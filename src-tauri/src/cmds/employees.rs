use crate::cmds::common::*;
use crate::db::Db;
use rusqlite::params;
use serde_json::{json, Value};
use tauri::State;

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
