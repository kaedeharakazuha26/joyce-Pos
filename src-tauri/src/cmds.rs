use crate::db::Db;
use crate::printer;
use rusqlite::{params, types::ValueRef, Connection, OpenFlags, OptionalExtension, ToSql};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use tauri::State;

pub type R<T> = Result<T, String>;
pub fn e<E: ToString>(x: E) -> String {
    x.to_string()
}

fn now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn get_active_shift(c: &Connection) -> Option<(i64, String)> {
    c.query_row(
        "SELECT id, business_date FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).ok()
}

pub fn active_business_date(c: &Connection) -> String {
    get_active_shift(c).map(|(_, d)| d).unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string())
}

pub fn business_now(c: &Connection) -> String {
    let bdate = active_business_date(c);
    let time = chrono::Local::now().format("%H:%M:%S");
    format!("{} {}", bdate, time)
}

fn num(v: &Value, k: &str) -> f64 {
    v.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0)
}
fn text(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").trim().to_string()
}
fn r2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

/// Runs a query and returns each row as a JSON object keyed by column name.
pub fn rows(c: &Connection, sql: &str, p: &[&dyn ToSql]) -> R<Vec<Value>> {
    let mut st = c.prepare(sql).map_err(e)?;
    let names: Vec<String> = st.column_names().iter().map(|s| s.to_string()).collect();
    let it = st
        .query_map(p, |r| {
            let mut m = Map::new();
            for (i, n) in names.iter().enumerate() {
                let v = match r.get_ref(i)? {
                    ValueRef::Null | ValueRef::Blob(_) => Value::Null,
                    ValueRef::Integer(x) => json!(x),
                    ValueRef::Real(x) => json!(x),
                    ValueRef::Text(t) => json!(String::from_utf8_lossy(t)),
                };
                m.insert(n.clone(), v);
            }
            Ok(Value::Object(m))
        })
        .map_err(e)?;
    it.collect::<Result<Vec<_>, _>>().map_err(e)
}

fn scalar(c: &Connection, sql: &str, p: &[&dyn ToSql]) -> f64 {
    c.query_row(sql, p, |r| r.get::<_, f64>(0)).unwrap_or(0.0)
}

pub fn log_audit(
    c: &Connection,
    actor: &str,
    role: &str,
    action: &str,
    entity_type: &str,
    entity_id: &str,
    summary: &str,
    details: Value,
) {
    let ts = now();
    let actor_clean = if actor.trim().is_empty() { "Administrator" } else { actor.trim() };
    let role_clean = if role.trim().is_empty() { "admin" } else { role.trim() };
    let _ = c.execute(
        "INSERT INTO audit_logs(timestamp, actor, role, action, entity_type, entity_id, summary, details_json) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![ts, actor_clean, role_clean, action, entity_type, entity_id, summary, details.to_string()],
    );
}

// ───────────────────────── Products ─────────────────────────

pub fn products_with_variants(c: &Connection) -> R<Vec<Value>> {
    let mut ps = rows(c, "SELECT * FROM products WHERE active=1 ORDER BY name COLLATE NOCASE", &[])?;
    let vs = rows(c, "SELECT * FROM variants ORDER BY qty", &[])?;
    for p in ps.iter_mut() {
        let pid = p["id"].clone();
        let list: Vec<Value> = vs.iter().filter(|v| v["product_id"] == pid).cloned().collect();
        p["variants"] = Value::Array(list);
    }
    Ok(ps)
}

#[tauri::command]
pub fn list_products(db: State<Db>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    products_with_variants(&c)
}

#[tauri::command]
pub fn save_product(db: State<Db>, product: Value) -> R<i64> {
    let mut c = db.0.lock().map_err(e)?;
    let tx = c.transaction().map_err(e)?;
    let name = text(&product, "name");
    if name.is_empty() {
        return Err("Product name is required".into());
    }
    let price = num(&product, "price");
    let cost = num(&product, "cost");
    if price < 0.0 || cost < 0.0 {
        return Err("Price and cost cannot be negative".into());
    }
    let actor = text(&product, "actor");
    let role = text(&product, "actor_role");
    let (id, is_update, before_val) = match product.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            let prev = rows(&tx, "SELECT id, name, category, price, cost, stock, low_stock, barcode FROM products WHERE id=?", &[&id])
                .ok()
                .and_then(|mut r| r.pop())
                .unwrap_or(json!(null));
            if let Some(stock_override) = product.get("stock").and_then(|x| x.as_i64()) {
                tx.execute(
                    "UPDATE products SET name=?,barcode=?,category=?,price=?,cost=?,stock=?,low_stock=?,image=? WHERE id=?",
                    params![name, text(&product, "barcode"), text(&product, "category"), price, cost, stock_override, num(&product, "low_stock") as i64, text(&product, "image"), id],
                )
                .map_err(e)?;
            } else {
                tx.execute(
                    "UPDATE products SET name=?,barcode=?,category=?,price=?,cost=?,low_stock=?,image=? WHERE id=?",
                    params![name, text(&product, "barcode"), text(&product, "category"), price, cost, num(&product, "low_stock") as i64, text(&product, "image"), id],
                )
                .map_err(e)?;
            }
            (id, true, prev)
        }
        None => {
            tx.execute(
                "INSERT INTO products(name,barcode,category,price,cost,stock,low_stock,image,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                params![name, text(&product, "barcode"), text(&product, "category"), price, cost, num(&product, "stock") as i64, num(&product, "low_stock") as i64, text(&product, "image"), now()],
            )
            .map_err(e)?;
            (tx.last_insert_rowid(), false, json!(null))
        }
    };
    tx.execute("DELETE FROM variants WHERE product_id=?", [id]).map_err(e)?;
    for v in product["variants"].as_array().cloned().unwrap_or_default() {
        let qty = num(&v, "qty") as i64;
        let vname = text(&v, "name");
        if qty > 0 && !vname.is_empty() {
            tx.execute(
                "INSERT INTO variants(product_id,name,qty,price) VALUES(?,?,?,?)",
                params![id, vname, qty, num(&v, "price")],
            )
            .map_err(e)?;
        }
    }
    log_audit(
        &tx,
        &actor,
        &role,
        if is_update { "UPDATE" } else { "CREATE" },
        "product",
        &id.to_string(),
        &format!("{} product '{}' (Price: ₱{:.2}, Cost: ₱{:.2})", if is_update { "Updated" } else { "Created" }, name, price, cost),
        json!({
            "before": before_val,
            "after": {
                "id": id,
                "name": name,
                "category": text(&product, "category"),
                "price": price,
                "cost": cost,
                "barcode": text(&product, "barcode")
            }
        }),
    );
    tx.commit().map_err(e)?;
    Ok(id)
}

