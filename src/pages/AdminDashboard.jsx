import { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  Clock,
  PieChart,
  BarChart3,
  ArrowUpDown,
  Search,
  FileDown,
  Printer,
  Calendar,
  AlertTriangle,
  Receipt,
  Wallet,
  Coins,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Store,
} from "lucide-react";
import { api } from "../api";
import { PageHeader, RangeBar, Empty, Modal, useToast } from "../components/ui";
import { useSettings } from "../App";
import { daysAgo, errText, monthStart, peso, ymd } from "../utils";

export default function AdminDashboard() {
  const { branchInfo, currentUser } = useSettings();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(ymd());
  const [d, setD] = useState(null);
  const [reportTab, setReportTab] = useState("products"); // "products" | "shifts" | "expenses" | "leakage"
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("revenue"); // "revenue" | "gross_profit" | "margin_pct" | "units_sold" | "current_stock"
  const [sortOrder, setSortOrder] = useState("desc"); // "asc" | "desc"
  const [selectedShift, setSelectedShift] = useState(null);
  const toast = useToast();

  const loadData = useCallback(() => {
    api.adminDashboard(from, to)
      .then(setD)
      .catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40, marginTop: 40 }}>
        <ShieldAlert size={48} color="var(--bad)" style={{ margin: "0 auto 16px" }} />
        <h2>Access Restricted</h2>
        <p className="muted">The Admin Dashboard is only accessible to administrator accounts.</p>
      </div>
    );
  }

  if (!d) return <PageHeader title="Admin Dashboard" subtitle="Loading executive suite metrics…" />;

  const activeBranch = branchInfo?.branches?.find((b) => b.id === branchInfo?.active_branch) || {
    name: "Main Store",
  };

  const setPreset = (preset) => {
    const today = ymd();
    if (preset === "today") {
      setFrom(today);
      setTo(today);
    } else if (preset === "yesterday") {
      const y = daysAgo(1);
      setFrom(y);
      setTo(y);
    } else if (preset === "7days") {
      setFrom(daysAgo(6));
      setTo(today);
    } else if (preset === "month") {
      setFrom(monthStart());
      setTo(today);
    } else if (preset === "30days") {
      setFrom(daysAgo(29));
      setTo(today);
    }
  };

  // Sorting helper for products
  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
  };

  const filteredProducts = (d.product_performance || [])
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const valA = Number(a[sortBy] || 0);
      const valB = Number(b[sortBy] || 0);
      return sortOrder === "desc" ? valB - valA : valA - valB;
    });

  const hourlyMax = Math.max(1, ...(d.hourly || []).map((h) => Number(h.revenue || 0)));
  const categoryMax = Math.max(1, ...(d.categories || []).map((c) => Number(c.revenue || 0)));

  const exportCsv = () => {
    let headers = [];
    let rows = [];
    let filename = "";

    if (reportTab === "products") {
      if (filteredProducts.length === 0) return toast("No product data to export", "err");
      headers = ["Product ID", "Product Name", "Category", "Units Sold", "Total Revenue", "COGS", "Gross Profit", "Margin %", "Current Stock"];
      rows = filteredProducts.map((p) => [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category.replace(/"/g, '""')}"`,
        p.units_sold,
        p.revenue,
        p.cogs,
        p.gross_profit,
        p.margin_pct,
        p.current_stock,
      ]);
      filename = `JOYCE_POS_Products_${from}_to_${to}.csv`;
    } else if (reportTab === "employees") {
      if (!d.top_employees || d.top_employees.length === 0) return toast("No employee data to export", "err");
      headers = ["Employee Name", "Base Salary", "Commissions", "LD Commissions", "Total Income"];
      rows = d.top_employees.map((e) => [
        `"${e.employee_name.replace(/"/g, '""')}"`,
        e.salary,
        e.commission,
        e.ld_commission,
        e.total,
      ]);
      filename = `JOYCE_POS_Top_Employees_${from}_to_${to}.csv`;
    } else if (reportTab === "shifts") {
      if (!d.shift_history || d.shift_history.length === 0) return toast("No shift data to export", "err");
      headers = [
        "Shift ID",
        "Business Date",
        "Cashier",
        "Opened At",
        "Closed At",
        "Opening Float",
        "Cash Sales",
        "Expenses",
        "Salaries",
        "Commissions",
        "LD Commissions",
        "Expected Cash",
        "Closing Cash",
        "Variance",
        "Status",
      ];
      rows = d.shift_history.map((s) => [
        s.id,
        s.business_date,
        `"${(s.opened_by || "").replace(/"/g, '""')}"`,
        `"${s.opened_at || ""}"`,
        `"${s.closed_at || ""}"`,
        s.opening_cash,
        s.cash_sales,
        s.expenses,
        s.salaries || 0,
        s.commissions || 0,
        s.ld_commissions || 0,
        s.expected_cash,
        s.closing_cash || 0,
        Number(s.closing_cash || 0) - Number(s.expected_cash || 0),
        s.status,
      ]);
      filename = `JOYCE_POS_Shift_Audit_${from}_to_${to}.csv`;
    } else {
      if (!d.expense_categories || d.expense_categories.length === 0) return toast("No expense data to export", "err");
      headers = ["Expense Category", "Transaction Count", "Total Amount"];
      rows = d.expense_categories.map((c) => [
        `"${c.category.replace(/"/g, '""')}"`,
        c.count,
        c.total,
      ]);
      filename = `JOYCE_POS_Expenses_${from}_to_${to}.csv`;
    }

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("Report exported to CSV");
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                background: "linear-gradient(135deg, #ff7a3d, #ec3f8e)",
                color: "#fff",
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              EXECUTIVE SUITE
            </span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Store size={13} color="var(--accent)" /> {activeBranch.name}
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 6, margin: 0 }}>Admin Dashboard & Playground</h1>
          <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 14 }}>
            Full CRUD analytics, product profitability, hourly volumes & financial auditing
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {/* Quick Date Presets */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="chip" onClick={() => setPreset("today")}>Today</button>
            <button className="chip" onClick={() => setPreset("yesterday")}>Yesterday</button>
            <button className="chip" onClick={() => setPreset("7days")}>Last 7d</button>
            <button className="chip" onClick={() => setPreset("month")}>This Month</button>
            <button className="chip" onClick={() => setPreset("30days")}>Last 30d</button>
          </div>
          <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        </div>
      </div>

      {/* ── 1. High-Level KPI Executive Cards ── */}
      <section className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 24 }}>
        <div className="card stat" style={{ "--c": "#ff7a3d" }}>
          <div className="stat-top">
            <div className="label">Gross Sales Revenue</div>
            <div className="stat-icon"><DollarSign size={18} /></div>
          </div>
          <div className="value">{peso(d.revenue)}</div>
          <div className="sub">{d.orders} orders · Avg ticket {peso(d.avg_ticket)}</div>
        </div>

        <div className="card stat" style={{ "--c": "#38bdf8" }}>
          <div className="stat-top">
            <div className="label">Cost of Goods (COGS)</div>
            <div className="stat-icon"><Package size={18} /></div>
          </div>
          <div className="value">{peso(d.cogs)}</div>
          <div className="sub">Inventory cost of items sold</div>
        </div>

        <div className="card stat" style={{ "--c": "#2fcf8a" }}>
          <div className="stat-top">
            <div className="label">Gross Profit</div>
            <div className="stat-icon"><TrendingUp size={18} /></div>
          </div>
          <div className="value">{peso(d.gross_profit)}</div>
          <div className="sub">Gross Margin: <b>{d.gross_margin}%</b></div>
        </div>

        <div className="card stat" style={{ "--c": "#f59e0b" }}>
          <div className="stat-top">
            <div className="label">Total Overheads</div>
            <div className="stat-icon"><Receipt size={18} /></div>
          </div>
          <div className="value">{peso(d.total_overheads)}</div>
          <div className="sub">Exp: {peso(d.expenses)} · Payroll: {peso(d.salaries + d.commissions + d.ld_commissions)}</div>
        </div>

        <div className="card stat" style={{ "--c": d.net_profit >= 0 ? "#10b981" : "#ff5470" }}>
          <div className="stat-top">
            <div className="label">Net Operating Profit</div>
            <div className="stat-icon"><DollarSign size={18} /></div>
          </div>
          <div className="value" style={{ color: d.net_profit >= 0 ? "var(--ok)" : "var(--bad)" }}>
            {peso(d.net_profit)}
          </div>
          <div className="sub">Net Margin: <b>{d.net_margin}%</b> (after all expenses)</div>
        </div>

        <div className="card stat" style={{ "--c": "#ec4899" }}>
          <div className="stat-top">
            <div className="label">Void / Leakage Rate</div>
            <div className="stat-icon"><AlertTriangle size={18} /></div>
          </div>
          <div className="value">{d.void_rate}%</div>
          <div className="sub">{peso(d.voided_total)} voided ({d.voided_count} receipts)</div>
        </div>

        <div className="card stat" style={{ "--c": "#8b5cf6" }}>
          <div className="stat-top">
            <div className="label">Working Capital (Stock)</div>
            <div className="stat-icon"><Layers size={18} /></div>
          </div>
          <div className="value">{peso(d.inventory_cost)}</div>
          <div className="sub">Retail Potential: {peso(d.inventory_retail)} (+{peso(d.potential_profit)})</div>
        </div>
      </section>

      {/* ── 2. Visual Charts & Operational Visualizations ── */}
      <section className="two-col" style={{ marginBottom: 24 }}>
        {/* Hourly Volume Heatmap */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={18} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Peak Trading Hours</h3>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>Trading volume by hour of day</span>
          </div>

          {!d.hourly || d.hourly.length === 0 ? (
            <Empty text="No hourly sales recorded in this period" />
          ) : (
            <div className="bars" style={{ minHeight: 160, alignItems: "flex-end", gap: 6 }}>
              {d.hourly.map((h) => {
                const hourFormatted = `${h.hour}:00`;
                return (
                  <div className="bar-col" key={h.hour} style={{ flex: 1, minWidth: 26 }}>
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(10, (h.revenue / hourlyMax) * 100)}%`,
                        background: "linear-gradient(180deg, #ff7a3d, #ec3f8e)",
                      }}
                      data-tip={`${hourFormatted}\nRevenue: ${peso(h.revenue)}\nOrders: ${h.count}`}
                    />
                    <small style={{ fontSize: 10, marginTop: 4 }}>{h.hour}</small>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Contribution Distribution */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PieChart size={18} color="var(--accent)" />
              <h3 style={{ margin: 0 }}>Revenue by Category</h3>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>Sales & profit share</span>
          </div>

          {!d.categories || d.categories.length === 0 ? (
            <Empty text="No category activity recorded" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {d.categories.map((cat) => {
                const pct = d.revenue > 0 ? ((cat.revenue / d.revenue) * 100).toFixed(1) : 0;
                return (
                  <div key={cat.category} style={{ fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>
                        <b>{cat.category}</b> ({cat.units} units sold)
                      </span>
                      <span>
                        <b>{peso(cat.revenue)}</b> ({pct}%)
                      </span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #2fcf8a, #38bdf8)",
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Top Performer Employees (Highest Income Graph) */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={18} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Top Performer Employees (Highest Income)</h3>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#8b5cf6" }} /> Base Salary
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#38bdf8" }} /> Commissions
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#2fcf8a" }} /> LD Commissions
            </span>
          </div>
        </div>

        {!d.top_employees || d.top_employees.length === 0 ? (
          <Empty text="No employee earnings recorded in this date range" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(() => {
              const maxEmpTotal = Math.max(1, ...d.top_employees.map((e) => Number(e.total || 0)));
              return d.top_employees.map((emp, idx) => {
                const total = Number(emp.total || 0);
                const salary = Number(emp.salary || 0);
                const comm = Number(emp.commission || 0);
                const ld = Number(emp.ld_commission || 0);
                const barWidth = Math.max(6, (total / maxEmpTotal) * 100);

                const salaryPct = total > 0 ? (salary / total) * 100 : 0;
                const commPct = total > 0 ? (comm / total) * 100 : 0;
                const ldPct = total > 0 ? (ld / total) * 100 : 0;

                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

                return (
                  <div key={emp.employee_name} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, width: 22, textAlign: "center" }}>{medal}</span>
                        <span style={{ fontWeight: 600 }}>{emp.employee_name}</span>
                        <span className="muted" style={{ fontSize: 11 }}>
                          (Salary: {peso(salary)} · Comm: {peso(comm)} · LD: {peso(ld)})
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                        {peso(total)}
                      </span>
                    </div>

                    {/* Segmented Stacked Bar */}
                    <div style={{ width: "100%", height: 12, background: "var(--border)", borderRadius: 6, overflow: "hidden", display: "flex" }}>
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: "100%",
                          display: "flex",
                          borderRadius: 6,
                          overflow: "hidden",
                          transition: "width 0.4s ease",
                        }}
                      >
                        {salary > 0 && (
                          <div
                            style={{
                              width: `${salaryPct}%`,
                              height: "100%",
                              background: "#8b5cf6",
                            }}
                            title={`Base Salary: ${peso(salary)}`}
                          />
                        )}
                        {comm > 0 && (
                          <div
                            style={{
                              width: `${commPct}%`,
                              height: "100%",
                              background: "#38bdf8",
                            }}
                            title={`Commissions: ${peso(comm)}`}
                          />
                        )}
                        {ld > 0 && (
                          <div
                            style={{
                              width: `${ldPct}%`,
                              height: "100%",
                              background: "#2fcf8a",
                            }}
                            title={`LD Commissions: ${peso(ld)}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </section>

      {/* ── 3. Detailed Reporting Playground (CRUD, Sort Highest-to-Lowest, Filter, Export) ── */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className={`chip ${reportTab === "products" ? "active" : ""}`}
              onClick={() => setReportTab("products")}
            >
              <Package size={14} /> Product Profitability (Sortable)
            </button>
            <button
              className={`chip ${reportTab === "employees" ? "active" : ""}`}
              onClick={() => setReportTab("employees")}
            >
              <Users size={14} /> Top Employees (Income)
            </button>
            <button
              className={`chip ${reportTab === "shifts" ? "active" : ""}`}
              onClick={() => setReportTab("shifts")}
            >
              <Clock size={14} /> Shift Audit & Z-Readings
            </button>
            <button
              className={`chip ${reportTab === "expenses" ? "active" : ""}`}
              onClick={() => setReportTab("expenses")}
            >
              <Receipt size={14} /> Expense Categories
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {reportTab === "products" && (
              <div style={{ position: "relative", minWidth: 220 }}>
                <input
                  type="search"
                  placeholder="Filter products / category…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: 13 }}
                />
                <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--muted)" }} />
              </div>
            )}
            <button className="btn sm ghost" onClick={exportCsv} title="Export current report to CSV file">
              <FileDown size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* ── Tab: Product Profitability & Ranking ── */}
        {reportTab === "products" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 12, color: "var(--muted)" }}>
              <span>Showing <b>{filteredProducts.length}</b> products. Click table headers to sort <b>Highest to Lowest</b> or <b>Lowest to Highest</b>.</span>
              <span>Sorted by: <b>{sortBy}</b> ({sortOrder.toUpperCase()})</span>
            </div>

            {filteredProducts.length === 0 ? (
              <Empty text="No product sales found for this filter" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th className="num" style={{ cursor: "pointer" }} onClick={() => toggleSort("units_sold")} title="Sort by Units Sold">
                        Units Sold <ArrowUpDown size={12} />
                      </th>
                      <th className="num" style={{ cursor: "pointer" }} onClick={() => toggleSort("revenue")} title="Sort by Revenue">
                        Revenue <ArrowUpDown size={12} />
                      </th>
                      <th className="num" style={{ cursor: "pointer" }} onClick={() => toggleSort("cogs")} title="Sort by COGS">
                        Cost (COGS) <ArrowUpDown size={12} />
                      </th>
                      <th className="num" style={{ cursor: "pointer" }} onClick={() => toggleSort("gross_profit")} title="Sort by Gross Profit">
                        Gross Profit <ArrowUpDown size={12} />
                      </th>
                      <th className="num" style={{ cursor: "pointer" }} onClick={() => toggleSort("margin_pct")} title="Sort by Margin %">
                        Margin % <ArrowUpDown size={12} />
                      </th>
                      <th className="num" style={{ cursor: "pointer" }} onClick={() => toggleSort("current_stock")} title="Sort by On-Hand Stock">
                        Stock Left <ArrowUpDown size={12} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const isHighMargin = p.margin_pct >= 40;
                      const isLowStock = p.current_stock <= 5;

                      return (
                        <tr key={p.id} className="row-hover">
                          <td>
                            <b>{p.name}</b>
                          </td>
                          <td>
                            <span className="badge">{p.category}</span>
                          </td>
                          <td className="num">{p.units_sold}</td>
                          <td className="num" style={{ fontWeight: 600, color: "var(--accent)" }}>
                            {peso(p.revenue)}
                          </td>
                          <td className="num">{peso(p.cogs)}</td>
                          <td className="num" style={{ fontWeight: 600, color: "var(--ok)" }}>
                            {peso(p.gross_profit)}
                          </td>
                          <td className="num">
                            <span className={"badge " + (isHighMargin ? "ok" : p.margin_pct <= 15 ? "warn" : "")}>
                              {p.margin_pct}%
                            </span>
                          </td>
                          <td className="num">
                            <span className={"badge " + (isLowStock ? "bad" : "")}>
                              {p.current_stock}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Top Employees Breakdown ── */}
        {reportTab === "employees" && (
          <div>
            {!d.top_employees || d.top_employees.length === 0 ? (
              <Empty text="No employee earnings recorded in this date range" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Employee Name</th>
                      <th className="num">Base Salary</th>
                      <th className="num">Commissions</th>
                      <th className="num">LD Commissions</th>
                      <th className="num">Total Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top_employees.map((emp, idx) => (
                      <tr key={emp.employee_name} className="row-hover">
                        <td style={{ fontWeight: 700 }}>
                          {idx === 0 ? "🥇 1st" : idx === 1 ? "🥈 2nd" : idx === 2 ? "🥉 3rd" : `#${idx + 1}`}
                        </td>
                        <td><b>{emp.employee_name}</b></td>
                        <td className="num">{peso(emp.salary)}</td>
                        <td className="num" style={{ color: "#38bdf8" }}>{peso(emp.commission)}</td>
                        <td className="num" style={{ color: "#2fcf8a" }}>{peso(emp.ld_commission)}</td>
                        <td className="num" style={{ fontWeight: 700, color: "var(--accent)" }}>
                          {peso(emp.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Shift Audit & Z-Readings ── */}
        {reportTab === "shifts" && (
          <div>
            {!d.shift_history || d.shift_history.length === 0 ? (
              <Empty text="No shift records found for this period" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Shift ID</th>
                      <th>Business Date</th>
                      <th>Cashier</th>
                      <th>Opened At</th>
                      <th>Closed At</th>
                      <th className="num">Opening Float</th>
                      <th className="num">Cash Sales</th>
                      <th className="num">Expenses</th>
                      <th className="num">Salaries</th>
                      <th className="num">Commissions</th>
                      <th className="num">LD Comm</th>
                      <th className="num">Expected</th>
                      <th className="num">Closing Cash</th>
                      <th className="num">Variance</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.shift_history.map((s) => {
                      const variance = Number(s.closing_cash || 0) - Number(s.expected_cash || 0);
                      const isClosed = s.status === "closed";

                      return (
                        <tr key={s.id} className="row-hover">
                          <td>#{s.id}</td>
                          <td><b>{s.business_date}</b></td>
                          <td>{s.opened_by}</td>
                          <td className="muted">{s.opened_at?.slice(11, 16) || "—"}</td>
                          <td className="muted">{s.closed_at?.slice(11, 16) || "—"}</td>
                          <td className="num">{peso(s.opening_cash)}</td>
                          <td className="num" style={{ color: "var(--ok)" }}>+{peso(s.cash_sales)}</td>
                          <td className="num" style={{ color: "var(--bad)" }}>-{peso(s.expenses)}</td>
                          <td className="num" style={{ color: "var(--bad)" }}>-{peso(s.salaries || 0)}</td>
                          <td className="num" style={{ color: "var(--bad)" }}>-{peso(s.commissions || 0)}</td>
                          <td className="num" style={{ color: "var(--bad)" }}>-{peso(s.ld_commissions || 0)}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{peso(s.expected_cash)}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{isClosed ? peso(s.closing_cash) : "—"}</td>
                          <td className="num">
                            {isClosed ? (
                              <span
                                className={
                                  "badge " +
                                  (variance === 0 ? "ok" : variance > 0 ? "ok" : "bad")
                                }
                              >
                                {variance >= 0 ? `+${peso(variance)}` : peso(variance)}
                              </span>
                            ) : (
                              <span className="badge warn">In Progress</span>
                            )}
                          </td>
                          <td>
                            <span className={"badge " + (isClosed ? "ok" : "warn")}>
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {isClosed && (
                              <button
                                className="btn sm ghost"
                                onClick={() => setSelectedShift(s)}
                                title="View Z-Reading"
                              >
                                <Printer size={13} /> Z-Reading
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Expense Breakdown by Category ── */}
        {reportTab === "expenses" && (
          <div>
            {!d.expense_categories || d.expense_categories.length === 0 ? (
              <Empty text="No expenses recorded in this period" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Expense Category</th>
                      <th className="num">Transaction Count</th>
                      <th className="num">Total Amount</th>
                      <th className="num">% of Total Overheads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.expense_categories.map((c) => {
                      const pct = d.total_overheads > 0 ? ((c.total / d.total_overheads) * 100).toFixed(1) : 0;
                      return (
                        <tr key={c.category} className="row-hover">
                          <td><b>{c.category || "General"}</b></td>
                          <td className="num">{c.count}</td>
                          <td className="num" style={{ fontWeight: 600, color: "var(--bad)" }}>
                            {peso(c.total)}
                          </td>
                          <td className="num">
                            <span className="badge">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Z-Reading Modal ── */}
      {selectedShift && (
        <Modal title={`Z-Reading — Shift #${selectedShift.id}`} onClose={() => setSelectedShift(null)}>
          <div className="printable-report" id="printable-shift-zreading">
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 14 }}>
              <h2 style={{ margin: 0, color: "#111" }}>JOYCE POS</h2>
              <div style={{ fontSize: 13, color: "#555" }}>OFFICIAL END OF DAY Z-READING</div>
              <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                Branch: <b>{activeBranch.name}</b> · Business Date: <b>{selectedShift.business_date}</b>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, marginBottom: 14 }}>
              <div>Opened by: <b>{selectedShift.opened_by}</b></div>
              <div>Closed by: <b>{selectedShift.closed_by || "—"}</b></div>
              <div>Start: {selectedShift.opened_at}</div>
              <div>End: {selectedShift.closed_at || "—"}</div>
            </div>

            <table className="report-table">
              <tbody>
                <tr>
                  <td>Opening Drawer Float</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>{peso(selectedShift.opening_cash)}</td>
                </tr>
                <tr>
                  <td>+ Total Cash Sales</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "green" }}>+{peso(selectedShift.cash_sales)}</td>
                </tr>
                <tr>
                  <td>- Store Expenses Paid</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "red" }}>-{peso(selectedShift.expenses)}</td>
                </tr>
                <tr>
                  <td>- Salaries Paid</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "red" }}>-{peso(selectedShift.salaries || 0)}</td>
                </tr>
                <tr>
                  <td>- Commissions Paid</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "red" }}>-{peso(selectedShift.commissions || 0)}</td>
                </tr>
                <tr>
                  <td>- LD Commissions Paid</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "red" }}>-{peso(selectedShift.ld_commissions || 0)}</td>
                </tr>
                <tr style={{ borderTop: "2px solid #333", background: "#f8f8f8" }}>
                  <td><b>Expected Drawer Balance</b></td>
                  <td style={{ textAlign: "right", fontWeight: "bold", fontSize: 15 }}>{peso(selectedShift.expected_cash)}</td>
                </tr>
                <tr>
                  <td><b>Actual Counted Cash</b></td>
                  <td style={{ textAlign: "right", fontWeight: "bold", fontSize: 15 }}>{peso(selectedShift.closing_cash)}</td>
                </tr>
                <tr style={{ background: "#f0fdf4" }}>
                  <td><b>Reconciliation Variance</b></td>
                  <td style={{ textAlign: "right", fontWeight: "bold", fontSize: 15 }}>
                    {peso(Number(selectedShift.closing_cash || 0) - Number(selectedShift.expected_cash || 0))}
                  </td>
                </tr>
              </tbody>
            </table>

            {selectedShift.notes && (
              <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>
                Shift Notes: <i>{selectedShift.notes}</i>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setSelectedShift(null)}>Close</button>
            <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print Z-Reading</button>
          </div>
        </Modal>
      )}
    </>
  );
}
