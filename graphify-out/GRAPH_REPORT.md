# Graph Report - Joy-Pos-Multiplatform  (2026-10-18)

## Corpus Check
- 49 files · ~135,574 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 393 nodes · 1273 edges · 27 communities (15 shown, 12 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb8b3af2`
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
- auth.rs
- default.json
- set-version.mjs
- joyce-pos
- ui.jsx
- JOYCE POS
- rows
- Db
- AdminModals.jsx
- products.rs
- sales.rs

## God Nodes (most connected - your core abstractions)
1. `Db` - 68 edges
2. `ymd()` - 42 edges
3. `peso()` - 38 edges
4. `rows()` - 35 edges
5. `Empty()` - 33 edges
6. `errText()` - 31 edges
7. `log_audit()` - 30 edges
8. `Modal()` - 26 edges
9. `useToast()` - 23 edges
10. `lucide-react` - 23 edges

## Surprising Connections (you probably didn't know these)
- `What is Graphify?` --references--> `ymd()`  [INFERRED]
  README.md → src/utils.js
- `change_admin_pin()` --calls--> `log_audit()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs
- `list_cashiers()` --calls--> `rows()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs
- `save_cashier()` --calls--> `log_audit()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs
- `save_cashier()` --calls--> `text()`  [INFERRED]
  src-tauri/src/cmds/auth.rs → src-tauri/src/cmds/common.rs

## Import Cycles
- None detected.

## Communities (27 total, 12 thin omitted)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+18 more)

### Community 2 - "printer.rs"
Cohesion: 0.25
Nodes (10): ascii(), build_receipt(), g(), hex(), list_usb(), money(), send(), send_usb() (+2 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ui.jsx"
Cohesion: 0.30
Nodes (20): lucide-react, react, AdminChartsSection(), InteractiveDoughnutChart(), InteractiveTrendChart(), AdminAlertsAndActivity(), AdminKpiGrid(), AdminCrudModals() (+12 more)

### Community 5 - "App.jsx"
Cohesion: 0.18
Nodes (31): api, App(), GATED_SHIFT_TABS, NAV, SettingsCtx, useSettings(), PinLock(), Field() (+23 more)

### Community 7 - "db.rs"
Cohesion: 0.14
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "auth.rs"
Cohesion: 0.16
Nodes (5): change_admin_pin(), delete_cashier(), list_cashiers(), save_cashier(), verify_pin()

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "ui.jsx"
Cohesion: 0.34
Nodes (17): RangeBar(), ToastCtx, blank(), Expenses(), blank(), Salary(), daysAgo(), lastMonthRange() (+9 more)

### Community 20 - "JOYCE POS"
Cohesion: 0.05
Nodes (39): 1. Variant-Aware Inventory Deduction, 2. Shift Cash Reconciliation (SOD & EOD), 3. Native Thermal Printer Pipeline, 4. Multi-Branch Isolation, Architecture & How It Works, Automated Git Hooks, Backup & Disaster Recovery, Building for Production (+31 more)

### Community 21 - "rows"
Cohesion: 0.12
Nodes (31): active_business_date(), business_now(), get_active_shift(), log_audit(), now(), num(), r2(), rows() (+23 more)

### Community 23 - "Db"
Cohesion: 0.16
Nodes (26): list_usb_devices(), print_receipt(), print_test(), end_day(), get_shift_status(), list_shifts(), start_day(), update_shift_notes() (+18 more)

### Community 24 - "AdminModals.jsx"
Cohesion: 0.26
Nodes (9): buildExcelHtml(), buildExportDataset(), CHART_COLORS, EXPENSE_CATEGORIES, REPORT_TABS, useAdminController(), ConfirmModal(), DATE_PRESETS (+1 more)

### Community 25 - "products.rs"
Cohesion: 0.47
Nodes (6): delete_product(), list_products(), list_restocks(), products_with_variants(), restock(), save_product()

### Community 26 - "sales.rs"
Cohesion: 0.53
Nodes (5): create_sale(), list_sales(), list_voided(), sale_detail(), void_sale()

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 119 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `db.rs`, `auth.rs`, `rows`, `products.rs`, `sales.rs`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `rows()` (e.g. with `delete_cashier()` and `list_cashiers()`) actually correct?**
  _`rows()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `ymd()` connect `ui.jsx` to `AdminModals.jsx`, `ui.jsx`, `JOYCE POS`, `App.jsx`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `db.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._