#[tauri::command]
pub fn delete_product(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let prev = rows(&c, "SELECT id, name, category, price, cost, stock FROM products WHERE id=?", &[&id])
        .ok()
        .and_then(|mut r| r.pop())
        .unwrap_or(json!({"id": id}));
    let pname = prev.get("name").and_then(|x| x.as_str()).unwrap_or("Product").to_string();
    c.execute("UPDATE products SET active=0 WHERE id=?", [id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "ARCHIVE",
        "product",
        &id.to_string(),
        &format!("Archived product '{}' (soft-deleted, historical sales preserved)", pname),
        json!({ "archived": prev }),
    );
    Ok(())
}

// ───────────────────────── Sales ─────────────────────────

fn sale_detail(c: &Connection, id: i64) -> R<Value> {
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
        let (name, price, cost, stock): (String, f64, f64, i64) = tx
            .query_row("SELECT name,price,cost,stock FROM products WHERE id=?", [pid], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
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
        if stock < units {
            return Err(format!("Not enough stock for {} (have {}, need {})", name, stock, units));
        }
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
        "SELECT * FROM sales WHERE date(created_at) BETWEEN ?1 AND ?2 AND (?3='' OR status=?3) ORDER BY id DESC LIMIT 1000",
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
    tx.execute("UPDATE sales SET status='voided',voided_at=?,void_reason=?,voided_by=? WHERE id=?", params![ts, reason, who, id]).map_err(e)?;
    tx.execute(
        "INSERT INTO voided_sales(sale_id,receipt_no,total,reason,items_json,sold_at,voided_at,voided_by) VALUES(?,?,?,?,?,?,?,?)",
        params![id, receipt_no, total_amt, reason, sale["items"].to_string(), sale["created_at"].as_str(), ts, who],
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
        json!({ "sale_id": id, "receipt_no": receipt_no, "total": total_amt, "reason": reason, "voided_by": who }),
    );
    tx.commit().map_err(e)
}

#[tauri::command]
pub fn list_voided(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    let mut list = rows(&c, "SELECT * FROM voided_sales WHERE date(voided_at) BETWEEN ?1 AND ?2 ORDER BY id DESC", &[&from, &to])?;
    for v in list.iter_mut() {
        let items: Value = serde_json::from_str(v["items_json"].as_str().unwrap_or("[]")).unwrap_or(json!([]));
        v["items"] = items;
    }
    Ok(list)
}

// ───────────────────────── Inventory ─────────────────────────

#[tauri::command]
pub fn restock(db: State<Db>, product_id: i64, qty: i64, unit_cost: f64, note: String) -> R<()> {
    if qty <= 0 {
        return Err("Quantity must be greater than 0".into());
    }
    let mut c = db.0.lock().map_err(e)?;
    let tx = c.transaction().map_err(e)?;
    let (name, old_stock, old_cost): (String, i64, f64) = tx
        .query_row("SELECT name, stock, cost FROM products WHERE id=?", [product_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .map_err(e)?;
    tx.execute("UPDATE products SET stock=stock+? WHERE id=?", params![qty, product_id]).map_err(e)?;
    if unit_cost > 0.0 {
        tx.execute("UPDATE products SET cost=? WHERE id=?", params![unit_cost, product_id]).map_err(e)?;
    }
    let created_at = business_now(&tx);
    tx.execute(
        "INSERT INTO restocks(product_id,product_name,qty,unit_cost,note,created_at) VALUES(?,?,?,?,?,?)",
        params![product_id, name, qty, unit_cost, note, created_at],
    )
    .map_err(e)?;
    let rid = tx.last_insert_rowid();
    log_audit(
        &tx,
        "Administrator",
        "admin",
        "RESTOCK",
        "inventory",
        &rid.to_string(),
        &format!("Restocked '{}' +{} units (Stock: {} → {})", name, qty, old_stock, old_stock + qty),
        json!({
            "product_id": product_id,
            "product_name": name,
            "qty_added": qty,
            "old_stock": old_stock,
            "new_stock": old_stock + qty,
            "old_cost": old_cost,
            "unit_cost": if unit_cost > 0.0 { unit_cost } else { old_cost },
            "note": note
        }),
    );
    tx.commit().map_err(e)
}

#[tauri::command]
pub fn list_restocks(db: State<Db>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM restocks ORDER BY id DESC LIMIT 300", &[])
}

// ───────────────────────── Expenses & Salaries ─────────────────────────

#[tauri::command]
pub fn list_expenses(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM expenses WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC, id DESC", &[&from, &to])
}

#[tauri::command]
pub fn save_expense(db: State<Db>, expense: Value) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let amt = num(&expense, "amount");
    if amt <= 0.0 {
        return Err("Amount must be greater than 0".into());
    }
    let raw_date = text(&expense, "date");
    let date = if raw_date.is_empty() { active_business_date(&c) } else { raw_date };
    let shift_id = get_active_shift(&c).map(|(sid, _)| sid);
    let raw_cat = text(&expense, "category");
    let cat = if raw_cat.is_empty() { "General".to_string() } else { raw_cat };
    let desc = text(&expense, "description");
    let actor = text(&expense, "actor");
    let role = text(&expense, "actor_role");
    match expense.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            let prev = rows(&c, "SELECT * FROM expenses WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!(null));
            c.execute("UPDATE expenses SET category=?,description=?,amount=?,date=? WHERE id=?", params![cat, desc, amt, date, id]).map_err(e)?;
            log_audit(
                &c,
                &actor,
                &role,
                "UPDATE",
                "expense",
                &id.to_string(),
                &format!("Updated expense #{} [{}] — ₱{:.2} ({})", id, cat, amt, date),
                json!({ "before": prev, "after": { "id": id, "category": cat, "description": desc, "amount": amt, "date": date } }),
            );
        }
        None => {
            c.execute("INSERT INTO expenses(category,description,amount,date,shift_id) VALUES(?,?,?,?,?)", params![cat, desc, amt, date, shift_id]).map_err(e)?;
            let id = c.last_insert_rowid();
            log_audit(
                &c,
                &actor,
                &role,
                "CREATE",
                "expense",
                &id.to_string(),
                &format!("Recorded expense [{}] — ₱{:.2} ({})", cat, amt, if desc.is_empty() { &date } else { &desc }),
                json!({ "id": id, "category": cat, "description": desc, "amount": amt, "date": date }),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_expense(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let prev = rows(&c, "SELECT * FROM expenses WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!({"id": id}));
    let cat = prev.get("category").and_then(|x| x.as_str()).unwrap_or("General");
    let amt = prev.get("amount").and_then(|x| x.as_f64()).unwrap_or(0.0);
    c.execute("DELETE FROM expenses WHERE id=?", [id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "DELETE",
        "expense",
        &id.to_string(),
        &format!("Deleted expense #{} [{}] (₱{:.2})", id, cat, amt),
        json!({ "deleted": prev }),
    );
    Ok(())
}

#[tauri::command]
pub fn list_salaries(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM salaries WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC, id DESC", &[&from, &to])
}

#[tauri::command]
pub fn save_salary(db: State<Db>, salary: Value) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let emp = text(&salary, "employee");
    let amt = num(&salary, "amount");
    if emp.is_empty() || amt <= 0.0 {
        return Err("Employee and amount are required".into());
    }
    let raw_date = text(&salary, "date");
    let date = if raw_date.is_empty() { active_business_date(&c) } else { raw_date };
    let shift_id = get_active_shift(&c).map(|(sid, _)| sid);
    let period = text(&salary, "period");
    let note = text(&salary, "note");
    let actor = text(&salary, "actor");
    let role = text(&salary, "actor_role");
    match salary.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            let prev = rows(&c, "SELECT * FROM salaries WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!(null));
            c.execute(
                "UPDATE salaries SET employee=?,amount=?,period=?,date=?,note=? WHERE id=?",
                params![emp, amt, period, date, note, id],
            ).map_err(e)?;
            log_audit(
                &c,
                &actor,
                &role,
                "UPDATE",
                "salary",
                &id.to_string(),
                &format!("Updated salary record #{} for '{}' — ₱{:.2} ({})", id, emp, amt, date),
                json!({ "before": prev, "after": { "id": id, "employee": emp, "amount": amt, "period": period, "date": date, "note": note } }),
            );
        }
        None => {
            c.execute(
                "INSERT INTO salaries(employee,amount,period,date,note,shift_id) VALUES(?,?,?,?,?,?)",
                params![emp, amt, period, date, note, shift_id],
            ).map_err(e)?;
            let id = c.last_insert_rowid();
            log_audit(
                &c,
                &actor,
                &role,
                "CREATE",
                "salary",
                &id.to_string(),
                &format!("Recorded salary payout for '{}' — ₱{:.2} ({})", emp, amt, date),
                json!({ "id": id, "employee": emp, "amount": amt, "period": period, "date": date, "note": note }),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_salary(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let prev = rows(&c, "SELECT * FROM salaries WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!({"id": id}));
    let emp = prev.get("employee").and_then(|x| x.as_str()).unwrap_or("Employee");
    let amt = prev.get("amount").and_then(|x| x.as_f64()).unwrap_or(0.0);
    c.execute("DELETE FROM salaries WHERE id=?", [id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "DELETE",
        "salary",
        &id.to_string(),
        &format!("Deleted salary record #{} for '{}' (₱{:.2})", id, emp, amt),
        json!({ "deleted": prev }),
    );
    Ok(())
}

// ───────────────────────── Commissions ─────────────────────────

fn comm_args(c: &Connection, v: &Value, with_type: bool) -> R<(String, Option<i64>, String, String, f64)> {
    let name = text(v, "employee_name");
    if name.is_empty() {
        return Err("Select an employee".into());
    }
    let ty = text(v, "type");
    if with_type && ty.is_empty() {
        return Err("Select a commission type".into());
    }
    if num(v, "amount") <= 0.0 {
        return Err("Amount must be greater than 0".into());
    }
    let raw_date = text(v, "date");
    let date = if raw_date.is_empty() { active_business_date(c) } else { raw_date };
    Ok((date, v.get("employee_id").and_then(|x| x.as_i64()), name, ty, num(v, "amount")))
}

#[tauri::command]
pub fn list_commissions(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM commissions WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC, id DESC", &[&from, &to])
}

#[tauri::command]
pub fn save_commission(db: State<Db>, commission: Value) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let (date, eid, name, ty, amt) = comm_args(&c, &commission, true)?;
    let shift_id = get_active_shift(&c).map(|(sid, _)| sid);
    let actor = text(&commission, "actor");
    let role = text(&commission, "actor_role");
    match commission.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            let prev = rows(&c, "SELECT * FROM commissions WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!(null));
            c.execute("UPDATE commissions SET date=?,employee_id=?,employee_name=?,type=?,amount=? WHERE id=?", params![date, eid, name, ty, amt, id]).map_err(e)?;
            log_audit(
                &c,
                &actor,
                &role,
                "UPDATE",
                "commission",
                &id.to_string(),
                &format!("Updated commission #{} for '{}' [{}] — ₱{:.2}", id, name, ty, amt),
                json!({ "before": prev, "after": { "id": id, "date": date, "employee_id": eid, "employee_name": name, "type": ty, "amount": amt } }),
            );
        }
        None => {
            c.execute("INSERT INTO commissions(date,employee_id,employee_name,type,amount,shift_id) VALUES(?,?,?,?,?,?)", params![date, eid, name, ty, amt, shift_id]).map_err(e)?;
            let id = c.last_insert_rowid();
            log_audit(
                &c,
                &actor,
                &role,
                "CREATE",
                "commission",
                &id.to_string(),
                &format!("Recorded commission for '{}' [{}] — ₱{:.2} ({})", name, ty, amt, date),
                json!({ "id": id, "date": date, "employee_id": eid, "employee_name": name, "type": ty, "amount": amt }),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_commission(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let prev = rows(&c, "SELECT * FROM commissions WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!({"id": id}));
    let emp = prev.get("employee_name").and_then(|x| x.as_str()).unwrap_or("Employee");
    let amt = prev.get("amount").and_then(|x| x.as_f64()).unwrap_or(0.0);
    c.execute("DELETE FROM commissions WHERE id=?", [id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "DELETE",
        "commission",
        &id.to_string(),
        &format!("Deleted commission #{} for '{}' (₱{:.2})", id, emp, amt),
        json!({ "deleted": prev }),
    );
    Ok(())
}

#[tauri::command]
pub fn list_commission_types(db: State<Db>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM commission_types ORDER BY name COLLATE NOCASE", &[])
}

#[tauri::command]
pub fn add_commission_type(db: State<Db>, name: String) -> R<()> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Type name is required".into());
    }
    let c = db.0.lock().map_err(e)?;
    c.execute("INSERT OR IGNORE INTO commission_types(name) VALUES(?)", [&name]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "CREATE",
        "commission_type",
        &name,
        &format!("Added commission type '{}'", name),
        json!({ "name": name }),
    );
    Ok(())
}

#[tauri::command]
pub fn list_ld_commissions(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM ld_commissions WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC, id DESC", &[&from, &to])
}

#[tauri::command]
pub fn save_ld_commission(db: State<Db>, commission: Value) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let (date, eid, name, _, amt) = comm_args(&c, &commission, false)?;
    let shift_id = get_active_shift(&c).map(|(sid, _)| sid);
    let qty = commission.get("quantity").and_then(|x| x.as_i64()).unwrap_or(1).max(1);
    let actor = text(&commission, "actor");
    let role = text(&commission, "actor_role");
    match commission.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            let prev = rows(&c, "SELECT * FROM ld_commissions WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!(null));
            c.execute(
                "UPDATE ld_commissions SET date=?,employee_id=?,employee_name=?,quantity=?,amount=? WHERE id=?",
                params![date, eid, name, qty, amt, id],
            ).map_err(e)?;
            log_audit(
                &c,
                &actor,
                &role,
                "UPDATE",
                "ld_commission",
                &id.to_string(),
                &format!("Updated LD commission #{} for '{}' (Qty: {}, ₱{:.2})", id, name, qty, amt),
                json!({ "before": prev, "after": { "id": id, "date": date, "employee_id": eid, "employee_name": name, "quantity": qty, "amount": amt } }),
            );
        }
        None => {
            c.execute(
                "INSERT INTO ld_commissions(date,employee_id,employee_name,quantity,amount,shift_id) VALUES(?,?,?,?,?,?)",
                params![date, eid, name, qty, amt, shift_id],
            ).map_err(e)?;
            let id = c.last_insert_rowid();
            log_audit(
                &c,
                &actor,
                &role,
                "CREATE",
                "ld_commission",
                &id.to_string(),
                &format!("Recorded LD commission for '{}' (Qty: {}, ₱{:.2})", name, qty, amt),
                json!({ "id": id, "date": date, "employee_id": eid, "employee_name": name, "quantity": qty, "amount": amt }),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_ld_commission(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let prev = rows(&c, "SELECT * FROM ld_commissions WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!({"id": id}));
    let emp = prev.get("employee_name").and_then(|x| x.as_str()).unwrap_or("Employee");
    let amt = prev.get("amount").and_then(|x| x.as_f64()).unwrap_or(0.0);
    c.execute("DELETE FROM ld_commissions WHERE id=?", [id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "DELETE",
        "ld_commission",
        &id.to_string(),
        &format!("Deleted LD commission #{} for '{}' (₱{:.2})", id, emp, amt),
        json!({ "deleted": prev }),
    );
    Ok(())
}

// ───────────────────────── Employees ─────────────────────────

#[tauri::command]
pub fn list_employees(db: State<Db>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM employees WHERE active=1 ORDER BY name COLLATE NOCASE", &[])
}

#[tauri::command]
pub fn save_employee(db: State<Db>, employee: Value) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let name = text(&employee, "name");
    if name.is_empty() {
        return Err("Employee name is required".into());
    }
    let (pos, com, ld, sal) = (text(&employee, "position"), num(&employee, "commission"), num(&employee, "ld_commission"), num(&employee, "salary"));
    let actor = text(&employee, "actor");
    let role = text(&employee, "actor_role");
    match employee.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            let prev = rows(&c, "SELECT * FROM employees WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!(null));
            c.execute(
                "UPDATE employees SET name=?,position=?,commission=?,ld_commission=?,salary=? WHERE id=?",
                params![name, pos, com, ld, sal, id],
            ).map_err(e)?;
            log_audit(
                &c,
                &actor,
                &role,
                "UPDATE",
                "employee",
                &id.to_string(),
                &format!("Updated employee '{}' ({})", name, if pos.is_empty() { "Staff" } else { &pos }),
                json!({ "before": prev, "after": { "id": id, "name": name, "position": pos, "commission": com, "ld_commission": ld, "salary": sal } }),
            );
        }
        None => {
            c.execute(
                "INSERT INTO employees(name,position,commission,ld_commission,salary,created_at) VALUES(?,?,?,?,?,?)",
                params![name, pos, com, ld, sal, now()],
            ).map_err(e)?;
            let id = c.last_insert_rowid();
            log_audit(
                &c,
                &actor,
                &role,
                "CREATE",
                "employee",
                &id.to_string(),
                &format!("Added employee '{}' ({})", name, if pos.is_empty() { "Staff" } else { &pos }),
                json!({ "id": id, "name": name, "position": pos, "commission": com, "ld_commission": ld, "salary": sal }),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_employee(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let prev = rows(&c, "SELECT * FROM employees WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!({"id": id}));
    let ename = prev.get("name").and_then(|x| x.as_str()).unwrap_or("Employee");
    c.execute("UPDATE employees SET active=0 WHERE id=?", [id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "ARCHIVE",
        "employee",
        &id.to_string(),
        &format!("Archived employee '{}' (historical payroll records preserved)", ename),
        json!({ "archived": prev }),
    );
    Ok(())
}

// ───────────────────────── Dashboard ─────────────────────────

#[tauri::command]
pub fn dashboard(db: State<Db>, from: String, to: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let p: &[&dyn ToSql] = &[&from, &to];
    let range = "status='completed' AND date(created_at) BETWEEN ?1 AND ?2";
    let revenue = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), p);
    let count = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), p);
    let cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), p);
    let voided = scalar(&c, "SELECT COALESCE(SUM(total),0) FROM voided_sales WHERE date(voided_at) BETWEEN ?1 AND ?2", p);
    let voided_n = scalar(&c, "SELECT COUNT(*) FROM voided_sales WHERE date(voided_at) BETWEEN ?1 AND ?2", p);
    let expenses = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date BETWEEN ?1 AND ?2", p);
    let salaries = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM salaries WHERE date BETWEEN ?1 AND ?2", p);
    let commissions = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM commissions WHERE date BETWEEN ?1 AND ?2", p);
    let ld_commissions = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE date BETWEEN ?1 AND ?2", p);
    let gross = revenue - cogs;
    let net = gross - expenses - salaries - commissions - ld_commissions;

    let top_employees = rows(
        &c,
        r#"
        SELECT employee_name,
               ROUND(SUM(amount), 2) AS total,
               ROUND(SUM(CASE WHEN src='salary' THEN amount ELSE 0 END), 2) AS salary,
               ROUND(SUM(CASE WHEN src='commission' THEN amount ELSE 0 END), 2) AS commission,
               ROUND(SUM(CASE WHEN src='ld' THEN amount ELSE 0 END), 2) AS ld_commission
        FROM (
            SELECT employee AS employee_name, amount, 'salary' AS src FROM salaries WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT employee_name, amount, 'commission' AS src FROM commissions WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT employee_name, amount, 'ld' AS src FROM ld_commissions WHERE date BETWEEN ?1 AND ?2
        )
        WHERE employee_name != ''
        GROUP BY employee_name
        ORDER BY total DESC
        LIMIT 10
        "#,
        p,
    )?;

    let daily = rows(
        &c,
        r#"
        SELECT day,
               ROUND(SUM(sales), 2) AS total,
               SUM(order_count) AS count,
               ROUND(SUM(expenses), 2) AS expenses,
               ROUND(SUM(salaries), 2) AS salaries,
               ROUND(SUM(commissions), 2) AS commissions,
               ROUND(SUM(ld_commissions), 2) AS ld_commissions,
               ROUND(SUM(sales - expenses - salaries - commissions - ld_commissions), 2) AS net
        FROM (
            SELECT date(created_at) AS day, total AS sales, 1 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
            FROM sales WHERE status='completed' AND date(created_at) BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, amount AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
            FROM expenses WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, amount AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
            FROM salaries WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, amount AS commissions, 0.0 AS ld_commissions
            FROM commissions WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, amount AS ld_commissions
            FROM ld_commissions WHERE date BETWEEN ?1 AND ?2
        )
        WHERE day IS NOT NULL AND day != ''
        GROUP BY day
        ORDER BY day ASC
        "#,
        p,
    )?;

    Ok(json!({
        "revenue": r2(revenue), "orders": count, "cogs": r2(cogs), "gross_profit": r2(gross),
        "voided_total": r2(voided), "voided_count": voided_n,
        "expenses": r2(expenses), "salaries": r2(salaries),
        "commissions": r2(commissions), "ld_commissions": r2(ld_commissions),
        "net_profit": r2(net),
        "top_employees": top_employees,
        "inventory_cost": r2(scalar(&c, "SELECT COALESCE(SUM(stock*cost),0) FROM products WHERE active=1", &[])),
        "inventory_retail": r2(scalar(&c, "SELECT COALESCE(SUM(stock*price),0) FROM products WHERE active=1", &[])),
        "daily": daily,
        "top": rows(&c, &format!("SELECT name, SUM(units_per*quantity) AS units, SUM(subtotal) AS revenue FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range}) GROUP BY product_id ORDER BY revenue DESC LIMIT 8"), p)?,
        "low_stock": rows(&c, "SELECT id,name,stock,low_stock FROM products WHERE active=1 AND stock<=low_stock ORDER BY stock LIMIT 10", &[])?,
    }))
}

pub fn build_activity_feed(c: &Connection, from: &str, to: &str, limit: i64) -> R<Vec<Value>> {
    let p: &[&dyn ToSql] = &[&from, &to, &limit];
    rows(
        c,
        r#"
        SELECT * FROM (
            SELECT
                'audit-' || id AS uid,
                timestamp,
                actor,
                role,
                action,
                entity_type,
                entity_id,
                summary,
                details_json
            FROM audit_logs
            WHERE date(timestamp) BETWEEN ?1 AND ?2

            UNION ALL

            SELECT
                'sale-' || id AS uid,
                created_at AS timestamp,
                'Cashier' AS actor,
                'cashier' AS role,
                'SALE' AS action,
                'sale' AS entity_type,
                receipt_no AS entity_id,
                'Completed sale ' || receipt_no || ' — ₱' || printf('%.2f', total) AS summary,
                '{}' AS details_json
            FROM sales
            WHERE status='completed'
              AND date(created_at) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='sale' AND a.action='SALE' AND a.entity_id=sales.receipt_no)

            UNION ALL

            SELECT
                'void-' || id AS uid,
                voided_at AS timestamp,
                CASE WHEN voided_by != '' THEN voided_by ELSE 'Administrator' END AS actor,
                'admin' AS role,
                'VOID' AS action,
                'sale' AS entity_type,
                receipt_no AS entity_id,
                'Voided receipt ' || receipt_no || ' (₱' || printf('%.2f', total) || ')' || CASE WHEN reason != '' THEN ' — ' || reason ELSE '' END AS summary,
                '{}' AS details_json
            FROM voided_sales
            WHERE date(voided_at) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='sale' AND a.action='VOID' AND a.entity_id=voided_sales.receipt_no)

            UNION ALL

            SELECT
                'restock-' || id AS uid,
                created_at AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'RESTOCK' AS action,
                'inventory' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Restocked ' || product_name || ' (+' || qty || ' units)' || CASE WHEN note != '' THEN ' — ' || note ELSE '' END AS summary,
                '{}' AS details_json
            FROM restocks
            WHERE date(created_at) BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='inventory' AND a.action='RESTOCK' AND a.entity_id=CAST(restocks.id AS TEXT))

            UNION ALL

            SELECT
                'exp-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'EXPENSE' AS action,
                'expense' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Expense [' || CASE WHEN category != '' THEN category ELSE 'General' END || '] — ₱' || printf('%.2f', amount) || CASE WHEN description != '' THEN ' (' || description || ')' ELSE '' END AS summary,
                '{}' AS details_json
            FROM expenses
            WHERE date BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='expense' AND a.entity_id=CAST(expenses.id AS TEXT))

            UNION ALL

            SELECT
                'sal-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'PAYROLL' AS action,
                'salary' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Salary paid to ' || employee || ' — ₱' || printf('%.2f', amount) || CASE WHEN note != '' THEN ' (' || note || ')' ELSE '' END AS summary,
                '{}' AS details_json
            FROM salaries
            WHERE date BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='salary' AND a.entity_id=CAST(salaries.id AS TEXT))

            UNION ALL

            SELECT
                'com-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'COMMISSION' AS action,
                'commission' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'Commission (' || type || ') paid to ' || employee_name || ' — ₱' || printf('%.2f', amount) AS summary,
                '{}' AS details_json
            FROM commissions
            WHERE date BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='commission' AND a.entity_id=CAST(commissions.id AS TEXT))

            UNION ALL

            SELECT
                'ld-' || id AS uid,
                date || ' 12:00:00' AS timestamp,
                'Administrator' AS actor,
                'admin' AS role,
                'LD_COMMISSION' AS action,
                'ld_commission' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                'LD Commission paid to ' || employee_name || ' (Qty: ' || quantity || ') — ₱' || printf('%.2f', amount) AS summary,
                '{}' AS details_json
            FROM ld_commissions
            WHERE date BETWEEN ?1 AND ?2
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='ld_commission' AND a.entity_id=CAST(ld_commissions.id AS TEXT))

            UNION ALL

            SELECT
                'shift-' || id AS uid,
                COALESCE(closed_at, opened_at) AS timestamp,
                CASE WHEN status='closed' AND closed_by != '' THEN closed_by WHEN opened_by != '' THEN opened_by ELSE 'Cashier' END AS actor,
                'cashier' AS role,
                CASE WHEN status='closed' THEN 'SHIFT_CLOSE' ELSE 'SHIFT_OPEN' END AS action,
                'shift' AS entity_type,
                CAST(id AS TEXT) AS entity_id,
                CASE WHEN status='closed'
                     THEN 'Closed Shift #' || id || ' (' || business_date || ') — Closing Cash: ₱' || printf('%.2f', closing_cash)
                     ELSE 'Opened Shift #' || id || ' (' || business_date || ') — Opening Float: ₱' || printf('%.2f', opening_cash)
                END AS summary,
                '{}' AS details_json
            FROM shifts
            WHERE (date(opened_at) BETWEEN ?1 AND ?2 OR date(business_date) BETWEEN ?1 AND ?2)
              AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_type='shift' AND a.entity_id=CAST(shifts.id AS TEXT))
        )
        ORDER BY timestamp DESC
        LIMIT ?3
        "#,
        p,
    )
}

#[tauri::command]
pub fn list_audit_logs(db: State<Db>, from: String, to: String, limit: Option<i64>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    build_activity_feed(&c, &from, &to, limit.unwrap_or(200))
}

#[tauri::command]
pub fn global_search(db: State<Db>, query: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let q = query.trim();
    if q.is_empty() {
        return Ok(json!({
            "products": [],
            "sales": [],
            "expenses": [],
            "salaries": [],
            "commissions": [],
            "ld_commissions": [],
            "employees": [],
            "shifts": []
        }));
    }
    let pattern = format!("%{}%", q);
    let p: &[&dyn ToSql] = &[&pattern];

    let products = rows(
        &c,
        "SELECT id, name, category, barcode, price, cost, stock, low_stock FROM products WHERE active=1 AND (name LIKE ?1 OR category LIKE ?1 OR barcode LIKE ?1) ORDER BY name LIMIT 12",
        p,
    )?;
    let sales = rows(
        &c,
        "SELECT id, receipt_no, total, paid, change_amt, status, created_at, void_reason, voided_by FROM sales WHERE receipt_no LIKE ?1 OR status LIKE ?1 OR void_reason LIKE ?1 ORDER BY id DESC LIMIT 12",
        p,
    )?;
    let expenses = rows(
        &c,
        "SELECT id, category, description, amount, date FROM expenses WHERE category LIKE ?1 OR description LIKE ?1 OR date LIKE ?1 ORDER BY date DESC, id DESC LIMIT 10",
        p,
    )?;
    let salaries = rows(
        &c,
        "SELECT id, employee, amount, period, date, note FROM salaries WHERE employee LIKE ?1 OR note LIKE ?1 OR date LIKE ?1 ORDER BY date DESC, id DESC LIMIT 10",
        p,
    )?;
    let commissions = rows(
        &c,
        "SELECT id, date, employee_id, employee_name, type, amount FROM commissions WHERE employee_name LIKE ?1 OR type LIKE ?1 OR date LIKE ?1 ORDER BY date DESC, id DESC LIMIT 10",
        p,
    )?;
    let ld_commissions = rows(
        &c,
        "SELECT id, date, employee_id, employee_name, quantity, amount FROM ld_commissions WHERE employee_name LIKE ?1 OR date LIKE ?1 ORDER BY date DESC, id DESC LIMIT 10",
        p,
    )?;
    let employees = rows(
        &c,
        "SELECT id, name, position, commission, ld_commission, salary FROM employees WHERE active=1 AND (name LIKE ?1 OR position LIKE ?1) ORDER BY name LIMIT 10",
        p,
    )?;
    let shifts = rows(
        &c,
        "SELECT id, business_date, status, opened_by, closed_by, opening_cash, expected_cash, closing_cash, notes FROM shifts WHERE business_date LIKE ?1 OR opened_by LIKE ?1 OR closed_by LIKE ?1 OR notes LIKE ?1 ORDER BY id DESC LIMIT 8",
        p,
    )?;

    Ok(json!({
        "products": products,
        "sales": sales,
        "expenses": expenses,
        "salaries": salaries,
        "commissions": commissions,
        "ld_commissions": ld_commissions,
        "employees": employees,
        "shifts": shifts
    }))
}

#[tauri::command]
pub fn admin_dashboard(db: State<Db>, from: String, to: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let p: &[&dyn ToSql] = &[&from, &to];
    let range = "status='completed' AND date(created_at) BETWEEN ?1 AND ?2";

    let revenue = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), p);
    let count = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), p);
    let cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), p);
    let voided = scalar(&c, "SELECT COALESCE(SUM(total),0) FROM voided_sales WHERE date(voided_at) BETWEEN ?1 AND ?2", p);
    let voided_n = scalar(&c, "SELECT COUNT(*) FROM voided_sales WHERE date(voided_at) BETWEEN ?1 AND ?2", p);
    let expenses = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date BETWEEN ?1 AND ?2", p);
    let salaries = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM salaries WHERE date BETWEEN ?1 AND ?2", p);
    let commissions = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM commissions WHERE date BETWEEN ?1 AND ?2", p);
    let ld_commissions = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE date BETWEEN ?1 AND ?2", p);

    let gross = revenue - cogs;
    let total_overheads = expenses + salaries + commissions + ld_commissions;
    let net = gross - total_overheads;
    let gross_margin = if revenue > 0.0 { r2((gross / revenue) * 100.0) } else { 0.0 };
    let net_margin = if revenue > 0.0 { r2((net / revenue) * 100.0) } else { 0.0 };
    let avg_ticket = if count > 0.0 { r2(revenue / count) } else { 0.0 };
    let void_rate = if (revenue + voided) > 0.0 { r2((voided / (revenue + voided)) * 100.0) } else { 0.0 };

    let inv_cost = scalar(&c, "SELECT COALESCE(SUM(stock*cost),0) FROM products WHERE active=1", &[]);
    let inv_retail = scalar(&c, "SELECT COALESCE(SUM(stock*price),0) FROM products WHERE active=1", &[]);

    // ── Previous Period Comparison ──
    let from_parsed = chrono::NaiveDate::parse_from_str(&from, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Local::now().date_naive());
    let to_parsed = chrono::NaiveDate::parse_from_str(&to, "%Y-%m-%d")
        .unwrap_or(from_parsed);
    let span_days = (to_parsed - from_parsed).num_days().max(0) + 1;
    let prev_to_date = from_parsed - chrono::Duration::days(1);
    let prev_from_date = prev_to_date - chrono::Duration::days(span_days - 1);
    let prev_from = prev_from_date.format("%Y-%m-%d").to_string();
    let prev_to = prev_to_date.format("%Y-%m-%d").to_string();
    let pp: &[&dyn ToSql] = &[&prev_from, &prev_to];

    let prev_revenue = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), pp);
    let prev_count = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), pp);
    let prev_cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), pp);
    let prev_voided = scalar(&c, "SELECT COALESCE(SUM(total),0) FROM voided_sales WHERE date(voided_at) BETWEEN ?1 AND ?2", pp);
    let prev_voided_n = scalar(&c, "SELECT COUNT(*) FROM voided_sales WHERE date(voided_at) BETWEEN ?1 AND ?2", pp);
    let prev_expenses = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date BETWEEN ?1 AND ?2", pp);
    let prev_salaries = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM salaries WHERE date BETWEEN ?1 AND ?2", pp);
    let prev_commissions = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM commissions WHERE date BETWEEN ?1 AND ?2", pp);
    let prev_ld_commissions = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE date BETWEEN ?1 AND ?2", pp);
    let prev_gross = prev_revenue - prev_cogs;
    let prev_overheads = prev_expenses + prev_salaries + prev_commissions + prev_ld_commissions;
    let prev_net = prev_gross - prev_overheads;
    let prev_avg_ticket = if prev_count > 0.0 { r2(prev_revenue / prev_count) } else { 0.0 };
    let prev_void_rate = if (prev_revenue + prev_voided) > 0.0 {
        r2((prev_voided / (prev_revenue + prev_voided)) * 100.0)
    } else {
        0.0
    };

    let prev_daily = rows(
        &c,
        r#"
        SELECT day,
               ROUND(SUM(sales), 2) AS sales,
               SUM(order_count) AS count,
               ROUND(SUM(expenses + salaries + commissions + ld_commissions), 2) AS overheads,
               ROUND(SUM(sales - expenses - salaries - commissions - ld_commissions), 2) AS net
        FROM (
            SELECT date(created_at) AS day, total AS sales, 1 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
            FROM sales WHERE status='completed' AND date(created_at) BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, amount AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
            FROM expenses WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, amount AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
            FROM salaries WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, amount AS commissions, 0.0 AS ld_commissions
            FROM commissions WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT date AS day, 0.0 AS sales, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, amount AS ld_commissions
            FROM ld_commissions WHERE date BETWEEN ?1 AND ?2
        )
        WHERE day IS NOT NULL AND day != ''
        GROUP BY day
        ORDER BY day ASC
        "#,
        pp,
    )?;

    // ── Today & Month-to-Date (MTD) Snapshot ──
    let today_date = active_business_date(&c);
    let tp: &[&dyn ToSql] = &[&today_date, &today_date];
    let today_rev = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), tp);
    let today_ord = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), tp);
    let today_cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), tp);
    let today_exp = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date BETWEEN ?1 AND ?2", tp);
    let today_sal = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM salaries WHERE date BETWEEN ?1 AND ?2", tp);
    let today_com = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM commissions WHERE date BETWEEN ?1 AND ?2", tp);
    let today_ld = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE date BETWEEN ?1 AND ?2", tp);
    let today_net = (today_rev - today_cogs) - (today_exp + today_sal + today_com + today_ld);
    let today_records = scalar(
        &c,
        r#"
        SELECT
            (SELECT COUNT(*) FROM sales WHERE date(created_at)=?1) +
            (SELECT COUNT(*) FROM expenses WHERE date=?1) +
            (SELECT COUNT(*) FROM salaries WHERE date=?1) +
            (SELECT COUNT(*) FROM commissions WHERE date=?1) +
            (SELECT COUNT(*) FROM ld_commissions WHERE date=?1) +
            (SELECT COUNT(*) FROM restocks WHERE date(created_at)=?1)
        "#,
        &[&today_date],
    );

    let now_local = chrono::Local::now().date_naive();
    let mtd_from = format!("{}-{:02}-01", now_local.format("%Y"), now_local.format("%m"));
    let mtd_to = now_local.format("%Y-%m-%d").to_string();
    let mp: &[&dyn ToSql] = &[&mtd_from, &mtd_to];
    let mtd_rev = scalar(&c, &format!("SELECT COALESCE(SUM(total),0) FROM sales WHERE {range}"), mp);
    let mtd_ord = scalar(&c, &format!("SELECT COUNT(*) FROM sales WHERE {range}"), mp);
    let mtd_cogs = scalar(&c, &format!("SELECT COALESCE(SUM(cost_total),0) FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range})"), mp);
    let mtd_exp = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date BETWEEN ?1 AND ?2", mp);
    let mtd_sal = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM salaries WHERE date BETWEEN ?1 AND ?2", mp);
    let mtd_com = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM commissions WHERE date BETWEEN ?1 AND ?2", mp);
    let mtd_ld = scalar(&c, "SELECT COALESCE(SUM(amount),0) FROM ld_commissions WHERE date BETWEEN ?1 AND ?2", mp);
    let mtd_gross = mtd_rev - mtd_cogs;
    let mtd_ovh = mtd_exp + mtd_sal + mtd_com + mtd_ld;
    let mtd_net = mtd_gross - mtd_ovh;

    // ── Record & Entity Counts ──
    let products_active = scalar(&c, "SELECT COUNT(*) FROM products WHERE active=1", &[]) as i64;
    let products_out_of_stock = scalar(&c, "SELECT COUNT(*) FROM products WHERE active=1 AND stock<=0", &[]) as i64;
    let products_low_stock = scalar(&c, "SELECT COUNT(*) FROM products WHERE active=1 AND stock>0 AND stock<=low_stock", &[]) as i64;
    let products_healthy = (products_active - products_out_of_stock - products_low_stock).max(0);
    let employees_active = scalar(&c, "SELECT COUNT(*) FROM employees WHERE active=1", &[]) as i64;
    let cashiers_count = scalar(&c, "SELECT COUNT(*) FROM cashiers", &[]) as i64;
    let open_shifts_count = scalar(&c, "SELECT COUNT(*) FROM shifts WHERE status='open'", &[]) as i64;

    let expenses_count = scalar(&c, "SELECT COUNT(*) FROM expenses WHERE date BETWEEN ?1 AND ?2", p) as i64;
    let salaries_count = scalar(&c, "SELECT COUNT(*) FROM salaries WHERE date BETWEEN ?1 AND ?2", p) as i64;
    let commissions_count = scalar(&c, "SELECT COUNT(*) FROM commissions WHERE date BETWEEN ?1 AND ?2", p) as i64;
    let ld_commissions_count = scalar(&c, "SELECT COUNT(*) FROM ld_commissions WHERE date BETWEEN ?1 AND ?2", p) as i64;
    let restocks_count = scalar(&c, "SELECT COUNT(*) FROM restocks WHERE date(created_at) BETWEEN ?1 AND ?2", p) as i64;
    let shifts_count = scalar(&c, "SELECT COUNT(*) FROM shifts WHERE date(opened_at) BETWEEN ?1 AND ?2 OR date(business_date) BETWEEN ?1 AND ?2", p) as i64;
    let total_records = (count as i64) + (voided_n as i64) + expenses_count + salaries_count + commissions_count + ld_commissions_count + restocks_count;

    // Hourly sales volume
    let hourly = rows(
        &c,
        &format!(
            "SELECT strftime('%H', created_at) AS hour, COUNT(*) AS count, ROUND(SUM(total), 2) AS revenue FROM sales WHERE {range} GROUP BY hour ORDER BY hour"
        ),
        p,
    )?;

    // Sales by Category
    let categories = rows(
        &c,
        &format!(
            r#"
            SELECT COALESCE(NULLIF(p.category, ''), 'General') AS category,
                   ROUND(SUM(si.subtotal), 2) AS revenue,
                   SUM(si.quantity * si.units_per) AS units,
                   ROUND(SUM(si.subtotal - si.cost_total), 2) AS gross_profit
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id IN (SELECT id FROM sales WHERE {range})
            GROUP BY category
            ORDER BY revenue DESC
            "#
        ),
        p,
    )?;

    // Product Profitability & Performance Table (products with sales in period)
    let product_performance = rows(
        &c,
        &format!(
            r#"
            SELECT p.id,
                   p.name,
                   p.barcode,
                   COALESCE(NULLIF(p.category, ''), 'General') AS category,
                   p.stock AS current_stock,
                   p.low_stock,
                   p.cost AS unit_cost,
                   p.price AS unit_price,
                   SUM(si.quantity * si.units_per) AS units_sold,
                   ROUND(SUM(si.subtotal), 2) AS revenue,
                   ROUND(SUM(si.cost_total), 2) AS cogs,
                   ROUND(SUM(si.subtotal - si.cost_total), 2) AS gross_profit,
                   ROUND(CASE WHEN SUM(si.subtotal) > 0 THEN ((SUM(si.subtotal - si.cost_total) / SUM(si.subtotal)) * 100) ELSE 0 END, 1) AS margin_pct
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id IN (SELECT id FROM sales WHERE {range})
            GROUP BY p.id
            ORDER BY revenue DESC
            "#
        ),
        p,
    )?;

    // Full Catalog Performance (includes active products even with 0 sales in period)
    let catalog_performance = rows(
        &c,
        &format!(
            r#"
            SELECT p.id,
                   p.name,
                   p.barcode,
                   COALESCE(NULLIF(p.category, ''), 'General') AS category,
                   p.stock AS current_stock,
                   p.low_stock,
                   p.cost AS unit_cost,
                   p.price AS unit_price,
                   p.image,
                   COALESCE(SUM(si.quantity * si.units_per), 0) AS units_sold,
                   ROUND(COALESCE(SUM(si.subtotal), 0), 2) AS revenue,
                   ROUND(COALESCE(SUM(si.cost_total), 0), 2) AS cogs,
                   ROUND(COALESCE(SUM(si.subtotal - si.cost_total), 0), 2) AS gross_profit,
                   ROUND(CASE
                       WHEN COALESCE(SUM(si.subtotal), 0) > 0 THEN ((SUM(si.subtotal - si.cost_total) / SUM(si.subtotal)) * 100)
                       WHEN p.price > 0 THEN (((p.price - p.cost) / p.price) * 100)
                       ELSE 0
                   END, 1) AS margin_pct
            FROM products p
            LEFT JOIN (
                SELECT product_id, quantity, units_per, subtotal, cost_total
                FROM sale_items
                WHERE sale_id IN (SELECT id FROM sales WHERE {range})
            ) si ON si.product_id = p.id
            WHERE p.active = 1
            GROUP BY p.id
            ORDER BY revenue DESC, p.name COLLATE NOCASE ASC
            "#
        ),
        p,
    )?;

    // Low stock & Out of stock items
    let low_stock_items = rows(
        &c,
        "SELECT id, name, COALESCE(NULLIF(category, ''), 'General') AS category, stock, low_stock, cost, price FROM products WHERE active=1 AND stock <= low_stock ORDER BY stock ASC, name COLLATE NOCASE ASC",
        &[],
    )?;

    // Expense breakdown by category
    let expense_categories = rows(
        &c,
        "SELECT COALESCE(NULLIF(category, ''), 'General') AS category, ROUND(SUM(amount), 2) AS total, COUNT(*) AS count FROM expenses WHERE date BETWEEN ?1 AND ?2 GROUP BY COALESCE(NULLIF(category, ''), 'General') ORDER BY total DESC",
        p,
    )?;

    // Top performing employees
    let top_employees = rows(
        &c,
        r#"
        SELECT employee_name,
               ROUND(SUM(amount), 2) AS total,
               ROUND(SUM(CASE WHEN src='salary' THEN amount ELSE 0 END), 2) AS salary,
               ROUND(SUM(CASE WHEN src='commission' THEN amount ELSE 0 END), 2) AS commission,
               ROUND(SUM(CASE WHEN src='ld' THEN amount ELSE 0 END), 2) AS ld_commission,
               COUNT(*) AS payout_count
        FROM (
            SELECT employee AS employee_name, amount, 'salary' AS src FROM salaries WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT employee_name, amount, 'commission' AS src FROM commissions WHERE date BETWEEN ?1 AND ?2
            UNION ALL
            SELECT employee_name, amount, 'ld' AS src FROM ld_commissions WHERE date BETWEEN ?1 AND ?2
        )
        WHERE employee_name != ''
        GROUP BY employee_name
        ORDER BY total DESC
        LIMIT 15
        "#,
        p,
    )?;

    // Shift audit history
    let shift_history = rows(
        &c,
        "SELECT * FROM shifts WHERE date(opened_at) BETWEEN ?1 AND ?2 OR date(business_date) BETWEEN ?1 AND ?2 ORDER BY id DESC LIMIT 100",
        p,
    )?;

    // Daily sales vs overheads trend (now includes cogs and gross_profit per day!)
    let daily = rows(
        &c,
        &format!(
            r#"
            SELECT day,
                   day AS date,
                   ROUND(SUM(sales), 2) AS sales,
                   ROUND(SUM(sales), 2) AS total,
                   ROUND(SUM(cogs), 2) AS cogs,
                   ROUND(SUM(sales - cogs), 2) AS gross_profit,
                   SUM(order_count) AS count,
                   ROUND(SUM(expenses), 2) AS expenses,
                   ROUND(SUM(salaries), 2) AS salaries,
                   ROUND(SUM(commissions), 2) AS commissions,
                   ROUND(SUM(ld_commissions), 2) AS ld_commissions,
                   ROUND(SUM(sales - cogs - expenses - salaries - commissions - ld_commissions), 2) AS net_after_cogs,
                   ROUND(SUM(sales - expenses - salaries - commissions - ld_commissions), 2) AS net
            FROM (
                SELECT date(s.created_at) AS day,
                       s.total AS sales,
                       COALESCE((SELECT SUM(si.cost_total) FROM sale_items si WHERE si.sale_id = s.id), 0.0) AS cogs,
                       1 AS order_count,
                       0.0 AS expenses,
                       0.0 AS salaries,
                       0.0 AS commissions,
                       0.0 AS ld_commissions
                FROM sales s WHERE s.{range}
                UNION ALL
                SELECT date AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, amount AS expenses, 0.0 AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM expenses WHERE date BETWEEN ?1 AND ?2
                UNION ALL
                SELECT date AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, 0.0 AS expenses, amount AS salaries, 0.0 AS commissions, 0.0 AS ld_commissions
                FROM salaries WHERE date BETWEEN ?1 AND ?2
                UNION ALL
                SELECT date AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, amount AS commissions, 0.0 AS ld_commissions
                FROM commissions WHERE date BETWEEN ?1 AND ?2
                UNION ALL
                SELECT date AS day, 0.0 AS sales, 0.0 AS cogs, 0 AS order_count, 0.0 AS expenses, 0.0 AS salaries, 0.0 AS commissions, amount AS ld_commissions
                FROM ld_commissions WHERE date BETWEEN ?1 AND ?2
            )
            WHERE day IS NOT NULL AND day != ''
            GROUP BY day
            ORDER BY day ASC
            "#
        ),
        p,
    )?;

    // Recent transactions (up to 25)
    let mut recent_sales = rows(
        &c,
        "SELECT * FROM sales WHERE date(created_at) BETWEEN ?1 AND ?2 ORDER BY id DESC LIMIT 25",
        p,
    )?;
    for s in recent_sales.iter_mut() {
        let sid = s["id"].as_i64().unwrap_or(0);
        s["items"] = Value::Array(rows(&c, "SELECT * FROM sale_items WHERE sale_id=?", &[&sid])?);
    }

    // Recent Activity & Audit Trail
    let recent_activity = build_activity_feed(&c, &from, &to, 60)?;

    // Build Smart Actionable Notifications / Alerts
    let mut alerts = Vec::new();
    if products_out_of_stock > 0 {
        alerts.push(json!({
            "id": "alert-out-of-stock",
            "severity": "bad",
            "title": format!("{} Product{} Out of Stock", products_out_of_stock, if products_out_of_stock == 1 { "" } else { "s" }),
            "description": "Zero units remaining on shelf. Immediate restock required to prevent lost sales.",
            "timestamp": now(),
            "target_tab": "products",
            "filter": "out_of_stock"
        }));
    }
    if products_low_stock > 0 {
        alerts.push(json!({
            "id": "alert-low-stock",
            "severity": "warn",
            "title": format!("{} Product{} Running Low on Stock", products_low_stock, if products_low_stock == 1 { "" } else { "s" }),
            "description": "Stock level has reached or fallen below the configured reorder threshold.",
            "timestamp": now(),
            "target_tab": "products",
            "filter": "low_stock"
        }));
    }
    if open_shifts_count == 0 {
        alerts.push(json!({
            "id": "alert-shift-closed",
            "severity": "info",
            "title": "No Active Business Shift (SOD)",
            "description": "Cashier POS and expense recording are locked until Start of Day (SOD) is opened.",
            "timestamp": now(),
            "target_tab": "shifts",
            "filter": "open_sod"
        }));
    }
    if void_rate >= 5.0 && voided_n > 0.0 {
        alerts.push(json!({
            "id": "alert-high-void-rate",
            "severity": "warn",
            "title": format!("Elevated Void / Leakage Rate ({}%)", void_rate),
            "description": format!("{} voided receipt(s) totaling ₱{:.2} in the selected period. Review void reasons in Sales Audit.", voided_n as i64, voided),
            "timestamp": now(),
            "target_tab": "sales",
            "filter": "voided"
        }));
    }
    if net < 0.0 && (revenue > 0.0 || total_overheads > 0.0) {
        alerts.push(json!({
            "id": "alert-negative-net",
            "severity": "bad",
            "title": "Negative Net Operating Profit in Period",
            "description": format!("Total overheads (₱{:.2}) exceeded gross profit (₱{:.2}) by ₱{:.2}.", total_overheads, gross, (total_overheads - gross).abs()),
            "timestamp": now(),
            "target_tab": "overview",
            "filter": "negative_net"
        }));
    }
    // Check for cash shortage in shifts
    let shortage_shifts: Vec<&Value> = shift_history
        .iter()
        .filter(|s| {
            s["status"] == "closed"
                && (s["closing_cash"].as_f64().unwrap_or(0.0) - s["expected_cash"].as_f64().unwrap_or(0.0)) < -0.01
        })
        .collect();
    if !shortage_shifts.is_empty() {
        alerts.push(json!({
            "id": "alert-shift-shortage",
            "severity": "bad",
            "title": format!("{} Shift(s) Recorded Cash Drawer Shortage", shortage_shifts.len()),
            "description": "Counted closing cash was less than expected cash in drawer. Inspect Z-Readings in Shift Audit.",
            "timestamp": now(),
            "target_tab": "shifts",
            "filter": "shortage"
        }));
    }

    Ok(json!({
        "revenue": r2(revenue),
        "orders": count,
        "cogs": r2(cogs),
        "gross_profit": r2(gross),
        "gross_margin": gross_margin,
        "total_overheads": r2(total_overheads),
        "expenses": r2(expenses),
        "salaries": r2(salaries),
        "commissions": r2(commissions),
        "ld_commissions": r2(ld_commissions),
        "net_profit": r2(net),
        "net_margin": net_margin,
        "avg_ticket": avg_ticket,
        "voided_total": r2(voided),
        "voided_count": voided_n,
        "void_rate": void_rate,
        "inventory_cost": r2(inv_cost),
        "inventory_retail": r2(inv_retail),
        "potential_profit": r2(inv_retail - inv_cost),
        "previous_period": {
            "from": prev_from,
            "to": prev_to,
            "days": span_days,
            "revenue": r2(prev_revenue),
            "orders": prev_count,
            "cogs": r2(prev_cogs),
            "gross_profit": r2(prev_gross),
            "expenses": r2(prev_expenses),
            "salaries": r2(prev_salaries),
            "commissions": r2(prev_commissions),
            "ld_commissions": r2(prev_ld_commissions),
            "total_overheads": r2(prev_overheads),
            "net_profit": r2(prev_net),
            "avg_ticket": prev_avg_ticket,
            "voided_total": r2(prev_voided),
            "voided_count": prev_voided_n,
            "void_rate": prev_void_rate,
            "daily": prev_daily
        },
        "today": {
            "date": today_date,
            "revenue": r2(today_rev),
            "orders": today_ord,
            "expenses": r2(today_exp),
            "salaries": r2(today_sal),
            "commissions": r2(today_com),
            "ld_commissions": r2(today_ld),
            "net_profit": r2(today_net),
            "records_created": today_records as i64
        },
        "mtd": {
            "from": mtd_from,
            "to": mtd_to,
            "revenue": r2(mtd_rev),
            "orders": mtd_ord,
            "gross_profit": r2(mtd_gross),
            "total_overheads": r2(mtd_ovh),
            "net_profit": r2(mtd_net)
        },
        "counts": {
            "products_active": products_active,
            "products_healthy": products_healthy,
            "products_low_stock": products_low_stock,
            "products_out_of_stock": products_out_of_stock,
            "employees_active": employees_active,
            "cashiers_count": cashiers_count,
            "open_shifts_count": open_shifts_count,
            "completed_sales": count as i64,
            "voided_sales": voided_n as i64,
            "expenses_count": expenses_count,
            "salaries_count": salaries_count,
            "commissions_count": commissions_count,
            "ld_commissions_count": ld_commissions_count,
            "restocks_count": restocks_count,
            "shifts_count": shifts_count,
            "total_records": total_records
        },
        "hourly": hourly,
        "categories": categories,
        "product_performance": product_performance,
        "catalog_performance": catalog_performance,
        "low_stock_items": low_stock_items,
        "expense_categories": expense_categories,
        "shift_history": shift_history,
        "top_employees": top_employees,
        "daily": daily,
        "recent_sales": recent_sales,
        "recent_activity": recent_activity,
        "alerts": alerts
    }))
}

