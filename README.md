# JOYCE POS

Offline point-of-sale for a sari-sari store. **React** (Vite) front end · **Tauri 2 + Rust** back end · **SQLite** database.

## Features
- **Dashboard** – sales, gross/net profit, expenses, salaries, voids, inventory value, daily chart, top products, low stock
- **POS** – product grid, search/barcode, variants (e.g. Candy 1 pc ₱2, 3 pcs ₱5 → deducts 3 from the main stock), cash/change, receipt print
- **Transactions** – history, **Void** (stock returns to inventory, sale saved permanently in *Voided history*)
- **Products** – add/edit with variants · **Inventory** – restock + restock history
- **Expenses** / **Salary** records
- **Settings** – light/dark mode, backup & restore database, printer (USB / Bluetooth / Serial / Network / system dialog), receipt layout with live preview (58 mm / 80 mm)

## Develop
```bash
npm install
npm run tauri dev
```
Requirements: Node 20+, Rust, and on Linux `libwebkit2gtk-4.1-dev libusb-1.0-0-dev libudev-dev` (see the Tauri prerequisites).

## Printing
Receipts are generated as ESC/POS in Rust and work with universal thermal printers.
- **USB**: Settings → Printer → *Scan USB devices*. Linux: add a udev rule for the printer (or run with permissions); Windows: install a WinUSB/libusb driver (e.g. with Zadig).
- **Bluetooth**: pair the printer in the OS, then enter its serial port (`/dev/rfcomm0`, `COM5`, `/dev/cu.Name`).
- **Network**: `ip[:9100]`.
- **System dialog**: uses the OS print dialog (good for normal printers).

## Release
Version is taken from the git tag. Push a tag and GitHub Actions builds Windows, macOS and Linux installers and publishes a release:
```bash
git tag v1.0.0
git push origin v1.0.0
```
To bump versions locally: `npm run version:set -- 1.0.1`.

## Data location
SQLite file `joyce_pos.db` lives in the OS app-data folder for `com.joyce.pos`. Use *Settings → Backup database* regularly.

## Knowledge graph (graphify)
`graphify-out/` contains the code knowledge graph (`GRAPH_REPORT.md`, `graph.html`, `graph.json`). Refresh with `graphify update .`; query with `graphify query "how does void work?"`. A git hook rebuilds it on checkout/merge.
