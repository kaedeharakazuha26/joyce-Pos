use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BranchInfo {
    pub id: String,
    pub name: String,
    pub file: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BranchConfig {
    pub active_branch: String,
    pub storage_dir: String, // empty string means default app_data_dir
    pub branches: Vec<BranchInfo>,
}

pub struct BranchState {
    pub default_dir: PathBuf,
    pub config: BranchConfig,
}

impl BranchState {
    pub fn config_file(&self) -> PathBuf {
        self.default_dir.join("branches.json")
    }

    pub fn save(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.config).map_err(|e| e.to_string())?;
        std::fs::write(self.config_file(), json).map_err(|e| e.to_string())
    }

    pub fn active_base_dir(&self) -> PathBuf {
        if !self.config.storage_dir.trim().is_empty() {
            let p = PathBuf::from(self.config.storage_dir.trim());
            if p.exists() || std::fs::create_dir_all(&p).is_ok() {
                return p;
            }
        }
        self.default_dir.clone()
    }

    pub fn active_db_path(&self) -> PathBuf {
        let base = self.active_base_dir();
        let branch = self
            .config
            .branches
            .iter()
            .find(|b| b.id == self.config.active_branch)
            .or_else(|| self.config.branches.first());
        let file = branch.map(|b| b.file.as_str()).unwrap_or("joyce_pos.db");
        base.join(file)
    }

    #[allow(dead_code)]
    pub fn branch_db_path(&self, branch_id: &str) -> Option<PathBuf> {
        let base = self.active_base_dir();
        let branch = self.config.branches.iter().find(|b| b.id == branch_id)?;
        Some(base.join(&branch.file))
    }
}

pub fn init_branch_state(default_dir: PathBuf) -> Result<BranchState, String> {
    let cfg_path = default_dir.join("branches.json");
    let mut config = if cfg_path.exists() {
        match std::fs::read_to_string(&cfg_path) {
            Ok(content) => serde_json::from_str::<BranchConfig>(&content).unwrap_or_else(|_| BranchConfig {
                active_branch: "main".into(),
                storage_dir: "".into(),
                branches: vec![BranchInfo {
                    id: "main".into(),
                    name: "Main Store".into(),
                    file: "joyce_pos.db".into(),
                    created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                }],
            }),
            Err(_) => BranchConfig {
                active_branch: "main".into(),
                storage_dir: "".into(),
                branches: vec![BranchInfo {
                    id: "main".into(),
                    name: "Main Store".into(),
                    file: "joyce_pos.db".into(),
                    created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                }],
            },
        }
    } else {
        BranchConfig {
            active_branch: "main".into(),
            storage_dir: "".into(),
            branches: vec![BranchInfo {
                id: "main".into(),
                name: "Main Store".into(),
                file: "joyce_pos.db".into(),
                created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            }],
        }
    };

    if config.branches.is_empty() {
        config.branches.push(BranchInfo {
            id: "main".into(),
            name: "Main Store".into(),
            file: "joyce_pos.db".into(),
            created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        });
    }

    let state = BranchState { default_dir, config };
    let _ = state.save();
    Ok(state)
}

pub struct Db(pub Mutex<Connection>, pub Mutex<BranchState>);

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
            image TEXT NOT NULL DEFAULT '',
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
            void_reason TEXT,
            voided_by TEXT NOT NULL DEFAULT ''
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
            voided_at TEXT NOT NULL,
            voided_by TEXT NOT NULL DEFAULT ''
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

        CREATE TABLE IF NOT EXISTS employees(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            position TEXT NOT NULL DEFAULT '',
            commission REAL NOT NULL DEFAULT 0,     -- flat amount (PHP)
            ld_commission REAL NOT NULL DEFAULT 0,  -- LD (load) flat amount (PHP)
            salary REAL NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS commission_types(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO commission_types(name) VALUES('Sales'),('Bonus'),('Referral');

        CREATE TABLE IF NOT EXISTS commissions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            employee_id INTEGER,
            employee_name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ld_commissions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            employee_id INTEGER,
            employee_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            amount REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cashiers(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            pin TEXT NOT NULL UNIQUE,
            permissions TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings(
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shifts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            opened_by TEXT NOT NULL DEFAULT '',
            opened_at TEXT NOT NULL,
            opening_cash REAL NOT NULL DEFAULT 0,
            closed_by TEXT NOT NULL DEFAULT '',
            closed_at TEXT,
            closing_cash REAL NOT NULL DEFAULT 0,
            expected_cash REAL NOT NULL DEFAULT 0,
            cash_sales REAL NOT NULL DEFAULT 0,
            expenses REAL NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
        CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
        "#,
    )?;

    // Safe column migrations for existing databases
    let _ = conn.execute("ALTER TABLE products ADD COLUMN image TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE ld_commissions ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE sales ADD COLUMN voided_by TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE voided_sales ADD COLUMN voided_by TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES('admin_pin', '0000')", []);

    Ok(())
}