// ───────────────────────── Business Shifts (SOD / EOD) ─────────────────────────

#[tauri::command]
pub fn get_shift_status(db: State<Db>) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let active = c.query_row(
        "SELECT id, business_date, status, opened_by, opened_at, opening_cash, notes FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1",
        [],
        |r| {
            Ok(json!({
                "id": r.get::<_, i64>(0)?,
                "business_date": r.get::<_, String>(1)?,
                "status": r.get::<_, String>(2)?,
                "opened_by": r.get::<_, String>(3)?,
                "opened_at": r.get::<_, String>(4)?,
                "opening_cash": r.get::<_, f64>(5)?,
                "notes": r.get::<_, String>(6)?,
            }))
        },
    ).optional().map_err(e)?;

    match active {
        Some(mut shift) => {
            let shift_id = shift["id"].as_i64().unwrap_or(0);
            let opened_at = shift["opened_at"].as_str().unwrap_or("").to_string();

            // Cash sales: strictly scoped to this shift by shift_id or timestamp after opened_at
            let cash_sales: f64 = c.query_row(
                "SELECT COALESCE(SUM(total), 0) FROM sales WHERE status='completed' AND (shift_id = ?1 OR (shift_id IS NULL AND created_at >= ?2))",
                params![shift_id, opened_at],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let expenses: f64 = c.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE shift_id = ?1",
                params![shift_id],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let salaries: f64 = c.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM salaries WHERE shift_id = ?1",
                params![shift_id],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let commissions: f64 = c.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE shift_id = ?1",
                params![shift_id],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let ld_commissions: f64 = c.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM ld_commissions WHERE shift_id = ?1",
                params![shift_id],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let opening_cash = shift["opening_cash"].as_f64().unwrap_or(0.0);
            let total_outflows = expenses + salaries + commissions + ld_commissions;
            let expected_cash = opening_cash + cash_sales - total_outflows;

            shift["cash_sales"] = json!(r2(cash_sales));
            shift["expenses"] = json!(r2(expenses));
            shift["salaries"] = json!(r2(salaries));
            shift["commissions"] = json!(r2(commissions));
            shift["ld_commissions"] = json!(r2(ld_commissions));
            shift["total_outflows"] = json!(r2(total_outflows));
            shift["expected_cash"] = json!(r2(expected_cash));
            Ok(json!({ "is_open": true, "shift": shift }))
        }
        None => {
            let last = c.query_row(
                "SELECT id, business_date, status, closed_at, closing_cash, expected_cash, cash_sales, expenses, salaries, commissions, ld_commissions FROM shifts WHERE status='closed' ORDER BY id DESC LIMIT 1",
                [],
                |r| {
                    Ok(json!({
                        "id": r.get::<_, i64>(0)?,
                        "business_date": r.get::<_, String>(1)?,
                        "status": r.get::<_, String>(2)?,
                        "closed_at": r.get::<_, Option<String>>(3)?,
                        "closing_cash": r.get::<_, f64>(4)?,
                        "expected_cash": r.get::<_, f64>(5)?,
                        "cash_sales": r.get::<_, f64>(6)?,
                        "expenses": r.get::<_, f64>(7)?,
                        "salaries": r.get::<_, f64>(8).unwrap_or(0.0),
                        "commissions": r.get::<_, f64>(9).unwrap_or(0.0),
                        "ld_commissions": r.get::<_, f64>(10).unwrap_or(0.0),
                    }))
                }
            ).optional().map_err(e)?;
            Ok(json!({ "is_open": false, "last_shift": last }))
        }
    }
}

