import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Package,
  Boxes,
  Receipt as ReceiptIcon,
  Wallet,
  Users,
  Coins,
  Smartphone,
  Settings as Cog,
  LogOut,
  Store,
  Plus,
  Sunrise,
  Sunset,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { ToastProvider, Modal, Field } from "./components/ui";
import { api } from "./api";
import PinLock from "./components/PinLock";
import AdminDashboard from "./pages/AdminDashboard";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Transactions from "./pages/Transactions";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Expenses from "./pages/Expenses";
import Salary from "./pages/Salary";
import { Commission, LDCommission } from "./pages/Commissions";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import { peso, ymd } from "./utils";

const SettingsCtx = createContext({
  settings: {},
  save: async () => {},
  currentUser: null,
  branchInfo: null,
  refreshBranchInfo: async () => {},
  handleSwitchBranch: async () => {},
  shiftStatus: null,
  refreshShiftStatus: async () => {},
  activeBusinessDate: ymd(),
  openSod: () => {},
  openEod: () => {},
});
export const useSettings = () => useContext(SettingsCtx);

const GATED_SHIFT_TABS = ["pos", "expenses", "commission", "ld-commission", "salary"];

const NAV = [
  { id: "admin-dashboard", label: "Admin Dashboard", icon: ShieldCheck, page: AdminDashboard, adminOnly: true },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, page: Dashboard },
  { id: "pos", label: "POS", icon: ShoppingCart, page: POS },
  { id: "transactions", label: "Transactions", icon: History, page: Transactions },
  { id: "products", label: "Products", icon: Package, page: Products },
  { id: "inventory", label: "Inventory", icon: Boxes, page: Inventory },
  { id: "expenses", label: "Expenses", icon: ReceiptIcon, page: Expenses },
  { id: "salary", label: "Salary", icon: Wallet, page: Salary },
  { id: "commission", label: "Commission", icon: Coins, page: Commission },
  { id: "ld-commission", label: "LD Commission", icon: Smartphone, page: LDCommission },
  { id: "employees", label: "Employees", icon: Users, page: Employees },
  { id: "settings", label: "Settings", icon: Cog, page: Settings },
];

