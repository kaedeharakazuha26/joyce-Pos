# Graph Report - Joy-Pos-Multiplatform  (2026-10-19)

## Corpus Check
- 50 files · ~149,911 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 401 nodes · 1333 edges · 24 communities (15 shown, 9 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 112 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `407d3f4a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.jsx
- package.json
- printer.rs
- tauri.conf.json
- lucide-react
- App.jsx
- AdminDashboard.jsx
- db.rs
- sales.rs
- default.json
- set-version.mjs
- joyce-pos
- ymd
- auth.rs
- JOYCE POS
- rows
- PageErrorBoundary
- Db

## God Nodes (most connected - your core abstractions)
1. `Db` - 69 edges
2. `ymd()` - 45 edges
3. `peso()` - 40 edges
4. `rows()` - 38 edges
5. `Empty()` - 35 edges
6. `errText()` - 35 edges
7. `Modal()` - 30 edges
8. `log_audit()` - 30 edges
9. `useToast()` - 25 edges
10. `lucide-react` - 24 edges

## Surprising Connections (you probably didn't know these)
- `What is Graphify?` --references--> `ymd()`  [INFERRED]
  README.md → src/utils.js
- `change_admin_pin()` --calls--> `log_audit()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs
- `delete_cashier()` --calls--> `log_audit()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs
- `delete_cashier()` --calls--> `rows()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs
- `list_cashiers()` --calls--> `rows()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs

## Import Cycles
- None detected.

## Communities (24 total, 9 thin omitted)

### Community 0 - "App.jsx"
Cohesion: 0.26
Nodes (10): App(), GATED_SHIFT_TABS, NAV, SettingsCtx, LoginBackground, PinLock(), ToastProvider(), Commission() (+2 more)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+18 more)

### Community 2 - "printer.rs"
Cohesion: 0.25
Nodes (12): e(), ascii(), build_receipt(), build_z_reading(), g(), hex(), list_usb(), money() (+4 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "lucide-react"
Cohesion: 0.52
Nodes (8): lucide-react, react, AdminOverviewPnL(), TablePagination(), AdminPayrollAuditTables(), AdminReportsModule(), AdminSalesInventoryTables(), StatusBadge()

### Community 5 - "App.jsx"
Cohesion: 0.25
Nodes (28): api, useSettings(), DashboardCrudModule(), Empty(), Field(), Modal(), PageHeader(), Receipt() (+20 more)

### Community 6 - "AdminDashboard.jsx"
Cohesion: 0.18
Nodes (20): AdminChartsSection(), InteractiveDoughnutChart(), InteractiveTrendChart(), AdminAlertsAndActivity(), AdminKpiGrid(), AdminCrudModals(), aggregateDailySeries(), buildExcelHtml() (+12 more)

### Community 7 - "db.rs"
Cohesion: 0.14
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "sales.rs"
Cohesion: 0.12
Nodes (10): r2(), scalar(), admin_dashboard(), build_activity_feed(), dashboard(), create_sale(), list_sales(), list_voided() (+2 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 14 - "ymd"
Cohesion: 0.40
Nodes (14): RangeBar(), ToastCtx, blank(), daysAgo(), lastMonthRange(), lastWeekRange(), monthStart(), pad() (+6 more)

### Community 16 - "auth.rs"
Cohesion: 0.56
Nodes (5): change_admin_pin(), delete_cashier(), list_cashiers(), save_cashier(), verify_pin()

### Community 20 - "JOYCE POS"
Cohesion: 0.04
Nodes (44): 1. Variant-Aware Inventory Deduction, 2. Shift Cash Reconciliation (SOD & EOD), 3. Native Thermal Printer Pipeline, 4. Multi-Branch Isolation, 5. End of Day (EOD) Thermal Z-Reading & Financial Net Formula, 6. Luxury Theme Engine: Black Gold & White Gold, 7. Interactive Login Experience & Moving Objects Engine, 8. Enterprise Terminal Security & Kiosk Protection (+36 more)

### Community 21 - "rows"
Cohesion: 0.13
Nodes (32): active_business_date(), business_now(), get_active_shift(), log_audit(), now(), num(), rows(), text() (+24 more)

### Community 23 - "Db"
Cohesion: 0.16
Nodes (27): list_usb_devices(), print_receipt(), print_test(), print_z_reading(), end_day(), get_shift_status(), list_shifts(), start_day() (+19 more)

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `auth.rs`, `sales.rs`, `rows`, `db.rs`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `rows()` (e.g. with `delete_cashier()` and `list_cashiers()`) actually correct?**
  _`rows()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `ymd()` connect `ymd` to `App.jsx`, `lucide-react`, `App.jsx`, `AdminDashboard.jsx`, `JOYCE POS`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `db.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._