#[tauri::command]
pub fn start_day(db: State<Db>, business_date: String, opened_by: String, opening_cash: f64, notes: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let exists: i64 = c.query_row("SELECT COUNT(*) FROM shifts WHERE status='open'", [], |r| r.get(0)).unwrap_or(0);
    if exists > 0 {
        return Err("A business day shift is already open. Please end the current day first.".into());
    }
    let bdate = if business_date.trim().is_empty() {
        chrono::Local::now().format("%Y-%m-%d").to_string()
    } else {
        business_date.trim().to_string()
    };
    let opened_at = now();
    c.execute(
        "INSERT INTO shifts(business_date, status, opened_by, opened_at, opening_cash, notes) VALUES(?, 'open', ?, ?, ?, ?)",
        params![bdate, opened_by, opened_at, opening_cash, notes],
    ).map_err(e)?;
    let id = c.last_insert_rowid();
    log_audit(
        &c,
        &opened_by,
        "cashier",
        "SHIFT_OPEN",
        "shift",
        &id.to_string(),
        &format!("Opened Shift #{} for business date {} (Opening Float: ₱{:.2})", id, bdate, opening_cash),
        json!({ "shift_id": id, "business_date": bdate, "opened_by": opened_by, "opening_cash": opening_cash, "notes": notes }),
    );
    Ok(json!({ "id": id, "business_date": bdate, "opened_by": opened_by, "opening_cash": opening_cash }))
}

