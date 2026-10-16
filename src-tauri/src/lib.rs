mod cmds;
mod db;
mod printer;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = rusqlite::Connection::open(dir.join("joyce_pos.db"))?;
            db::init(&conn)?;
            app.manage(db::Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmds::list_products,
            cmds::save_product,
            cmds::delete_product,
            cmds::create_sale,
            cmds::list_sales,
            cmds::void_sale,
            cmds::list_voided,
            cmds::restock,
            cmds::list_restocks,
            cmds::list_expenses,
            cmds::save_expense,
            cmds::delete_expense,
            cmds::list_salaries,
            cmds::save_salary,
            cmds::delete_salary,
            cmds::list_employees,
            cmds::save_employee,
            cmds::delete_employee,
            cmds::dashboard,
            cmds::get_settings,
            cmds::set_settings,
            cmds::backup_db,
            cmds::restore_db,
            cmds::print_receipt,
            cmds::print_test,
            cmds::list_usb_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running JOYCE POS");
}
