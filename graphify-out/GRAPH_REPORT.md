# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 39 files · ~129,554 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 299 nodes · 1139 edges · 17 communities (12 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `722be8ac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageErrorBoundary
- package.json
- printer.rs
- tauri.conf.json
- ui.jsx
- App.jsx
- db.rs
- Db
- default.json
- set-version.mjs
- joyce-pos
- Value
- comm_args
- cmds.rs
- JOYCE POS

## God Nodes (most connected - your core abstractions)
1. `Db` - 58 edges
2. `ymd()` - 39 edges
3. `peso()` - 36 edges
4. `rows()` - 35 edges
5. `Empty()` - 33 edges
6. `errText()` - 31 edges
7. `log_audit()` - 29 edges
8. `Modal()` - 26 edges
9. `lucide-react` - 23 edges
10. `react` - 22 edges

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

## Communities (17 total, 5 thin omitted)

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
Cohesion: 0.16
Nodes (35): AdminChartsSection(), InteractiveDoughnutChart(), InteractiveTrendChart(), AdminAlertsAndActivity(), AdminKpiGrid(), AdminOverviewPnL(), TablePagination(), AdminPayrollAuditTables() (+27 more)

### Community 5 - "App.jsx"
Cohesion: 0.19
Nodes (41): lucide-react, react, api, App(), GATED_SHIFT_TABS, NAV, SettingsCtx, useSettings() (+33 more)

### Community 7 - "db.rs"
Cohesion: 0.15
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "Db"
Cohesion: 0.23
Nodes (28): add_commission_type(), backup_db(), branch_info_json(), change_admin_pin(), create_branch(), delete_branch(), delete_cashier(), delete_commission() (+20 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "Value"
Cohesion: 0.19
Nodes (18): get_shift_status(), global_search(), list_cashiers(), list_commission_types(), list_commissions(), list_employees(), list_expenses(), list_ld_commissions() (+10 more)

### Community 17 - "comm_args"
Cohesion: 0.35
Nodes (12): active_business_date(), business_now(), comm_args(), get_active_shift(), num(), save_commission(), save_employee(), save_expense() (+4 more)

### Community 18 - "cmds.rs"
Cohesion: 0.16
Nodes (13): admin_dashboard(), build_activity_feed(), create_sale(), dashboard(), get_settings(), list_audit_logs(), load_settings(), print_receipt() (+5 more)

### Community 20 - "JOYCE POS"
Cohesion: 0.25
Nodes (7): Data location, Develop, Features, JOYCE POS, Knowledge graph (graphify), Printing, Release

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 79 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `Value`, `comm_args`, `cmds.rs`, `db.rs`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `package.json`, `ui.jsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.jsx` to `package.json`, `ui.jsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._