#[tauri::command]
pub fn end_day(db: State<Db>, closing_cash: f64, closed_by: String, notes: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let active = c.query_row(
        "SELECT id, business_date, opening_cash, opened_at FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1",
        [],
        |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, f64>(2)?, r.get::<_, String>(3)?)),
    ).map_err(|_| "No open business day shift found.".to_string())?;

    let (shift_id, biz_date, opening_cash, opened_at) = active;
    let cash_sales: f64 = c.query_row(
        "SELECT COALESCE(SUM(total), 0) FROM sales WHERE status='completed' AND (shift_id = ?1 OR (shift_id IS NULL AND created_at >= ?2))",
        params![shift_id, opened_at],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let expenses: f64 = c.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE shift_id = ?1",
        params![shift_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let salaries: f64 = c.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM salaries WHERE shift_id = ?1",
        params![shift_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let commissions: f64 = c.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE shift_id = ?1",
        params![shift_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let ld_commissions: f64 = c.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM ld_commissions WHERE shift_id = ?1",
        params![shift_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let total_outflows = expenses + salaries + commissions + ld_commissions;
    let expected_cash = opening_cash + cash_sales - total_outflows;
    let closed_at = now();
    let variance = r2(closing_cash - expected_cash);

    c.execute(
        r#"
        UPDATE shifts
        SET status='closed', closed_by=?, closed_at=?, closing_cash=?, expected_cash=?, cash_sales=?, expenses=?, salaries=?, commissions=?, ld_commissions=?, notes=CASE WHEN ? != '' THEN ? ELSE notes END
        WHERE id=?
        "#,
        params![closed_by, closed_at, closing_cash, expected_cash, cash_sales, expenses, salaries, commissions, ld_commissions, notes, notes, shift_id],
    ).map_err(e)?;

    log_audit(
        &c,
        &closed_by,
        "cashier",
        "SHIFT_CLOSE",
        "shift",
        &shift_id.to_string(),
        &format!("Closed Shift #{} ({}) — Expected: ₱{:.2}, Counted: ₱{:.2}, Variance: ₱{:.2}", shift_id, biz_date, expected_cash, closing_cash, variance),
        json!({
            "shift_id": shift_id,
            "business_date": biz_date,
            "expected_cash": r2(expected_cash),
            "closing_cash": r2(closing_cash),
            "variance": variance,
            "closed_by": closed_by
        }),
    );

    // Automatically run atomic End-of-Day (EOD) snapshot backup to Google Drive folder (if configured) or local EOD_Backups
    let eod_backup = perform_eod_snapshot(&db, &c, &format!("EOD_{}", biz_date), &closed_by).unwrap_or_else(|err| {
        json!({
            "ok": false,
            "error": err
        })
    });

    Ok(json!({
        "id": shift_id,
        "business_date": biz_date,
        "opening_cash": r2(opening_cash),
        "cash_sales": r2(cash_sales),
        "expenses": r2(expenses),
        "salaries": r2(salaries),
        "commissions": r2(commissions),
        "ld_commissions": r2(ld_commissions),
        "total_outflows": r2(total_outflows),
        "expected_cash": r2(expected_cash),
        "closing_cash": r2(closing_cash),
        "variance": variance,
        "closed_at": closed_at,
        "closed_by": closed_by,
        "eod_backup": eod_backup
    }))
}

#[tauri::command]
pub fn list_shifts(db: State<Db>, limit: Option<i64>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    let lim = limit.unwrap_or(30);
    rows(&c, &format!("SELECT * FROM shifts ORDER BY id DESC LIMIT {}", lim), &[])
}

#[tauri::command]
pub fn update_shift_notes(db: State<Db>, id: i64, notes: String) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("UPDATE shifts SET notes=?1 WHERE id=?2", params![notes.trim(), id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "UPDATE",
        "shift",
        &id.to_string(),
        &format!("Updated Shift #{} audit notes", id),
        json!({ "shift_id": id, "notes": notes.trim() }),
    );
    Ok(())
}

// ───────────────────────── Settings & database ─────────────────────────

pub fn load_settings(c: &Connection) -> R<HashMap<String, String>> {
    let mut st = c.prepare("SELECT key,value FROM settings").map_err(e)?;
    let it = st.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map_err(e)?;
    it.collect::<Result<HashMap<_, _>, _>>().map_err(e)
}

#[tauri::command]
pub fn get_settings(db: State<Db>) -> R<HashMap<String, String>> {
    let c = db.0.lock().map_err(e)?;
    load_settings(&c)
}

#[tauri::command]
pub fn set_settings(db: State<Db>, values: HashMap<String, String>) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    for (k, v) in values {
        c.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![k, v]).map_err(e)?;
    }
    Ok(())
}

#[tauri::command]
pub fn backup_db(db: State<Db>, path: String) -> R<String> {
    let branch_name = {
        let bs = db.1.lock().map_err(e)?;
        bs.config.branches.iter().find(|b| b.id == bs.config.active_branch).map(|b| b.name.clone()).unwrap_or_else(|| "Main Branch".into())
    };
    let c = db.0.lock().map_err(e)?;
    let _ = std::fs::remove_file(&path);
    c.execute("VACUUM INTO ?1", [&path]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "BACKUP",
        "database",
        &branch_name,
        &format!("Created database backup for branch '{}'", branch_name),
        json!({ "branch": branch_name, "path": path }),
    );
    Ok(format!("Backup for branch '{}' saved successfully", branch_name))
}

#[tauri::command]
pub fn restore_db(db: State<Db>, path: String) -> R<String> {
    let src = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(e)?;
    let ok: i64 = src
        .query_row("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('products','sales','settings')", [], |r| r.get(0))
        .map_err(|_| "Not a valid JOYCE POS backup".to_string())?;
    if ok < 3 {
        return Err("Not a valid JOYCE POS backup".into());
    }
    let mut c = db.0.lock().map_err(e)?;
    {
        let b = rusqlite::backup::Backup::new(&src, &mut *c).map_err(e)?;
        b.run_to_completion(100, std::time::Duration::from_millis(0), None).map_err(e)?;
    }
    crate::db::init(&c).map_err(e)?;
    let branch_name = {
        let bs = db.1.lock().map_err(e)?;
        bs.config.branches.iter().find(|b| b.id == bs.config.active_branch).map(|b| b.name.clone()).unwrap_or_else(|| "Selected Branch".into())
    };
    log_audit(
        &c,
        "Administrator",
        "admin",
        "RESTORE",
        "database",
        &branch_name,
        &format!("Restored database backup for branch '{}'", branch_name),
        json!({ "branch": branch_name, "path": path }),
    );
    Ok(format!("Database for branch '{}' restored successfully", branch_name))
}

#[tauri::command]
pub fn reset_db(db: State<Db>, pin: String, keep_catalog: bool) -> R<String> {
    let mut c = db.0.lock().map_err(e)?;
    let pin = pin.trim();
    if pin.is_empty() {
        return Err("Admin PIN is required to authorize database reset".into());
    }
    let admin_pin: String = c
        .query_row("SELECT value FROM settings WHERE key='admin_pin'", [], |r| r.get(0))
        .unwrap_or_else(|_| "0000".to_string());
    if pin != admin_pin {
        return Err("Invalid Admin PIN. Database reset was rejected.".into());
    }

    let tx = c.transaction().map_err(e)?;
    tx.execute("DELETE FROM sales", []).map_err(e)?;
    tx.execute("DELETE FROM sale_items", []).map_err(e)?;
    tx.execute("DELETE FROM voided_sales", []).map_err(e)?;
    tx.execute("DELETE FROM restocks", []).map_err(e)?;
    tx.execute("DELETE FROM expenses", []).map_err(e)?;
    tx.execute("DELETE FROM salaries", []).map_err(e)?;
    tx.execute("DELETE FROM commissions", []).map_err(e)?;
    tx.execute("DELETE FROM ld_commissions", []).map_err(e)?;
    tx.execute("DELETE FROM shifts", []).map_err(e)?;

    if !keep_catalog {
        tx.execute("DELETE FROM products", []).map_err(e)?;
        tx.execute("DELETE FROM variants", []).map_err(e)?;
        tx.execute("DELETE FROM employees", []).map_err(e)?;
        tx.execute("DELETE FROM cashiers", []).map_err(e)?;
    }

    log_audit(
        &tx,
        "Administrator",
        "admin",
        "RESET_DB",
        "database",
        "all",
        &format!("Reset branch database (Keep catalog: {})", keep_catalog),
        json!({ "keep_catalog": keep_catalog }),
    );

    tx.commit().map_err(e)?;

    let branch_name = {
        let bs = db.1.lock().map_err(e)?;
        bs.config.branches.iter().find(|b| b.id == bs.config.active_branch).map(|b| b.name.clone()).unwrap_or_else(|| "Selected Branch".into())
    };

    Ok(format!("Database for branch '{}' has been reset successfully.", branch_name))
}

#[tauri::command]
pub fn save_text_file(path: String, content: String) -> R<()> {
    std::fs::write(&path, content).map_err(e)?;
    Ok(())
}

// ───────────────────────── Printing ─────────────────────────

#[tauri::command]
pub fn print_receipt(db: State<Db>, sale_id: i64) -> R<()> {
    let (sale, st) = {
        let c = db.0.lock().map_err(e)?;
        (sale_detail(&c, sale_id)?, load_settings(&c)?)
    };
    printer::send(&st, printer::build_receipt(&sale, &st))
}

#[tauri::command]
pub fn print_test(db: State<Db>) -> R<()> {
    let st = {
        let c = db.0.lock().map_err(e)?;
        load_settings(&c)?
    };
    let sale = json!({
        "receipt_no": "JP-TEST-0001", "created_at": now(), "total": 7.0, "paid": 10.0, "change_amt": 3.0, "status": "completed",
        "items": [
            {"name":"Candy","variant_name":"","quantity":1,"unit_price":2.0,"subtotal":2.0},
            {"name":"Candy","variant_name":"3 pcs","quantity":1,"unit_price":5.0,"subtotal":5.0}
        ]
    });
    printer::send(&st, printer::build_receipt(&sale, &st))
}

#[tauri::command]
pub fn list_usb_devices() -> R<Vec<Value>> {
    printer::list_usb()
}

// ───────────────────────── Auth & Cashiers ─────────────────────────

#[tauri::command]
pub fn verify_pin(db: State<Db>, pin: String) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let pin = pin.trim();
    if pin.is_empty() {
        return Err("Please enter a PIN".into());
    }
    // Check admin pin (default '0000')
    let admin_pin: String = c
        .query_row("SELECT value FROM settings WHERE key='admin_pin'", [], |r| r.get(0))
        .unwrap_or_else(|_| "0000".to_string());
    if pin == admin_pin {
        return Ok(json!({
            "id": 0,
            "name": "Administrator",
            "role": "admin",
            "permissions": ["*"]
        }));
    }
    // Check cashiers
    let mut st = c.prepare("SELECT id, name, permissions FROM cashiers WHERE pin = ?1").map_err(e)?;
    let mut rows = st.query_map([pin], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?))
    }).map_err(e)?;

    if let Some(Ok((id, name, perms_str))) = rows.next() {
        let perms: Value = serde_json::from_str(&perms_str).unwrap_or(json!(["pos", "transactions"]));
        return Ok(json!({
            "id": id,
            "name": name,
            "role": "cashier",
            "permissions": perms
        }));
    }

    Err("Incorrect PIN. Please try again.".into())
}

