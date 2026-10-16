# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 27 files · ~92,154 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 191 nodes · 575 edges · 16 communities (9 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b63b5daa`
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
- Transactions.jsx
- default.json
- set-version.mjs
- joyce-pos

## God Nodes (most connected - your core abstractions)
1. `Db` - 29 edges
2. `useToast()` - 19 edges
3. `errText()` - 19 edges
4. `ymd()` - 18 edges
5. `peso()` - 18 edges
6. `Empty()` - 17 edges
7. `PageHeader()` - 17 edges
8. `Field()` - 15 edges
9. `Modal()` - 15 edges
10. `Transactions()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `send_usb()` --calls--> `e()`  [INFERRED]
  src-tauri/src/printer.rs → src-tauri/src/cmds.rs
- `Settings()` --calls--> `useSettings()`  [EXTRACTED]
  src/pages/Settings.jsx → src/App.jsx
- `Transactions()` --calls--> `useSettings()`  [EXTRACTED]
  src/pages/Transactions.jsx → src/App.jsx
- `Employees()` --calls--> `peso()`  [EXTRACTED]
  src/pages/Employees.jsx → src/utils.js
- `Dashboard()` --calls--> `Empty()`  [EXTRACTED]
  src/pages/Dashboard.jsx → src/components/ui.jsx

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (16 total, 7 thin omitted)

### Community 0 - "cmds.rs"
Cohesion: 0.17
Nodes (36): backup_db(), create_sale(), dashboard(), delete_employee(), delete_expense(), delete_product(), delete_salary(), get_settings() (+28 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (28): dependencies, lucide-react, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, devDependencies, @tauri-apps/cli (+20 more)

### Community 2 - "printer.rs"
Cohesion: 0.22
Nodes (11): e(), ascii(), build_receipt(), g(), hex(), list_usb(), money(), send() (+3 more)

### Community 3 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 4 - "ui.jsx"
Cohesion: 0.43
Nodes (10): RangeBar(), ToastCtx, Dashboard(), Stat(), blank(), Expenses(), daysAgo(), monthStart() (+2 more)

### Community 5 - "App.jsx"
Cohesion: 0.27
Nodes (10): lucide-react, react, api, NAV, SettingsCtx, useSettings(), POS(), blank (+2 more)

### Community 6 - "useToast"
Cohesion: 0.43
Nodes (13): Empty(), Field(), Modal(), PageHeader(), useToast(), blank, Employees(), Inventory() (+5 more)

### Community 8 - "Transactions.jsx"
Cohesion: 0.80
Nodes (4): Receipt(), Items(), Transactions(), peso()

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 64 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `Transactions.jsx`, `package.json`, `ui.jsx`, `useToast`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `Transactions.jsx`, `package.json`, `ui.jsx`, `useToast`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `Db` connect `cmds.rs` to `db.rs`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._