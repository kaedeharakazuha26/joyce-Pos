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
  Cloud,
  FolderOpen,
  Store,
  Info,
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
  const { settings, save, branchInfo, refreshBranchInfo, handleSwitchBranch } = useSettings();
  const [s, setS] = useState({ ...DEFAULTS, ...settings });
  const [usb, setUsb] = useState([]);
  const [tab, setTab] = useState("general");
  const [cashiersList, setCashiersList] = useState([]);
  const [adminPinForm, setAdminPinForm] = useState({ oldPin: "", newPin: "", confirmPin: "" });
  const [cashierModal, setCashierModal] = useState(null); // null or cashier object
  const [newBranchModal, setNewBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [keepCatalog, setKeepCatalog] = useState(true);
  const [resetting, setResetting] = useState(false);
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

  const activeBranch = branchInfo?.branches?.find((b) => b.id === branchInfo?.active_branch) || {
    id: "main",
    name: "Main Store",
    file: "joyce_pos.db",
  };

  const backup = () =>
    run(async () => {
      const safeBranchName = activeBranch.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      const path = await saveDialog({
        defaultPath: `joyce_pos_${safeBranchName}_${ymd()}.db`,
        filters: [{ name: "SQLite database", extensions: ["db"] }],
      });
      if (path) {
        const msg = await api.backup(path);
        toast(typeof msg === "string" ? msg : `Backup for branch '${activeBranch.name}' saved`);
      }
    });

  const restore = () =>
    run(async () => {
      const path = await openDialog({
        multiple: false,
        filters: [{ name: "SQLite database", extensions: ["db"] }],
      });
      if (!path) return;
      if (!confirm(`Warning: Restoring will overwrite ALL database records for branch [${activeBranch.name}]. Other branch databases will not be touched. Continue?`)) return;
      const msg = await api.restore(path);
      toast(typeof msg === "string" ? msg : `Branch '${activeBranch.name}' database restored — reloading…`);
      setTimeout(() => location.reload(), 900);
    });

  const handleResetDatabase = async (e) => {
    e.preventDefault();
    if (!resetPin) return toast("Admin PIN is required to authorize database reset", "err");
    if (!confirm(`Are you absolutely sure you want to RESET ALL DATA for branch [${activeBranch.name}]? This action cannot be undone.`)) return;
    setResetting(true);
    try {
      const msg = await api.resetDb(resetPin, keepCatalog);
      toast(typeof msg === "string" ? msg : `Branch '${activeBranch.name}' reset successfully`);
      setShowResetModal(false);
      setResetPin("");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      toast(errText(err), "err");
    } finally {
      setResetting(false);
    }
  };

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

  const handlePickStorageDir = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        title: "Select Google Drive Synced Folder",
      });
      if (selected) {
        await api.setStorageDir(selected);
        await refreshBranchInfo();
        toast("Database folder updated to Google Drive folder!");
      }
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const handleResetStorageDir = async () => {
    if (!confirm("Reset database location to default local app folder?")) return;
    try {
      await api.setStorageDir("");
      await refreshBranchInfo();
      toast("Reset to default local folder");
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const handleDeleteBranch = async (id, name) => {
    if (!confirm(`Delete branch "${name}" from list? The .db file will stay safely on disk.`)) return;
    try {
      await api.deleteBranch(id);
      await refreshBranchInfo();
      toast(`Branch "${name}" deleted`);
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const toggleBranchMenu = async (menuId) => {
    let current = [];
    try {
      current = s.disabled_menus ? JSON.parse(s.disabled_menus) : [];
    } catch {
      current = [];
    }
    const next = current.includes(menuId)
      ? current.filter((m) => m !== menuId)
      : [...current, menuId];
    const val = JSON.stringify(next);
    set("disabled_menus", val);
    await save({ disabled_menus: val });
    toast("Branch menu configuration updated");
  };

  useEffect(() => {
    if (tab === "printer" && s.printer_conn === "usb") {
      api.usbDevices().then(setUsb).catch(() => {});
    }
  }, [tab, s.printer_conn]);

  const submitCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    try {
      await api.createBranch(newBranchName.trim());
      await refreshBranchInfo();
      toast(`Branch "${newBranchName.trim()}" created`);
      setNewBranchName("");
      setNewBranchModal(false);
    } catch (e) {
      toast(errText(e), "err");
    } finally {
      setCreatingBranch(false);
    }
  };

  const tabs = [
    ["general", "Appearance & Data"],
    ["branches", "Branches & Google Drive"],
    ["security", "Security & Cashiers"],
    ["printer", "Printer"],
    ["receipt", "Receipt"],
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle="Appearance, branches, security, cashiers, printing">
        {tab !== "general" && tab !== "security" && tab !== "branches" && (
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <DatabaseBackup size={20} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Branch Database Backup & Restore</h3>
            </div>

            <div
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                padding: "12px 14px",
                borderRadius: 10,
                marginBottom: 14,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span>Active Branch: <b>{activeBranch.name}</b></span>
                  <span className="muted" style={{ marginLeft: 8 }}>({activeBranch.file})</span>
                </div>
                <span className="badge ok">Branch-Specific Backup</span>
              </div>
              <p className="muted" style={{ margin: "6px 0 0 0", fontSize: 12 }}>
                Backup and restore operations below only affect the selected branch database. To backup or restore another branch, switch branches first.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={backup}>
                <DatabaseBackup size={17} /> Backup [{activeBranch.name}]
              </button>
              <button className="btn ghost" onClick={restore}>
                <DatabaseZap size={17} /> Restore [{activeBranch.name}]
              </button>
              <button className="btn danger" onClick={() => setShowResetModal(true)}>
                <Trash2 size={17} /> Reset [{activeBranch.name}] Database
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "branches" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Google Drive Location Card */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Cloud size={22} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Google Drive & Database Location</h3>
            </div>
            <p className="muted" style={{ marginBottom: 16 }}>
              Point the database storage folder to your local <b>Google Drive synced folder</b> (e.g. <code>Google Drive/JOYCE_POS</code>) to automatically sync sales from branch stores to the office in real-time.
            </p>

            <div style={{ padding: 14, background: "var(--card-solid)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>CURRENT STORAGE FOLDER</span>
                <span className={"badge " + (branchInfo?.storage_dir ? "ok" : "warn")}>
                  {branchInfo?.storage_dir ? "☁️ Google Drive / Custom Folder" : "💻 Local Default Storage"}
                </span>
              </div>
              <code style={{ display: "block", wordBreak: "break-all", fontSize: 13, color: "var(--text)" }}>
                {branchInfo?.storage_dir || branchInfo?.default_dir || "Loading directory…"}
              </code>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                Active Database: <b>{branchInfo?.active_db_path?.split("/").pop() || "joyce_pos.db"}</b>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={handlePickStorageDir}>
                <FolderOpen size={16} /> Choose Google Drive Folder
              </button>
              {branchInfo?.storage_dir && (
                <button className="btn ghost" onClick={handleResetStorageDir}>
                  Reset to Local Storage
                </button>
              )}
            </div>
          </div>

          {/* Branches List Card */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>Store Branches</h3>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Each branch saves to its own separate database file so different store locations never collide or corrupt each other.
                </p>
              </div>
              <button className="btn sm" onClick={() => setNewBranchModal(true)}>
                <Plus size={15} /> Add Branch
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Branch Name</th>
                  <th>Database File</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(branchInfo?.branches || []).map((b) => {
                  const isActive = b.id === branchInfo?.active_branch;
                  return (
                    <tr key={b.id} className="row-hover">
                      <td>
                        <b>{b.name}</b>
                        {b.id === "main" && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>(Default)</span>}
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{b.file}</code>
                      </td>
                      <td>
                        {isActive ? (
                          <span className="badge ok">Active</span>
                        ) : (
                          <button
                            className="btn ghost sm"
                            onClick={() => handleSwitchBranch(b.id)}
                            style={{ padding: "4px 10px" }}
                          >
                            Switch to this
                          </button>
                        )}
                      </td>
                      <td>
                        {b.id !== "main" && (branchInfo?.branches || []).length > 1 && (
                          <button
                            className="icon-btn"
                            title="Delete branch"
                            onClick={() => handleDeleteBranch(b.id, b.name)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Branch Menu & Reporting Configuration Card */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Store size={18} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>
                Sidebar Menus & Reporting for Active Branch:{" "}
                <span style={{ color: "var(--accent)" }}>
                  {branchInfo?.branches?.find((b) => b.id === branchInfo?.active_branch)?.name || "Current Branch"}
                </span>
              </h3>
            </div>
            <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
              Enable or disable specific modules for this branch. Disabled menus are hidden from the sidebar and automatically excluded from Dashboard reports and overhead deductions.
            </p>

            <div className="perm-grid">
              {[
                { id: "expenses", label: "Expenses", desc: "Store expenses logging & deductions" },
                { id: "salary", label: "Salary", desc: "Employee salary payouts & payroll" },
                { id: "commission", label: "Commission", desc: "Flat employee commission tracking" },
                { id: "ld-commission", label: "LD Commission", desc: "Quantity-based load commissions" },
                { id: "inventory", label: "Inventory", desc: "Stock restock records & history" },
                { id: "employees", label: "Employees", desc: "Staff directory & pay rates" },
              ].map((m) => {
                let disabledList = [];
                try {
                  disabledList = s.disabled_menus ? JSON.parse(s.disabled_menus) : [];
                } catch {
                  disabledList = [];
                }
                const isEnabled = !disabledList.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="perm-label"
                    style={{
                      borderLeft: isEnabled ? "3px solid var(--ok)" : "3px solid var(--border)",
                      opacity: isEnabled ? 1 : 0.65,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleBranchMenu(m.id)}
                    />
                    <div>
                      <b>{m.label}</b>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        {m.desc}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Google Drive Guide Card */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Info size={18} color="var(--accent)" />
              <h4 style={{ margin: 0 }}>How Google Drive Multi-Area Sync Works</h4>
            </div>
            <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13, lineHeight: "1.7", color: "var(--muted)" }}>
              <li>Install <b>Google Drive for Desktop</b> on your Office PC and branch POS terminals.</li>
              <li>Create a shared folder in Google Drive (e.g. <code>My Drive/JOYCE_POS_DATA</code>).</li>
              <li>On all computers, click <b>"Choose Google Drive Folder"</b> above and select that folder.</li>
              <li>Each branch operates in its own dedicated database (e.g. <code>joyce_pos_taguig.db</code>), avoiding SQLite locking issues.</li>
              <li>At the office, the admin can switch between branches in the top-left dropdown to review sales, inventory, and highest employee income in real-time!</li>
            </ol>
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

      {/* Create Branch Modal */}
      {newBranchModal && (
        <Modal title="Create New Branch" onClose={() => setNewBranchModal(false)}>
          <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
            Creates a separate database for this location. Point your Database Storage Folder to Google Drive to sync sales from all branches.
          </p>
          <Field label="Branch Name">
            <input
              autoFocus
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="e.g. Taguig Branch, Downtown Branch"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newBranchName.trim()) submitCreateBranch();
              }}
            />
          </Field>
          <button
            type="button"
            className="btn"
            style={{ width: "100%", marginTop: 8 }}
            disabled={!newBranchName.trim() || creatingBranch}
            onClick={submitCreateBranch}
          >
            <Plus size={16} /> {creatingBranch ? "Creating…" : "Create & Switch Branch"}
          </button>
        </Modal>
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
                {usb.length > 0 ? (
                  <Field label="Detected USB Printers (Inserted)">
                    <select
                      value={`${s.usb_vid}:${s.usb_pid}`}
                      onChange={(e) => {
                        const [v, p] = e.target.value.split(":");
                        set("usb_vid", v);
                        set("usb_pid", p);
                      }}
                    >
                      <option value=":">Select inserted printer…</option>
                      {usb.map((d) => (
                        <option key={d.vid + d.pid} value={`${d.vid}:${d.pid}`}>
                          🖨️ {d.name} ({d.vid}:{d.pid})
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <div
                    className="muted"
                    style={{
                      fontSize: 13,
                      padding: "10px 14px",
                      background: "var(--card-solid)",
                      borderRadius: 10,
                      border: "1px dashed var(--border)",
                    }}
                  >
                    No USB thermal printer detected. Please connect your receipt printer USB cable to the computer and click "Scan USB devices".
                  </div>
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

      {/* ── Authorize Database Reset Modal ── */}
      {showResetModal && (
        <Modal
          title={`Reset Database — ${activeBranch.name}`}
          onClose={() => {
            setShowResetModal(false);
            setResetPin("");
          }}
        >
          <div
            style={{
              background: "rgba(255, 84, 112, 0.1)",
              border: "1px solid rgba(255, 84, 112, 0.35)",
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <b style={{ color: "var(--bad)", display: "block", marginBottom: 4 }}>
              ⚠️ Danger Zone: Authorize Database Reset
            </b>
            <p style={{ margin: 0, color: "var(--text)" }}>
              This will permanently delete all sales, transactions, restocks, expenses, payroll, and shifts for <b>{activeBranch.name}</b>. Other branch databases will not be touched.
            </p>
          </div>

          <form onSubmit={handleResetDatabase}>
            <Field label="Admin PIN Verification">
              <input
                autoFocus
                type="password"
                value={resetPin}
                onChange={(e) => setResetPin(e.target.value)}
                placeholder="Enter Admin PIN to authorize"
                required
              />
            </Field>

            <div style={{ margin: "14px 0", display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="keep-catalog-check"
                checked={keepCatalog}
                onChange={(e) => setKeepCatalog(e.target.checked)}
                style={{ width: "auto" }}
              />
              <label htmlFor="keep-catalog-check" style={{ fontSize: 13, cursor: "pointer", color: "var(--text)" }}>
                Preserve Product Catalog & Cashiers (Recommended — only clears transactions & logs)
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setShowResetModal(false);
                  setResetPin("");
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn danger"
                disabled={resetting || !resetPin}
                style={{ flex: 1 }}
              >
                <Trash2 size={16} /> {resetting ? "Resetting Database…" : `Confirm Reset for [${activeBranch.name}]`}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