#[tauri::command]
pub fn change_admin_pin(db: State<Db>, old_pin: String, new_pin: String) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let old_pin = old_pin.trim();
    let new_pin = new_pin.trim();
    if new_pin.len() < 4 {
        return Err("New PIN must be at least 4 digits".into());
    }
    let current: String = c
        .query_row("SELECT value FROM settings WHERE key='admin_pin'", [], |r| r.get(0))
        .unwrap_or_else(|_| "0000".to_string());
    if old_pin != current {
        return Err("Current admin PIN is incorrect".into());
    }
    c.execute(
        "INSERT INTO settings(key, value) VALUES('admin_pin', ?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [new_pin],
    )
    .map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "SECURITY",
        "settings",
        "admin_pin",
        "Updated Administrator security PIN",
        json!({}),
    );
    Ok(())
}

#[tauri::command]
pub fn list_cashiers(db: State<Db>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    let mut list = rows(&c, "SELECT id, name, pin, permissions, created_at FROM cashiers ORDER BY name COLLATE NOCASE", &[])?;
    for item in list.iter_mut() {
        if let Some(perms_str) = item.get("permissions").and_then(|p| p.as_str()) {
            item["permissions_list"] = serde_json::from_str(perms_str).unwrap_or(json!([]));
        }
    }
    Ok(list)
}

