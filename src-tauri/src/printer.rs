use crate::cmds::{e, R};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Write;
use std::time::Duration;

type Settings = HashMap<String, String>;

fn g<'a>(st: &'a Settings, k: &str, d: &'a str) -> &'a str {
    st.get(k).map(|s| s.as_str()).filter(|s| !s.is_empty()).unwrap_or(d)
}

/// Thermal printers only reliably handle ASCII; replace everything else.
fn ascii(s: &str) -> String {
    s.chars().map(|c| if c.is_ascii() && !c.is_control() { c } else if c == '₱' { 'P' } else { '?' }).collect()
}

fn money(x: f64) -> String {
    format!("{:.2}", x)
}

fn two(l: &str, r: &str, w: usize) -> String {
    let (l, r) = (ascii(l), ascii(r));
    let space = w.saturating_sub(r.len() + 1);
    let l: String = l.chars().take(space).collect();
    format!("{}{}{}\n", l, " ".repeat(w.saturating_sub(l.len() + r.len())), r)
}

/// Builds ESC/POS bytes for a receipt using the saved receipt settings.
pub fn build_receipt(sale: &Value, st: &Settings) -> Vec<u8> {
    let paper = g(st, "paper_width", "58");
    let w: usize = g(st, "chars_per_line", if paper == "80" { "48" } else { "32" }).parse().unwrap_or(32);
    let align = |a: &str| match a { "center" => 1u8, "right" => 2, _ => 0 };
    let big = g(st, "font_size", "normal") == "large";
    let line = "-".repeat(w) + "\n";
    let mut b: Vec<u8> = vec![0x1B, 0x40]; // init
    let put = |b: &mut Vec<u8>, s: &str| b.extend_from_slice(ascii(s).as_bytes());

    b.extend([0x1B, 0x61, align(g(st, "header_align", "center"))]);
    b.extend([0x1B, 0x45, 1]);
    b.extend([0x1D, 0x21, if big { 0x11 } else { 0x01 }]);
    put(&mut b, &format!("{}\n", g(st, "store_name", "JOYCE POS")));
    b.extend([0x1D, 0x21, 0x00]);
    b.extend([0x1B, 0x45, 0]);
    for k in ["store_address", "store_phone", "receipt_header"] {
        let v = g(st, k, "");
        if !v.is_empty() {
            put(&mut b, &format!("{}\n", v));
        }
    }
    b.extend([0x1B, 0x61, 0]);
    put(&mut b, &line);
    put(&mut b, &format!("Receipt: {}\n", sale["receipt_no"].as_str().unwrap_or("")));
    put(&mut b, &format!("Date: {}\n", sale["created_at"].as_str().unwrap_or("")));
    if sale["status"] == "voided" {
        put(&mut b, "*** VOIDED ***\n");
    }
    put(&mut b, &line);
    for it in sale["items"].as_array().cloned().unwrap_or_default() {
        let vn = it["variant_name"].as_str().unwrap_or("");
        let qty = it["quantity"].as_i64().unwrap_or(1);
        let label = if vn.is_empty() { it["name"].as_str().unwrap_or("").to_string() } else { format!("{} ({})", it["name"].as_str().unwrap_or(""), vn) };
        put(&mut b, &two(&format!("{}x {}", qty, label), &money(it["subtotal"].as_f64().unwrap_or(0.0)), w));
        if qty > 1 {
            put(&mut b, &format!("   @ {}\n", money(it["unit_price"].as_f64().unwrap_or(0.0))));
        }
    }
    put(&mut b, &line);
    b.extend([0x1B, 0x45, 1]);
    put(&mut b, &two("TOTAL", &money(sale["total"].as_f64().unwrap_or(0.0)), w));
    b.extend([0x1B, 0x45, 0]);
    put(&mut b, &two("Cash", &money(sale["paid"].as_f64().unwrap_or(0.0)), w));
    put(&mut b, &two("Change", &money(sale["change_amt"].as_f64().unwrap_or(0.0)), w));
    put(&mut b, &line);
    b.extend([0x1B, 0x61, align(g(st, "footer_align", "center"))]);
    put(&mut b, &format!("{}\n", g(st, "receipt_footer", "Thank you! Come again.")));
    let feed: u8 = g(st, "feed_lines", "3").parse().unwrap_or(3);
    b.extend([0x1B, 0x64, feed]);
    if g(st, "cut_paper", "1") == "1" {
        b.extend([0x1D, 0x56, 0x42, 0x00]);
    }
    if g(st, "open_drawer", "0") == "1" {
        b.extend([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    }
    b
}

/// Builds ESC/POS bytes for an End of Day (Z-Reading) thermal receipt.
pub fn build_z_reading(shift: &Value, st: &Settings, closing_cash: f64, closing_notes: &str) -> Vec<u8> {
    let paper = g(st, "paper_width", "58");
    let w: usize = g(st, "chars_per_line", if paper == "80" { "48" } else { "32" }).parse().unwrap_or(32);
    let line = "-".repeat(w) + "\n";
    let dline = "=".repeat(w) + "\n";
    let mut b: Vec<u8> = vec![0x1B, 0x40]; // init
    let put = |b: &mut Vec<u8>, s: &str| b.extend_from_slice(ascii(s).as_bytes());

    // Header
    b.extend([0x1B, 0x61, 1]); // Center
    b.extend([0x1B, 0x45, 1]); // Bold
    b.extend([0x1D, 0x21, 0x01]); // Double height
    put(&mut b, &format!("{}\n", g(st, "store_name", "JOYCE POS")));
    b.extend([0x1D, 0x21, 0x00]); // Normal
    b.extend([0x1B, 0x45, 0]);
    for k in ["store_address", "store_phone"] {
        let v = g(st, k, "");
        if !v.is_empty() {
            put(&mut b, &format!("{}\n", v));
        }
    }
    b.extend([0x1B, 0x45, 1]);
    put(&mut b, "*** END OF DAY / Z-READING ***\n");
    b.extend([0x1B, 0x45, 0]);
    b.extend([0x1B, 0x61, 0]); // Left

    put(&mut b, &dline);
    let shift_id = shift["id"].as_i64().unwrap_or(0);
    put(&mut b, &format!("Shift ID : #{}\n", shift_id));
    put(&mut b, &format!("Date     : {}\n", shift["business_date"].as_str().unwrap_or("")));
    put(&mut b, &format!("Opened At: {}\n", shift["opened_at"].as_str().unwrap_or("")));
    put(&mut b, &format!("Opened By: {}\n", shift["opened_by"].as_str().unwrap_or("")));
    put(&mut b, &format!("Closed By: {}\n", shift["closed_by"].as_str().unwrap_or("Cashier")));
    put(&mut b, &line);

    // Products breakdown: products x quantity = amount
    b.extend([0x1B, 0x45, 1]);
    put(&mut b, "PRODUCTS SOLD (QTY x AMOUNT):\n");
    b.extend([0x1B, 0x45, 0]);
    put(&mut b, &line);

    let items = shift["sold_items"].as_array().cloned().unwrap_or_default();
    if items.is_empty() {
        put(&mut b, "No products sold in shift.\n");
    } else {
        for it in items {
            let name = it["name"].as_str().unwrap_or("");
            let vn = it["variant_name"].as_str().unwrap_or("");
            let label = if vn.is_empty() { name.to_string() } else { format!("{} ({})", name, vn) };
            let qty = it["quantity"].as_i64().unwrap_or(0);
            let amt = it["amount"].as_f64().unwrap_or(0.0);
            put(&mut b, &two(&format!("{} x {}", label, qty), &money(amt), w));
        }
    }
    put(&mut b, &dline);

    // Financial breakdown: Total Gross - Expenses - Salaries - Commissions - LD Comm = Net
    let gross = shift["gross_sales"].as_f64().unwrap_or(shift["cash_sales"].as_f64().unwrap_or(0.0));
    let expenses = shift["expenses"].as_f64().unwrap_or(0.0);
    let salaries = shift["salaries"].as_f64().unwrap_or(0.0);
    let commissions = shift["commissions"].as_f64().unwrap_or(0.0);
    let ld_commissions = shift["ld_commissions"].as_f64().unwrap_or(0.0);

    let disabled: Vec<String> = serde_json::from_str(g(st, "disabled_menus", "[]")).unwrap_or_default();
    let show_exp = !disabled.contains(&"expenses".into());
    let show_sal = !disabled.contains(&"salary".into()) && !disabled.contains(&"salaries".into());
    let show_com = !disabled.contains(&"commission".into()) && !disabled.contains(&"commissions".into());
    let show_ld = !disabled.contains(&"ld-commission".into()) && !disabled.contains(&"ld_commission".into());

    let mut net = gross;
    b.extend([0x1B, 0x45, 1]);
    put(&mut b, &two("TOTAL GROSS SALES", &money(gross), w));
    b.extend([0x1B, 0x45, 0]);

    if show_exp {
        net -= expenses;
        put(&mut b, &two("- Store Expenses", &format!("-{}", money(expenses)), w));
    }
    if show_sal {
        net -= salaries;
        put(&mut b, &two("- Salaries Paid", &format!("-{}", money(salaries)), w));
    }
    if show_ld {
        net -= ld_commissions;
        put(&mut b, &two("- LD Comm Paid", &format!("-{}", money(ld_commissions)), w));
    }
    if show_com {
        net -= commissions;
        put(&mut b, &two("- Commissions Paid", &format!("-{}", money(commissions)), w));
    }

    put(&mut b, &line);
    b.extend([0x1B, 0x45, 1]);
    put(&mut b, &two("= NET OPERATING PROFIT", &money(net), w));
    b.extend([0x1B, 0x45, 0]);
    put(&mut b, &dline);

    // Drawer Cash Reconciliation
    let open_cash = shift["opening_cash"].as_f64().unwrap_or(0.0);
    let cash_sales = shift["cash_sales"].as_f64().unwrap_or(0.0);
    let total_outflows = (if show_exp { expenses } else { 0.0 })
        + (if show_sal { salaries } else { 0.0 })
        + (if show_com { commissions } else { 0.0 })
        + (if show_ld { ld_commissions } else { 0.0 });
    let expected = open_cash + cash_sales - total_outflows;
    let actual = if closing_cash > 0.0 { closing_cash } else { expected };
    let variance = actual - expected;

    put(&mut b, &two("Opening Float", &money(open_cash), w));
    put(&mut b, &two("+ Cash Sales", &money(cash_sales), w));
    put(&mut b, &two("- Total Outflows", &format!("-{}", money(total_outflows)), w));
    b.extend([0x1B, 0x45, 1]);
    put(&mut b, &two("Expected in Drawer", &money(expected), w));
    put(&mut b, &two("Actual Cash Counted", &money(actual), w));
    let var_str = if variance.abs() < 0.01 {
        "0.00 (Balanced)".to_string()
    } else if variance > 0.0 {
        format!("+{} (Overage)", money(variance))
    } else {
        format!("{} (Shortage)", money(variance))
    };
    put(&mut b, &two("Variance", &var_str, w));
    b.extend([0x1B, 0x45, 0]);

    if !closing_notes.is_empty() {
        put(&mut b, &line);
        put(&mut b, &format!("Notes: {}\n", ascii(closing_notes)));
    }

    put(&mut b, &dline);
    b.extend([0x1B, 0x61, 1]); // Center
    put(&mut b, "\n_______________________\nCashier Signature\n\n\n_______________________\nManager Signature\n\n");
    put(&mut b, &format!("Printed: {}\n", crate::cmds::common::now()));

    let feed: u8 = g(st, "feed_lines", "3").parse().unwrap_or(3);
    b.extend([0x1B, 0x64, feed]);
    if g(st, "cut_paper", "1") == "1" {
        b.extend([0x1D, 0x56, 0x42, 0x00]);
    }
    if g(st, "open_drawer", "0") == "1" {
        b.extend([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    }
    b
}

pub fn send(st: &Settings, bytes: Vec<u8>) -> R<()> {
    let copies: usize = g(st, "copies", "1").parse().unwrap_or(1).clamp(1, 5);
    let data: Vec<u8> = bytes.repeat(copies);
    match g(st, "printer_conn", "none") {
        "usb" => {
            let vid = hex(g(st, "usb_vid", ""))?;
            let pid = hex(g(st, "usb_pid", ""))?;
            send_usb(vid, pid, &data)
        }
        // Bluetooth printers are used through their paired serial port
        // (Linux: /dev/rfcomm0, Windows: COM5, macOS: /dev/cu.PrinterName)
        "bluetooth" | "serial" => write_path(g(st, "serial_path", ""), &data),
        "network" => {
            let addr = g(st, "network_addr", "");
            let addr = if addr.contains(':') { addr.to_string() } else { format!("{}:9100", addr) };
            let sock = std::net::ToSocketAddrs::to_socket_addrs(&addr).map_err(e)?.next().ok_or("Invalid address")?;
            let mut s = std::net::TcpStream::connect_timeout(&sock, Duration::from_secs(4)).map_err(e)?;
            s.write_all(&data).map_err(e)
        }
        _ => Err("No printer configured. Set one up in Settings > Printer.".into()),
    }
}

fn hex(s: &str) -> R<u16> {
    u16::from_str_radix(s.trim().trim_start_matches("0x"), 16).map_err(|_| "Select a USB printer first".to_string())
}

fn write_path(path: &str, data: &[u8]) -> R<()> {
    if path.is_empty() {
        return Err("Printer port/path is empty".into());
    }
    let p = if cfg!(windows) && path.to_uppercase().starts_with("COM") { format!(r"\\.\{}", path) } else { path.to_string() };
    let mut f = std::fs::OpenOptions::new().write(true).open(&p).map_err(|x| format!("Cannot open {}: {}", path, x))?;
    f.write_all(data).map_err(e)?;
    f.flush().map_err(e)
}

fn send_usb(vid: u16, pid: u16, data: &[u8]) -> R<()> {
    let h = rusb::open_device_with_vid_pid(vid, pid).ok_or("USB printer not found (is it connected / driver installed?)")?;
    let cfg = h.device().active_config_descriptor().map_err(e)?;
    let mut found: Option<(u8, u8)> = None;
    'o: for ifc in cfg.interfaces() {
        for d in ifc.descriptors() {
            for ep in d.endpoint_descriptors() {
                if ep.direction() == rusb::Direction::Out && ep.transfer_type() == rusb::TransferType::Bulk {
                    found = Some((d.interface_number(), ep.address()));
                    break 'o;
                }
            }
        }
    }
    let (ifn, addr) = found.ok_or("No writable endpoint on this USB device")?;
    let _ = h.set_auto_detach_kernel_driver(true);
    h.claim_interface(ifn).map_err(e)?;
    let mut sent = 0;
    let mut res = Ok(());
    while sent < data.len() {
        match h.write_bulk(addr, &data[sent..], Duration::from_secs(5)) {
            Ok(n) => sent += n,
            Err(x) => {
                res = Err(e(x));
                break;
            }
        }
    }
    let _ = h.release_interface(ifn);
    res
}

pub fn list_usb() -> R<Vec<Value>> {
    let mut out = vec![];
    for d in rusb::devices().map_err(e)?.iter() {
        let Ok(desc) = d.device_descriptor() else { continue };
        let vid = desc.vendor_id();
        let pid = desc.product_id();
        let class = desc.class_code();

        // 1. Exclude virtual Linux root hubs (VID 0x1d6b)
        if vid == 0x1d6b {
            continue;
        }

        // 2. Exclude USB Hubs (Class 0x09)
        if class == 9 {
            continue;
        }

        // 3. Inspect configuration / interfaces to check for PRINTER interface (Class 7)
        // or bulk out endpoint (standard for ESC/POS thermal printers)
        let mut is_printer_class = class == 7;
        let mut has_bulk_out = false;
        let mut is_blacklisted_class = matches!(class, 1 /* Audio */ | 3 /* HID */ | 14 /* Video */ | 224 /* Wireless */);

        if let Ok(cfg) = d.active_config_descriptor() {
            for ifc in cfg.interfaces() {
                for ifc_desc in ifc.descriptors() {
                    let ifc_class = ifc_desc.class_code();
                    if ifc_class == 7 {
                        is_printer_class = true;
                    }
                    if matches!(ifc_class, 1 | 3 | 14 | 224) {
                        is_blacklisted_class = true;
                    }
                    for ep in ifc_desc.endpoint_descriptors() {
                        if ep.direction() == rusb::Direction::Out && ep.transfer_type() == rusb::TransferType::Bulk {
                            has_bulk_out = true;
                        }
                    }
                }
            }
        }

        let (mfg, prod) = d
            .open()
            .ok()
            .map(|h| {
                let m = h.read_manufacturer_string_ascii(&desc).ok();
                let p = h.read_product_string_ascii(&desc).ok();
                (m, p)
            })
            .unwrap_or((None, None));

        let name = match (&mfg, &prod) {
            (Some(m), Some(p)) if !m.is_empty() && !p.is_empty() => format!("{} {}", m.trim(), p.trim()),
            (_, Some(p)) if !p.is_empty() => p.trim().to_string(),
            (Some(m), _) if !m.is_empty() => m.trim().to_string(),
            _ => format!("USB Device {:04x}:{:04x}", vid, pid),
        };

        let lower = name.to_lowercase();

        // Common thermal printer keywords
        let name_is_printer = lower.contains("printer")
            || lower.contains("pos")
            || lower.contains("thermal")
            || lower.contains("receipt")
            || lower.contains("esc")
            || lower.contains("xprinter")
            || lower.contains("rongta")
            || lower.contains("epson")
            || lower.contains("citizen")
            || lower.contains("star")
            || lower.contains("bixolon")
            || lower.contains("zywell")
            || lower.contains("gprinter")
            || lower.contains("58")
            || lower.contains("80");

        // Discard devices that are definitely not printers
        let is_excluded_name = lower.contains("camera")
            || lower.contains("audio")
            || lower.contains("bluetooth")
            || lower.contains("touch")
            || lower.contains("fingerprint")
            || lower.contains("keyboard")
            || lower.contains("mouse")
            || lower.contains("receiver")
            || lower.contains("hub");

        if is_excluded_name {
            continue;
        }

        // Include only if confirmed printer class, printer keyword in name, or valid non-blacklisted bulk OUT device
        if is_printer_class || name_is_printer || (has_bulk_out && !is_blacklisted_class) {
            out.push(json!({
                "vid": format!("{:04x}", vid),
                "pid": format!("{:04x}", pid),
                "name": name,
                "is_printer": is_printer_class || name_is_printer,
            }));
        }
    }
    Ok(out)
}
