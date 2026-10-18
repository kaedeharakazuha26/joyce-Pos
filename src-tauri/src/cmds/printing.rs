use crate::cmds::common::*;
use crate::cmds::sales::sale_detail;
use crate::cmds::system::load_settings;
use crate::db::Db;
use crate::printer;
use rusqlite::OptionalExtension;
use serde_json::{json, Value};
use tauri::State;

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
pub fn print_z_reading(
    db: State<Db>,
    shift_id: Option<i64>,
    closing_cash: Option<f64>,
    closing_notes: Option<String>,
    closed_by: Option<String>,
) -> R<()> {
    let (shift_val, st) = {
        let c = db.0.lock().map_err(e)?;
        let st = load_settings(&c)?;

        // Find shift: by shift_id if provided, else open shift, else most recent shift
        let shift_row: Option<(i64, String, String, String, String, f64, Option<f64>, Option<String>, Option<String>)> = if let Some(sid) = shift_id {
            c.query_row(
                "SELECT id, business_date, status, opened_by, opened_at, opening_cash, closing_cash, closed_by, notes FROM shifts WHERE id = ?1",
                rusqlite::params![sid],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?)),
            ).optional().map_err(e)?
        } else {
            let open_opt = c.query_row(
                "SELECT id, business_date, status, opened_by, opened_at, opening_cash, closing_cash, closed_by, notes FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?)),
            ).optional().map_err(e)?;

            if open_opt.is_some() {
                open_opt
            } else {
                c.query_row(
                    "SELECT id, business_date, status, opened_by, opened_at, opening_cash, closing_cash, closed_by, notes FROM shifts ORDER BY id DESC LIMIT 1",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?)),
                ).optional().map_err(e)?
            }
        };

        let Some((sid, bdate, status, op_by, op_at, op_cash, cl_cash, cl_by, notes)) = shift_row else {
            return Err("No shift found to print Z-Reading for.".into());
        };

        let gross_sales: f64 = c.query_row(
            "SELECT COALESCE(SUM(total), 0) FROM sales WHERE status='completed' AND (shift_id = ?1 OR (shift_id IS NULL AND created_at >= ?2))",
            rusqlite::params![sid, op_at],
            |r| r.get(0)
        ).unwrap_or(0.0);

        let cash_sales = gross_sales;

        let expenses: f64 = c.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE shift_id = ?1",
            rusqlite::params![sid],
            |r| r.get(0)
        ).unwrap_or(0.0);

        let salaries: f64 = c.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM salaries WHERE shift_id = ?1",
            rusqlite::params![sid],
            |r| r.get(0)
        ).unwrap_or(0.0);

        let commissions: f64 = c.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE shift_id = ?1",
            rusqlite::params![sid],
            |r| r.get(0)
        ).unwrap_or(0.0);

        let ld_commissions: f64 = c.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM ld_commissions WHERE shift_id = ?1",
            rusqlite::params![sid],
            |r| r.get(0)
        ).unwrap_or(0.0);

        let sold_items = rows(
            &c,
            "SELECT si.name, COALESCE(si.variant_name, '') AS variant_name, SUM(si.quantity) AS quantity, ROUND(SUM(si.subtotal), 2) AS amount
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE s.status='completed' AND (s.shift_id = ?1 OR (s.shift_id IS NULL AND s.created_at >= ?2))
             GROUP BY si.name, si.variant_name
             ORDER BY amount DESC",
            &[&sid, &op_at],
        )?;

        let final_closed_by = closed_by.unwrap_or_else(|| cl_by.unwrap_or_else(|| "Cashier".into()));
        let final_notes = closing_notes.unwrap_or_else(|| notes.unwrap_or_default());
        let final_closing_cash = closing_cash.or(cl_cash).unwrap_or(0.0);

        let shift_val = json!({
            "id": sid,
            "business_date": bdate,
            "status": status,
            "opened_by": op_by,
            "opened_at": op_at,
            "closed_by": final_closed_by,
            "opening_cash": op_cash,
            "gross_sales": gross_sales,
            "cash_sales": cash_sales,
            "expenses": expenses,
            "salaries": salaries,
            "commissions": commissions,
            "ld_commissions": ld_commissions,
            "sold_items": sold_items,
            "closing_notes": final_notes,
            "closing_cash": final_closing_cash,
        });

        (shift_val, st)
    };

    let closing_cash_val = shift_val["closing_cash"].as_f64().unwrap_or(0.0);
    let closing_notes_val = shift_val["closing_notes"].as_str().unwrap_or("");
    printer::send(&st, printer::build_z_reading(&shift_val, &st, closing_cash_val, closing_notes_val))
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