#[tauri::command]
pub fn save_cashier(db: State<Db>, cashier: Value) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let name = text(&cashier, "name");
    let pin = text(&cashier, "pin");
    if name.is_empty() {
        return Err("Cashier name is required".into());
    }
    if pin.len() < 4 {
        return Err("PIN must be at least 4 digits".into());
    }
    let admin_pin: String = c
        .query_row("SELECT value FROM settings WHERE key='admin_pin'", [], |r| r.get(0))
        .unwrap_or_else(|_| "0000".to_string());
    if pin == admin_pin {
        return Err("Cashier PIN cannot be the same as Admin PIN".into());
    }

    let perms = cashier.get("permissions").unwrap_or(&json!(["pos", "transactions"])).to_string();

    match cashier.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            let exists: i64 = c.query_row("SELECT COUNT(*) FROM cashiers WHERE pin=?1 AND id!=?2", params![&pin, id], |r| r.get(0)).unwrap_or(0);
            if exists > 0 {
                return Err("Another cashier is already using this PIN".into());
            }
            c.execute("UPDATE cashiers SET name=?, pin=?, permissions=? WHERE id=?", params![name, pin, perms, id]).map_err(e)?;
            log_audit(
                &c,
                "Administrator",
                "admin",
                "UPDATE",
                "cashier",
                &id.to_string(),
                &format!("Updated cashier account '{}'", name),
                json!({ "id": id, "name": name }),
            );
        }
        None => {
            let exists: i64 = c.query_row("SELECT COUNT(*) FROM cashiers WHERE pin=?1", [&pin], |r| r.get(0)).unwrap_or(0);
            if exists > 0 {
                return Err("Another cashier is already using this PIN".into());
            }
            c.execute("INSERT INTO cashiers(name, pin, permissions, created_at) VALUES(?,?,?,?)", params![name, pin, perms, now()]).map_err(e)?;
            let id = c.last_insert_rowid();
            log_audit(
                &c,
                "Administrator",
                "admin",
                "CREATE",
                "cashier",
                &id.to_string(),
                &format!("Created cashier account '{}'", name),
                json!({ "id": id, "name": name }),
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_cashier(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let prev = rows(&c, "SELECT id, name FROM cashiers WHERE id=?", &[&id]).ok().and_then(|mut r| r.pop()).unwrap_or(json!({"id": id}));
    let cname = prev.get("name").and_then(|x| x.as_str()).unwrap_or("Cashier");
    c.execute("DELETE FROM cashiers WHERE id=?", [id]).map_err(e)?;
    log_audit(
        &c,
        "Administrator",
        "admin",
        "DELETE",
        "cashier",
        &id.to_string(),
        &format!("Deleted cashier account '{}'", cname),
        json!({ "deleted": prev }),
    );
    Ok(())
}

// ───────────────────────── Branches & Safe EOD Google Drive Sync ─────────────────────────

/// Atomically writes a clean, single-file SQLite snapshot (`VACUUM INTO`) without WAL/SHM locks.
/// Writes to a `.tmp` file first and renames atomically so Google Drive never syncs a partial file.
pub fn perform_eod_snapshot(db: &Db, c: &Connection, tag: &str, actor: &str) -> R<Value> {
    let (branch, cloud_dir, default_dir) = {
        let bs = db.1.lock().map_err(e)?;
        (bs.active_branch_info(), bs.backup_base_dir(), bs.default_dir.clone())
    };

    let target_base = cloud_dir.clone().unwrap_or_else(|| default_dir.clone());
    let is_gdrive = cloud_dir.is_some();
    let eod_dir = target_base.join("EOD_Backups");
    std::fs::create_dir_all(&eod_dir).map_err(|err| format!("Failed to create EOD_Backups folder: {}", err))?;

    let safe_tag: String = tag
        .chars()
        .map(|ch| if ch.is_alphanumeric() || ch == '-' || ch == '_' { ch } else { '_' })
        .collect();
    let archive_filename = format!("joyce_pos_{}_{}.db", branch.id, safe_tag);
    let archive_path = eod_dir.join(&archive_filename);
    let tmp_archive_path = eod_dir.join(format!(".tmp_{}", archive_filename));

    let _ = std::fs::remove_file(&tmp_archive_path);
    let tmp_str = tmp_archive_path.to_string_lossy().to_string();
    c.execute("VACUUM INTO ?1", [&tmp_str]).map_err(e)?;
    let _ = std::fs::remove_file(&archive_path);
    std::fs::rename(&tmp_archive_path, &archive_path).map_err(e)?;

    // If a Google Drive / Cloud folder is configured, also update the root branch snapshot file
    // (e.g. `<Google Drive>/joyce_pos.db`) atomically so the office PC always sees the latest EOD state.
    let mut latest_cloud_path_str = archive_path.to_string_lossy().to_string();
    if let Some(ref gdir) = cloud_dir {
        let latest_path = gdir.join(&branch.file);
        let _ = std::fs::copy(&archive_path, &latest_path);
        latest_cloud_path_str = latest_path.to_string_lossy().to_string();
    }

    let ts = now();
    {
        let mut bs = db.1.lock().map_err(e)?;
        bs.config.last_backup_at = ts.clone();
        bs.config.last_backup_path = archive_path.to_string_lossy().to_string();
        let _ = bs.save();
    }

    log_audit(
        c,
        actor,
        "admin",
        "EOD_BACKUP",
        "database",
        &branch.id,
        &format!(
            "Saved atomic {} snapshot for '{}' to {}",
            if is_gdrive { "Google Drive EOD" } else { "Local EOD" },
            branch.name,
            archive_path.to_string_lossy()
        ),
        json!({
            "branch": branch.name,
            "is_google_drive": is_gdrive,
            "archive_path": archive_path.to_string_lossy(),
            "latest_path": latest_cloud_path_str,
            "timestamp": ts
        }),
    );

    Ok(json!({
        "ok": true,
        "is_google_drive": is_gdrive,
        "branch_name": branch.name,
        "archive_path": archive_path.to_string_lossy(),
        "latest_path": latest_cloud_path_str,
        "timestamp": ts
    }))
}

#[tauri::command]
pub fn sync_to_gdrive(db: State<Db>) -> R<Value> {
    let c = db.0.lock().map_err(e)?;
    let bdate = active_business_date(&c);
    let stamp = chrono::Local::now().format("%H%M%S").to_string();
    perform_eod_snapshot(&db, &c, &format!("SYNC_{}_{}", bdate, stamp), "Administrator")
}

fn branch_info_json(db: &Db) -> R<Value> {
    let bs = db.1.lock().map_err(e)?;
    let active_path = bs.active_db_path();
    Ok(json!({
        "active_branch": bs.config.active_branch,
        "storage_dir": bs.config.storage_dir,
        "default_dir": bs.default_dir.to_string_lossy(),
        "active_db_path": active_path.to_string_lossy(),
        "last_backup_at": bs.config.last_backup_at,
        "last_backup_path": bs.config.last_backup_path,
        "branches": bs.config.branches,
    }))
}

#[tauri::command]
pub fn get_branch_info(db: State<Db>) -> R<Value> {
    branch_info_json(&db)
}

#[tauri::command]
pub fn switch_branch(db: State<Db>, branch_id: String) -> R<Value> {
    let new_path = {
        let mut bs = db.1.lock().map_err(e)?;
        if !bs.config.branches.iter().any(|b| b.id == branch_id) {
            return Err("Branch not found".into());
        }
        bs.config.active_branch = branch_id;
        bs.save().map_err(e)?;
        bs.active_db_path()
    };

    {
        let mut c = db.0.lock().map_err(e)?;
        *c = Connection::open(&new_path).map_err(e)?;
        crate::db::init(&c).map_err(e)?;
    }

    branch_info_json(&db)
}

#[tauri::command]
pub fn create_branch(db: State<Db>, name: String) -> R<Value> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Branch name is required".into());
    }

    let (_branch_id, new_path) = {
        let mut bs = db.1.lock().map_err(e)?;
        let safe_name: String = name
            .to_lowercase()
            .chars()
            .map(|ch| if ch.is_alphanumeric() { ch } else { '_' })
            .collect();
        let timestamp = chrono::Local::now().format("%s").to_string();
        let branch_id = format!("branch_{}_{}", safe_name.trim_matches('_'), &timestamp[timestamp.len().saturating_sub(4)..]);
        let file = format!("joyce_pos_{}.db", branch_id);
        let path = bs.default_dir.join(&file);

        let info = crate::db::BranchInfo {
            id: branch_id.clone(),
            name: name.to_string(),
            file,
            created_at: now(),
        };

        bs.config.branches.push(info);
        bs.config.active_branch = branch_id.clone();
        bs.save().map_err(e)?;
        (branch_id, path)
    };

    {
        let mut c = db.0.lock().map_err(e)?;
        *c = Connection::open(&new_path).map_err(e)?;
        crate::db::init(&c).map_err(e)?;
    }

    branch_info_json(&db)
}

