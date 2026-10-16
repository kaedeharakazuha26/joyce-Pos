# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 30 files · ~112,791 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 246 nodes · 864 edges · 23 communities (14 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa504db2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Field
- package.json
- printer.rs
- tauri.conf.json
- ymd
- App.jsx
- db.rs
- Db
- default.json
- set-version.mjs
- joyce-pos
- Value
- comm_args
- cmds.rs
- Modal
- Commissions.jsx

## God Nodes (most connected - your core abstractions)
1. `Db` - 55 edges
2. `Modal()` - 25 edges
3. `errText()` - 25 edges
4. `peso()` - 24 edges
5. `ymd()` - 24 edges
6. `useToast()` - 23 edges
7. `Empty()` - 23 edges
8. `Field()` - 21 edges
9. `PageHeader()` - 21 edges
10. `rows()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `send_usb()` --calls--> `e()`  [INFERRED]
  src-tauri/src/printer.rs → src-tauri/src/cmds.rs
- `list_products()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `save_product()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `list_sales()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `list_voided()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (23 total, 9 thin omitted)

### Community 0 - "Field"
Cohesion: 0.83
Nodes (3): Field(), blank(), Expenses()

### Community 1 - "package.json"
Cohesion: 0.08
Nodes (25): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+17 more)

### Community 2 - "printer.rs"
Cohesion: 0.21
Nodes (11): e(), ascii(), build_receipt(), g(), hex(), list_usb(), money(), send() (+3 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ymd"
Cohesion: 0.38
Nodes (12): useSettings(), RangeBar(), ToastCtx, DEFAULT_CARD_ORDER, Dashboard(), Stat(), blank(), Salary() (+4 more)

### Community 5 - "App.jsx"
Cohesion: 0.16
Nodes (14): lucide-react, react, react-dom, api, App(), GATED_SHIFT_TABS, NAV, SettingsCtx (+6 more)

### Community 7 - "db.rs"
Cohesion: 0.15
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "Db"
Cohesion: 0.20
Nodes (28): add_commission_type(), backup_db(), branch_info_json(), change_admin_pin(), create_sale(), delete_branch(), delete_cashier(), delete_commission() (+20 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "Value"
Cohesion: 0.26
Nodes (14): list_cashiers(), list_commission_types(), list_commissions(), list_employees(), list_expenses(), list_ld_commissions(), list_products(), list_restocks() (+6 more)

### Community 17 - "comm_args"
Cohesion: 0.26
Nodes (14): active_business_date(), business_now(), comm_args(), get_active_shift(), num(), restock(), save_cashier(), save_commission() (+6 more)

### Community 18 - "cmds.rs"
Cohesion: 0.17
Nodes (10): admin_dashboard(), create_branch(), dashboard(), end_day(), list_usb_devices(), now(), r2(), save_text_file() (+2 more)

### Community 19 - "Modal"
Cohesion: 0.41
Nodes (16): Empty(), Modal(), PageHeader(), Receipt(), useToast(), AdminDashboard(), Employees(), Inventory() (+8 more)

### Community 23 - "Commissions.jsx"
Cohesion: 0.83
Nodes (3): Commission(), CommissionBase(), LDCommission()

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 74 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `Value`, `comm_args`, `cmds.rs`, `db.rs`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.jsx` to `Field`, `package.json`, `ymd`, `Modal`, `Commissions.jsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `Field`, `package.json`, `ymd`, `Modal`, `Commissions.jsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._