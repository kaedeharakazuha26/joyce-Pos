import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LayoutDashboard, ShoppingCart, History, Package, Boxes, Receipt as ReceiptIcon, Wallet, Users, Coins, Smartphone, Settings as Cog, LogOut } from "lucide-react";
import { ToastProvider } from "./components/ui";
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

const SettingsCtx = createContext({ settings: {}, save: async () => { }, currentUser: null });
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

  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem("joyce-theme", t);
  };

  useEffect(() => {
    applyTheme(localStorage.getItem("joyce-theme") || "dark");
    api.getSettings().then((s) => { setSettings(s); if (s.theme) applyTheme(s.theme); }).catch(() => { });
  }, []);

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

  const allowedNav = NAV.filter((item) => {
    if (!currentUser) return false;
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
      <SettingsCtx.Provider value={{ settings, save, currentUser }}>
        {!currentUser ? (
          <PinLock onUnlock={handleUnlock} />
        ) : (
          <div className="app">
            <aside className="sidebar">
              <div className="brand">
                <img src="/logo.png" alt="JOYCE POS logo" />
                <div><b>JOYCE POS</b><small></small></div>
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
            <main className={"main" + (tab === "pos" ? " pos-main" : "")} key={tab}>
              {Page ? <Page /> : <div className="empty">No access to this section.</div>}
            </main>
          </div>
        )}
      </SettingsCtx.Provider>
    </ToastProvider>
  );
}
