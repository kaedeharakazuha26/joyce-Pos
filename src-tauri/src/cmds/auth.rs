use crate::cmds::common::*;
use crate::db::Db;
use rusqlite::params;
use serde_json::{json, Value};
use tauri::State;

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
