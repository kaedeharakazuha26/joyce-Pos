use crate::cmds::common::*;
use crate::db::Db;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tauri::State;

pub fn sale_detail(c: &Connection, id: i64) -> R<Value> {
    let mut s = rows(c, "SELECT * FROM sales WHERE id=?", &[&id])?;
    let mut sale = s.pop().ok_or("Sale not found")?;
    sale["items"] = Value::Array(rows(c, "SELECT * FROM sale_items WHERE sale_id=?", &[&id])?);
    Ok(sale)
}

#[tauri::command]
pub fn create_sale(db: State<Db>, items: Vec<Value>, paid: f64) -> R<Value> {
    let mut c = db.0.lock().map_err(e)?;
    let tx = c.transaction().map_err(e)?;
    if items.is_empty() {
        return Err("Cart is empty".into());
    }
    let (shift_id, biz_date, receipt_prefix) = match get_active_shift(&tx) {
        Some((sid, bdate)) => {
            let clean = bdate.replace("-", "");
            (Some(sid), bdate, clean)
        }
        None => {
            (
                None,
                chrono::Local::now().format("%Y-%m-%d").to_string(),
                chrono::Local::now().format("%Y%m%d").to_string(),
            )
        }
    };
    let n: i64 = tx
        .query_row("SELECT COUNT(*) FROM sales WHERE date(created_at)=?1", [&biz_date], |r| r.get(0))
        .map_err(e)?;
    let receipt = format!("JP-{}-{:04}", receipt_prefix, n + 1);
    let created_at = format!("{} {}", biz_date, chrono::Local::now().format("%H:%M:%S"));
    tx.execute(
        "INSERT INTO sales(receipt_no,total,paid,change_amt,status,created_at,shift_id) VALUES(?,0,0,0,'completed',?,?)",
        params![receipt, created_at, shift_id],
    )
    .map_err(e)?;
    let sid = tx.last_insert_rowid();
    let mut total = 0.0;
    for it in &items {
        let pid = it["product_id"].as_i64().ok_or("Invalid product")?;
        let qty = it["quantity"].as_i64().unwrap_or(0);
        if qty <= 0 {
            return Err("Invalid quantity".into());
        }
        let (name, price, cost): (String, f64, f64) = tx
            .query_row("SELECT name,price,cost FROM products WHERE id=?", [pid], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
            .map_err(e)?;
        let (vid, vname, per, unit_price): (Option<i64>, String, i64, f64) =
            match it.get("variant_id").and_then(|x| x.as_i64()) {
                Some(v) => {
                    let (n, q, p): (String, i64, f64) = tx
                        .query_row("SELECT name,qty,price FROM variants WHERE id=? AND product_id=?", params![v, pid], |r| {
                            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
                        })
                        .map_err(e)?;
                    (Some(v), n, q, p)
                }
                None => (None, String::new(), 1, price),
            };
        let units = per * qty;
        // Allow 0 stock sales: deduct units directly without blocking checkout
        tx.execute("UPDATE products SET stock=stock-? WHERE id=?", params![units, pid]).map_err(e)?;
        let sub = unit_price * qty as f64;
        total += sub;
        tx.execute(
            "INSERT INTO sale_items(sale_id,product_id,variant_id,name,variant_name,units_per,unit_price,quantity,subtotal,cost_total) VALUES(?,?,?,?,?,?,?,?,?,?)",
            params![sid, pid, vid, name, vname, per, unit_price, qty, sub, cost * units as f64],
        )
        .map_err(e)?;
    }
    let total = r2(total);
    if paid + 1e-9 < total {
        return Err("Payment is less than the total".into());
    }
    tx.execute("UPDATE sales SET total=?,paid=?,change_amt=? WHERE id=?", params![total, paid, r2(paid - total), sid]).map_err(e)?;
    log_audit(
        &tx,
        "Cashier",
        "cashier",
        "SALE",
        "sale",
        &receipt,
        &format!("Completed sale {} for ₱{:.2} ({} line items)", receipt, total, items.len()),
        json!({ "sale_id": sid, "receipt_no": receipt, "total": total, "paid": paid, "change": r2(paid - total) }),
    );
    tx.commit().map_err(e)?;
    sale_detail(&c, sid)
}

#[tauri::command]
pub fn list_sales(db: State<Db>, from: String, to: String, status: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    let mut list = rows(
        &c,
        r#"
        SELECT *,
               COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(created_at)) AS business_date
        FROM sales
        WHERE COALESCE((SELECT business_date FROM shifts WHERE id=sales.shift_id), date(created_at)) BETWEEN ?1 AND ?2
          AND (?3='' OR status=?3)
        ORDER BY id DESC LIMIT 1000
        "#,
        &[&from, &to, &status],
    )?;
    for s in list.iter_mut() {
        let id = s["id"].as_i64().unwrap_or(0);
        s["items"] = Value::Array(rows(&c, "SELECT * FROM sale_items WHERE sale_id=?", &[&id])?);
    }
    Ok(list)
}

