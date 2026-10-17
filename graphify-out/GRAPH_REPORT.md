# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 39 files · ~132,151 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 331 nodes · 1172 edges · 14 communities (9 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e73e59b3`
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
- cmds.rs
- default.json
- set-version.mjs
- joyce-pos
- JOYCE POS

## God Nodes (most connected - your core abstractions)
1. `Db` - 58 edges
2. `ymd()` - 40 edges
3. `peso()` - 36 edges
4. `rows()` - 35 edges
5. `Empty()` - 33 edges
6. `errText()` - 31 edges
7. `log_audit()` - 29 edges
8. `Modal()` - 26 edges
9. `lucide-react` - 23 edges
10. `react` - 22 edges

## Surprising Connections (you probably didn't know these)
- `What is Graphify?` --references--> `ymd()`  [INFERRED]
  README.md → src/utils.js
- `send_usb()` --calls--> `e()`  [INFERRED]
  src-tauri/src/printer.rs → src-tauri/src/cmds.rs
- `InteractiveTrendChart()` --calls--> `Empty()`  [EXTRACTED]
  src/components/admin/AdminCharts.jsx → src/components/ui.jsx
- `InteractiveTrendChart()` --calls--> `peso()`  [EXTRACTED]
  src/components/admin/AdminCharts.jsx → src/utils.js
- `InteractiveDoughnutChart()` --calls--> `Empty()`  [EXTRACTED]
  src/components/admin/AdminCharts.jsx → src/components/ui.jsx

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (14 total, 5 thin omitted)

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

### Community 7 - "db.rs"
Cohesion: 0.15
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "cmds.rs"
Cohesion: 0.12
Nodes (71): active_business_date(), add_commission_type(), admin_dashboard(), backup_db(), branch_info_json(), build_activity_feed(), business_now(), change_admin_pin() (+63 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 20 - "JOYCE POS"
Cohesion: 0.05
Nodes (39): 1. Variant-Aware Inventory Deduction, 2. Shift Cash Reconciliation (SOD & EOD), 3. Native Thermal Printer Pipeline, 4. Multi-Branch Isolation, Architecture & How It Works, Automated Git Hooks, Backup & Disaster Recovery, Building for Production (+31 more)

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 101 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ymd()` connect `App.jsx` to `JOYCE POS`, `ui.jsx`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `What is Graphify?` connect `JOYCE POS` to `App.jsx`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `cmds.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.12285456187895212 - nodes in this community are weakly interconnected._
- **Should `JOYCE POS` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._