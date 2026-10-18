import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Wallet,
  PiggyBank,
  Ban,
  Boxes,
  Store,
  Zap,
  Coins,
  Smartphone,
  FileDown,
  Printer,
  Table as TableIcon,
  BarChart3,
  LineChart,
  Calendar,
  ClipboardList,
  Search,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../api";
import { PageHeader, RangeBar, Empty, Modal, useToast } from "../components/ui";
import { useSettings } from "../App";
import { daysAgo, errText, peso, ymd } from "../utils";
import DashboardCrudModule from "../components/DashboardCrudModule";
import { InteractiveTrendChart } from "../components/admin/AdminCharts";

const Stat = ({ label, value, sub, color, icon: Icon }) => (
  <div className="card stat" style={{ "--c": color }}>
    <div className="stat-top">
      <div className="label">{label}</div>
      {Icon && (
        <div className="stat-icon">
          <Icon size={18} />
        </div>
      )}
    </div>
    <div className="value">{value}</div>
    <div className="sub">{sub}</div>
  </div>
);

export default function Dashboard() {
  const { settings, branchInfo, activeBusinessDate, shiftStatus, currentUser } = useSettings();
  const [from, setFrom] = useState(() => daysAgo(6, activeBusinessDate));
  const [to, setTo] = useState(() => activeBusinessDate || ymd());
  const [d, setD] = useState(null);
  const [trendView, setTrendView] = useState("line"); // "line" | "bar" | "table"
  const [seriesEnabled, setSeriesEnabled] = useState({
    sales: true,
    expenses: true,
    salaries: true,
    commissions: true,
    ld_commissions: true,
    net: true,
  });
  const [showPdfModal, setShowPdfModal] = useState(false);
  const toast = useToast();

  const toggleSeries = (key) => {
    setSeriesEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (activeBusinessDate && to !== activeBusinessDate && to === ymd()) {
      setTo(activeBusinessDate);
      setFrom(daysAgo(6, activeBusinessDate));
    }
  }, [activeBusinessDate]);

  const load = useCallback(() => {
    api.dashboard(from, to)
      .then(setD)
      .catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  useEffect(load, [load]);

  // Parse disabled menus for this branch to exclude them from reporting
  const disabledMenus = settings?.disabled_menus
    ? (() => {
        try {
          return JSON.parse(settings.disabled_menus);
        } catch {
          return [];
        }
      })()
    : [];

  const showExpenses = !disabledMenus.includes("expenses");
  const showSalary = !disabledMenus.includes("salary");
  const showCommission = !disabledMenus.includes("commission");
  const showLdCommission = !disabledMenus.includes("ld-commission");
  const showPayroll = showSalary || showCommission || showLdCommission;
  const showInventory = !disabledMenus.includes("inventory");

  // Normalized chart data with all report lines for the multi-line chart (always called unconditionally)
  const chartDailyData = useMemo(() => {
    return (d?.daily || []).map((x) => {
      const s = Number(x.total ?? x.sales ?? x.revenue ?? 0);
      const exp = showExpenses ? Number(x.expenses || 0) : 0;
      const sal = showSalary ? Number(x.salaries || 0) : 0;
      const com = showCommission ? Number(x.commissions || 0) : 0;
      const ld = showLdCommission ? Number(x.ld_commissions || 0) : 0;
      const ovh = exp + sal + com + ld;
      const net = s - ovh;
      return {
        ...x,
        key: x.day,
        label: x.day ? x.day.slice(5) : "",
        day: x.day,
        revenue: s,
        sales: s,
        total: s,
        expenses: exp,
        salaries: sal,
        commissions: com,
        ld_commissions: ld,
        overheads: ovh,
        net: net,
        net_profit: net,
      };
    });
  }, [d?.daily, showExpenses, showSalary, showCommission, showLdCommission]);

  const seriesConfig = useMemo(
    () => [
      { key: "sales", label: "Sales Revenue", color: "var(--accent, #ff7a3d)", enabled: seriesEnabled.sales },
      ...(showExpenses ? [{ key: "expenses", label: "Store Expenses", color: "#f97316", enabled: seriesEnabled.expenses }] : []),
      ...(showSalary ? [{ key: "salaries", label: "Salaries", color: "#38bdf8", enabled: seriesEnabled.salaries }] : []),
      ...(showCommission ? [{ key: "commissions", label: "Commissions", color: "#a855f7", enabled: seriesEnabled.commissions }] : []),
      ...(showLdCommission ? [{ key: "ld_commissions", label: "LD Commissions", color: "#06b6d4", enabled: seriesEnabled.ld_commissions }] : []),
      { key: "net", label: "Net Profit", color: "#2fcf8a", enabled: seriesEnabled.net },
    ],
    [seriesEnabled, showExpenses, showSalary, showCommission, showLdCommission]
  );

  // ── Inventory Stock & Sales Report State & Memos ──
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("all");
  const [inventorySortKey, setInventorySortKey] = useState("units_sold");
  const [inventorySortDir, setInventorySortDir] = useState("desc");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [expandedVariants, setExpandedVariants] = useState({});

  const toggleVariantExpand = useCallback((id) => {
    setExpandedVariants((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleInventorySort = useCallback((key) => {
    setInventorySortKey((prevKey) => {
      if (prevKey === key) {
        setInventorySortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return key;
      }
      setInventorySortDir("desc");
      return key;
    });
  }, []);

  const enrichedInventory = useMemo(() => {
    const rawList = d?.inventory_report || [];
    const variantSalesMap = new Map();
    (d?.variant_sales || []).forEach((vs) => {
      const pid = vs.product_id;
      if (!variantSalesMap.has(pid)) variantSalesMap.set(pid, []);
      variantSalesMap.get(pid).push(vs);
    });

    return rawList.map((item) => {
      const vs = variantSalesMap.get(item.id) || [];
      return {
        ...item,
        variant_sales: vs,
        has_variant_sales: vs.length > 0,
      };
    });
  }, [d?.inventory_report, d?.variant_sales]);

  const inventoryCategories = useMemo(() => {
    const set = new Set();
    (enrichedInventory || []).forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["all", ...Array.from(set).sort()];
  }, [enrichedInventory]);

  const filteredInventory = useMemo(() => {
    let list = enrichedInventory || [];
    if (inventoryCategory !== "all") {
      list = list.filter((p) => p.category === inventoryCategory);
    }
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.variant_sales || []).some((v) => (v.variant_name || "").toLowerCase().includes(q))
      );
    }
    const dir = inventorySortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = a[inventorySortKey] ?? 0;
      const vb = b[inventorySortKey] ?? 0;
      if (typeof va === "string") {
        return dir * va.localeCompare(String(vb));
      }
      return dir * (Number(va) - Number(vb));
    });
  }, [enrichedInventory, inventoryCategory, inventorySearch, inventorySortKey, inventorySortDir]);

  const inventoryPageSize = 10;
  const totalInventoryPages = Math.max(1, Math.ceil(filteredInventory.length / inventoryPageSize));
  const pagedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return filteredInventory.slice(start, start + inventoryPageSize);
  }, [filteredInventory, inventoryPage]);

  const inventoryTotalUnitsSold = useMemo(
    () => filteredInventory.reduce((acc, item) => acc + Number(item.units_sold || 0), 0),
    [filteredInventory]
  );
  const inventoryTotalAmountSold = useMemo(
    () => filteredInventory.reduce((acc, item) => acc + Number(item.total_sold_amount || 0), 0),
    [filteredInventory]
  );

  if (!d) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Loading metrics…">
          <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} businessDate={activeBusinessDate} />
        </PageHeader>
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted, #8e95a5)" }}>
          Loading dashboard metrics…
        </div>
      </>
    );
  }

  // Filtered calculations based on active modules
  const activeExpenses = showExpenses ? Number(d.expenses || 0) : 0;
  const activeSalary = showSalary ? Number(d.salaries || 0) : 0;
  const activeCommission = showCommission ? Number(d.commissions || 0) : 0;
  const activeLdCommission = showLdCommission ? Number(d.ld_commissions || 0) : 0;
  const totalActivePayout = activeSalary + activeCommission + activeLdCommission;
  const totalOverheads = activeExpenses + totalActivePayout;

  // Net Profit excludes disabled overheads
  const computedNetProfit = Number(d.gross_profit || 0) - totalOverheads;
  const profitMargin =
    d.revenue > 0 ? ((computedNetProfit / d.revenue) * 100).toFixed(1) : 0;
  const avgTicket = d.orders > 0 ? d.revenue / d.orders : 0;

  const activeBranch =
    branchInfo?.branches?.find((b) => b.id === branchInfo?.active_branch) || {
      name: "Main Store",
    };

  const dailyList = d.daily || [];

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Sales, payroll & performance reporting">
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} businessDate={activeBusinessDate} />
      </PageHeader>

      {/* Overnight Shift Midnight-Persistence Alert Banner */}
      {shiftStatus?.is_open && activeBusinessDate && activeBusinessDate !== ymd() && (
        <div
          style={{
            background: "linear-gradient(90deg, rgba(124, 92, 255, 0.15), rgba(77, 166, 255, 0.15))",
            border: "1px solid rgba(124, 92, 255, 0.4)",
            borderRadius: "10px",
            padding: "10px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "0.9rem",
            color: "#d0d4ff",
          }}
        >
          <span style={{ fontSize: "1.3rem" }}>🌙</span>
          <div>
            <b>Overnight Shift Active (Midnight Persisted):</b>
            <div style={{ fontSize: "0.82rem", color: "rgba(208, 212, 255, 0.8)" }}>
              All sales, revenue, expenses, and transactions remain attributed to Business Shift Date <b>{activeBusinessDate}</b> (even past midnight) until official End of Day close.
            </div>
          </div>
        </div>
      )}

      {/* Quick summary status chips */}
      <div className="dash-chips">
        <span className="dash-chip" style={{ borderColor: "rgba(255, 122, 61, 0.4)" }}>
          <Store size={14} color="#ff7a3d" />
          <span>Branch: <b>{activeBranch.name}</b></span>
        </span>
        <span className="dash-chip" style={{ borderColor: "rgba(47, 207, 138, 0.4)" }}>
          <Zap size={14} color="#2fcf8a" />
          <span><b>100% Offline-Ready</b> (Local SQLite)</span>
        </span>
        <span
          className="dash-chip"
          style={{
            borderColor: computedNetProfit >= 0 ? "rgba(47, 207, 138, 0.4)" : "rgba(255, 84, 112, 0.4)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: computedNetProfit >= 0 ? "var(--ok)" : "var(--bad)",
            }}
          />
          <span>Net Margin: <b>{profitMargin}%</b></span>
        </span>
        <span className="dash-chip">
          <span>Avg ticket: <b>{peso(avgTicket)}</b></span>
        </span>
      </div>

      {/* ── Separate stat cards for Revenue, Gross, Net, Expenses, Salary, Commissions ── */}
      <section className="stats">
        <Stat
          label="Sales revenue"
          value={peso(d.revenue)}
          sub={`${d.orders} completed sales`}
          color="#ff7a3d"
          icon={ShoppingCart}
        />
        <Stat
          label="Gross profit"
          value={peso(d.gross_profit)}
          sub={`Cost of goods: ${peso(d.cogs)}`}
          color="#2fcf8a"
          icon={TrendingUp}
        />
        <Stat
          label="Net profit"
          value={peso(computedNetProfit)}
          sub={
            showExpenses || showPayroll
              ? "Gross − active overheads"
              : "Gross profit (no overheads active)"
          }
          color="#ec3f8e"
          icon={PiggyBank}
        />

        {showExpenses && (
          <Stat
            label="Expenses"
            value={peso(activeExpenses)}
            sub="Operating expenditures"
            color="#f97316"
            icon={Receipt}
          />
        )}

        {showSalary && (
          <Stat
            label="Salary wages"
            value={peso(activeSalary)}
            sub="Employee fixed payroll"
            color="#38bdf8"
            icon={Wallet}
          />
        )}

        {showCommission && (
          <Stat
            label="Commission"
            value={peso(activeCommission)}
            sub="Standard sales commissions"
            color="#a855f7"
            icon={Coins}
          />
        )}

        {showLdCommission && (
          <Stat
            label="LD Commission"
            value={peso(activeLdCommission)}
            sub="Load distribution payouts"
            color="#06b6d4"
            icon={Smartphone}
          />
        )}

        <Stat
          label="Voided sales"
          value={peso(d.voided_total)}
          sub={`${d.voided_count} voided`}
          color="#ff5470"
          icon={Ban}
        />

        {showInventory && (
          <Stat
            label="Stock asset value"
            value={peso(d.inventory_cost)}
            sub={`Retail: ${peso(d.inventory_retail)}`}
            color="#5b8def"
            icon={Boxes}
          />
        )}
      </section>

      {/* ── Comprehensive Profit & Loss (P&L) Statement ── */}
      <section className="card pnl-statement-box" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={20} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Comprehensive Profit & Loss (P&L) Statement</h3>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Shift-grounded executive financial statement for <b>{activeBranch.name}</b> ({from} → {to})
            </p>
          </div>
          <span className={`badge ${computedNetProfit >= 0 ? "tone-ok" : "tone-bad"}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px" }}>
            {computedNetProfit >= 0 ? "PROFITABLE" : "OPERATING LOSS"}: {peso(computedNetProfit)} ({profitMargin}% margin)
          </span>
        </div>

        <div className="pnl-table">
          <div className="pnl-row">
            <span>Gross Sales Revenue ({d.orders || 0} completed orders)</span>
            <b className="text-ok">{peso(d.revenue)}</b>
          </div>
          <div className="pnl-row sub">
            <span>Less: Cost of Goods Sold (COGS)</span>
            <b className="text-bad">−{peso(d.cogs || 0)}</b>
          </div>
          <div className="pnl-row highlight">
            <b>Gross Operating Profit ({d.revenue > 0 ? (((d.gross_profit || 0) / d.revenue) * 100).toFixed(1) : 0}% margin)</b>
            <b className="text-info">{peso(d.gross_profit || 0)}</b>
          </div>

          <div className="pnl-section-label">Operating Overheads & Payroll</div>
          {showExpenses && (
            <div className="pnl-row">
              <span>Store Operating Expenses</span>
              <b className="text-bad">−{peso(activeExpenses)}</b>
            </div>
          )}
          {showSalary && (
            <div className="pnl-row">
              <span>Employee Salaries Payroll</span>
              <b className="text-bad">−{peso(activeSalary)}</b>
            </div>
          )}
          {showCommission && (
            <div className="pnl-row">
              <span>Regular Employee Commissions</span>
              <b className="text-bad">−{peso(activeCommission)}</b>
            </div>
          )}
          {showLdCommission && (
            <div className="pnl-row">
              <span>Ladies Drink (LD) Commissions</span>
              <b className="text-bad">−{peso(activeLdCommission)}</b>
            </div>
          )}
          <div className="pnl-row sub">
            <b>Total Operating Overheads</b>
            <b className="text-bad">−{peso(totalOverheads)}</b>
          </div>

          <div className={`pnl-row total ${computedNetProfit >= 0 ? "positive" : "negative"}`}>
            <div>
              <b>Net Operating Income / Profit</b>
              <div style={{ fontSize: 11, fontWeight: 400 }} className="muted">
                Net Profit Margin: {profitMargin}% • Based on active shift business dates
              </div>
            </div>
            <b style={{ fontSize: 18 }}>{peso(computedNetProfit)}</b>
          </div>
        </div>
      </section>

      {/* ── Multi-Line Sales & Overheads Trend ── */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={20} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Sales & Overheads Trend</h3>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Multi-metric trend comparison showing all operational curves for <b>{from}</b> to <b>{to}</b>
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`chip ${trendView === "line" ? "active" : ""}`}
              onClick={() => setTrendView("line")}
              title="Multi-line chart of all report series"
            >
              <LineChart size={14} /> Multi-Line
            </button>
            <button
              type="button"
              className={`chip ${trendView === "bar" ? "active" : ""}`}
              onClick={() => setTrendView("bar")}
              title="Multi-metric grouped bars"
            >
              <BarChart3 size={14} /> Grouped Bars
            </button>
            <button
              type="button"
              className={`chip ${trendView === "table" ? "active" : ""}`}
              onClick={() => setTrendView("table")}
              title="Daily data table"
            >
              <TableIcon size={14} /> Daily Table
            </button>
          </div>
        </div>

        {dailyList.length === 0 ? (
          <Empty text="No activity recorded in this date range" />
        ) : trendView === "line" || trendView === "bar" ? (
          <div>
            <InteractiveTrendChart
              data={chartDailyData}
              mode={trendView}
              showComparison={false}
              seriesConfig={seriesConfig}
            />

            {/* Interactive series toggle controls */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 18,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
                fontSize: 12,
                alignItems: "center",
              }}
            >
              <span className="muted" style={{ fontWeight: 600, marginRight: 4 }}>
                Toggle Lines:
              </span>
              {seriesConfig.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`chip sm ${s.enabled ? "active" : ""}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    opacity: s.enabled ? 1 : 0.45,
                    border: s.enabled ? `1px solid ${s.color}` : "1px solid var(--border)",
                  }}
                  onClick={() => toggleSeries(s.key)}
                  title={`Toggle ${s.label} line`}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: s.color,
                      display: "inline-block",
                    }}
                  />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Orders</th>
                  <th className="num">Sales</th>
                  {showExpenses && <th className="num">Expenses</th>}
                  {showSalary && <th className="num">Salary</th>}
                  {showCommission && <th className="num">Commission</th>}
                  {showLdCommission && <th className="num">LD Comm</th>}
                  <th className="num">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {dailyList.map((x) => {
                  const daySales = Number(x.total ?? x.sales ?? x.revenue ?? 0);
                  const dayExp = showExpenses ? Number(x.expenses || 0) : 0;
                  const daySal = showSalary ? Number(x.salaries || 0) : 0;
                  const dayCom = showCommission ? Number(x.commissions || 0) : 0;
                  const dayLd = showLdCommission ? Number(x.ld_commissions || 0) : 0;
                  const dayNet = daySales - dayExp - daySal - dayCom - dayLd;

                  return (
                    <tr key={x.day} className="row-hover">
                      <td><b>{x.day}</b></td>
                      <td className="num">{x.orders ?? x.count ?? 0}</td>
                      <td className="num" style={{ fontWeight: 600, color: "var(--accent)" }}>
                        {peso(daySales)}
                      </td>
                      {showExpenses && <td className="num">{peso(dayExp)}</td>}
                      {showSalary && <td className="num">{peso(daySal)}</td>}
                      {showCommission && <td className="num">{peso(dayCom)}</td>}
                      {showLdCommission && <td className="num">{peso(dayLd)}</td>}
                      <td className="num">
                        <b style={{ color: dayNet >= 0 ? "var(--ok)" : "var(--bad)" }}>
                          {peso(dayNet)}
                        </b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td>Totals for Period</td>
                  <td className="num">{d.orders}</td>
                  <td className="num" style={{ color: "var(--accent)" }}>{peso(d.revenue)}</td>
                  {showExpenses && <td className="num">{peso(activeExpenses)}</td>}
                  {showSalary && <td className="num">{peso(activeSalary)}</td>}
                  {showCommission && <td className="num">{peso(activeCommission)}</td>}
                  {showLdCommission && <td className="num">{peso(activeLdCommission)}</td>}
                  <td className="num" style={{ color: computedNetProfit >= 0 ? "var(--ok)" : "var(--bad)", fontSize: 16 }}>
                    {peso(computedNetProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── Highest income per employee (Moved below Sales Trend + Export as PDF) ── */}
      {showPayroll && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Award size={20} color="#ffb020" />
                <h3 style={{ margin: 0 }}>Highest income per employee</h3>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Active payroll and earnings breakdown for <b>{activeBranch.name}</b> ({from} to {to})
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="badge"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                Total Paid: <b>{peso(totalActivePayout)}</b>
              </span>
              <button
                className="btn sm ghost"
                onClick={() => setShowPdfModal(true)}
                title="Export report as PDF for sharing"
              >
                <FileDown size={15} /> Export as PDF
              </button>
            </div>
          </div>

          {!d.top_employees || d.top_employees.length === 0 ? (
            <Empty text="No salary or commission records recorded in this period" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>Rank</th>
                  <th>Employee</th>
                  {showSalary && <th className="num">Salary</th>}
                  {showCommission && <th className="num">Commission</th>}
                  {showLdCommission && <th className="num">LD Commission</th>}
                  <th className="num">Total Income</th>
                </tr>
              </thead>
              <tbody>
                {d.top_employees.map((emp, i) => {
                  const empTotal =
                    (showSalary ? Number(emp.salary || 0) : 0) +
                    (showCommission ? Number(emp.commission || 0) : 0) +
                    (showLdCommission ? Number(emp.ld_commission || 0) : 0);
                  return (
                    <tr key={emp.employee_name} className="row-hover">
                      <td>
                        {i === 0 ? (
                          <span
                            className="badge"
                            style={{ background: "rgba(255,176,32,0.2)", color: "#ffb020" }}
                          >
                            🥇 1st
                          </span>
                        ) : i === 1 ? (
                          <span
                            className="badge"
                            style={{ background: "rgba(180,180,190,0.2)", color: "var(--muted)" }}
                          >
                            🥈 2nd
                          </span>
                        ) : i === 2 ? (
                          <span
                            className="badge"
                            style={{ background: "rgba(205,127,50,0.2)", color: "#cd7f32" }}
                          >
                            🥉 3rd
                          </span>
                        ) : (
                          `#${i + 1}`
                        )}
                      </td>
                      <td>
                        <b>{emp.employee_name}</b>
                      </td>
                      {showSalary && <td className="num">{peso(emp.salary)}</td>}
                      {showCommission && <td className="num">{peso(emp.commission)}</td>}
                      {showLdCommission && (
                        <td className="num">{peso(emp.ld_commission)}</td>
                      )}
                      <td className="num">
                        <b style={{ color: "var(--ok)", fontSize: 16 }}>{peso(empTotal)}</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ── Low Stock Alerts & Top Selling Products ── */}
      <section className="two-col" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Boxes size={18} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Low stock alerts</h3>
          </div>
          {d.low_stock.length === 0 ? (
            <Empty text="All stocked up 🎉" />
          ) : (
            d.low_stock.map((p) => (
              <div className="list-row" key={p.id}>
                <span>{p.name}</span>
                <span className={"badge " + (p.stock === 0 ? "bad" : "warn")}>
                  {p.stock === 0 ? "OUT OF STOCK" : `${p.stock} left`}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingCart size={18} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Top selling products</h3>
            </div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                document.getElementById("inventory-report-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              title="Jump to full Inventory Stock & Sales Report"
            >
              <ClipboardList size={14} /> Full Inventory Report
            </button>
          </div>
          {d.top.length === 0 ? (
            <Empty text="Nothing sold yet" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th className="num">Units sold</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {d.top.map((t, i) => (
                  <tr key={t.name + i} className="row-hover">
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            i === 0
                              ? "#ffb020"
                              : i === 1
                              ? "var(--muted)"
                              : i === 2
                              ? "#cd7f32"
                              : "inherit",
                        }}
                      >
                        {i === 0 ? "★ 1" : `#${i + 1}`}
                      </span>
                    </td>
                    <td>{t.name}</td>
                    <td className="num">{t.units}</td>
                    <td className="num" style={{ fontWeight: 600, color: "var(--ok)" }}>
                      {peso(t.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Inventory Stock & Sales Report ── */}
      <section id="inventory-report-section" className="card" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardList size={20} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Inventory Stock & Sales Report</h3>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Tracking units sold per item, total sales amount, and current stock status for <b>{from}</b> to <b>{to}</b>
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", minWidth: 200 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, opacity: 0.5 }} />
              <input
                type="text"
                placeholder="Search items…"
                style={{ paddingLeft: 30, height: 34, fontSize: 13 }}
                value={inventorySearch}
                onChange={(e) => {
                  setInventorySearch(e.target.value);
                  setInventoryPage(1);
                }}
              />
              {inventorySearch && (
                <button
                  type="button"
                  className="icon-btn sm"
                  style={{ position: "absolute", right: 4, top: 4 }}
                  onClick={() => {
                    setInventorySearch("");
                    setInventoryPage(1);
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            {inventoryCategories.length > 2 && (
              <select
                value={inventoryCategory}
                onChange={(e) => {
                  setInventoryCategory(e.target.value);
                  setInventoryPage(1);
                }}
                style={{ height: 34, fontSize: 13, padding: "0 10px" }}
              >
                {inventoryCategories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            )}

            {/* Print button */}
            <button
              type="button"
              className="btn sm ghost"
              onClick={handlePrintPdf}
              title="Print Inventory Stock & Sales Report"
            >
              <Printer size={14} /> Print Report
            </button>
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div
          className="table-summary-strip"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: "0.85rem",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <span>Active Products: <b>{filteredInventory.length}</b></span>
            <span>
              Total Units Sold:{" "}
              <b style={{ color: "var(--accent, #ff7a3d)" }}>
                {inventoryTotalUnitsSold.toLocaleString()}
              </b>
            </span>
            <span>
              Total Amount Sold:{" "}
              <b style={{ color: "var(--ok, #2fcf8a)" }}>
                {peso(inventoryTotalAmountSold)}
              </b>
            </span>
          </div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Attributed to Shift Date: <b>{from}</b> to <b>{to}</b>
          </div>
        </div>

        {filteredInventory.length === 0 ? (
          <Empty text="No inventory stock or sales records match your criteria." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th
                    onClick={() => toggleInventorySort("name")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Item / Product {inventorySortKey === "name" ? (inventorySortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    onClick={() => toggleInventorySort("category")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Category {inventorySortKey === "category" ? (inventorySortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    className="num"
                    onClick={() => toggleInventorySort("current_stock")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Stock {inventorySortKey === "current_stock" ? (inventorySortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th>Health</th>
                  <th
                    className="num"
                    onClick={() => toggleInventorySort("price")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Price {inventorySortKey === "price" ? (inventorySortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    className="num"
                    onClick={() => toggleInventorySort("units_sold")}
                    style={{
                      cursor: "pointer",
                      userSelect: "none",
                      background: "rgba(255, 122, 61, 0.08)",
                    }}
                  >
                    Units Sold (Qty) {inventorySortKey === "units_sold" ? (inventorySortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    className="num"
                    onClick={() => toggleInventorySort("total_sold_amount")}
                    style={{
                      cursor: "pointer",
                      userSelect: "none",
                      background: "rgba(47, 207, 138, 0.08)",
                    }}
                  >
                    Total Amount Sold {inventorySortKey === "total_sold_amount" ? (inventorySortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedInventory.map((item) => {
                  const isExpanded = !!expandedVariants[item.id];
                  const hasVariants = item.has_variant_sales;
                  const stock = Number(item.current_stock ?? 0);
                  const lowStock = Number(item.low_stock ?? 5);
                  const isOut = stock <= 0;
                  const isLow = stock > 0 && stock <= lowStock;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="row-hover">
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <b>{item.name}</b>
                            {hasVariants && (
                              <button
                                type="button"
                                className="icon-btn xs"
                                onClick={() => toggleVariantExpand(item.id)}
                                title={isExpanded ? "Collapse variants" : "View sold variants breakdown"}
                                style={{
                                  color: "var(--accent, #ff7a3d)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  background: "rgba(255, 122, 61, 0.12)",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                <span>{item.variant_sales.length} variant{item.variant_sales.length > 1 ? "s" : ""} sold</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge tone-neutral" style={{ fontSize: "0.78rem" }}>
                            {item.category || "General"}
                          </span>
                        </td>
                        <td className="num">
                          <b>{stock}</b>
                        </td>
                        <td>
                          <span className={`badge ${isOut ? "bad" : isLow ? "warn" : "ok"}`} style={{ fontSize: 11 }}>
                            {isOut ? "Out of Stock" : isLow ? "Low Stock" : "Healthy"}
                          </span>
                        </td>
                        <td className="num">{peso(item.price)}</td>
                        <td className="num" style={{ background: "rgba(255, 122, 61, 0.05)" }}>
                          <span
                            className="badge"
                            style={{
                              fontWeight: 700,
                              background: item.units_sold > 0 ? "rgba(255, 122, 61, 0.2)" : "transparent",
                              color: item.units_sold > 0 ? "#ff7a3d" : "var(--muted)",
                            }}
                          >
                            {Number(item.units_sold || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="num" style={{ background: "rgba(47, 207, 138, 0.05)" }}>
                          <b style={{ color: item.total_sold_amount > 0 ? "var(--ok)" : "var(--muted)" }}>
                            {peso(item.total_sold_amount || 0)}
                          </b>
                        </td>
                      </tr>

                      {/* Expandable Variant Breakdown Subrow */}
                      {isExpanded && hasVariants && (
                        <tr style={{ background: "rgba(255, 255, 255, 0.02)" }}>
                          <td colSpan={7} style={{ padding: "8px 16px 12px 32px" }}>
                            <div
                              style={{
                                background: "var(--bg-soft, #1e222d)",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                padding: "10px 14px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: 6,
                                }}
                              >
                                <b style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                                  Variant Sales for "{item.name}"
                                </b>
                                <span className="muted" style={{ fontSize: "0.78rem" }}>
                                  Period: {from} to {to}
                                </span>
                              </div>
                              <table style={{ width: "100%", fontSize: "0.82rem" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                                    <th style={{ textAlign: "left", padding: "4px 8px" }}>Variant</th>
                                    <th className="num" style={{ padding: "4px 8px" }}>Packs/Qty Sold</th>
                                    <th className="num" style={{ padding: "4px 8px" }}>Units Sold</th>
                                    <th className="num" style={{ padding: "4px 8px" }}>Total Amount Sold</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.variant_sales.map((vs, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                      <td style={{ padding: "6px 8px" }}>
                                        <b>{vs.variant_name}</b>
                                      </td>
                                      <td className="num" style={{ padding: "6px 8px" }}>
                                        {Number(vs.qty_sold || 0).toLocaleString()}
                                      </td>
                                      <td className="num" style={{ padding: "6px 8px" }}>
                                        <b style={{ color: "var(--accent, #ff7a3d)" }}>
                                          {Number(vs.units_sold || 0).toLocaleString()}
                                        </b>
                                      </td>
                                      <td className="num" style={{ padding: "6px 8px" }}>
                                        <b style={{ color: "var(--ok)" }}>
                                          {peso(vs.revenue || 0)}
                                        </b>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalInventoryPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
              fontSize: "0.85rem",
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
            }}
          >
            <span className="muted">
              Page {inventoryPage} of {totalInventoryPages} ({filteredInventory.length} items)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn sm ghost"
                disabled={inventoryPage <= 1}
                onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn sm ghost"
                disabled={inventoryPage >= totalInventoryPages}
                onClick={() => setInventoryPage((p) => Math.min(totalInventoryPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Operational Records CRUD Module (Sales, Expenses, Salary, Commissions) ── */}
      <DashboardCrudModule
        from={from}
        to={to}
        activeBusinessDate={activeBusinessDate}
        currentUser={currentUser}
        settings={settings}
        onDataChanged={load}
        inventoryReport={enrichedInventory}
        variantSales={d.variant_sales}
      />

      {/* ── PDF Export / Print Preview Modal for Highest Income Per Employee ── */}
      {showPdfModal && (
        <Modal title="Export Employee Income Report" onClose={() => setShowPdfModal(false)}>
          <div id="printable-employee-report" className="printable-report">
            <div className="report-header">
              <div className="report-title-row">
                <div>
                  <h2 style={{ margin: 0, color: "#111", fontSize: 22 }}>JOYCE POS</h2>
                  <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
                    Branch: <b>{activeBranch.name}</b>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
                  <div>Report: <b>Employee Income & Payroll</b></div>
                  <div>Period: <b>{from}</b> to <b>{to}</b></div>
                  <div>Generated: {ymd()}</div>
                </div>
              </div>
            </div>

            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ width: 45 }}>Rank</th>
                  <th>Employee Name</th>
                  {showSalary && <th style={{ textAlign: "right" }}>Salary</th>}
                  {showCommission && <th style={{ textAlign: "right" }}>Commission</th>}
                  {showLdCommission && <th style={{ textAlign: "right" }}>LD Commission</th>}
                  <th style={{ textAlign: "right" }}>Total Payout</th>
                </tr>
              </thead>
              <tbody>
                {d.top_employees?.map((emp, idx) => {
                  const empTotal =
                    (showSalary ? Number(emp.salary || 0) : 0) +
                    (showCommission ? Number(emp.commission || 0) : 0) +
                    (showLdCommission ? Number(emp.ld_commission || 0) : 0);
                  return (
                    <tr key={emp.employee_name}>
                      <td>#{idx + 1}</td>
                      <td><b>{emp.employee_name}</b></td>
                      {showSalary && <td style={{ textAlign: "right" }}>{peso(emp.salary)}</td>}
                      {showCommission && <td style={{ textAlign: "right" }}>{peso(emp.commission)}</td>}
                      {showLdCommission && <td style={{ textAlign: "right" }}>{peso(emp.ld_commission)}</td>}
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>{peso(empTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                  <td colSpan={2}>Grand Total Payout</td>
                  {showSalary && <td style={{ textAlign: "right" }}>{peso(activeSalary)}</td>}
                  {showCommission && <td style={{ textAlign: "right" }}>{peso(activeCommission)}</td>}
                  {showLdCommission && <td style={{ textAlign: "right" }}>{peso(activeLdCommission)}</td>}
                  <td style={{ textAlign: "right", fontSize: 15 }}>{peso(totalActivePayout)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="report-sign-off">
              <div>
                <div className="sign-line" />
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Prepared by / Cashier</div>
              </div>
              <div>
                <div className="sign-line" />
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Approved by / Store Manager</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button className="btn ghost" onClick={() => setShowPdfModal(false)}>
              Close
            </button>
            <button className="btn" onClick={handlePrintPdf}>
              <Printer size={16} /> Print / Save as PDF
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
