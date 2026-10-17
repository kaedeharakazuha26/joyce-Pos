# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 30 files · ~128,461 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 277 nodes · 1003 edges · 22 communities (17 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2054e20e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageErrorBoundary
- package.json
- printer.rs
- tauri.conf.json
- ymd
- Settings.jsx
- AdminDashboard.jsx
- db.rs
- Db
- default.json
- set-version.mjs
- joyce-pos
- App.jsx
- peso
- Value
- comm_args
- cmds.rs
- Modal
- JOYCE POS
- Commissions.jsx

## God Nodes (most connected - your core abstractions)
1. `Db` - 58 edges
2. `rows()` - 35 edges
3. `ymd()` - 30 edges
4. `log_audit()` - 29 edges
5. `peso()` - 26 edges
6. `Modal()` - 25 edges
7. `Empty()` - 25 edges
8. `errText()` - 25 edges
9. `useToast()` - 23 edges
10. `PageHeader()` - 21 edges

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

## Communities (22 total, 5 thin omitted)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+18 more)

### Community 2 - "printer.rs"
Cohesion: 0.22
Nodes (11): e(), ascii(), build_receipt(), g(), hex(), list_usb(), money(), send() (+3 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ymd"
Cohesion: 0.38
Nodes (13): RangeBar(), ToastCtx, Dashboard(), Stat(), daysAgo(), lastMonthRange(), lastWeekRange(), pad() (+5 more)

### Community 5 - "Settings.jsx"
Cohesion: 0.29
Nodes (6): lucide-react, react, api, ALL_PERMISSIONS, DEFAULTS, sample

### Community 6 - "AdminDashboard.jsx"
Cohesion: 0.29
Nodes (11): Empty(), StatusBadge(), AdminDashboard(), aggregateDailySeries(), CHART_COLORS, EXPENSE_CATEGORIES, InteractiveDoughnutChart(), InteractiveTrendChart() (+3 more)

### Community 7 - "db.rs"
Cohesion: 0.15
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "Db"
Cohesion: 0.23
Nodes (28): add_commission_type(), backup_db(), branch_info_json(), change_admin_pin(), create_branch(), delete_branch(), delete_cashier(), delete_commission() (+20 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 14 - "App.jsx"
Cohesion: 0.31
Nodes (9): App(), GATED_SHIFT_TABS, NAV, SettingsCtx, PinLock(), ToastProvider(), blank(), Salary() (+1 more)

### Community 15 - "peso"
Cohesion: 0.53
Nodes (8): useSettings(), Receipt(), POS(), Settings(), Items(), Transactions(), errText(), peso()

### Community 16 - "Value"
Cohesion: 0.19
Nodes (18): get_shift_status(), global_search(), list_cashiers(), list_commission_types(), list_commissions(), list_employees(), list_expenses(), list_ld_commissions() (+10 more)

### Community 17 - "comm_args"
Cohesion: 0.35
Nodes (12): active_business_date(), business_now(), comm_args(), get_active_shift(), num(), save_commission(), save_employee(), save_expense() (+4 more)

### Community 18 - "cmds.rs"
Cohesion: 0.16
Nodes (13): admin_dashboard(), build_activity_feed(), create_sale(), dashboard(), get_settings(), list_audit_logs(), load_settings(), print_receipt() (+5 more)

### Community 19 - "Modal"
Cohesion: 0.34
Nodes (12): ConfirmModal(), Field(), Modal(), PageHeader(), useToast(), blank, Employees(), blank() (+4 more)

### Community 20 - "JOYCE POS"
Cohesion: 0.25
Nodes (7): Data location, Develop, Features, JOYCE POS, Knowledge graph (graphify), Printing, Release

### Community 23 - "Commissions.jsx"
Cohesion: 0.83
Nodes (3): Commission(), CommissionBase(), LDCommission()

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 83 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `Value`, `comm_args`, `cmds.rs`, `db.rs`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Settings.jsx` to `package.json`, `ymd`, `AdminDashboard.jsx`, `App.jsx`, `peso`, `Modal`, `Commissions.jsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Settings.jsx` to `package.json`, `ymd`, `AdminDashboard.jsx`, `App.jsx`, `peso`, `Modal`, `Commissions.jsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._