export default function App() {
  const [tab, setTab] = useState("pos");
  const [settings, setSettings] = useState({});
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("joyce-user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [branchInfo, setBranchInfo] = useState(null);
  const [branchKey, setBranchKey] = useState(0);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);

  // Business Shift state (Start of Day / End of Day)
  const [shiftStatus, setShiftStatus] = useState(null);
  const [showSodModal, setShowSodModal] = useState(false);
  const [showEodModal, setShowEodModal] = useState(false);
  const [sodForm, setSodForm] = useState({
    businessDate: ymd(),
    openingCash: "0",
    notes: "",
  });
  const [eodForm, setEodForm] = useState({
    closingCash: "",
    notes: "",
  });
  const [submittingShift, setSubmittingShift] = useState(false);

  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem("joyce-theme", t);
  };

  useEffect(() => {
    applyTheme(localStorage.getItem("joyce-theme") || "dark");
    api
      .getSettings()
      .then((s) => {
        setSettings(s);
        if (s.theme) applyTheme(s.theme);
      })
      .catch(() => {});
  }, []);

  const loadBranchInfo = useCallback(async () => {
    try {
      const info = await api.getBranchInfo();
      setBranchInfo(info);
    } catch (e) {
      console.error("Failed to load branch info", e);
    }
  }, []);

  const loadShiftStatus = useCallback(async () => {
    try {
      const s = await api.getShiftStatus();
      setShiftStatus(s);
    } catch (e) {
      console.error("Failed to load shift status", e);
    }
  }, []);

  useEffect(() => {
    loadBranchInfo();
    loadShiftStatus();
  }, [loadBranchInfo, loadShiftStatus, branchKey]);

  const save = useCallback(async (values) => {
    await api.setSettings(values);
    setSettings((s) => ({ ...s, ...values }));
    if (values.theme) applyTheme(values.theme);
  }, []);

  const handleUnlock = (user) => {
    sessionStorage.setItem("joyce-user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("joyce-user");
    setCurrentUser(null);
  };

  const handleSwitchBranch = async (branchId) => {
    try {
      const info = await api.switchBranch(branchId);
      setBranchInfo(info);
      const s = await api.getSettings().catch(() => ({}));
      setSettings(s);
      if (s.theme) applyTheme(s.theme);
      setBranchKey((k) => k + 1);
      await loadShiftStatus();
    } catch (e) {
      alert("Failed to switch branch: " + e);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    try {
      const info = await api.createBranch(newBranchName.trim());
      setBranchInfo(info);
      const s = await api.getSettings().catch(() => ({}));
      setSettings(s);
      if (s.theme) applyTheme(s.theme);
      setBranchKey((k) => k + 1);
      setShowAddBranch(false);
      setNewBranchName("");
      await loadShiftStatus();
    } catch (e) {
      alert("Failed to create branch: " + e);
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleStartDay = async (e) => {
    e?.preventDefault();
    setSubmittingShift(true);
    try {
      await api.startDay(
        sodForm.businessDate || ymd(),
        currentUser?.name || "Cashier",
        Number(sodForm.openingCash || 0),
        sodForm.notes
      );
      await loadShiftStatus();
      setShowSodModal(false);
      setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
    } catch (err) {
      alert("Failed to start day: " + err);
    } finally {
      setSubmittingShift(false);
    }
  };

  const handleEndDay = async (e) => {
    e?.preventDefault();
    if (eodForm.closingCash === "") {
      alert("Please enter the counted closing cash in drawer");
      return;
    }
    setSubmittingShift(true);
    try {
      const summary = await api.endDay(
        Number(eodForm.closingCash || 0),
        currentUser?.name || "Cashier",
        eodForm.notes
      );
      await loadShiftStatus();
      setShowEodModal(false);
      setEodForm({ closingCash: "", notes: "" });
      alert(
        `Business Day [${summary.business_date}] closed successfully!\n\nExpected Cash: ₱${summary.expected_cash}\nClosing Count: ₱${summary.closing_cash}\nVariance: ₱${summary.variance}`
      );
    } catch (err) {
      alert("Failed to end day: " + err);
    } finally {
      setSubmittingShift(false);
    }
  };

  const activeBusinessDate = shiftStatus?.is_open
    ? shiftStatus.shift.business_date
    : ymd();

  const disabledMenus = settings?.disabled_menus
    ? (() => {
        try {
          return JSON.parse(settings.disabled_menus);
        } catch {
          return [];
        }
      })()
    : [];

  const allowedNav = NAV.filter((item) => {
    if (!currentUser) return false;
    // Admin dashboard and admin-only tabs are strictly restricted to role === "admin"
    if (item.adminOnly && currentUser.role !== "admin") return false;

    // Per-branch disabled menus (core system tabs are protected)
    if (!["admin-dashboard", "dashboard", "pos", "transactions", "products", "settings"].includes(item.id)) {
      if (disabledMenus.includes(item.id)) return false;
    }
    if (currentUser.role === "admin") return true;
    if (Array.isArray(currentUser.permissions)) {
      return currentUser.permissions.includes(item.id);
    }
    return false;
  });

  useEffect(() => {
    if (currentUser && allowedNav.length > 0) {
      if (!allowedNav.some((n) => n.id === tab)) {
        setTab(allowedNav[0].id);
      }
    }
  }, [currentUser, allowedNav, tab]);

  const currentItem = allowedNav.find((n) => n.id === tab) || allowedNav[0];
  const Page = currentItem ? currentItem.page : null;

  return (
    <ToastProvider>
      <SettingsCtx.Provider
        value={{
          settings,
          save,
          currentUser,
          branchInfo,
          refreshBranchInfo: loadBranchInfo,
          handleSwitchBranch,
          shiftStatus,
          refreshShiftStatus: loadShiftStatus,
          activeBusinessDate,
          openSod: () => {
            setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
            setShowSodModal(true);
          },
          openEod: () => {
            loadShiftStatus();
            setEodForm({ closingCash: "", notes: "" });
            setShowEodModal(true);
          },
        }}
      >
        {!currentUser ? (
          <PinLock onUnlock={handleUnlock} />
        ) : (
          <div className="app">
            <aside className="sidebar">
              <div className="brand">
                <img src="/logo.png" alt="JOYCE POS logo" />
                <div>
                  <b>JOYCE POS</b>
                  <small></small>
                </div>
              </div>

              {/* Branch switcher dropdown with plus icon below JOYCE POS */}
              <div className="branch-bar">
                <div className="branch-selector">
                  <Store size={15} className="branch-icon" />
                  <select
                    id="branch-select"
                    value={branchInfo?.active_branch || "main"}
                    onChange={(e) => handleSwitchBranch(e.target.value)}
                    title="Switch active store branch"
                  >
                    {(branchInfo?.branches || [{ id: "main", name: "Main Store" }]).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-icon branch-add-btn"
                  title="Create new branch"
                  onClick={() => setShowAddBranch(true)}
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Start of Day / End of Day Shift Widget */}
              <div className={`shift-widget ${shiftStatus?.is_open ? "open" : "closed"}`}>
                <div className="shift-widget-header">
                  <div className="shift-badge">
                    <span className="shift-dot" />
                    <span>{shiftStatus?.is_open ? "DAY OPEN" : "DAY CLOSED"}</span>
                  </div>
                  <span className="shift-date">
                    {shiftStatus?.is_open ? shiftStatus.shift.business_date : "No active shift"}
                  </span>
                </div>

                {shiftStatus?.is_open ? (
                  <div className="shift-widget-body">
                    <div className="shift-details">
                      <span>Started: <b>{shiftStatus.shift.opened_at?.slice(11, 16) || "—"}</b></span>
                      <span>Cash in drawer: <b>{peso(shiftStatus.shift.expected_cash)}</b></span>
                    </div>
                    <button
                      type="button"
                      className="btn-shift end"
                      onClick={() => {
                        loadShiftStatus();
                        setEodForm({ closingCash: "", notes: "" });
                        setShowEodModal(true);
                      }}
                    >
                      <Sunset size={14} /> End of Day (EOD)
                    </button>
                  </div>
                ) : (
                  <div className="shift-widget-body">
                    <p className="shift-subtext">Transactions will anchor to start date even past 12 midnight</p>
                    <button
                      type="button"
                      className="btn-shift start"
                      onClick={() => {
                        setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
                        setShowSodModal(true);
                      }}
                    >
                      <Sunrise size={14} /> Start of Day (SOD)
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflowY: "auto" }}>
                {allowedNav.map(({ id, label, icon: Icon }) => {
                  const isGated = GATED_SHIFT_TABS.includes(id) && !shiftStatus?.is_open;
                  return (
                    <button
                      key={id}
                      id={`nav-${id}`}
                      className={
                        "nav-btn" +
                        (tab === id ? " active" : "") +
                        (isGated ? " gated-disabled" : "")
                      }
                      onClick={() => {
                        if (isGated) {
                          setShowSodModal(true);
                        } else {
                          setTab(id);
                        }
                      }}
                      title={
                        isGated
                          ? "Business day is closed. Click to Start Day (SOD) to enable."
                          : label
                      }
                    >
                      <Icon size={19} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {isGated && (
                        <span className="lock-pill" title="Requires active business shift">
                          <Lock size={10} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
                          SOD
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="sidebar-footer">
                <div className="user-profile">
                  <div className="user-avatar">{currentUser.role === "admin" ? "🛡️" : "👤"}</div>
                  <div className="user-info">
                    <span className="user-name">{currentUser.name || "User"}</span>
                    <span className="user-role">{currentUser.role}</span>
                  </div>
                  <button
                    className="btn-ghost btn-sm"
                    style={{ padding: "6px", minWidth: "unset" }}
                    title="Lock screen"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            </aside>
            <main
              className={"main" + (tab === "pos" && shiftStatus?.is_open ? " pos-main" : "")}
              key={`${tab}-${branchKey}`}
            >
              {GATED_SHIFT_TABS.includes(tab) && !shiftStatus?.is_open ? (
                <div className="shift-locked-screen">
                  <div className="shift-locked-icon">
                    <Sunrise size={42} />
                  </div>
                  <h2>Business Day is Closed</h2>
                  <p>
                    To guarantee transaction integrity and avoid cross-date bookkeeping issues,{" "}
                    <b>{currentItem?.label || "This section"}</b> is disabled until a business day is started.
                    Starting of Day (SOD) locks all subsequent sales, expenses, commissions, and payroll to that business date even past 12 midnight.
                  </p>
                  <div className="shift-locked-tabs">
                    <span className="shift-locked-tab-chip"><Lock size={12} /> POS</span>
                    <span className="shift-locked-tab-chip"><Lock size={12} /> Expenses</span>
                    <span className="shift-locked-tab-chip"><Lock size={12} /> Commissions</span>
                    <span className="shift-locked-tab-chip"><Lock size={12} /> LD Commissions</span>
                    <span className="shift-locked-tab-chip"><Lock size={12} /> Salary</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "12px 28px", fontSize: 15 }}
                      onClick={() => {
                        setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
                        setShowSodModal(true);
                      }}
                    >
                      <Sunrise size={18} /> Start of Day (SOD)
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setTab(currentUser.role === "admin" ? "admin-dashboard" : "dashboard")}
                    >
                      View Reports Dashboard
                    </button>
                  </div>
                </div>
              ) : Page ? (
                <Page />
              ) : (
                <div className="empty">No access to this section.</div>
              )}
            </main>

            {/* Create Branch Modal */}
            {showAddBranch && (
              <Modal title="Create New Branch" onClose={() => setShowAddBranch(false)}>
                <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
                  Creates an isolated database for this location. Point your Database Storage Folder to Google Drive in Settings to sync sales across branches.
                </p>
                <Field label="Branch Name">
                  <input
                    autoFocus
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="e.g. Taguig Branch, Downtown Branch"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newBranchName.trim()) handleCreateBranch();
                    }}
                  />
                </Field>
                <button
                  type="button"
                  className="btn"
                  style={{ width: "100%", marginTop: 8 }}
                  disabled={!newBranchName.trim() || creatingBranch}
                  onClick={handleCreateBranch}
                >
                  <Plus size={16} /> {creatingBranch ? "Creating…" : "Create & Switch Branch"}
                </button>
              </Modal>
            )}

            {/* ── Start of Day (SOD) Modal ── */}
            {showSodModal && (
              <Modal title="Start of Day (SOD) — Open Shift" onClose={() => setShowSodModal(false)}>
                <div
                  style={{
                    background: "rgba(255, 122, 61, 0.08)",
                    border: "1px solid rgba(255, 122, 61, 0.3)",
                    padding: 12,
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
                    <Sunrise size={16} /> Midnight Date Persistence Active
                  </div>
                  <div>
                    The business date you choose below will remain the official transaction date for <b>all sales, expenses, and payroll</b>, even if the store operates past <b>12:00 midnight</b>, until you execute End of Day (EOD).
                  </div>
                </div>

                <form onSubmit={handleStartDay}>
                  <Field label="Official Business Date">
                    <input
                      type="date"
                      value={sodForm.businessDate}
                      onChange={(e) => setSodForm({ ...sodForm, businessDate: e.target.value })}
                      required
                    />
                  </Field>

                  <Field label="Opening Drawer Float / Cash (₱)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sodForm.openingCash}
                      onChange={(e) => setSodForm({ ...sodForm, openingCash: e.target.value })}
                      placeholder="e.g. 1000.00"
                      required
                    />
                  </Field>

                  <Field label="Shift Notes (Optional)">
                    <input
                      value={sodForm.notes}
                      onChange={(e) => setSodForm({ ...sodForm, notes: e.target.value })}
                      placeholder="e.g. Opening bill change denominations confirmed"
                    />
                  </Field>

                  <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button type="button" className="btn ghost" onClick={() => setShowSodModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn" disabled={submittingShift} style={{ flex: 1 }}>
                      <Sunrise size={16} /> {submittingShift ? "Opening Shift…" : "Confirm & Start Business Day"}
                    </button>
                  </div>
                </form>
              </Modal>
            )}

            {/* ── End of Day (EOD) Modal & Drawer Reconciliation ── */}
            {showEodModal && shiftStatus?.shift && (() => {
              const shift = shiftStatus.shift;
              const openCash = Number(shift.opening_cash || 0);
              const cashSales = Number(shift.cash_sales || 0);
              const expenses = Number(shift.expenses || 0);
              const salaries = Number(shift.salaries || 0);
              const commissions = Number(shift.commissions || 0);
              const ldCommissions = Number(shift.ld_commissions || 0);
              const totalOutflows = expenses + salaries + commissions + ldCommissions;
              const expected = openCash + cashSales - totalOutflows;
              const actual = eodForm.closingCash !== "" ? Number(eodForm.closingCash) : null;
              const variance = actual !== null ? actual - expected : null;

              return (
                <Modal title="End of Day (EOD) — Shift Reconciliation" onClose={() => setShowEodModal(false)}>
                  <div id="printable-eod-report" style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        background: "var(--card)",
                        padding: 14,
                        borderRadius: 10,
                        fontSize: 13,
                        marginBottom: 14,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div>
                        <span className="muted">Business Date:</span><br />
                        <b>{shift.business_date}</b>
                      </div>
                      <div>
                        <span className="muted">Branch:</span><br />
                        <b>{branchInfo?.branches?.find((b) => b.id === branchInfo.active_branch)?.name || "Main Store"}</b>
                      </div>
                      <div>
                        <span className="muted">Opened By:</span><br />
                        <span>{shift.opened_by} ({shift.opened_at?.slice(11, 16)})</span>
                      </div>
                      <div>
                        <span className="muted">Closed By:</span><br />
                        <span>{currentUser?.name || "Cashier"}</span>
                      </div>
                    </div>

                    {/* Breakdown table */}
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                        <span>Opening Cash Float</span>
                        <b>{peso(openCash)}</b>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                        <span>+ Total Cash Sales</span>
                        <b style={{ color: "var(--ok)" }}>+{peso(cashSales)}</b>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                        <span>- Store Expenses Paid</span>
                        <b style={{ color: "var(--bad)" }}>-{peso(expenses)}</b>
                      </div>
                      {salaries > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                          <span>- Salaries Paid</span>
                          <b style={{ color: "var(--bad)" }}>-{peso(salaries)}</b>
                        </div>
                      )}
                      {commissions > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                          <span>- Commissions Paid</span>
                          <b style={{ color: "var(--bad)" }}>-{peso(commissions)}</b>
                        </div>
                      )}
                      {ldCommissions > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                          <span>- LD Commissions Paid</span>
                          <b style={{ color: "var(--bad)" }}>-{peso(ldCommissions)}</b>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          background: "rgba(255, 122, 61, 0.08)",
                          fontSize: 15,
                        }}
                      >
                        <b>Expected Cash in Drawer</b>
                        <b style={{ color: "var(--accent)" }}>{peso(expected)}</b>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleEndDay}>
                    <Field label="Actual Cash Counted in Drawer (₱)">
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        min="0"
                        value={eodForm.closingCash}
                        onChange={(e) => setEodForm({ ...eodForm, closingCash: e.target.value })}
                        placeholder="e.g. 15250.00"
                        required
                      />
                    </Field>

                    {variance !== null && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          marginBottom: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background:
                            variance === 0
                              ? "rgba(47, 207, 138, 0.1)"
                              : variance > 0
                              ? "rgba(47, 207, 138, 0.15)"
                              : "rgba(255, 84, 112, 0.15)",
                          border: `1px solid ${
                            variance >= 0 ? "rgba(47, 207, 138, 0.4)" : "rgba(255, 84, 112, 0.4)"
                          }`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {variance === 0 ? (
                            <CheckCircle2 size={18} color="var(--ok)" />
                          ) : (
                            <AlertCircle size={18} color={variance > 0 ? "var(--ok)" : "var(--bad)"} />
                          )}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {variance === 0
                              ? "Drawer Exactly Balanced"
                              : variance > 0
                              ? `Cash Overage (+${peso(variance)})`
                              : `Cash Shortage (${peso(variance)})`}
                          </span>
                        </div>
                        <b style={{ color: variance >= 0 ? "var(--ok)" : "var(--bad)" }}>
                          {variance >= 0 ? `+${peso(variance)}` : peso(variance)}
                        </b>
                      </div>
                    )}

                    <Field label="Closing Notes / Shift Summary">
                      <input
                        value={eodForm.notes}
                        onChange={(e) => setEodForm({ ...eodForm, notes: e.target.value })}
                        placeholder="e.g. Deposit prepared, drawer locked"
                      />
                    </Field>

                    <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => window.print()}
                        title="Print drawer summary"
                      >
                        <Printer size={16} /> Print Z-Reading
                      </button>
                      <button
                        type="submit"
                        className="btn danger"
                        disabled={submittingShift || eodForm.closingCash === ""}
                        style={{ flex: 1 }}
                      >
                        <Sunset size={16} /> {submittingShift ? "Closing Shift…" : "Confirm End of Day (Close Shift)"}
                      </button>
                    </div>
                  </form>
                </Modal>
              );
            })()}
          </div>
        )}
      </SettingsCtx.Provider>
    </ToastProvider>
  );
}
