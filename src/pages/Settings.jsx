import { useCallback, useEffect, useState } from "react";
import {
  Moon,
  Sun,
  DatabaseBackup,
  DatabaseZap,
  Printer,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  Lock,
} from "lucide-react";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, Receipt, useToast } from "../components/ui";
import { useSettings } from "../App";
import { errText, ymd } from "../utils";

export const ALL_PERMISSIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pos", label: "POS" },
  { id: "transactions", label: "Transactions" },
  { id: "products", label: "Products" },
  { id: "inventory", label: "Inventory" },
  { id: "expenses", label: "Expenses" },
  { id: "salary", label: "Salary" },
  { id: "commission", label: "Commission" },
  { id: "ld-commission", label: "LD Commission" },
  { id: "employees", label: "Employees" },
  { id: "settings", label: "Settings" },
];

const DEFAULTS = {
  theme: "dark",
  printer_conn: "none",
  usb_vid: "",
  usb_pid: "",
  serial_path: "",
  network_addr: "",
  auto_print: "0",
  copies: "1",
  store_name: "JOYCE POS",
  store_address: "",
  store_phone: "",
  receipt_header: "",
  receipt_footer: "Thank you! Come again.",
  paper_width: "58",
  chars_per_line: "",
  font_size: "normal",
  header_align: "center",
  footer_align: "center",
  feed_lines: "3",
  cut_paper: "1",
  open_drawer: "0",
};

const sample = {
  receipt_no: "JP-20260101-0001",
  created_at: "2026-01-01 09:30:00",
  status: "completed",
  total: 7,
  paid: 10,
  change_amt: 3,
  items: [
    { name: "Candy", variant_name: "", quantity: 1, unit_price: 2, subtotal: 2 },
    { name: "Candy", variant_name: "3 pcs", quantity: 1, unit_price: 5, subtotal: 5 },
  ],
};