#[tauri::command]
pub fn delete_branch(db: State<Db>, branch_id: String) -> R<Value> {
    let should_switch = {
        let mut bs = db.1.lock().map_err(e)?;
        if bs.config.branches.len() <= 1 {
            return Err("Cannot delete the only remaining branch".into());
        }
        if branch_id == "main" {
            return Err("Cannot delete the main branch".into());
        }
        let pos = bs
            .config
            .branches
            .iter()
            .position(|b| b.id == branch_id)
            .ok_or_else(|| "Branch not found".to_string())?;
        bs.config.branches.remove(pos);

        let was_active = bs.config.active_branch == branch_id;
        if was_active {
            bs.config.active_branch = bs.config.branches[0].id.clone();
        }
        bs.save().map_err(e)?;
        if was_active {
            Some(bs.active_db_path())
        } else {
            None
        }
    };

    if let Some(path) = should_switch {
        let mut c = db.0.lock().map_err(e)?;
        *c = Connection::open(&path).map_err(e)?;
        crate::db::init(&c).map_err(e)?;
    }

    branch_info_json(&db)
}

#[tauri::command]
pub fn set_storage_dir(db: State<Db>, storage_dir: String) -> R<Value> {
    let storage_dir = storage_dir.trim().to_string();
    if !storage_dir.is_empty() {
        let p = std::path::Path::new(&storage_dir);
        if !p.exists() {
            std::fs::create_dir_all(p).map_err(|e| format!("Failed to create folder: {}", e))?;
        }
    }

    let active_path = {
        let mut bs = db.1.lock().map_err(e)?;
        bs.config.storage_dir = storage_dir.clone();
        bs.save().map_err(e)?;
        bs.active_db_path()
    };

    {
        let mut c = db.0.lock().map_err(e)?;
        *c = Connection::open(&active_path).map_err(e)?;
        crate::db::init(&c).map_err(e)?;
        // If user just selected a Google Drive folder, immediately write a clean initial snapshot
        if !storage_dir.is_empty() {
            let bdate = active_business_date(&c);
            let _ = perform_eod_snapshot(&db, &c, &format!("INIT_{}", bdate), "Administrator");
        }
    }

    branch_info_json(&db)
}



