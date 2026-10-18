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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <ShoppingCart size={18} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Top selling products</h3>
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

      {/* ── Operational Records CRUD Module (Sales, Expenses, Salary, Commissions) ── */}
      <DashboardCrudModule
        from={from}
        to={to}
        activeBusinessDate={activeBusinessDate}
        currentUser={currentUser}
        settings={settings}
        onDataChanged={load}
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