/// Voids a sale: returns every item to inventory and stores a permanent record in `voided_sales`.
#[tauri::command]
pub fn void_sale(db: State<Db>, id: i64, reason: String, voided_by: Option<String>) -> R<()> {
    let mut c = db.0.lock().map_err(e)?;
    let tx = c.transaction().map_err(e)?;
    let sale = sale_detail(&tx, id)?;
    if sale["status"] != "completed" {
        return Err("This sale is already voided".into());
    }
    for it in sale["items"].as_array().cloned().unwrap_or_default() {
        let units = it["units_per"].as_i64().unwrap_or(1) * it["quantity"].as_i64().unwrap_or(0);
        tx.execute("UPDATE products SET stock=stock+? WHERE id=?", params![units, it["product_id"].as_i64()]).map_err(e)?;
    }
    let ts = business_now(&tx);
    let who = voided_by.unwrap_or_else(|| "Administrator".into());
    let receipt_no = sale["receipt_no"].as_str().unwrap_or("").to_string();
    let total_amt = sale["total"].as_f64().unwrap_or(0.0);
    let active_sid = get_active_shift(&tx).map(|(sid, _)| sid);
    let sale_sid = sale.get("shift_id").and_then(|x| x.as_i64());
    let shift_id = active_sid.or(sale_sid);

    tx.execute("UPDATE sales SET status='voided',voided_at=?,void_reason=?,voided_by=? WHERE id=?", params![ts, reason, who, id]).map_err(e)?;
    tx.execute(
        "INSERT INTO voided_sales(sale_id,receipt_no,total,reason,items_json,sold_at,voided_at,voided_by,shift_id) VALUES(?,?,?,?,?,?,?,?,?)",
        params![id, receipt_no, total_amt, reason, sale["items"].to_string(), sale["created_at"].as_str(), ts, who, shift_id],
    )
    .map_err(e)?;
    log_audit(
        &tx,
        &who,
        "admin",
        "VOID",
        "sale",
        &receipt_no,
        &format!("Voided receipt {} (₱{:.2}) — Reason: {}", receipt_no, total_amt, if reason.is_empty() { "None specified" } else { &reason }),
        json!({ "sale_id": id, "receipt_no": receipt_no, "total": total_amt, "reason": reason, "voided_by": who, "shift_id": shift_id }),
    );
    tx.commit().map_err(e)
}

#[tauri::command]
pub fn list_voided(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    let sql = r#"
        SELECT *,
               COALESCE((SELECT business_date FROM shifts WHERE id=voided_sales.shift_id), (SELECT business_date FROM shifts s JOIN sales sl ON sl.shift_id=s.id WHERE sl.id=voided_sales.sale_id), date(voided_at)) AS business_date
        FROM voided_sales
        WHERE COALESCE((SELECT business_date FROM shifts WHERE id=voided_sales.shift_id), (SELECT business_date FROM shifts s JOIN sales sl ON sl.shift_id=s.id WHERE sl.id=voided_sales.sale_id), date(voided_at)) BETWEEN ?1 AND ?2
        ORDER BY id DESC
    "#;
    let mut list = rows(&c, sql, &[&from, &to])?;
    for v in list.iter_mut() {
        let items: Value = serde_json::from_str(v["items_json"].as_str().unwrap_or("[]")).unwrap_or(json!([]));
        v["items"] = items;
    }
    Ok(list)
}
