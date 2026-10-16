# Graph Report - Joy-Pos-Multiplatform  (2026-10-17)

## Corpus Check
- 25 files · ~91,278 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 1, .icns 1, .ico 1)

## Summary
- 183 nodes · 534 edges · 14 communities (9 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- cmds.rs
- package.json
- printer.rs
- tauri.conf.json
- ui.jsx
- App.jsx
- Expenses.jsx
- db.rs
- Transactions.jsx
- default.json
- set-version.mjs
- joyce-pos

## God Nodes (most connected - your core abstractions)
1. `Db` - 26 edges
2. `ymd()` - 18 edges
3. `useToast()` - 17 edges
4. `errText()` - 17 edges
5. `peso()` - 16 edges
6. `PageHeader()` - 15 edges
7. `Empty()` - 15 edges
8. `Transactions()` - 14 edges
9. `Modal()` - 13 edges
10. `Field()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `send_usb()` --calls--> `e()`  [INFERRED]
  src-tauri/src/printer.rs → src-tauri/src/cmds.rs
- `Settings()` --calls--> `useSettings()`  [EXTRACTED]
  src/pages/Settings.jsx → src/App.jsx
- `POS()` --calls--> `Modal()`  [EXTRACTED]
  src/pages/POS.jsx → src/components/ui.jsx
- `Salary()` --calls--> `Modal()`  [EXTRACTED]
  src/pages/Salary.jsx → src/components/ui.jsx
- `Transactions()` --calls--> `Modal()`  [EXTRACTED]
  src/pages/Transactions.jsx → src/components/ui.jsx

## Import Cycles
- 2-file cycle: `src-tauri/src/cmds.rs -> src-tauri/src/printer.rs -> src-tauri/src/cmds.rs`

## Communities (14 total, 5 thin omitted)

### Community 0 - "cmds.rs"
Cohesion: 0.18
Nodes (33): backup_db(), create_sale(), dashboard(), delete_expense(), delete_product(), delete_salary(), get_settings(), list_expenses() (+25 more)

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
Cohesion: 0.42
Nodes (11): Empty(), RangeBar(), ToastCtx, Dashboard(), Stat(), blank(), Salary(), daysAgo() (+3 more)

### Community 5 - "App.jsx"
Cohesion: 0.32
Nodes (7): lucide-react, react, api, NAV, SettingsCtx, DEFAULTS, sample

### Community 6 - "Expenses.jsx"
Cohesion: 0.44
Nodes (11): Field(), Modal(), PageHeader(), useToast(), blank(), Expenses(), Inventory(), blank (+3 more)

### Community 8 - "Transactions.jsx"
Cohesion: 0.62
Nodes (6): useSettings(), Receipt(), POS(), Items(), Transactions(), peso()

### Community 9 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

## Knowledge Gaps
- **2 isolated node(s):** `@tauri-apps/cli`, `joyce-pos`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 61 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `Transactions.jsx`, `package.json`, `ui.jsx`, `Expenses.jsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `@tauri-apps/cli`, `joyce-pos` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `Transactions.jsx`, `package.json`, `ui.jsx`, `Expenses.jsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `Db` connect `cmds.rs` to `db.rs`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._