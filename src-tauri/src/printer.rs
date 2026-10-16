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
        let name = d
            .open()
            .ok()
            .and_then(|h| h.read_product_string_ascii(&desc).ok())
            .unwrap_or_else(|| "USB device".into());
        out.push(json!({ "vid": format!("{:04x}", desc.vendor_id()), "pid": format!("{:04x}", desc.product_id()), "name": name }));
    }
    Ok(out)
}
