use rusqlite::Connection;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

/// Creates all tables if they don't exist yet. Safe to run on every start / after restore.
pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = OFF;

        CREATE TABLE IF NOT EXISTS products(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL DEFAULT 0,      -- price of 1 base unit
            cost REAL NOT NULL DEFAULT 0,       -- cost of 1 base unit
            stock INTEGER NOT NULL DEFAULT 0,   -- in base units
            low_stock INTEGER NOT NULL DEFAULT 5,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        -- A variant is a "pack": sells `qty` base units for `price`.
        -- e.g. Candy: 1 pc = 2.00 (base), "3 pcs" qty=3 price=5.00
        CREATE TABLE IF NOT EXISTS variants(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            qty INTEGER NOT NULL,
            price REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sales(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_no TEXT NOT NULL,
            total REAL NOT NULL DEFAULT 0,
            paid REAL NOT NULL DEFAULT 0,
            change_amt REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'completed',
            created_at TEXT NOT NULL,
            voided_at TEXT,
            void_reason TEXT
        );

        CREATE TABLE IF NOT EXISTS sale_items(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            variant_id INTEGER,
            name TEXT NOT NULL,
            variant_name TEXT NOT NULL DEFAULT '',
            units_per INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            cost_total REAL NOT NULL DEFAULT 0
        );

        -- permanent history of voided sales (snapshot of the sale)
        CREATE TABLE IF NOT EXISTS voided_sales(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            receipt_no TEXT NOT NULL,
            total REAL NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            items_json TEXT NOT NULL,
            sold_at TEXT NOT NULL,
            voided_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS restocks(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            qty INTEGER NOT NULL,
            unit_cost REAL NOT NULL DEFAULT 0,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS expenses(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL,
            date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS salaries(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee TEXT NOT NULL,
            amount REAL NOT NULL,
            period TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS settings(
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
        "#,
    )
}
