# Graph Report - Joy-Pos-Multiplatform  (2026-10-18)

## Corpus Check
- 50 files · ~144,741 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 393 nodes · 1309 edges · 24 communities (15 shown, 9 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c7c05346`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageErrorBoundary
- package.json
- printer.rs
- tauri.conf.json
- ui.jsx
- App.jsx
- ymd
- db.rs
- common
- default.json
- set-version.mjs
- joyce-pos
- adminUtils.js
- AdminModals.jsx
- JOYCE POS
- rows
- Db
- sales.rs

## God Nodes (most connected - your core abstractions)
1. `Db` - 68 edges
2. `ymd()` - 45 edges
3. `peso()` - 40 edges
4. `Empty()` - 35 edges
5. `rows()` - 35 edges
6. `errText()` - 33 edges
7. `Modal()` - 30 edges
8. `log_audit()` - 30 edges
9. `useToast()` - 25 edges
10. `lucide-react` - 24 edges

## Surprising Connections (you probably didn't know these)
- `What is Graphify?` --references--> `ymd()`  [INFERRED]
  README.md → src/utils.js
- `dashboard()` --calls--> `rows()`  [INFERRED]
  src-tauri/src/cmds/dashboard.rs → src-tauri/src/cmds/common.rs
- `dashboard()` --calls--> `scalar()`  [INFERRED]
  src-tauri/src/cmds/dashboard.rs → src-tauri/src/cmds/common.rs
- `build_activity_feed()` --calls--> `rows()`  [INFERRED]
  src-tauri/src/cmds/dashboard.rs → src-tauri/src/cmds/common.rs
- `admin_dashboard()` --calls--> `active_business_date()`  [INFERRED]
  src-tauri/src/cmds/dashboard.rs → src-tauri/src/cmds/common.rs

## Import Cycles
- None detected.

## Communities (24 total, 9 thin omitted)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+18 more)

### Community 2 - "printer.rs"
Cohesion: 0.24
Nodes (11): e(), ascii(), build_receipt(), g(), hex(), list_usb(), money(), send() (+3 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ui.jsx"
Cohesion: 0.38
Nodes (12): lucide-react, AdminAlertsAndActivity(), AdminKpiGrid(), AdminOverviewPnL(), TablePagination(), AdminPayrollAuditTables(), AdminReportsModule(), AdminSalesInventoryTables() (+4 more)

### Community 5 - "App.jsx"
Cohesion: 0.20
Nodes (34): react, api, App(), GATED_SHIFT_TABS, NAV, SettingsCtx, useSettings(), DashboardCrudModule() (+26 more)

### Community 6 - "ymd"
Cohesion: 0.36
Nodes (16): RangeBar(), ToastCtx, Commission(), CommissionBase(), LDCommission(), daysAgo(), lastMonthRange(), lastWeekRange() (+8 more)

### Community 7 - "db.rs"
Cohesion: 0.14
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "common"
Cohesion: 0.16
Nodes (5): change_admin_pin(), delete_cashier(), list_cashiers(), save_cashier(), verify_pin()

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 14 - "adminUtils.js"
Cohesion: 0.25
Nodes (13): AdminChartsSection(), InteractiveDoughnutChart(), InteractiveTrendChart(), aggregateDailySeries(), buildExcelHtml(), buildExportDataset(), CHART_COLORS, REPORT_TABS (+5 more)

### Community 16 - "AdminModals.jsx"
Cohesion: 0.60
Nodes (4): AdminCrudModals(), EXPENSE_CATEGORIES, ConfirmModal(), Receipt()

### Community 20 - "JOYCE POS"
Cohesion: 0.05
Nodes (39): 1. Variant-Aware Inventory Deduction, 2. Shift Cash Reconciliation (SOD & EOD), 3. Native Thermal Printer Pipeline, 4. Multi-Branch Isolation, Architecture & How It Works, Automated Git Hooks, Backup & Disaster Recovery, Building for Production (+31 more)

### Community 21 - "rows"
Cohesion: 0.13
Nodes (33): active_business_date(), business_now(), get_active_shift(), log_audit(), now(), num(), rows(), scalar() (+25 more)

### Community 23 - "Db"
Cohesion: 0.13
Nodes (30): r2(), admin_dashboard(), build_activity_feed(), dashboard(), list_usb_devices(), print_receipt(), print_test(), end_day() (+22 more)

### Community 26 - "sales.rs"
Cohesion: 0.53
Nodes (5): create_sale(), list_sales(), list_voided(), sale_detail(), void_sale()

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 116 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `common`, `sales.rs`, `rows`, `db.rs`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `rows()` (e.g. with `delete_cashier()` and `list_cashiers()`) actually correct?**
  _`rows()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `ymd()` connect `ymd` to `ui.jsx`, `JOYCE POS`, `App.jsx`, `adminUtils.js`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `db.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._