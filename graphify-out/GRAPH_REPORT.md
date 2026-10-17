# Graph Report - Joy-Pos-Multiplatform  (2026-10-18)

## Corpus Check
- 39 files · ~135,138 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 334 nodes · 1197 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ff270a12`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageErrorBoundary
- package.json
- printer.rs
- tauri.conf.json
- ui.jsx
- App.jsx
- R
- db.rs
- Db
- default.json
- set-version.mjs
- joyce-pos
- cmds.rs
- Connection
- perform_eod_snapshot
- JOYCE POS

## God Nodes (most connected - your core abstractions)
1. `Db` - 60 edges
2. `ymd()` - 40 edges
3. `peso()` - 38 edges
4. `rows()` - 35 edges
5. `Empty()` - 33 edges
6. `errText()` - 31 edges
7. `log_audit()` - 30 edges
8. `Modal()` - 26 edges
9. `lucide-react` - 23 edges
10. `useToast()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `What is Graphify?` --references--> `ymd()`  [INFERRED]
  README.md → src/utils.js
- `send_usb()` --calls--> `e()`  [INFERRED]
  src-tauri/src/printer.rs → src-tauri/src/cmds.rs
- `list_products()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `save_product()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs
- `create_sale()` --references--> `Db`  [EXTRACTED]
  src-tauri/src/cmds.rs → src-tauri/src/db.rs

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (18 total, 5 thin omitted)

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
Cohesion: 0.18
Nodes (23): AdminChartsSection(), InteractiveDoughnutChart(), InteractiveTrendChart(), AdminAlertsAndActivity(), AdminKpiGrid(), AdminOverviewPnL(), TablePagination(), AdminPayrollAuditTables() (+15 more)

### Community 5 - "App.jsx"
Cohesion: 0.17
Nodes (53): lucide-react, react, api, App(), GATED_SHIFT_TABS, NAV, SettingsCtx, useSettings() (+45 more)

### Community 6 - "R"
Cohesion: 0.27
Nodes (19): admin_dashboard(), build_activity_feed(), global_search(), list_audit_logs(), list_cashiers(), list_commission_types(), list_commissions(), list_employees() (+11 more)

### Community 7 - "db.rs"
Cohesion: 0.14
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "Db"
Cohesion: 0.23
Nodes (22): add_commission_type(), backup_db(), change_admin_pin(), delete_cashier(), delete_commission(), delete_employee(), delete_expense(), delete_ld_commission() (+14 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 14 - "cmds.rs"
Cohesion: 0.18
Nodes (10): create_sale(), dashboard(), get_settings(), load_settings(), print_receipt(), print_test(), r2(), sale_detail() (+2 more)

### Community 15 - "Connection"
Cohesion: 0.35
Nodes (12): active_business_date(), business_now(), comm_args(), get_active_shift(), num(), save_commission(), save_employee(), save_expense() (+4 more)

### Community 16 - "perform_eod_snapshot"
Cohesion: 0.24
Nodes (10): branch_info_json(), create_branch(), delete_branch(), end_day(), get_branch_info(), now(), perform_eod_snapshot(), set_storage_dir() (+2 more)

### Community 20 - "JOYCE POS"
Cohesion: 0.05
Nodes (39): 1. Variant-Aware Inventory Deduction, 2. Shift Cash Reconciliation (SOD & EOD), 3. Native Thermal Printer Pipeline, 4. Multi-Branch Isolation, Architecture & How It Works, Automated Git Hooks, Backup & Disaster Recovery, Building for Production (+31 more)

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 102 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ymd()` connect `App.jsx` to `JOYCE POS`, `ui.jsx`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `What is Graphify?` connect `JOYCE POS` to `App.jsx`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `db.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._
- **Should `JOYCE POS` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._