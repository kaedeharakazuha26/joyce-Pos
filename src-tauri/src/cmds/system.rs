use crate::cmds::common::*;
use crate::cmds::dashboard::build_activity_feed;
use crate::db::Db;
use rusqlite::{params, Connection, OpenFlags, ToSql};
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::State;

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

pub fn branch_info_json(db: &Db) -> R<Value> {
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
