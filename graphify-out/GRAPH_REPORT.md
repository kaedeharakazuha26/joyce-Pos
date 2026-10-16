# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 29 files · ~99,856 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 230 nodes · 759 edges · 21 communities (13 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c57d413e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cmds.rs
- package.json
- printer.rs
- tauri.conf.json
- ui.jsx
- App.jsx
- useToast
- db.rs
- Db
- default.json
- set-version.mjs
- joyce-pos
- Value
- comm_args
- App.jsx

## God Nodes (most connected - your core abstractions)
1. `Db` - 49 edges
2. `errText()` - 23 edges
3. `Empty()` - 21 edges
4. `Modal()` - 21 edges
5. `useToast()` - 21 edges
6. `ymd()` - 20 edges
7. `peso()` - 20 edges
8. `Field()` - 19 edges
9. `PageHeader()` - 19 edges
10. `rows()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Dashboard()` --calls--> `useSettings()`  [EXTRACTED]
  src/pages/Dashboard.jsx → src/App.jsx
- `App()` --calls--> `PinLock()`  [EXTRACTED]
  src/App.jsx → src/components/PinLock.jsx
- `Dashboard()` --calls--> `Empty()`  [EXTRACTED]
  src/pages/Dashboard.jsx → src/components/ui.jsx
- `Dashboard()` --calls--> `useToast()`  [EXTRACTED]
  src/pages/Dashboard.jsx → src/components/ui.jsx
- `Dashboard()` --calls--> `peso()`  [EXTRACTED]
  src/pages/Dashboard.jsx → src/utils.js

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (21 total, 8 thin omitted)

### Community 0 - "cmds.rs"
Cohesion: 0.20
Nodes (11): create_sale(), dashboard(), get_settings(), load_settings(), now(), print_receipt(), print_test(), r2() (+3 more)

### Community 1 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+18 more)

### Community 2 - "printer.rs"
Cohesion: 0.21
Nodes (11): e(), ascii(), build_receipt(), g(), hex(), list_usb(), money(), send() (+3 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ui.jsx"
Cohesion: 0.35
Nodes (15): PinLock(), PageHeader(), RangeBar(), ToastCtx, Dashboard(), Stat(), blank(), Expenses() (+7 more)

### Community 5 - "App.jsx"
Cohesion: 0.36
Nodes (5): lucide-react, react, api, blank, blank

### Community 6 - "useToast"
Cohesion: 0.35
Nodes (12): useSettings(), Empty(), Receipt(), useToast(), POS(), ALL_PERMISSIONS, DEFAULTS, sample (+4 more)

### Community 7 - "db.rs"
Cohesion: 0.15
Nodes (5): BranchConfig, BranchInfo, BranchState, init(), init_branch_state()

### Community 8 - "Db"
Cohesion: 0.24
Nodes (22): add_commission_type(), backup_db(), branch_info_json(), change_admin_pin(), create_branch(), delete_branch(), delete_cashier(), delete_commission() (+14 more)

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "Value"
Cohesion: 0.27
Nodes (13): list_cashiers(), list_commission_types(), list_commissions(), list_employees(), list_expenses(), list_ld_commissions(), list_products(), list_restocks() (+5 more)

### Community 17 - "comm_args"
Cohesion: 0.29
Nodes (10): comm_args(), num(), save_cashier(), save_commission(), save_employee(), save_expense(), save_ld_commission(), save_product() (+2 more)

### Community 19 - "App.jsx"
Cohesion: 0.33
Nodes (12): App(), NAV, SettingsCtx, Field(), Modal(), ToastProvider(), Commission(), CommissionBase() (+4 more)

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 70 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Db` connect `Db` to `cmds.rs`, `Value`, `comm_args`, `db.rs`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.jsx` to `package.json`, `App.jsx`, `ui.jsx`, `useToast`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `package.json`, `App.jsx`, `ui.jsx`, `useToast`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._