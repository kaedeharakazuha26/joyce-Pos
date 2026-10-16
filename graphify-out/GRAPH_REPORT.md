# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 29 files · ~96,852 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 212 nodes · 698 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `11aee41b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cmds.rs
- package.json
- printer.rs
- tauri.conf.json
- ui.jsx
- App.jsx
- useToast
- db.rs
- Db
- default.json
- set-version.mjs
- joyce-pos
- Value
- comm_args
- R
- Expenses.jsx
- Settings.jsx

## God Nodes (most connected - your core abstractions)
1. `Db` - 42 edges
2. `errText()` - 23 edges
3. `Empty()` - 21 edges
4. `useToast()` - 21 edges
5. `ymd()` - 20 edges
6. `peso()` - 20 edges
7. `PageHeader()` - 19 edges
8. `Modal()` - 19 edges
9. `rows()` - 18 edges
10. `Field()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `send_usb()` --calls--> `e()`  [INFERRED]
  src-tauri/src/printer.rs → src-tauri/src/cmds.rs
- `list_products()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `save_product()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `create_sale()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `list_sales()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (21 total, 7 thin omitted)

### Community 0 - "cmds.rs"
Cohesion: 0.27
Nodes (3): dashboard(), now(), scalar()

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+18 more)

### Community 2 - "printer.rs"
Cohesion: 0.22
Nodes (11): e(), ascii(), build_receipt(), g(), hex(), list_usb(), money(), send() (+3 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ui.jsx"
Cohesion: 0.35
Nodes (14): PageHeader(), RangeBar(), ToastCtx, Commission(), CommissionBase(), LDCommission(), Dashboard(), Stat() (+6 more)

### Community 5 - "App.jsx"
Cohesion: 0.26
Nodes (10): lucide-react, react, api, App(), NAV, SettingsCtx, PinLock(), ToastProvider() (+2 more)

### Community 6 - "useToast"
Cohesion: 0.45
Nodes (14): useSettings(), Empty(), Modal(), Receipt(), useToast(), Employees(), Inventory(), POS() (+6 more)

### Community 8 - "Db"
Cohesion: 0.23
Nodes (15): add_commission_type(), backup_db(), change_admin_pin(), delete_cashier(), delete_commission(), delete_employee(), delete_expense(), delete_ld_commission() (+7 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "Value"
Cohesion: 0.27
Nodes (13): list_cashiers(), list_commission_types(), list_commissions(), list_employees(), list_expenses(), list_ld_commissions(), list_products(), list_restocks() (+5 more)

### Community 17 - "comm_args"
Cohesion: 0.29
Nodes (10): comm_args(), num(), save_cashier(), save_commission(), save_employee(), save_expense(), save_ld_commission(), save_product() (+2 more)

### Community 18 - "R"
Cohesion: 0.33
Nodes (9): create_sale(), get_settings(), list_usb_devices(), load_settings(), print_receipt(), print_test(), r2(), sale_detail() (+1 more)

### Community 19 - "Expenses.jsx"
Cohesion: 0.83
Nodes (3): Field(), blank(), Expenses()

### Community 20 - "Settings.jsx"
Cohesion: 0.50
Nodes (3): ALL_PERMISSIONS, DEFAULTS, sample

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 65 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `package.json`, `ui.jsx`, `useToast`, `Expenses.jsx`, `Settings.jsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `Db` connect `Db` to `cmds.rs`, `db.rs`, `Value`, `comm_args`, `R`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `package.json`, `ui.jsx`, `useToast`, `Expenses.jsx`, `Settings.jsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._