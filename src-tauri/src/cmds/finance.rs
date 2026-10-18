use crate::cmds::common::*;
use crate::db::Db;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tauri::State;

// ───────────────────────── Expenses & Salaries ─────────────────────────

#[tauri::command]
pub fn list_expenses(db: State<Db>, from: String, to: String) -> R<Vec<Value>> {
    let c = db.0.lock().map_err(e)?;
    let sql = r#"
        SELECT *,
               COALESCE((SELECT business_date FROM shifts WHERE id=expenses.shift_id), date) AS business_date
        FROM expenses
        WHERE COALESCE((SELECT business_date FROM shifts WHERE id=expenses.shift_id), date) BETWEEN ?1 AND ?2
        ORDER BY business_date DESC, id DESC
    "#;
    rows(&c, sql, &[&from, &to])
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
    let sql = r#"
        SELECT *,
               COALESCE((SELECT business_date FROM shifts WHERE id=salaries.shift_id), date) AS business_date
        FROM salaries
        WHERE COALESCE((SELECT business_date FROM shifts WHERE id=salaries.shift_id), date) BETWEEN ?1 AND ?2
        ORDER BY business_date DESC, id DESC
    "#;
    rows(&c, sql, &[&from, &to])
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
    let sql = r#"
        SELECT *,
               COALESCE((SELECT business_date FROM shifts WHERE id=commissions.shift_id), date) AS business_date
        FROM commissions
        WHERE COALESCE((SELECT business_date FROM shifts WHERE id=commissions.shift_id), date) BETWEEN ?1 AND ?2
        ORDER BY business_date DESC, id DESC
    "#;
    rows(&c, sql, &[&from, &to])
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
    let sql = r#"
        SELECT *,
               COALESCE((SELECT business_date FROM shifts WHERE id=ld_commissions.shift_id), date) AS business_date
        FROM ld_commissions
        WHERE COALESCE((SELECT business_date FROM shifts WHERE id=ld_commissions.shift_id), date) BETWEEN ?1 AND ?2
        ORDER BY business_date DESC, id DESC
    "#;
    rows(&c, sql, &[&from, &to])
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
