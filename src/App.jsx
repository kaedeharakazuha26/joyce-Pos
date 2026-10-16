import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LayoutDashboard, ShoppingCart, History, Package, Boxes, Receipt as ReceiptIcon, Wallet, Users, Coins, Smartphone, Settings as Cog, LogOut, Store, Plus } from "lucide-react";
import { ToastProvider, Modal, Field } from "./components/ui";
import { api } from "./api";
import PinLock from "./components/PinLock";
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

const SettingsCtx = createContext({
  settings: {},
  save: async () => { },
  currentUser: null,
  branchInfo: null,
  refreshBranchInfo: async () => { },
  handleSwitchBranch: async () => { },
});
export const useSettings = () => useContext(SettingsCtx);

const NAV = [
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

  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem("joyce-theme", t);
  };

  useEffect(() => {
    applyTheme(localStorage.getItem("joyce-theme") || "dark");
    api.getSettings().then((s) => { setSettings(s); if (s.theme) applyTheme(s.theme); }).catch(() => { });
  }, []);

  const loadBranchInfo = useCallback(async () => {
    try {
      const info = await api.getBranchInfo();
      setBranchInfo(info);
    } catch (e) {
      console.error("Failed to load branch info", e);
    }
  }, []);

  useEffect(() => {
    loadBranchInfo();
  }, [loadBranchInfo]);

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
    } catch (e) {
      alert("Failed to create branch: " + e);
    } finally {
      setCreatingBranch(false);
    }
  };

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
        }}
      >
        {!currentUser ? (
          <PinLock onUnlock={handleUnlock} />
        ) : (
          <div className="app">
            <aside className="sidebar">
              <div className="brand">
                <img src="/logo.png" alt="JOYCE POS logo" />
                <div><b>JOYCE POS</b><small></small></div>
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

              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflowY: "auto" }}>
                {allowedNav.map(({ id, label, icon: Icon }) => (
                  <button key={id} id={`nav-${id}`} className={"nav-btn" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
                    <Icon size={19} /> {label}
                  </button>
                ))}
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
            <main className={"main" + (tab === "pos" ? " pos-main" : "")} key={`${tab}-${branchKey}`}>
              {Page ? <Page /> : <div className="empty">No access to this section.</div>}
            </main>

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
          </div>
        )}
      </SettingsCtx.Provider>
    </ToastProvider>
  );
}
