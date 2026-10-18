use crate::cmds::common::*;
use crate::cmds::system::perform_eod_snapshot;
use crate::db::Db;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};
use tauri::State;

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

            let gross_sales: f64 = c.query_row(
                "SELECT COALESCE(SUM(total), 0) FROM sales WHERE status='completed' AND (shift_id = ?1 OR (shift_id IS NULL AND created_at >= ?2))",
                params![shift_id, opened_at],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let orders_count: i64 = c.query_row(
                "SELECT COUNT(*) FROM sales WHERE status='completed' AND (shift_id = ?1 OR (shift_id IS NULL AND created_at >= ?2))",
                params![shift_id, opened_at],
                |r| r.get(0)
            ).unwrap_or(0);

            let sold_items = rows(
                &c,
                "SELECT si.name, COALESCE(si.variant_name, '') AS variant_name, SUM(si.quantity) AS quantity, ROUND(SUM(si.subtotal), 2) AS amount
                 FROM sale_items si
                 JOIN sales s ON si.sale_id = s.id
                 WHERE s.status='completed' AND (s.shift_id = ?1 OR (s.shift_id IS NULL AND s.created_at >= ?2))
                 GROUP BY si.name, si.variant_name
                 ORDER BY amount DESC",
                &[&shift_id, &opened_at],
            )?;

            let opening_cash = shift["opening_cash"].as_f64().unwrap_or(0.0);
            let total_outflows = expenses + salaries + commissions + ld_commissions;
            let expected_cash = opening_cash + cash_sales - total_outflows;

            shift["gross_sales"] = json!(r2(gross_sales));
            shift["orders_count"] = json!(orders_count);
            shift["sold_items"] = Value::Array(sold_items);
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

            let last_shift = if let Some(mut l) = last {
                let last_id = l["id"].as_i64().unwrap_or(0);
                let last_items = rows(
                    &c,
                    "SELECT si.name, COALESCE(si.variant_name, '') AS variant_name, SUM(si.quantity) AS quantity, ROUND(SUM(si.subtotal), 2) AS amount
                     FROM sale_items si
                     JOIN sales s ON si.sale_id = s.id
                     WHERE s.status='completed' AND s.shift_id = ?1
                     GROUP BY si.name, si.variant_name
                     ORDER BY amount DESC",
                    &[&last_id],
                ).unwrap_or_default();
                let last_gross: f64 = c.query_row(
                    "SELECT COALESCE(SUM(total), 0) FROM sales WHERE status='completed' AND shift_id = ?1",
                    params![last_id],
                    |r| r.get(0)
                ).unwrap_or(l["cash_sales"].as_f64().unwrap_or(0.0));
                let last_orders: i64 = c.query_row(
                    "SELECT COUNT(*) FROM sales WHERE status='completed' AND shift_id = ?1",
                    params![last_id],
                    |r| r.get(0)
                ).unwrap_or(0);
                l["gross_sales"] = json!(r2(last_gross));
                l["orders_count"] = json!(last_orders);
                l["sold_items"] = Value::Array(last_items);
                Some(l)
            } else {
                None
            };
            Ok(json!({ "is_open": false, "last_shift": last_shift }))
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

    let sold_items = rows(
        &c,
        "SELECT si.name, COALESCE(si.variant_name, '') AS variant_name, SUM(si.quantity) AS quantity, ROUND(SUM(si.subtotal), 2) AS amount
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.status='completed' AND (s.shift_id = ?1 OR (s.shift_id IS NULL AND s.created_at >= ?2))
         GROUP BY si.name, si.variant_name
         ORDER BY amount DESC",
        &[&shift_id, &opened_at],
    ).unwrap_or_default();

    let orders_count: i64 = c.query_row(
        "SELECT COUNT(*) FROM sales WHERE status='completed' AND (shift_id = ?1 OR (shift_id IS NULL AND created_at >= ?2))",
        params![shift_id, opened_at],
        |r| r.get(0)
    ).unwrap_or(0);

    Ok(json!({
        "id": shift_id,
        "business_date": biz_date,
        "opening_cash": r2(opening_cash),
        "gross_sales": r2(cash_sales),
        "cash_sales": r2(cash_sales),
        "orders_count": orders_count,
        "sold_items": Value::Array(sold_items),
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
