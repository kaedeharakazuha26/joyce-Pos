use crate::cmds::common::*;
use crate::db::Db;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tauri::State;

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
    let shift_id = get_active_shift(&tx).map(|(sid, _)| sid);
    tx.execute(
        "INSERT INTO restocks(product_id,product_name,qty,unit_cost,note,created_at,shift_id) VALUES(?,?,?,?,?,?,?)",
        params![product_id, name, qty, unit_cost, note, created_at, shift_id],
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
            "note": note,
            "shift_id": shift_id
        }),
    );
    tx.commit().map_err(e)
}

#[tauri::command]
pub fn list_restocks(db: State<Db>) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(
        &c,
        r#"
        SELECT *,
               COALESCE((SELECT business_date FROM shifts WHERE id=restocks.shift_id), date(created_at)) AS business_date
        FROM restocks
        ORDER BY id DESC LIMIT 300
        "#,
        &[],
    )
}
