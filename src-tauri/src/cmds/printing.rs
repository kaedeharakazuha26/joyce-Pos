use crate::cmds::common::*;
use crate::cmds::sales::sale_detail;
use crate::cmds::system::load_settings;
use crate::db::Db;
use crate::printer;
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
