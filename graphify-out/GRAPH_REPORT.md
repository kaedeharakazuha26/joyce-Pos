# Graph Report - Joy-Pos-Multiplatform  (2026-10-18)

## Corpus Check
- 49 files · ~135,574 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 266 nodes · 772 edges · 23 communities (10 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0d985048`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App
- package.json
- printer.rs
- tauri.conf.json
- ui.jsx
- App.jsx
- db.rs
- default.json
- set-version.mjs
- joyce-pos
- ui.jsx
- JOYCE POS

## God Nodes (most connected - your core abstractions)
1. `ymd()` - 40 edges
2. `peso()` - 38 edges
3. `Empty()` - 33 edges
4. `errText()` - 31 edges
5. `Modal()` - 26 edges
6. `useToast()` - 23 edges
7. `lucide-react` - 23 edges
8. `react` - 22 edges
9. `Field()` - 21 edges
10. `PageHeader()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `What is Graphify?` --references--> `ymd()`  [INFERRED]
  README.md → src/utils.js
- `AdminChartsSection()` --calls--> `Empty()`  [EXTRACTED]
  src/components/admin/AdminCharts.jsx → src/components/ui.jsx
- `InteractiveDoughnutChart()` --calls--> `Empty()`  [EXTRACTED]
  src/components/admin/AdminCharts.jsx → src/components/ui.jsx
- `InteractiveTrendChart()` --calls--> `Empty()`  [EXTRACTED]
  src/components/admin/AdminCharts.jsx → src/components/ui.jsx
- `AdminAlertsAndActivity()` --calls--> `Empty()`  [EXTRACTED]
  src/components/admin/AdminKpiGrid.jsx → src/components/ui.jsx

## Import Cycles
- None detected.

## Communities (23 total, 13 thin omitted)

### Community 0 - "App"
Cohesion: 0.18
Nodes (5): react-dom, App(), PageErrorBoundary, PinLock(), ToastProvider()

### Community 1 - "package.json"
Cohesion: 0.08
Nodes (25): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+17 more)

### Community 2 - "printer.rs"
Cohesion: 0.23
Nodes (10): ascii(), build_receipt(), g(), hex(), list_usb(), money(), send(), send_usb() (+2 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ui.jsx"
Cohesion: 0.23
Nodes (22): lucide-react, AdminChartsSection(), InteractiveDoughnutChart(), InteractiveTrendChart(), AdminAlertsAndActivity(), AdminKpiGrid(), AdminCrudModals(), AdminOverviewPnL() (+14 more)

### Community 5 - "App.jsx"
Cohesion: 0.21
Nodes (32): react, api, GATED_SHIFT_TABS, NAV, SettingsCtx, useSettings(), Empty(), Field() (+24 more)

### Community 7 - "db.rs"
Cohesion: 0.15
Nodes (6): BranchConfig, BranchInfo, BranchState, Db, init(), init_branch_state()

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "ui.jsx"
Cohesion: 0.26
Nodes (19): buildExcelHtml(), buildExportDataset(), useAdminController(), RangeBar(), ToastCtx, Dashboard(), Stat(), DATE_PRESETS (+11 more)

### Community 20 - "JOYCE POS"
Cohesion: 0.05
Nodes (39): 1. Variant-Aware Inventory Deduction, 2. Shift Cash Reconciliation (SOD & EOD), 3. Native Thermal Printer Pipeline, 4. Multi-Branch Isolation, Architecture & How It Works, Automated Git Hooks, Backup & Disaster Recovery, Building for Production (+31 more)

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 114 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ymd()` connect `ui.jsx` to `App`, `ui.jsx`, `JOYCE POS`, `App.jsx`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Why does `What is Graphify?` connect `JOYCE POS` to `ui.jsx`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `db.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.14761904761904762 - nodes in this community are weakly interconnected._
- **Should `JOYCE POS` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._