# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 30 files · ~109,037 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 244 nodes · 859 edges · 23 communities (14 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e1bd79f2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- printer.rs
- tauri.conf.json
- ymd
- App.jsx
- useToast
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
8. `PageHeader()` - 21 edges
9. `rows()` - 20 edges
10. `Field()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `AdminDashboard()` --calls--> `useSettings()`  [EXTRACTED]
  src/pages/AdminDashboard.jsx → src/App.jsx
- `AdminDashboard()` --calls--> `Empty()`  [EXTRACTED]
  src/pages/AdminDashboard.jsx → src/components/ui.jsx
- `AdminDashboard()` --calls--> `Modal()`  [EXTRACTED]
  src/pages/AdminDashboard.jsx → src/components/ui.jsx
- `AdminDashboard()` --calls--> `PageHeader()`  [EXTRACTED]
  src/pages/AdminDashboard.jsx → src/components/ui.jsx
- `AdminDashboard()` --calls--> `Receipt()`  [EXTRACTED]
  src/pages/AdminDashboard.jsx → src/components/ui.jsx

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (23 total, 9 thin omitted)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+18 more)

### Community 2 - "printer.rs"
Cohesion: 0.21
Nodes (11): e(), ascii(), build_receipt(), g(), hex(), list_usb(), money(), send() (+3 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ymd"
Cohesion: 0.46
Nodes (10): RangeBar(), AdminDashboard(), blank(), Expenses(), blank(), Salary(), daysAgo(), monthStart() (+2 more)

### Community 5 - "App.jsx"
Cohesion: 0.19
Nodes (14): lucide-react, react, api, App(), GATED_SHIFT_TABS, NAV, SettingsCtx, PinLock() (+6 more)

### Community 6 - "useToast"
Cohesion: 0.49
Nodes (8): useSettings(), Empty(), Receipt(), Dashboard(), Stat(), POS(), Settings(), errText()

### Community 7 - "db.rs"
Cohesion: 0.15
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "Db"
Cohesion: 0.22
Nodes (25): add_commission_type(), backup_db(), branch_info_json(), change_admin_pin(), create_branch(), delete_branch(), delete_cashier(), delete_commission() (+17 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "Value"
Cohesion: 0.26
Nodes (14): list_cashiers(), list_commission_types(), list_commissions(), list_employees(), list_expenses(), list_ld_commissions(), list_products(), list_restocks() (+6 more)

### Community 17 - "comm_args"
Cohesion: 0.31
Nodes (12): active_business_date(), comm_args(), get_active_shift(), num(), save_cashier(), save_commission(), save_employee(), save_expense() (+4 more)

### Community 18 - "cmds.rs"
Cohesion: 0.15
Nodes (14): admin_dashboard(), business_now(), create_sale(), dashboard(), end_day(), list_usb_devices(), now(), print_receipt() (+6 more)

### Community 19 - "Modal"
Cohesion: 0.46
Nodes (11): Field(), Modal(), PageHeader(), useToast(), blank, Employees(), Inventory(), Products() (+3 more)

### Community 23 - "Commissions.jsx"
Cohesion: 0.83
Nodes (3): Commission(), CommissionBase(), LDCommission()

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 73 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `Value`, `comm_args`, `cmds.rs`, `db.rs`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.jsx` to `package.json`, `ymd`, `useToast`, `Modal`, `Commissions.jsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `package.json`, `ymd`, `useToast`, `Modal`, `Commissions.jsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._