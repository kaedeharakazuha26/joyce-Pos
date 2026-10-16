use crate::db::Db;
use crate::printer;
use rusqlite::{params, types::ValueRef, Connection, OpenFlags, ToSql};
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
    let id = match product.get("id").and_then(|x| x.as_i64()) {
        Some(id) => {
            tx.execute(
                "UPDATE products SET name=?,barcode=?,category=?,price=?,cost=?,low_stock=?,image=? WHERE id=?",
                params![name, text(&product, "barcode"), text(&product, "category"), num(&product, "price"), num(&product, "cost"), num(&product, "low_stock") as i64, text(&product, "image"), id],
            )
            .map_err(e)?;
            id
        }
        None => {
            tx.execute(
                "INSERT INTO products(name,barcode,category,price,cost,stock,low_stock,image,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                params![name, text(&product, "barcode"), text(&product, "category"), num(&product, "price"), num(&product, "cost"), num(&product, "stock") as i64, num(&product, "low_stock") as i64, text(&product, "image"), now()],
            )
            .map_err(e)?;
            tx.last_insert_rowid()
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
    tx.commit().map_err(e)?;
    Ok(id)
}

#[tauri::command]
pub fn delete_product(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("UPDATE products SET active=0 WHERE id=?", [id]).map_err(e)?;
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
    let day = chrono::Local::now().format("%Y%m%d").to_string();
    let n: i64 = tx
        .query_row("SELECT COUNT(*) FROM sales WHERE date(created_at)=date('now','localtime')", [], |r| r.get(0))
        .map_err(e)?;
    let receipt = format!("JP-{}-{:04}", day, n + 1);
    tx.execute(
        "INSERT INTO sales(receipt_no,total,paid,change_amt,status,created_at) VALUES(?,0,0,0,'completed',?)",
        params![receipt, now()],
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
    let ts = now();
    let who = voided_by.unwrap_or_default();
    tx.execute("UPDATE sales SET status='voided',voided_at=?,void_reason=?,voided_by=? WHERE id=?", params![ts, reason, who, id]).map_err(e)?;
    tx.execute(
        "INSERT INTO voided_sales(sale_id,receipt_no,total,reason,items_json,sold_at,voided_at,voided_by) VALUES(?,?,?,?,?,?,?,?)",
        params![id, sale["receipt_no"].as_str(), sale["total"].as_f64(), reason, sale["items"].to_string(), sale["created_at"].as_str(), ts, who],
    )
    .map_err(e)?;
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
    let name: String = tx.query_row("SELECT name FROM products WHERE id=?", [product_id], |r| r.get(0)).map_err(e)?;
    tx.execute("UPDATE products SET stock=stock+? WHERE id=?", params![qty, product_id]).map_err(e)?;
    if unit_cost > 0.0 {
        tx.execute("UPDATE products SET cost=? WHERE id=?", params![unit_cost, product_id]).map_err(e)?;
    }
    tx.execute(
        "INSERT INTO restocks(product_id,product_name,qty,unit_cost,note,created_at) VALUES(?,?,?,?,?,?)",
        params![product_id, name, qty, unit_cost, note, now()],
    )
    .map_err(e)?;
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
    if num(&expense, "amount") <= 0.0 {
        return Err("Amount must be greater than 0".into());
    }
    let (cat, desc, amt, date) = (text(&expense, "category"), text(&expense, "description"), num(&expense, "amount"), text(&expense, "date"));
    match expense.get("id").and_then(|x| x.as_i64()) {
        Some(id) => c.execute("UPDATE expenses SET category=?,description=?,amount=?,date=? WHERE id=?", params![cat, desc, amt, date, id]),
        None => c.execute("INSERT INTO expenses(category,description,amount,date) VALUES(?,?,?,?)", params![cat, desc, amt, date]),
    }
    .map_err(e)?;
    Ok(())
}

#[tauri::command]
pub fn delete_expense(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM expenses WHERE id=?", [id]).map_err(e)?;
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
    if text(&salary, "employee").is_empty() || num(&salary, "amount") <= 0.0 {
        return Err("Employee and amount are required".into());
    }
    match salary.get("id").and_then(|x| x.as_i64()) {
        Some(id) => c.execute(
            "UPDATE salaries SET employee=?,amount=?,period=?,date=?,note=? WHERE id=?",
            params![text(&salary, "employee"), num(&salary, "amount"), text(&salary, "period"), text(&salary, "date"), text(&salary, "note"), id],
        ),
        None => c.execute(
            "INSERT INTO salaries(employee,amount,period,date,note) VALUES(?,?,?,?,?)",
            params![text(&salary, "employee"), num(&salary, "amount"), text(&salary, "period"), text(&salary, "date"), text(&salary, "note")],
        ),
    }
    .map_err(e)?;
    Ok(())
}

#[tauri::command]
pub fn delete_salary(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM salaries WHERE id=?", [id]).map_err(e)?;
    Ok(())
}

// ───────────────────────── Commissions ─────────────────────────

fn comm_args(v: &Value, with_type: bool) -> R<(String, Option<i64>, String, String, f64)> {
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
    Ok((text(v, "date"), v.get("employee_id").and_then(|x| x.as_i64()), name, ty, num(v, "amount")))
}

#[tauri::command]
pub fn list_commissions(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    rows(&c, "SELECT * FROM commissions WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC, id DESC", &[&from, &to])
}

#[tauri::command]
pub fn save_commission(db: State<Db>, commission: Value) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let (date, eid, name, ty, amt) = comm_args(&commission, true)?;
    match commission.get("id").and_then(|x| x.as_i64()) {
        Some(id) => c.execute("UPDATE commissions SET date=?,employee_id=?,employee_name=?,type=?,amount=? WHERE id=?", params![date, eid, name, ty, amt, id]),
        None => c.execute("INSERT INTO commissions(date,employee_id,employee_name,type,amount) VALUES(?,?,?,?,?)", params![date, eid, name, ty, amt]),
    }
    .map_err(e)?;
    Ok(())
}

#[tauri::command]
pub fn delete_commission(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM commissions WHERE id=?", [id]).map_err(e)?;
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
    c.execute("INSERT OR IGNORE INTO commission_types(name) VALUES(?)", [name]).map_err(e)?;
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
    let (date, eid, name, _, amt) = comm_args(&commission, false)?;
    let qty = commission.get("quantity").and_then(|x| x.as_i64()).unwrap_or(1).max(1);
    match commission.get("id").and_then(|x| x.as_i64()) {
        Some(id) => c.execute(
            "UPDATE ld_commissions SET date=?,employee_id=?,employee_name=?,quantity=?,amount=? WHERE id=?",
            params![date, eid, name, qty, amt, id],
        ),
        None => c.execute(
            "INSERT INTO ld_commissions(date,employee_id,employee_name,quantity,amount) VALUES(?,?,?,?,?)",
            params![date, eid, name, qty, amt],
        ),
    }
    .map_err(e)?;
    Ok(())
}

#[tauri::command]
pub fn delete_ld_commission(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM ld_commissions WHERE id=?", [id]).map_err(e)?;
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
    match employee.get("id").and_then(|x| x.as_i64()) {
        Some(id) => c.execute(
            "UPDATE employees SET name=?,position=?,commission=?,ld_commission=?,salary=? WHERE id=?",
            params![name, pos, com, ld, sal, id],
        ),
        None => c.execute(
            "INSERT INTO employees(name,position,commission,ld_commission,salary,created_at) VALUES(?,?,?,?,?,?)",
            params![name, pos, com, ld, sal, now()],
        ),
    }
    .map_err(e)?;
    Ok(())
}

#[tauri::command]
pub fn delete_employee(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("UPDATE employees SET active=0 WHERE id=?", [id]).map_err(e)?;
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
        LIMIT 6
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
        "daily": rows(&c, &format!("SELECT date(created_at) AS day, SUM(total) AS total, COUNT(*) AS count FROM sales WHERE {range} GROUP BY day ORDER BY day"), p)?,
        "top": rows(&c, &format!("SELECT name, SUM(units_per*quantity) AS units, SUM(subtotal) AS revenue FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE {range}) GROUP BY product_id ORDER BY revenue DESC LIMIT 8"), p)?,
        "low_stock": rows(&c, "SELECT id,name,stock,low_stock FROM products WHERE active=1 AND stock<=low_stock ORDER BY stock LIMIT 10", &[])?,
    }))
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
pub fn backup_db(db: State<Db>, path: String) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    let _ = std::fs::remove_file(&path);
    c.execute("VACUUM INTO ?1", [&path]).map_err(e)?;
    Ok(())
}

#[tauri::command]
pub fn restore_db(db: State<Db>, path: String) -> R<()> {
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
    crate::db::init(&c).map_err(e)
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
        }
        None => {
            let exists: i64 = c.query_row("SELECT COUNT(*) FROM cashiers WHERE pin=?1", [&pin], |r| r.get(0)).unwrap_or(0);
            if exists > 0 {
                return Err("Another cashier is already using this PIN".into());
            }
            c.execute("INSERT INTO cashiers(name, pin, permissions, created_at) VALUES(?,?,?,?)", params![name, pin, perms, now()]).map_err(e)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_cashier(db: State<Db>, id: i64) -> R<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM cashiers WHERE id=?", [id]).map_err(e)?;
    Ok(())
}

