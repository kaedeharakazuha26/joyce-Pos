import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LayoutDashboard, ShoppingCart, History, Package, Boxes, Receipt as ReceiptIcon, Wallet, Users, Coins, Smartphone, Settings as Cog } from "lucide-react";
import { ToastProvider } from "./components/ui";
import { api } from "./api";
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

const SettingsCtx = createContext({ settings: {}, save: async () => { } });
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

  const Page = NAV.find((n) => n.id === tab).page;

  return (
    <ToastProvider>
      <SettingsCtx.Provider value={{ settings, save }}>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <img src="/logo.png" alt="JOYCE POS logo" />
              <div><b>JOYCE POS</b><small></small></div>
            </div>
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} id={`nav-${id}`} className={"nav-btn" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
                <Icon size={19} /> {label}
              </button>
            ))}
          </aside>
          <main className={"main" + (tab === "pos" ? " pos-main" : "")} key={tab}>
            <Page />
          </main>
        </div>
      </SettingsCtx.Provider>
    </ToastProvider>
  );
}
