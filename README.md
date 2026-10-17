# JOYCE POS

> **Offline-First Multiplatform Point of Sale System** for retail stores, convenience shops, and sari-sari stores.  
> Engineered with **React 18** (Vite) on the front end, **Tauri v2** (Rust) on the native desktop layer, and an embedded **SQLite** database with WAL mode for fast, resilient, zero-cloud operation.

---

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & How It Works](#architecture--how-it-works)
  - [High-Level Data Flow](#high-level-data-flow)
  - [Core Subsystems](#core-subsystems)
- [Project Structure](#project-structure)
  - [Directory Breakdown](#directory-breakdown)
  - [Key File Responsibilities](#key-file-responsibilities)
- [Installation & Setup Tutorial](#installation--setup-tutorial)
  - [System Prerequisites](#system-prerequisites)
  - [Local Development Setup](#local-development-setup)
  - [Building for Production](#building-for-production)
  - [Release Management & CI/CD](#release-management--cicd)
- [Hardware & Thermal Printing Guide](#hardware--thermal-printing-guide)
  - [Supported Printer Interfaces](#supported-printer-interfaces)
  - [Linux udev Setup](#linux-udev-setup)
  - [Windows USB Setup](#windows-usb-setup)
  - [Receipt Layout Customization](#receipt-layout-customization)
- [Knowledge Graph & Code Intelligence (Graphify)](#knowledge-graph--code-intelligence-graphify)
  - [What is Graphify?](#what-is-graphify)
  - [Graphify Artifacts](#graphify-artifacts)
  - [How to Query the Codebase](#how-to-query-the-codebase)
  - [Updating the Knowledge Graph](#updating-the-knowledge-graph)
  - [Automated Git Hooks](#automated-git-hooks)
- [Security, Storage & Database Maintenance](#security-storage--database-maintenance)

---

## Overview

JOYCE POS is built to solve the real-world operational challenges of neighborhood retail and sari-sari stores: intermittent internet, multi-pack inventory pricing, hardware diversity (inexpensive thermal receipt printers), daily shift cash accounting, and multi-branch management.

- **Zero Cloud Lock-In**: Everything runs locally on the host machine.
- **Microsecond Response Times**: Rust-backed SQLite database operating in Write-Ahead Logging (`WAL`) mode.
- **Hardware Agnostic**: Direct ESC/POS byte-level command generation in Rust for 58mm and 80mm thermal receipt printers over USB, Bluetooth RFCOMM, TCP network, or system print dialogs.
- **Audit-Ready**: Strict tracking of inventory deductions, cash reconciliation discrepancies, and voided sales.

---

## Key Features

| Module | Features & Capabilities |
| :--- | :--- |
| **Point of Sale (POS)** | Fast barcode scanner & text search; multi-pack variant pricing; live cart calculation; cash received & change computation; instant ESC/POS receipt printing. |
| **Product & Inventory** | Base unit stock tracking; pack-level variants (e.g., Candy 1 pc = ₱2.00, 3 pcs = ₱5.00 deducting 3 base units); low stock visual alerts; restock logs with unit cost history. |
| **Shift Management** | Start of Day (SOD) opening float; operational tab gating; End of Day (EOD) cash count; automated expected cash calculation vs. actual cash with over/short variance tracking. |
| **Transactions & Voids** | Searchable receipt history; full receipt reprint; audited Void function (automatically restores inventory to base stock and captures reason & staff name). |
| **Admin Dashboard** | Real-time KPI grid (Gross Sales, Net Profit, Operational Expenses, Payroll, Voided Amounts, Inventory Valuation); interactive trend & doughnut charts; date range presets; CSV/Excel/Print data export. |
| **Finance & Payroll** | Store operational expense tracking by category; employee salary disbursements; standard sales commissions and LD (electronic load / airtime) commission tracking. |
| **Staff & Security** | Granular cashier roles and PINs; Master Admin PIN protection; immutable system audit log capturing high-risk operational actions. |
| **Multi-Branch Support** | Switch between distinct store branches on the fly; custom database storage directory configuration; hot branch swapping without application restarts. |
| **Database Ops** | Live SQLite backup & restore; factory database reset with optional catalog retention. |

---

## Architecture & How It Works

JOYCE POS is designed around an offline-first desktop architecture combining a React SPA with a lightweight, secure native Rust backend using Tauri v2.

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 React Frontend (Vite + React 18)            │
│  - State & Views (POS, Admin Dashboard, Inventory, Settings) │
│  - Custom Controller Hooks (useAdminController, useSettings) │
│  - UI Components (PinLock, Charts, Modals, Tables, Toast)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                        Tauri IPC (invoke)
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Tauri v2 Core (Rust)                     │
│  - Command Handlers: `src-tauri/src/cmds.rs`                 │
│  - App State & Mutexes: `Db(Mutex<Connection>, BranchState)` │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
        SQLite Database                Hardware Output
               │                              │
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│     rusqlite (WAL Mode)     ││    ESC/POS Thermal Engine    │
│ - joyce_pos.db              ││  - printer.rs: USB / BT / TCP│
│ - branches.json             ││  - 58mm / 80mm formatting    │
└─────────────────────────────┘└──────────────────────────────┘
```

### Core Subsystems

#### 1. Variant-Aware Inventory Deduction
In neighborhood retail, products are frequently sold in multiple packaging formats (e.g., single stick vs. pack vs. carton).
- The `products` table maintains the physical inventory in **base units** (`stock`).
- The `variants` table defines pack quantities and bundle prices (`product_id`, `qty`, `price`).
- When a variant is sold via `create_sale`, the Rust backend multiplies line item quantity by `units_per` and decrements `stock` in base units inside a database transaction:
  $$\text{Deducted Base Units} = \text{Quantity Sold} \times \text{Units per Variant}$$
- When a sale is **voided**, the exact base unit quantity is added back to the product's inventory, and a permanent snapshot is archived in `voided_sales`.

#### 2. Shift Cash Reconciliation (SOD & EOD)
To prevent employee theft and identify drawer discrepancies:
- **Start of Day (SOD)**: Cashier logs initial float (`opening_cash`) and active business date. Core transaction tabs (`pos`, `expenses`, `salary`, `commission`) remain locked until an active shift is open.
- **During the Shift**: Sales increment cash revenue; expenses, payouts, and commissions reduce the expected drawer cash.
- **End of Day (EOD)**: The cashier enters the physical drawer count (`closing_cash`). The system calculates:
  $$\text{Expected Cash} = \text{Opening Cash} + \text{Cash Sales} - \text{Expenses} - \text{Salaries} - \text{Commissions}$$
  $$\text{Variance} = \text{Closing Cash} - \text{Expected Cash}$$
  The shift snapshot is permanently recorded with discrepancies and notes.

#### 3. Native Thermal Printer Pipeline
Rather than relying on browser print dialogs that require user interaction and print drivers:
- `src-tauri/src/printer.rs` builds raw ESC/POS byte streams tailored to printer paper width (32 characters for 58mm, 48 characters for 80mm).
- Converts Unicode currency symbols (e.g. `₱` $\to$ `P`) to preserve character encoding compatibility with standard receipt printer firmware.
- Transmits raw bytes directly to:
  - **USB**: `rusb` vendor/product communication.
  - **Bluetooth / Serial**: Direct serial stream writing (e.g., `/dev/rfcomm0` or `COMx`).
  - **Network**: Direct TCP socket stream to port `9100`.

#### 4. Multi-Branch Isolation
- Branch configurations are stored in `branches.json`.
- Each branch has its own dedicated SQLite database file (e.g., `joyce_pos.db`, `joyce_pos_branch2.db`).
- Switching branches in Settings updates the active database connection in Rust's managed state without requiring an application restart.

---

## Project Structure

### Directory Breakdown

```
Joy-Pos-Multiplatform/
├── .github/
│   └── workflows/
│       └── release.yml          # Multi-platform CI/CD build matrix (Ubuntu, Windows, macOS)
├── .git/hooks/                  # Git hooks (post-commit, post-checkout, post-merge for graphify)
├── graphify-out/                # Automated codebase knowledge graph & intelligence
│   ├── graph.html               # Interactive visual knowledge graph
│   ├── graph.json               # Graph topology and node metadata
│   ├── GRAPH_REPORT.md          # Architectural report, god nodes & connection audit
│   └── manifest.json            # AST extraction cache manifest
├── public/                      # Static web assets & icons
├── scripts/
│   └── set-version.mjs          # Synchronizes versions across package.json, Cargo.toml & tauri.conf.json
├── src/                         # React Frontend Application
│   ├── components/              # Modular UI Components
│   │   ├── admin/               # Dedicated Admin Analytics & Reporting Suite
│   │   │   ├── AdminCharts.jsx             # SVG Trend and Doughnut analytics charts
│   │   │   ├── AdminKpiGrid.jsx            # High-level financial & inventory KPI cards
│   │   │   ├── AdminModals.jsx             # CRUD modals for products, stock, staff, payouts
│   │   │   ├── AdminOverviewPnL.jsx        # Profit and Loss statements & breakdown
│   │   │   ├── AdminPayrollAuditTables.jsx # Salary, commission, and audit trail tables
│   │   │   ├── AdminReportsModule.jsx      # Centralized reporting engine with filters
│   │   │   ├── AdminSalesInventoryTables.jsx# Sales records, item inspection, and inventory
│   │   │   ├── adminUtils.js               # CSV/Excel exporters, metric calculations
│   │   │   └── useAdminController.js       # Centralized business logic & state hook for admin
│   │   ├── PinLock.jsx          # Security modal for PIN verification (Admin & Cashier)
│   │   └── ui.jsx               # Design system primitives (Modal, Field, Toast, Pagination)
│   ├── pages/                   # Main Application Views
│   │   ├── AdminDashboard.jsx   # Executive reporting & administration hub
│   │   ├── Commissions.jsx      # Standard & LD (e-load) commission management
│   │   ├── Dashboard.jsx        # Operational store overview & fast analytics
│   │   ├── Employees.jsx        # Staff roster & compensation setup
│   │   ├── Expenses.jsx         # Operating expense records
│   │   ├── Inventory.jsx        # Stock replenishment, history, and alerts
│   │   ├── POS.jsx              # Active sales register & checkout interface
│   │   ├── Products.jsx         # Product catalog and variant definitions
│   │   ├── Salary.jsx           # Staff payroll payout logs
│   │   ├── Settings.jsx         # Hardware, branch, layout, backup & theme configs
│   │   └── Transactions.jsx     # Sales receipts, reprint, and void history
│   ├── api.js                   # Tauri IPC invoke wrappers
│   ├── App.jsx                  # Root component, routing, navigation, and shift-gating
│   ├── main.jsx                 # React DOM mount entrypoint
│   ├── styles.css               # Vanilla CSS design tokens & responsive styles
│   └── utils.js                 # Currency formatting, date math, text sanitizers
├── src-tauri/                   # Rust Backend & Native Tauri Layer
│   ├── src/
│   │   ├── cmds.rs              # 50+ Tauri IPC commands handling DB operations & logic
│   │   ├── db.rs                # SQLite schema definitions, branch manager & migrations
│   │   ├── lib.rs               # Tauri application builder, plugin & command registrations
│   │   ├── main.rs              # Desktop executable entrypoint
│   │   └── printer.rs           # ESC/POS byte generator and USB/Bluetooth/Network transport
│   ├── Cargo.toml               # Rust package metadata & dependencies (rusqlite, rusb, etc.)
│   └── tauri.conf.json          # Tauri application settings, windows, and security permissions
├── index.html                   # HTML shell for Vite
├── package.json                 # Node dependencies and scripts
└── vite.config.js               # Vite bundler configuration
```

### Key File Responsibilities

| File Path | Description |
| :--- | :--- |
| `src-tauri/src/cmds.rs` | Central Rust command registry. Executes SQLite queries, enforces transaction atomicity on sales/voids, manages shift calculations, and handles file backups. |
| `src-tauri/src/db.rs` | Initializes SQLite database tables, executes non-destructive schema migrations, and tracks multi-branch state via `branches.json`. |
| `src-tauri/src/printer.rs` | Formats sales data into raw ESC/POS binary instructions. Handles line wrapping, character alignment, and hardware communication. |
| `src/api.js` | Typed bridge connecting React components to Tauri's native `invoke()` methods with runtime environment guards. |
| `src/components/admin/useAdminController.js` | Custom React controller hook encapsulating date filtering, state aggregation, CRUD operations, and CSV/Excel report exports. |
| `src/App.jsx` | Orchestrates top-level navigation, sidebar responsiveness, global context providers, error boundaries, and shift-gating rules. |

---

## Installation & Setup Tutorial

### System Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.0.0` or higher (`node -v`)
- **npm**: `v9.0.0` or higher (`npm -v`)
- **Rust & Cargo**: Stable toolchain (`rustc --version`, `cargo --version`). Install via [rustup.rs](https://rustup.rs/).

#### Platform-Specific Libraries

##### Linux (Ubuntu / Debian / Linux Mint)
Install the required WebKit, GTK, and USB development libraries:
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libusb-1.0-0-dev \
  libudev-dev
```

##### Windows
- Install [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (select "Desktop development with C++").
- Ensure the [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) is installed (pre-installed on Windows 10/11).

##### macOS
- Install Xcode Command Line Tools:
```bash
xcode-select --install
```

---

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kaedeharakazuha26/joyce-Pos.git
   cd joyce-Pos
   ```

2. **Install JavaScript dependencies**:
   ```bash
   npm install
   ```

3. **Start the Tauri development server**:
   ```bash
   npm run tauri dev
   ```
   *This command starts the Vite frontend dev server and compiles/runs the native Rust application window with hot module reloading (HMR).*

---

### Building for Production

To create an optimized, standalone native installer for your operating system:

```bash
npm run tauri build
```

Generated installer bundles will be located in:
- **Linux**: `src-tauri/target/release/bundle/deb/` or `bundle/appimage/`
- **Windows**: `src-tauri/target/release/bundle/msi/` or `bundle/nsis/`
- **macOS**: `src-tauri/target/release/bundle/dmg/` or `bundle/macos/`

---

### Release Management & CI/CD

The project includes an automated multi-platform release workflow (`.github/workflows/release.yml`).

1. **Bump the application version**:
   Use the built-in version synchronization script:
   ```bash
   npm run version:set -- 1.0.1
   ```
   *This updates `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` simultaneously.*

2. **Tag and push to GitHub**:
   ```bash
   git commit -am "chore: bump version to v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```
3. GitHub Actions will automatically compile binaries for Ubuntu, Windows, and macOS (Intel & Apple Silicon) and attach the installers to a new GitHub Release.

---

## Hardware & Thermal Printing Guide

JOYCE POS features a direct ESC/POS hardware generation engine that requires no third-party printer drivers for standard thermal receipt printers.

```
┌──────────────┐     ESC/POS Bytes     ┌────────────────────────┐
│  printer.rs  │ ────────────────────> │ Thermal Receipt Printer│
└──────────────┘                       │ (58mm or 80mm roll)    │
   │        │                          └────────────────────────┘
   │        ├─ USB Direct (rusb raw bulk transfer)
   │        ├─ Bluetooth Serial (/dev/rfcomm0, COM5)
   │        ├─ TCP Network Socket (192.168.1.100:9100)
   │        └─ OS Print Dialog (Universal Fallback)
```

### Supported Printer Interfaces

Configure your printer under **Settings $\to$ Printer**:

| Interface | Configuration Steps |
| :--- | :--- |
| **USB** | Click **Scan USB Devices** to locate the Vendor ID and Product ID of your connected printer. |
| **Bluetooth** | Pair the thermal printer in your host operating system settings, then specify the virtual serial device path (`/dev/rfcomm0` on Linux, `COM3` on Windows, `/dev/cu.PrinterName` on macOS). |
| **Network (LAN/Wi-Fi)** | Provide the printer's local static IP address and port (default is port 9100, e.g. `192.168.1.100:9100`). |
| **System Dialog** | Falls back to the operating system's standard document print dialog. Suitable for desktop laser/inkjet printers. |

### Linux udev Setup

On Linux, non-root users need permissions to access raw USB thermal printers. Add a udev rule:

1. Identify your printer's Vendor ID (VID) and Product ID (PID) via `lsusb` or through Settings in JOYCE POS.
2. Create a rules file:
   ```bash
   sudo nano /etc/udev/rules.d/99-thermal-printer.rules
   ```
3. Add the following rule (replace `04b8` and `0e15` with your printer's VID and PID):
   ```udev
   SUBSYSTEM=="usb", ATTR{idVendor}=="04b8", ATTR{idProduct}=="0e15", MODE="0666", GROUP="plugdev"
   ```
4. Reload udev rules:
   ```bash
   sudo udevadm control --reload-rules && sudo udevadm trigger
   ```

### Windows USB Setup

If the USB thermal printer is not detected or throws access errors:
1. Download [Zadig](https://zadig.akeo.ie/).
2. Select your thermal printer from the dropdown.
3. Install the **WinUSB** or **libusb-win32** driver for the device.

### Receipt Layout Customization

Navigate to **Settings $\to$ Receipt Layout** to customize:
- **Paper Width**: `58 mm` (32 characters per line) or `80 mm` (48 characters per line).
- **Header Details**: Store Name, Store Address, Store Contact Phone, and Custom Greeting.
- **Font Sizing**: Normal or Large header typography.
- **Footer Text**: Custom thank-you message or return policy disclaimer.
- **Interactive Preview**: A live digital preview renders layout changes in real time.

---

## Knowledge Graph & Code Intelligence (Graphify)

JOYCE POS includes an integrated [Graphify](https://github.com/safishamsi) knowledge graph. Graphify analyzes the entire codebase AST (Abstract Syntax Tree) to map dependencies, call graphs, database queries, and architectural clusters.

```
                      ┌───────────────────────┐
                      │  JOYCE POS Codebase   │
                      └──────────┬────────────┘
                                 │
                   graphify extract & cluster
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│    graph.html    │   │ GRAPH_REPORT.md  │   │    graph.json    │
│ Interactive Web  │   │ Audit Report &   │   │ GraphRAG Vector  │
│  Topology Map    │   │ Architectural QA │   │  Knowledge Base  │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

### What is Graphify?
Graphify turns this repository into a navigable graph without requiring external LLM API costs for code. It extracts:
- **Symbols & Calls**: Every Rust function, React component, and Tauri command.
- **God Nodes**: Highly interconnected architectural hubs (e.g., `Db`, `cmds.rs`, `App.jsx`, `ymd()`).
- **Community Clusters**: Logical groupings of related functionality across frontend and backend boundaries.

### Graphify Artifacts

All knowledge graph files are stored in the `graphify-out/` directory:
- **`graphify-out/graph.html`**: An interactive browser visualization. Open this file in Google Chrome, Firefox, or Safari to inspect the visual dependency web.
- **`graphify-out/GRAPH_REPORT.md`**: Architectural audit report detailing corpus size, community hubs, cohesion metrics, and structural recommendations.
- **`graphify-out/graph.json`**: Complete structured knowledge graph data ready for GraphRAG and semantic search.

### How to Query the Codebase

You can query the architecture directly from your terminal using natural language:

```bash
# Query specific functional flows
graphify query "how does void work?"
graphify query "explain start_day and shift gating"
graphify query "where is the thermal printer byte generation handled?"

# Trace the shortest dependency path between components
graphify path "POS" "Db"

# Inspect a specific node's connections
graphify explain "Db"
```

### Updating the Knowledge Graph

Whenever you modify Rust or React source files, update the knowledge graph:

```bash
# Incremental update (re-extracts only modified files, zero API token cost)
graphify update .

# Full rebuild of the graph
graphify .
```

### Automated Git Hooks

This repository is equipped with automated Git hooks in `.git/hooks/` (`post-commit`, `post-checkout`, and `post-merge`). Whenever you commit changes or pull updates from git, the graphify hooks automatically re-index modified files and update `graphify-out/` in the background.

---

## Security, Storage & Database Maintenance

### Default Credentials
- **Default Master Admin PIN**: `0000`
- To change the PIN, navigate to **Settings $\to$ Security $\to$ Change Admin PIN**.
- Additional cashiers can be configured in **Settings $\to$ Cashier PINs** with restricted permissions.

### Operating System Database Locations
The SQLite database file (`joyce_pos.db`) is stored locally in the operating system's standard application data folder:
- **Linux**: `~/.local/share/com.joyce.pos/`
- **Windows**: `C:\Users\<Username>\AppData\Roaming\com.joyce.pos\`
- **macOS**: `~/Library/Application Support/com.joyce.pos/`

### Backup & Disaster Recovery
1. **Manual Backup**: Go to **Settings $\to$ Backup & Restore $\to$ Backup Database** and save a `.db` snapshot to an external flash drive or secondary drive.
2. **Restore**: Select **Restore Database** to replace the current state with a saved snapshot. The database connection reinitializes immediately.
3. **Reset Database**: Authorized admins can perform a factory reset, with an option to preserve the product catalog while clearing sales and cash drawer history.

---

## License

This project is proprietary software developed for JOYCE POS. All rights reserved.