export default function Settings() {
  const { settings, save } = useSettings();
  const [s, setS] = useState({ ...DEFAULTS, ...settings });
  const [usb, setUsb] = useState([]);
  const [tab, setTab] = useState("general");
  const [cashiersList, setCashiersList] = useState([]);
  const [adminPinForm, setAdminPinForm] = useState({ oldPin: "", newPin: "", confirmPin: "" });
  const [cashierModal, setCashierModal] = useState(null); // null or cashier object
  const toast = useToast();

  useEffect(() => {
    setS((x) => ({ ...DEFAULTS, ...settings, ...x, theme: settings.theme || x.theme }));
  }, [settings]);

  const loadCashiers = useCallback(() => {
    api.cashiers()
      .then(setCashiersList)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "security") {
      loadCashiers();
    }
  }, [tab, loadCashiers]);

  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const persist = () => run(() => save(s), "Settings saved");
  const scanUsb = () => run(async () => setUsb(await api.usbDevices()));

  const backup = () =>
    run(async () => {
      const path = await saveDialog({
        defaultPath: `joyce-pos-backup-${ymd()}.db`,
        filters: [{ name: "SQLite database", extensions: ["db"] }],
      });
      if (path) {
        await api.backup(path);
        toast("Backup saved: " + path);
      }
    });

  const restore = () =>
    run(async () => {
      const path = await openDialog({
        multiple: false,
        filters: [{ name: "SQLite database", extensions: ["db"] }],
      });
      if (!path) return;
      if (!confirm("Restoring replaces ALL current data with the backup. Continue?")) return;
      await api.restore(path);
      toast("Database restored — reloading…");
      setTimeout(() => location.reload(), 900);
    });

  const handleChangeAdminPin = async (e) => {
    e.preventDefault();
    if (!adminPinForm.oldPin) return toast("Enter current admin PIN", "err");
    if (adminPinForm.newPin.length < 4) return toast("New PIN must be at least 4 digits", "err");
    if (adminPinForm.newPin !== adminPinForm.confirmPin) return toast("New PINs do not match", "err");
    try {
      await api.changeAdminPin(adminPinForm.oldPin, adminPinForm.newPin);
      toast("Admin PIN changed successfully");
      setAdminPinForm({ oldPin: "", newPin: "", confirmPin: "" });
    } catch (err) {
      toast(errText(err), "err");
    }
  };

  const openCashierForm = (cashier = null) => {
    setCashierModal(
      cashier
        ? {
            id: cashier.id,
            name: cashier.name,
            pin: cashier.pin,
            permissions: Array.isArray(cashier.permissions_list)
              ? cashier.permissions_list
              : ["pos", "transactions"],
          }
        : {
            name: "",
            pin: "",
            permissions: ["pos", "transactions"],
          }
    );
  };

  const togglePermission = (permId) => {
    setCashierModal((prev) => {
      const has = prev.permissions.includes(permId);
      const next = has
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: next };
    });
  };

  const selectAllPerms = () => {
    setCashierModal((prev) => ({
      ...prev,
      permissions: ALL_PERMISSIONS.map((p) => p.id),
    }));
  };

  const handleSaveCashier = async () => {
    if (!cashierModal.name.trim()) return toast("Cashier name is required", "err");
    if (!cashierModal.pin || cashierModal.pin.length < 4) return toast("PIN must be at least 4 digits", "err");
    if (cashierModal.permissions.length === 0) return toast("Select at least one sidebar permission", "err");
    try {
      await api.saveCashier(cashierModal);
      toast("Cashier saved");
      setCashierModal(null);
      loadCashiers();
    } catch (err) {
      toast(errText(err), "err");
    }
  };

  const handleDeleteCashier = async (id, name) => {
    if (!confirm(`Delete cashier "${name}"?`)) return;
    try {
      await api.deleteCashier(id);
      toast("Cashier deleted");
      loadCashiers();
    } catch (err) {
      toast(errText(err), "err");
    }
  };

  const tabs = [
    ["general", "Appearance & Data"],
    ["security", "Security & Cashiers"],
    ["printer", "Printer"],
    ["receipt", "Receipt"],
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle="Appearance, security, cashiers, printing">
        {tab !== "general" && tab !== "security" && (
          <button className="btn" onClick={persist}>
            Save settings
          </button>
        )}
      </PageHeader>
      <div className="tabs">
        {tabs.map(([id, l]) => (
          <button
            key={id}
            className={"chip" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="card">
            <h3>Theme</h3>
            <div className="theme-pick">
              {[
                ["light", "Light mode", Sun],
                ["dark", "Dark mode", Moon],
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  id={`theme-${id}`}
                  className={
                    "theme-card" +
                    (settings.theme === id || (!settings.theme && id === "dark")
                      ? " active"
                      : "")
                  }
                  onClick={() => {
                    set("theme", id);
                    run(() => save({ theme: id }));
                  }}
                >
                  <Icon size={22} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Database</h3>
            <p className="muted" style={{ marginBottom: 14 }}>
              All data is stored offline in a local SQLite file. Back it up regularly to a USB
              drive.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={backup}>
                <DatabaseBackup size={17} /> Backup database
              </button>
              <button className="btn ghost" onClick={restore}>
                <DatabaseZap size={17} /> Restore database
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Admin PIN Card */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <ShieldCheck size={22} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Administrator PIN</h3>
            </div>
            <p className="muted" style={{ marginBottom: 16 }}>
              Default Admin PIN is <b>0000</b>. Admins have unrestricted access to all tabs and
              settings.
            </p>
            <form onSubmit={handleChangeAdminPin} className="grid3" style={{ alignItems: "end" }}>
              <Field label="Current Admin PIN">
                <input
                  type="password"
                  maxLength={10}
                  placeholder="Current PIN (default 0000)"
                  value={adminPinForm.oldPin}
                  onChange={(e) =>
                    setAdminPinForm({ ...adminPinForm, oldPin: e.target.value })
                  }
                />
              </Field>
              <Field label="New Admin PIN">
                <input
                  type="password"
                  maxLength={10}
                  placeholder="Min 4 digits"
                  value={adminPinForm.newPin}
                  onChange={(e) =>
                    setAdminPinForm({ ...adminPinForm, newPin: e.target.value })
                  }
                />
              </Field>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Confirm New PIN">
                    <input
                      type="password"
                      maxLength={10}
                      placeholder="Confirm PIN"
                      value={adminPinForm.confirmPin}
                      onChange={(e) =>
                        setAdminPinForm({ ...adminPinForm, confirmPin: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <button
                  type="submit"
                  className="btn"
                  style={{ alignSelf: "flex-end", height: 42 }}
                >
                  <KeyRound size={16} /> Update PIN
                </button>
              </div>
            </form>
          </div>

          {/* Cashier accounts & permissions */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Cashier accounts & permissions</h3>
                <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                  Create individual login PINs for cashiers and restrict which sidebar tabs they
                  can access.
                </p>
              </div>
              <button className="btn" onClick={() => openCashierForm(null)}>
                <Plus size={16} /> Add Cashier
              </button>
            </div>

            {cashiersList.length === 0 ? (
              <Empty text="No cashier accounts configured yet. Click 'Add Cashier' to create one." />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Cashier Name</th>
                    <th>PIN</th>
                    <th>Accessible Tabs</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cashiersList.map((c) => (
                    <tr key={c.id} className="row-hover">
                      <td>
                        <b>{c.name}</b>
                      </td>
                      <td>
                        <span className="barcode-badge">•••• ({c.pin})</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(c.permissions_list || []).map((permId) => {
                            const found = ALL_PERMISSIONS.find((p) => p.id === permId);
                            return (
                              <span key={permId} className="badge">
                                {found ? found.label : permId}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="muted">{c.created_at?.slice(0, 10)}</td>
                      <td>
                        <div className="actions">
                          <button
                            className="icon-btn"
                            title="Edit Cashier"
                            onClick={() => openCashierForm(c)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Delete Cashier"
                            onClick={() => handleDeleteCashier(c.id, c.name)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Cashier Modal */}
      {cashierModal && (
        <Modal
          title={cashierModal.id ? `Edit Cashier: ${cashierModal.name}` : "Create Cashier Account"}
          onClose={() => setCashierModal(null)}
          wide
        >
          <div className="grid2">
            <Field label="Cashier Name">
              <input
                autoFocus
                value={cashierModal.name}
                onChange={(e) => setCashierModal({ ...cashierModal, name: e.target.value })}
                placeholder="e.g. Maria Cruz"
              />
            </Field>
            <Field label="Login PIN" hint="Minimum 4 digits (e.g. 1234)">
              <input
                type="text"
                maxLength={8}
                value={cashierModal.pin}
                onChange={(e) =>
                  setCashierModal({ ...cashierModal, pin: e.target.value.replace(/\D/g, "") })
                }
                placeholder="4-digit PIN"
              />
            </Field>
          </div>

          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <label className="field">
                <span>Sidebar Tab Permissions (Choose what this cashier can access)</span>
              </label>
              <button type="button" className="btn ghost sm" onClick={selectAllPerms}>
                Select All
              </button>
            </div>
            <div className="perm-grid">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm.id} className="perm-label">
                  <input
                    type="checkbox"
                    checked={cashierModal.permissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn big"
            style={{ marginTop: 14 }}
            onClick={handleSaveCashier}
          >
            <UserCheck size={18} /> Save Cashier Account
          </button>
        </Modal>
      )}

      {tab === "printer" && (
        <div className="card" style={{ maxWidth: 720 }}>
          <h3>Thermal printer (ESC/POS)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Connection">
              <select
                value={s.printer_conn}
                onChange={(e) => set("printer_conn", e.target.value)}
              >
                <option value="none">Not configured</option>
                <option value="browser">System / browser print dialog</option>
                <option value="usb">USB (direct)</option>
                <option value="bluetooth">Bluetooth (paired serial port)</option>
                <option value="serial">Serial / COM port</option>
                <option value="network">Network (LAN / Wi-Fi, port 9100)</option>
              </select>
            </Field>

            {s.printer_conn === "usb" && (
              <>
                <button
                  className="btn ghost sm"
                  style={{ alignSelf: "flex-start" }}
                  onClick={scanUsb}
                >
                  <RefreshCw size={14} /> Scan USB devices
                </button>
                {usb.length > 0 && (
                  <Field label="Detected devices">
                    <select
                      value={`${s.usb_vid}:${s.usb_pid}`}
                      onChange={(e) => {
                        const [v, p] = e.target.value.split(":");
                        set("usb_vid", v);
                        set("usb_pid", p);
                      }}
                    >
                      <option value=":">Select…</option>
                      {usb.map((d) => (
                        <option key={d.vid + d.pid} value={`${d.vid}:${d.pid}`}>
                          {d.name} ({d.vid}:{d.pid})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="grid2">
                  <Field label="Vendor ID (hex)">
                    <input
                      value={s.usb_vid}
                      onChange={(e) => set("usb_vid", e.target.value)}
                      placeholder="0416"
                    />
                  </Field>
                  <Field label="Product ID (hex)">
                    <input
                      value={s.usb_pid}
                      onChange={(e) => set("usb_pid", e.target.value)}
                      placeholder="5011"
                    />
                  </Field>
                </div>
              </>
            )}
            {(s.printer_conn === "bluetooth" || s.printer_conn === "serial") && (
              <Field
                label="Port / device path"
                hint="Pair the printer in your OS first. Linux: /dev/rfcomm0 · Windows: COM5 (outgoing port) · macOS: /dev/cu.PrinterName"
              >
                <input
                  value={s.serial_path}
                  onChange={(e) => set("serial_path", e.target.value)}
                  placeholder="/dev/rfcomm0"
                />
              </Field>
            )}
            {s.printer_conn === "network" && (
              <Field label="IP address[:port]">
                <input
                  value={s.network_addr}
                  onChange={(e) => set("network_addr", e.target.value)}
                  placeholder="192.168.1.50:9100"
                />
              </Field>
            )}

            <div className="grid2">
              <Field label="Copies">
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={s.copies}
                  onChange={(e) => set("copies", e.target.value)}
                />
              </Field>
              <Field label="Auto-print after each sale">
                <select
                  value={s.auto_print}
                  onChange={(e) => set("auto_print", e.target.value)}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                onClick={() =>
                  run(async () => {
                    await save(s);
                    await api.printTest();
                  }, "Test receipt sent")
                }
              >
                <Printer size={16} /> Save & print test
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "receipt" && (
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3>Receipt layout</h3>
            <Field label="Store name">
              <input
                value={s.store_name}
                onChange={(e) => set("store_name", e.target.value)}
              />
            </Field>
            <Field label="Address">
              <input
                value={s.store_address}
                onChange={(e) => set("store_address", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                value={s.store_phone}
                onChange={(e) => set("store_phone", e.target.value)}
              />
            </Field>
            <Field label="Header message">
              <input
                value={s.receipt_header}
                onChange={(e) => set("receipt_header", e.target.value)}
              />
            </Field>
            <Field label="Footer message">
              <input
                value={s.receipt_footer}
                onChange={(e) => set("receipt_footer", e.target.value)}
              />
            </Field>
            <div className="grid2">
              <Field label="Paper width">
                <select
                  value={s.paper_width}
                  onChange={(e) => set("paper_width", e.target.value)}
                >
                  <option value="58">58 mm</option>
                  <option value="80">80 mm</option>
                </select>
              </Field>
              <Field label="Characters per line" hint="Blank = auto (32 / 48)">
                <input
                  type="number"
                  value={s.chars_per_line}
                  onChange={(e) => set("chars_per_line", e.target.value)}
                />
              </Field>
              <Field label="Font size">
                <select
                  value={s.font_size}
                  onChange={(e) => set("font_size", e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="large">Large title</option>
                </select>
              </Field>
              <Field label="Feed lines at end">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={s.feed_lines}
                  onChange={(e) => set("feed_lines", e.target.value)}
                />
              </Field>
              <Field label="Header alignment">
                <select
                  value={s.header_align}
                  onChange={(e) => set("header_align", e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </Field>
              <Field label="Footer alignment">
                <select
                  value={s.footer_align}
                  onChange={(e) => set("footer_align", e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </Field>
              <Field label="Auto-cut paper">
                <select
                  value={s.cut_paper}
                  onChange={(e) => set("cut_paper", e.target.value)}
                >
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </Field>
              <Field label="Open cash drawer">
                <select
                  value={s.open_drawer}
                  onChange={(e) => set("open_drawer", e.target.value)}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </Field>
            </div>
          </div>
          <div className="card">
            <h3>Live preview</h3>
            <div className="receipt-wrap">
              <Receipt sale={sample} settings={s} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
