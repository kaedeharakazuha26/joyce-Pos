import { Component, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Search,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sun,
  Moon,
  ChevronRight,
  Zap,
  CheckCheck,
  ExternalLink,
  AlertTriangle,
  Info,
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
import { monthStart, peso, ymd, errText } from "./utils";

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
  navigateTo: () => {},
  navigateToAdminReport: () => {},
  adminReportIntent: null,
  clearAdminReportIntent: () => {},
  refreshAlerts: async () => {},
});
export const useSettings = () => useContext(SettingsCtx);

const GATED_SHIFT_TABS = ["pos", "expenses", "commission", "ld-commission", "salary"];

const NAV = [
  { id: "admin-dashboard", label: "Admin Dashboard", group: "Analytics & Control", icon: ShieldCheck, page: AdminDashboard, adminOnly: true },
  { id: "dashboard", label: "Store Overview", group: "Analytics & Control", icon: LayoutDashboard, page: Dashboard },
  { id: "pos", label: "Point of Sale (POS)", group: "Operations", icon: ShoppingCart, page: POS },
  { id: "transactions", label: "Transactions", group: "Operations", icon: History, page: Transactions },
  { id: "products", label: "Products Catalog", group: "Inventory & Catalog", icon: Package, page: Products },
  { id: "inventory", label: "Stock & Restock", group: "Inventory & Catalog", icon: Boxes, page: Inventory },
  { id: "expenses", label: "Store Expenses", group: "Finance & Payroll", icon: ReceiptIcon, page: Expenses },
  { id: "salary", label: "Salary Payroll", group: "Finance & Payroll", icon: Wallet, page: Salary },
  { id: "commission", label: "Commissions", group: "Finance & Payroll", icon: Coins, page: Commission },
  { id: "ld-commission", label: "LD Commissions", group: "Finance & Payroll", icon: Smartphone, page: LDCommission },
  { id: "employees", label: "Employees", group: "Administration", icon: Users, page: Employees },
  { id: "settings", label: "Settings", group: "Administration", icon: Cog, page: Settings },
];

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Page render error caught by boundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ textAlign: "center", padding: 40, margin: "40px auto", maxWidth: 600 }}>
          <ShieldAlert size={48} color="var(--bad)" style={{ margin: "0 auto 16px" }} />
          <h3>Something went wrong rendering this section</h3>
          <p className="muted" style={{ fontSize: 13, wordBreak: "break-word", margin: "12px 0 20px" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="btn sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reload Section
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  // Responsive & Collapsible Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("joyce-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Deep-link navigation state into AdminDashboard reports
  const [adminReportIntent, setAdminReportIntent] = useState(null);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // Notifications & Important Alerts state
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => {
    try {
      const saved = sessionStorage.getItem("joyce-dismissed-alerts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef(null);
  const quickRef = useRef(null);
  const userRef = useRef(null);

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
  const [eodViewMode, setEodViewMode] = useState("reconciliation"); // "reconciliation" | "receipt"
  const [printingZReading, setPrintingZReading] = useState(false);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("joyce-sidebar-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem("joyce-theme", t);
  };

  const toggleTheme = () => {
    const cur = document.documentElement.dataset.theme || "dark";
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    setSettings((s) => ({ ...s, theme: next }));
    api.setSettings({ theme: next }).catch(() => {});
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

  const refreshAlerts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const d = await api.adminDashboard(monthStart(), ymd());
      if (Array.isArray(d?.alerts)) {
        setAlerts(d.alerts);
      }
    } catch {
      // Fallback for non-admin or initial load
    }
  }, [currentUser]);

  useEffect(() => {
    loadBranchInfo();
    loadShiftStatus();
    refreshAlerts();
  }, [loadBranchInfo, loadShiftStatus, refreshAlerts, branchKey]);

  // Close topbar popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (quickRef.current && !quickRef.current.contains(e.target)) setQuickMenuOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        const el = document.getElementById("global-search-input");
        if (el) el.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced Global Search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.globalSearch(q);
        setSearchResults(res);
      } catch (e) {
        console.error("Global search failed:", e);
      } finally {
        setSearchLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const save = useCallback(async (values) => {
    await api.setSettings(values);
    setSettings((s) => ({ ...s, ...values }));
    if (values.theme) applyTheme(values.theme);
  }, []);

  const handleUnlock = (user) => {
    sessionStorage.setItem("joyce-user", JSON.stringify(user));
    setCurrentUser(user);
    if (user.role === "admin") {
      let isDis = false;
      try {
        const d = settings?.disabled_menus ? JSON.parse(settings.disabled_menus) : [];
        isDis = d.includes("admin-dashboard");
      } catch {}
      setTab(isDis ? "dashboard" : "admin-dashboard");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("joyce-user");
    setCurrentUser(null);
    setUserMenuOpen(false);
  };

  const navigateTo = useCallback(
    (targetTab) => {
      const isGated = GATED_SHIFT_TABS.includes(targetTab) && !shiftStatus?.is_open;
      setMobileNavOpen(false);
      if (isGated) {
        setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
        setShowSodModal(true);
      } else {
        setTab(targetTab);
      }
    },
    [shiftStatus]
  );

  const navigateToAdminReport = useCallback(
    (reportTab, filters = {}) => {
      setMobileNavOpen(false);
      setAdminReportIntent({
        reportTab,
        ...filters,
        ts: Date.now(),
      });
      if (currentUser?.role === "admin" && !disabledMenus.includes("admin-dashboard")) {
        setTab("admin-dashboard");
      } else {
        // Fallback for non-admin users to corresponding operational module
        const map = {
          sales: "transactions",
          products: "products",
          expenses: "expenses",
          salaries: "salary",
          commissions: "commission",
          "ld-commissions": "ld-commission",
          employees: "employees",
        };
        setTab(map[reportTab] || "dashboard");
      }
    },
    [currentUser]
  );

  const clearAdminReportIntent = useCallback(() => {
    setAdminReportIntent(null);
  }, []);

  const handleSwitchBranch = async (branchId) => {
    try {
      const info = await api.switchBranch(branchId);
      setBranchInfo(info);
      const s = await api.getSettings().catch(() => ({}));
      setSettings(s);
      if (s.theme) applyTheme(s.theme);
      setBranchKey((k) => k + 1);
      await loadShiftStatus();
      await refreshAlerts();
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
      await refreshAlerts();
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
      await refreshAlerts();
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
      await loadBranchInfo();
      await refreshAlerts();
      setShowEodModal(false);
      setEodForm({ closingCash: "", notes: "" });
      const bkp = summary?.eod_backup;
      const bkpMsg = bkp?.ok
        ? `\n\n☁️ Automatic EOD Backup Saved (${bkp.is_google_drive ? "Google Drive Folder" : "Local EOD_Backups"}):\n${bkp.archive_path}`
        : "";
      alert(
        `Business Day [${summary.business_date}] closed successfully!\n\nExpected Cash: ₱${summary.expected_cash}\nClosing Count: ₱${summary.closing_cash}\nVariance: ₱${summary.variance}${bkpMsg}`
      );
    } catch (err) {
      alert("Failed to end day: " + err);
    } finally {
      setSubmittingShift(false);
    }
  };

  const handlePrintZReadingThermal = async (shift) => {
    setPrintingZReading(true);
    try {
      const closingVal = eodForm.closingCash !== "" ? Number(eodForm.closingCash) : Number(shift.expected_cash || 0);
      await api.printZReading(shift.id, closingVal, eodForm.notes, currentUser?.name || "Cashier");
      alert("Thermal Z-Reading successfully sent to thermal printer!");
    } catch (e) {
      alert("Thermal printer error: " + errText(e));
    } finally {
      setPrintingZReading(false);
    }
  };

  const dismissAlert = (id) => {
    setDismissedAlertIds((prev) => {
      const next = [...new Set([...prev, id])];
      try {
        sessionStorage.setItem("joyce-dismissed-alerts", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearDismissedAlerts = () => {
    setDismissedAlertIds([]);
    try {
      sessionStorage.removeItem("joyce-dismissed-alerts");
    } catch {}
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
    if (item.adminOnly && currentUser.role !== "admin") return false;
    if (!["dashboard", "pos", "transactions", "products", "settings"].includes(item.id)) {
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
  const activeBranchName =
    branchInfo?.branches?.find((b) => b.id === branchInfo.active_branch)?.name || "Main Store";

  const visibleAlerts = alerts.filter((a) => !dismissedAlertIds.includes(a.id));

  const handleAlertClick = (a) => {
    setNotifOpen(false);
    if (a.target === "shift") {
      if (!shiftStatus?.is_open) {
        setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
        setShowSodModal(true);
      } else {
        navigateToAdminReport("shifts", { filter: a.filter || "all" });
      }
      return;
    }
    navigateToAdminReport(a.target || "overview", { statusFilter: a.filter || "all" });
  };

  const handleSearchResultClick = (type, item) => {
    setSearchOpen(false);
    setSearchQuery("");
    if (currentUser?.role === "admin") {
      const map = {
        products: { reportTab: "products", search: item.name },
        sales: { reportTab: "sales", search: item.receipt_no },
        expenses: { reportTab: "expenses", search: item.category },
        salaries: { reportTab: "salaries", search: item.staff_name },
        commissions: { reportTab: "commissions", search: item.staff_name },
        ld_commissions: { reportTab: "ld-commissions", search: item.staff_name },
        employees: { reportTab: "employees", search: item.name },
        shifts: { reportTab: "shifts", search: item.business_date },
      };
      const target = map[type] || { reportTab: "overview" };
      navigateToAdminReport(target.reportTab, { search: target.search || "" });
    } else {
      const tabMap = {
        products: "products",
        sales: "transactions",
        expenses: "expenses",
        salaries: "salary",
        commissions: "commission",
        ld_commissions: "ld-commission",
        employees: "employees",
      };
      navigateTo(tabMap[type] || "dashboard");
    }
  };

  const totalSearchHits = searchResults
    ? Object.values(searchResults).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
    : 0;

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
          navigateTo,
          navigateToAdminReport,
          adminReportIntent,
          clearAdminReportIntent,
          refreshAlerts,
        }}
      >
        {!currentUser ? (
          <PinLock onUnlock={handleUnlock} />
        ) : (
          <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            {/* Mobile backdrop when sidebar drawer is open */}
            {mobileNavOpen && (
              <div
                className="mobile-nav-backdrop"
                onClick={() => setMobileNavOpen(false)}
                aria-hidden="true"
              />
            )}

            <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileNavOpen ? "mobile-open" : ""}`}>
              <div className="brand">
                <img src="/logo.png" alt="JOYCE POS logo" />
                {!sidebarCollapsed && (
                  <div className="brand-text">
                    <b>{settings.store_name || "JOYCE POS"}</b>
                    <small>{activeBranchName}</small>
                  </div>
                )}
                <button
                  type="button"
                  className="icon-btn sidebar-collapse-btn"
                  onClick={toggleSidebarCollapse}
                  title={sidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
                  aria-label="Toggle sidebar"
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
              </div>

              {/* Branch switcher dropdown */}
              {!sidebarCollapsed && (
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
              )}

              {/* Start of Day / End of Day Shift Widget */}
              {!sidebarCollapsed ? (
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
                      <p className="shift-subtext">Transactions anchor to start date even past 12 midnight</p>
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
              ) : (
                <button
                  type="button"
                  className={`shift-rail-btn ${shiftStatus?.is_open ? "open" : "closed"}`}
                  title={
                    shiftStatus?.is_open
                      ? `Shift OPEN (${shiftStatus.shift.business_date}) • Drawer: ${peso(shiftStatus.shift.expected_cash)} — Click for EOD`
                      : "Shift CLOSED — Click to Start Day (SOD)"
                  }
                  onClick={() => {
                    if (shiftStatus?.is_open) {
                      loadShiftStatus();
                      setEodForm({ closingCash: "", notes: "" });
                      setShowEodModal(true);
                    } else {
                      setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
                      setShowSodModal(true);
                    }
                  }}
                >
                  {shiftStatus?.is_open ? <Sunset size={17} /> : <Sunrise size={17} />}
                </button>
              )}

              <nav className="sidebar-nav" aria-label="Main navigation">
                {allowedNav.map(({ id, label, icon: Icon }, idx) => {
                  const isGated = GATED_SHIFT_TABS.includes(id) && !shiftStatus?.is_open;
                  const prevGroup = idx > 0 ? allowedNav[idx - 1].group : null;
                  const curGroup = allowedNav[idx].group;
                  return (
                    <div key={id}>
                      {!sidebarCollapsed && curGroup !== prevGroup && (
                        <div className="nav-group-label">{curGroup}</div>
                      )}
                      <button
                        id={`nav-${id}`}
                        className={
                          "nav-btn" +
                          (tab === id ? " active" : "") +
                          (isGated ? " gated-disabled" : "")
                        }
                        onClick={() => navigateTo(id)}
                        title={
                          isGated
                            ? `${label} — Business day is closed. Click to Start Day (SOD).`
                            : label
                        }
                      >
                        <Icon size={18} style={{ flexShrink: 0 }} />
                        {!sidebarCollapsed && <span style={{ flex: 1 }}>{label}</span>}
                        {!sidebarCollapsed && isGated && (
                          <span className="lock-pill" title="Requires active business shift">
                            <Lock size={10} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
                            SOD
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </nav>

              <div className="sidebar-footer">
                <div className="user-profile" title={`${currentUser.name || "User"} (${currentUser.role})`}>
                  <div className="user-avatar">{currentUser.role === "admin" ? "🛡️" : "👤"}</div>
                  {!sidebarCollapsed && (
                    <div className="user-info">
                      <span className="user-name">{currentUser.name || "User"}</span>
                      <span className="user-role">{currentUser.role}</span>
                    </div>
                  )}
                  <button
                    className="btn-ghost btn-sm"
                    style={{ padding: "6px", minWidth: "unset" }}
                    title="Lock screen / Switch user"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            </aside>

            <div className="workspace-shell">
              {/* Top Navigation Bar */}
              <header className="topbar no-print">
                <div className="topbar-left">
                  <button
                    type="button"
                    className="icon-btn mobile-menu-btn"
                    onClick={() => setMobileNavOpen((o) => !o)}
                    aria-label="Open navigation menu"
                    title="Toggle navigation menu"
                  >
                    <Menu size={18} />
                  </button>

                  <div className="breadcrumbs" aria-label="Breadcrumb">
                    <span className="crumb-root">{activeBranchName}</span>
                    <ChevronRight size={13} className="crumb-sep" />
                    <span className="crumb-group">{currentItem?.group || "Workspace"}</span>
                    <ChevronRight size={13} className="crumb-sep" />
                    <strong className="crumb-current">{currentItem?.label || "Dashboard"}</strong>
                  </div>
                </div>

                {/* Global Cross-Module Search */}
                <div className="topbar-search" ref={searchRef}>
                  <div className="search-input-wrap">
                    <Search size={15} className="search-icon" />
                    <input
                      id="global-search-input"
                      type="text"
                      value={searchQuery}
                      onFocus={() => setSearchOpen(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      placeholder="Search products, receipts, staff, expenses… (Ctrl+K)"
                      aria-label="Global search"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="search-clear-btn"
                        onClick={() => {
                          setSearchQuery("");
                          setSearchResults(null);
                        }}
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {searchOpen && searchQuery.trim().length > 0 && (
                    <div className="topbar-dropdown search-dropdown">
                      <div className="dropdown-head">
                        <span>Search Results for “{searchQuery.trim()}”</span>
                        <span className="muted">{searchLoading ? "Searching…" : `${totalSearchHits} found`}</span>
                      </div>
                      <div className="dropdown-body">
                        {!searchLoading && totalSearchHits === 0 && (
                          <div className="dropdown-empty">No matching records across products, sales, staff, or expenses.</div>
                        )}

                        {searchResults?.products?.length > 0 && (
                          <div className="search-group">
                            <div className="search-group-title">Products ({searchResults.products.length})</div>
                            {searchResults.products.map((p) => (
                              <button
                                key={`p-${p.id}`}
                                type="button"
                                className="search-item"
                                onClick={() => handleSearchResultClick("products", p)}
                              >
                                <div>
                                  <b>{p.name}</b>
                                  <span className="muted"> • {p.category || "General"}</span>
                                </div>
                                <div className="search-meta">
                                  <span>{peso(p.price)}</span>
                                  <span className={`badge ${p.stock <= 0 ? "tone-bad" : p.stock <= p.low_stock ? "tone-warn" : "tone-ok"}`}>
                                    {p.stock} in stock
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults?.sales?.length > 0 && (
                          <div className="search-group">
                            <div className="search-group-title">Receipts & Sales ({searchResults.sales.length})</div>
                            {searchResults.sales.map((s) => (
                              <button
                                key={`s-${s.id}`}
                                type="button"
                                className="search-item"
                                onClick={() => handleSearchResultClick("sales", s)}
                              >
                                <div>
                                  <b>{s.receipt_no}</b>
                                  <span className="muted"> • {s.created_at}</span>
                                </div>
                                <div className="search-meta">
                                  <b>{peso(s.total)}</b>
                                  <span className={`badge ${s.status === "voided" ? "tone-bad" : "tone-ok"}`}>
                                    {s.status}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults?.employees?.length > 0 && (
                          <div className="search-group">
                            <div className="search-group-title">Employees ({searchResults.employees.length})</div>
                            {searchResults.employees.map((emp) => (
                              <button
                                key={`emp-${emp.id}`}
                                type="button"
                                className="search-item"
                                onClick={() => handleSearchResultClick("employees", emp)}
                              >
                                <div>
                                  <b>{emp.name}</b>
                                  <span className="muted"> • {emp.role || "Staff"}</span>
                                </div>
                                <span className="badge tone-info">{peso(emp.daily_rate)}/day</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults?.expenses?.length > 0 && (
                          <div className="search-group">
                            <div className="search-group-title">Expenses ({searchResults.expenses.length})</div>
                            {searchResults.expenses.map((ex) => (
                              <button
                                key={`ex-${ex.id}`}
                                type="button"
                                className="search-item"
                                onClick={() => handleSearchResultClick("expenses", ex)}
                              >
                                <div>
                                  <b>{ex.category}</b>
                                  <span className="muted"> • {ex.description || ex.incurred_on}</span>
                                </div>
                                <span className="badge tone-warn">{peso(ex.amount)}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {(searchResults?.salaries?.length > 0 ||
                          searchResults?.commissions?.length > 0 ||
                          searchResults?.ld_commissions?.length > 0) && (
                          <div className="search-group">
                            <div className="search-group-title">Payroll & Commissions</div>
                            {(searchResults.salaries || []).map((sal) => (
                              <button
                                key={`sal-${sal.id}`}
                                type="button"
                                className="search-item"
                                onClick={() => handleSearchResultClick("salaries", sal)}
                              >
                                <div>
                                  <b>Salary: {sal.staff_name}</b>
                                  <span className="muted"> • {sal.paid_on}</span>
                                </div>
                                <span className="badge tone-info">{peso(sal.amount)}</span>
                              </button>
                            ))}
                            {(searchResults.commissions || []).map((c) => (
                              <button
                                key={`com-${c.id}`}
                                type="button"
                                className="search-item"
                                onClick={() => handleSearchResultClick("commissions", c)}
                              >
                                <div>
                                  <b>Commission: {c.staff_name}</b>
                                  <span className="muted"> • {c.commission_type} ({c.earned_on})</span>
                                </div>
                                <span className="badge tone-purple">{peso(c.amount)}</span>
                              </button>
                            ))}
                            {(searchResults.ld_commissions || []).map((ld) => (
                              <button
                                key={`ld-${ld.id}`}
                                type="button"
                                className="search-item"
                                onClick={() => handleSearchResultClick("ld_commissions", ld)}
                              >
                                <div>
                                  <b>LD Commission: {ld.staff_name}</b>
                                  <span className="muted"> • {ld.quantity} Ladies Drink ({ld.earned_on})</span>
                                </div>
                                <span className="badge tone-purple">{peso(ld.total)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Topbar Right Actions: Quick Actions, Shift Badge, Notifications, Theme, Profile */}
                <div className="topbar-right">
                  {/* Quick Actions Menu */}
                  <div className="topbar-popover-wrap" ref={quickRef}>
                    <button
                      type="button"
                      className="btn sm ghost topbar-action-btn"
                      onClick={() => setQuickMenuOpen((o) => !o)}
                      title="Quick Actions & Shortcuts"
                    >
                      <Zap size={15} color="var(--accent)" />
                      <span className="hide-sm">Quick Actions</span>
                    </button>
                    {quickMenuOpen && (
                      <div className="topbar-dropdown quick-dropdown">
                        <div className="dropdown-head">
                          <span>Quick Actions</span>
                        </div>
                        <div className="dropdown-body">
                          <button
                            type="button"
                            className="dropdown-action-item"
                            onClick={() => {
                              setQuickMenuOpen(false);
                              navigateTo("pos");
                            }}
                          >
                            <ShoppingCart size={15} /> Open POS Terminal
                          </button>
                          {currentUser.role === "admin" && (
                            <>
                              <button
                                type="button"
                                className="dropdown-action-item"
                                onClick={() => {
                                  setQuickMenuOpen(false);
                                  navigateToAdminReport("products", { openModal: "add-product" });
                                }}
                              >
                                <Package size={15} /> Add New Product
                              </button>
                              <button
                                type="button"
                                className="dropdown-action-item"
                                onClick={() => {
                                  setQuickMenuOpen(false);
                                  navigateToAdminReport("expenses", { openModal: "add-expense" });
                                }}
                              >
                                <ReceiptIcon size={15} /> Record Store Expense
                              </button>
                              <button
                                type="button"
                                className="dropdown-action-item"
                                onClick={() => {
                                  setQuickMenuOpen(false);
                                  navigateToAdminReport("salaries", { openModal: "add-salary" });
                                }}
                              >
                                <Wallet size={15} /> Record Staff Salary
                              </button>
                              <button
                                type="button"
                                className="dropdown-action-item"
                                onClick={() => {
                                  setQuickMenuOpen(false);
                                  navigateToAdminReport("ld-commissions", { openModal: "add-ld" });
                                }}
                              >
                                <Smartphone size={15} /> Log LD Commission
                              </button>
                              <button
                                type="button"
                                className="dropdown-action-item"
                                onClick={() => {
                                  setQuickMenuOpen(false);
                                  navigateToAdminReport("audit", {});
                                }}
                              >
                                <ShieldCheck size={15} /> View Audit Trail
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="dropdown-action-item"
                            onClick={() => {
                              setQuickMenuOpen(false);
                              if (shiftStatus?.is_open) {
                                loadShiftStatus();
                                setEodForm({ closingCash: "", notes: "" });
                                setShowEodModal(true);
                              } else {
                                setSodForm({ businessDate: ymd(), openingCash: "0", notes: "" });
                                setShowSodModal(true);
                              }
                            }}
                          >
                            {shiftStatus?.is_open ? <Sunset size={15} /> : <Sunrise size={15} />}
                            {shiftStatus?.is_open ? "Execute End of Day (EOD)" : "Start Business Day (SOD)"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notifications & Important Alerts Bell */}
                  <div className="topbar-popover-wrap" ref={notifRef}>
                    <button
                      type="button"
                      className="icon-btn notif-btn"
                      onClick={() => {
                        setNotifOpen((o) => !o);
                        refreshAlerts();
                      }}
                      title="System Alerts & Notifications"
                      aria-label="Notifications"
                    >
                      <Bell size={17} />
                      {visibleAlerts.length > 0 && (
                        <span className="notif-badge">{visibleAlerts.length}</span>
                      )}
                    </button>

                    {notifOpen && (
                      <div className="topbar-dropdown notif-dropdown">
                        <div className="dropdown-head">
                          <span>Important Alerts ({visibleAlerts.length})</span>
                          {dismissedAlertIds.length > 0 && (
                            <button
                              type="button"
                              className="link-btn"
                              onClick={clearDismissedAlerts}
                              title="Restore dismissed alerts"
                            >
                              Restore all
                            </button>
                          )}
                        </div>
                        <div className="dropdown-body">
                          {visibleAlerts.length === 0 ? (
                            <div className="dropdown-empty">
                              <CheckCheck size={24} color="var(--ok)" style={{ margin: "0 auto 6px" }} />
                              <div>All clear! No critical stock, shift, or financial alerts.</div>
                            </div>
                          ) : (
                            visibleAlerts.map((a) => (
                              <div key={a.id} className={`notif-item severity-${a.severity || "info"}`}>
                                <div
                                  className="notif-main"
                                  onClick={() => handleAlertClick(a)}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="notif-title-row">
                                    {a.severity === "bad" ? (
                                      <AlertCircle size={15} color="var(--bad)" />
                                    ) : a.severity === "warn" ? (
                                      <AlertTriangle size={15} color="var(--warn)" />
                                    ) : (
                                      <Info size={15} color="var(--info)" />
                                    )}
                                    <b>{a.title}</b>
                                  </div>
                                  <p>{a.message}</p>
                                  <span className="notif-cta">
                                    Inspect in Report <ExternalLink size={11} />
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="icon-btn sm"
                                  title="Dismiss alert"
                                  onClick={() => dismissAlert(a.id)}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Theme Toggle */}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={toggleTheme}
                    title="Toggle Light / Dark theme"
                    aria-label="Toggle theme"
                  >
                    {(settings.theme || localStorage.getItem("joyce-theme") || "dark") === "dark" ? (
                      <Sun size={17} />
                    ) : (
                      <Moon size={17} />
                    )}
                  </button>

                  {/* User Account Menu */}
                  <div className="topbar-popover-wrap" ref={userRef}>
                    <button
                      type="button"
                      className="topbar-user-btn"
                      onClick={() => setUserMenuOpen((o) => !o)}
                      title="Account & Session Menu"
                    >
                      <span className="topbar-avatar">{currentUser.role === "admin" ? "🛡️" : "👤"}</span>
                      <span className="hide-sm topbar-username">{currentUser.name || "User"}</span>
                      <span className={`badge ${currentUser.role === "admin" ? "tone-ok" : "tone-info"} hide-sm`}>
                        {currentUser.role}
                      </span>
                    </button>
                    {userMenuOpen && (
                      <div className="topbar-dropdown user-dropdown">
                        <div className="dropdown-head">
                          <div>
                            <b>{currentUser.name || "User"}</b>
                            <div className="muted" style={{ fontSize: 11 }}>
                              Role: {currentUser.role.toUpperCase()} • {activeBranchName}
                            </div>
                          </div>
                        </div>
                        <div className="dropdown-body">
                          {currentUser.role === "admin" && !disabledMenus.includes("admin-dashboard") && (
                            <button
                              type="button"
                              className="dropdown-action-item"
                              onClick={() => {
                                setUserMenuOpen(false);
                                navigateTo("admin-dashboard");
                              }}
                            >
                              <ShieldCheck size={15} /> Admin Analytics & Reports
                            </button>
                          )}
                          <button
                            type="button"
                            className="dropdown-action-item"
                            onClick={() => {
                              setUserMenuOpen(false);
                              navigateTo("settings");
                            }}
                          >
                            <Cog size={15} /> System & Branch Settings
                          </button>
                          <button
                            type="button"
                            className="dropdown-action-item danger-text"
                            onClick={handleLogout}
                          >
                            <LogOut size={15} /> Lock Screen / Switch User
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </header>

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
                        onClick={() => setTab(currentUser.role === "admin" && !disabledMenus.includes("admin-dashboard") ? "admin-dashboard" : "dashboard")}
                      >
                        View Reports Dashboard
                      </button>
                    </div>
                  </div>
                ) : Page ? (
                  <PageErrorBoundary key={`${tab}-${branchKey}`}>
                    <Page />
                  </PageErrorBoundary>
                ) : (
                  <div className="empty">No access to this section.</div>
                )}
              </main>
            </div>

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

              const showExpenses = !disabledMenus.includes("expenses");
              const showSalary = !disabledMenus.includes("salary") && !disabledMenus.includes("salaries");
              const showCommission = !disabledMenus.includes("commission") && !disabledMenus.includes("commissions");
              const showLdCommission = !disabledMenus.includes("ld-commission") && !disabledMenus.includes("ld_commission");

              const activeExpenses = showExpenses ? Number(shift.expenses || 0) : 0;
              const activeSalaries = showSalary ? Number(shift.salaries || 0) : 0;
              const activeCommissions = showCommission ? Number(shift.commissions || 0) : 0;
              const activeLdCommissions = showLdCommission ? Number(shift.ld_commissions || 0) : 0;

              const totalOutflows = activeExpenses + activeSalaries + activeCommissions + activeLdCommissions;
              const expected = openCash + cashSales - totalOutflows;
              const actual = eodForm.closingCash !== "" ? Number(eodForm.closingCash) : null;
              const variance = actual !== null ? actual - expected : null;
              const grossSales = Number(shift.gross_sales || cashSales);
              const netProfit = grossSales - activeExpenses - activeSalaries - activeCommissions - activeLdCommissions;
              const soldItems = Array.isArray(shift.sold_items) ? shift.sold_items : [];

              return (
                <Modal
                  title={`End of Day (EOD) — Shift #${shift.id} (${shift.business_date})`}
                  onClose={() => setShowEodModal(false)}
                >
                  {/* Top Switcher & Action Toolbar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div className="segmented-control" style={{ margin: 0 }}>
                      <button
                        type="button"
                        className={eodViewMode === "reconciliation" ? "active" : ""}
                        onClick={() => setEodViewMode("reconciliation")}
                      >
                        📋 Shift Reconciliation
                      </button>
                      <button
                        type="button"
                        className={eodViewMode === "receipt" ? "active" : ""}
                        onClick={() => setEodViewMode("receipt")}
                      >
                        🧾 Thermal Z-Reading Receipt
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn sm ghost"
                        onClick={() => handlePrintZReadingThermal(shift)}
                        disabled={printingZReading}
                        title="Send receipt directly to USB/thermal printer via ESC/POS"
                      >
                        <Printer size={14} /> {printingZReading ? "Printing…" : "Thermal Printer"}
                      </button>
                      <button
                        type="button"
                        className="btn sm ghost"
                        onClick={() => window.print()}
                        title="Print via standard system printer dialog"
                      >
                        Browser Print
                      </button>
                    </div>
                  </div>

                  {/* VIEW 1: Thermal Receipt Paper Preview */}
                  {eodViewMode === "receipt" ? (
                    <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "4px 0" }}>
                      <div id="printable-thermal-z-reading" className="thermal-receipt-preview">
                        <div className="thermal-receipt-header">
                          <h3>{settings?.store_name || "JOYCE POS"}</h3>
                          {settings?.store_address && <div>{settings.store_address}</div>}
                          {settings?.store_phone && <div>Tel: {settings.store_phone}</div>}
                          <div style={{ marginTop: 4, fontWeight: "bold" }}>*** END OF DAY / Z-READING ***</div>
                        </div>

                        <div className="thermal-receipt-dline" />
                        <div className="thermal-receipt-row"><span>Shift ID :</span><b>#{shift.id}</b></div>
                        <div className="thermal-receipt-row"><span>Date     :</span><b>{shift.business_date}</b></div>
                        <div className="thermal-receipt-row"><span>Opened At:</span><span>{shift.opened_at}</span></div>
                        <div className="thermal-receipt-row"><span>Opened By:</span><span>{shift.opened_by}</span></div>
                        <div className="thermal-receipt-row"><span>Closed By:</span><span>{currentUser?.name || "Cashier"}</span></div>
                        <div className="thermal-receipt-dline" />

                        {/* Products Breakdown: Products x Quantity = Amount */}
                        <div style={{ fontWeight: "bold", margin: "6px 0 4px 0" }}>PRODUCTS SOLD (QTY x AMOUNT):</div>
                        <div className="thermal-receipt-sline" />
                        {soldItems.length === 0 ? (
                          <div className="muted" style={{ fontStyle: "italic", textAlign: "center", padding: "6px 0" }}>
                            No products sold during this shift.
                          </div>
                        ) : (
                          soldItems.map((item, idx) => {
                            const label = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
                            return (
                              <div key={idx} className="thermal-receipt-row">
                                <span style={{ maxWidth: "68%", wordBreak: "break-word" }}>
                                  {label} x {item.quantity}
                                </span>
                                <b>{peso(Number(item.amount || 0))}</b>
                              </div>
                            );
                          })
                        )}
                        <div className="thermal-receipt-dline" />

                        {/* P&L Operating Net Formula: Gross - Expenses - Salaries - LD - Comm = Net */}
                        <div className="thermal-receipt-row bold" style={{ fontSize: "14px" }}>
                          <span>TOTAL GROSS SALES</span>
                          <span>{peso(grossSales)}</span>
                        </div>

                        {showExpenses && (
                          <div className="thermal-receipt-row">
                            <span>- Store Expenses</span>
                            <span>-{peso(activeExpenses)}</span>
                          </div>
                        )}
                        {showSalary && (
                          <div className="thermal-receipt-row">
                            <span>- Salaries Paid</span>
                            <span>-{peso(activeSalaries)}</span>
                          </div>
                        )}
                        {showLdCommission && (
                          <div className="thermal-receipt-row">
                            <span>- LD Comm Paid</span>
                            <span>-{peso(activeLdCommissions)}</span>
                          </div>
                        )}
                        {showCommission && (
                          <div className="thermal-receipt-row">
                            <span>- Commissions Paid</span>
                            <span>-{peso(activeCommissions)}</span>
                          </div>
                        )}

                        <div className="thermal-receipt-sline" />
                        <div className="thermal-receipt-row bold" style={{ fontSize: "14px" }}>
                          <span>= NET OPERATING PROFIT</span>
                          <span style={{ color: netProfit >= 0 ? "#008000" : "#d00000" }}>{peso(netProfit)}</span>
                        </div>
                        <div className="thermal-receipt-dline" />

                        {/* Drawer Cash Reconciliation */}
                        <div className="thermal-receipt-row"><span>Opening Float</span><span>{peso(openCash)}</span></div>
                        <div className="thermal-receipt-row"><span>+ Cash Sales</span><span>+{peso(cashSales)}</span></div>
                        <div className="thermal-receipt-row"><span>- Total Outflows</span><span>-{peso(totalOutflows)}</span></div>
                        <div className="thermal-receipt-sline" />
                        <div className="thermal-receipt-row bold"><span>Expected in Drawer</span><span>{peso(expected)}</span></div>
                        <div className="thermal-receipt-row bold">
                          <span>Actual Cash Counted</span>
                          <span>{actual !== null ? peso(actual) : "Pending count"}</span>
                        </div>
                        {actual !== null && (
                          <div className="thermal-receipt-row bold">
                            <span>Variance</span>
                            <span>
                              {Math.abs(variance) < 0.01
                                ? "0.00 (Balanced)"
                                : variance > 0
                                ? `+${peso(variance)} (Overage)`
                                : `${peso(variance)} (Shortage)`}
                            </span>
                          </div>
                        )}

                        {eodForm.notes && (
                          <>
                            <div className="thermal-receipt-sline" />
                            <div style={{ fontSize: 11, wordBreak: "break-word" }}>
                              <b>Notes:</b> {eodForm.notes}
                            </div>
                          </>
                        )}

                        <div className="thermal-signatures">
                          <div className="thermal-sig-block">
                            <div className="thermal-sig-line" />
                            <span>Cashier Signature</span>
                          </div>
                          <div className="thermal-sig-block">
                            <div className="thermal-sig-line" />
                            <span>Manager Signature</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => handlePrintZReadingThermal(shift)}
                          disabled={printingZReading}
                          style={{ flex: 1 }}
                        >
                          <Printer size={16} /> {printingZReading ? "Printing…" : "Print to Thermal Printer"}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setEodViewMode("reconciliation")}
                        >
                          ← Shift Reconciliation
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* VIEW 2: Shift Reconciliation & Drawer Count */
                    <div>
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
                            <b>{activeBranchName}</b>
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
                          {showExpenses && (
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                              <span>- Store Expenses Paid</span>
                              <b style={{ color: "var(--bad)" }}>-{peso(activeExpenses)}</b>
                            </div>
                          )}
                          {showSalary && activeSalaries > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                              <span>- Salaries Paid</span>
                              <b style={{ color: "var(--bad)" }}>-{peso(activeSalaries)}</b>
                            </div>
                          )}
                          {showCommission && activeCommissions > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                              <span>- Commissions Paid</span>
                              <b style={{ color: "var(--bad)" }}>-{peso(activeCommissions)}</b>
                            </div>
                          )}
                          {showLdCommission && activeLdCommissions > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                              <span>- LD Commissions Paid</span>
                              <b style={{ color: "var(--bad)" }}>-{peso(activeLdCommissions)}</b>
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

                        <div
                          style={{
                            background: "rgba(56, 189, 248, 0.08)",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            borderRadius: 10,
                            padding: "10px 12px",
                            fontSize: 12,
                            marginTop: 10,
                            lineHeight: 1.5,
                          }}
                        >
                          <b>☁️ Safe End-of-Day Backup:</b> Closing the day will automatically save a clean, corruption-free snapshot (<code>VACUUM INTO</code>) to{" "}
                          <b>{branchInfo?.storage_dir ? "your Google Drive EOD_Backups folder" : "your local EOD_Backups folder"}</b>.
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => setEodViewMode("receipt")}
                            title="Preview Thermal Z-Reading format"
                          >
                            <ReceiptIcon size={16} /> Preview Z-Reading
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => handlePrintZReadingThermal(shift)}
                            disabled={printingZReading}
                            title="Print thermal Z-Reading receipt via ESC/POS"
                          >
                            <Printer size={16} /> {printingZReading ? "Printing…" : "Print Thermal"}
                          </button>
                          <button
                            type="submit"
                            className="btn danger"
                            disabled={submittingShift || eodForm.closingCash === ""}
                            style={{ flex: 1, minWidth: 200 }}
                          >
                            <Sunset size={16} /> {submittingShift ? "Closing & Backing Up…" : "Confirm End of Day & Save EOD Backup"}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </Modal>
              );
            })()}
          </div>
        )}
      </SettingsCtx.Provider>
    </ToastProvider>
  );
}
