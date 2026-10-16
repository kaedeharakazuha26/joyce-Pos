import { useCallback, useEffect, useState } from "react";
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
  Calendar,
} from "lucide-react";
import { api } from "../api";
import { PageHeader, RangeBar, Empty, Modal, useToast } from "../components/ui";
import { useSettings } from "../App";
import { daysAgo, errText, peso, ymd } from "../utils";

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
  const { settings, branchInfo } = useSettings();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(ymd());
  const [d, setD] = useState(null);
  const [trendView, setTrendView] = useState("chart"); // "chart" | "table"
  const [showPdfModal, setShowPdfModal] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    api.dashboard(from, to)
      .then(setD)
      .catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  useEffect(load, [load]);

  if (!d) return <PageHeader title="Dashboard" subtitle="Loading metrics…" />;

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
  const maxSales = Math.max(1, ...dailyList.map((x) => Number(x.total || 0)));

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Sales, payroll & performance reporting">
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </PageHeader>

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

      {/* ── Sales Trend (Calculations for expenses, ld commission, commission, and salary base on date selected) ── */}
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
              Daily breakdown of Sales, Expenses, Salaries, and Commissions for <b>{from}</b> to <b>{to}</b>
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`chip ${trendView === "chart" ? "active" : ""}`}
              onClick={() => setTrendView("chart")}
              title="Chart visualization"
            >
              <BarChart3 size={14} /> Chart View
            </button>
            <button
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
        ) : trendView === "chart" ? (
          <div>
            {/* Visual multi-metric bars */}
            <div className="bars" style={{ minHeight: 180, alignItems: "flex-end", gap: 10 }}>
              {dailyList.map((x) => {
                const daySales = Number(x.total || 0);
                const dayExp = showExpenses ? Number(x.expenses || 0) : 0;
                const daySal = showSalary ? Number(x.salaries || 0) : 0;
                const dayCom = showCommission ? Number(x.commissions || 0) : 0;
                const dayLd = showLdCommission ? Number(x.ld_commissions || 0) : 0;
                const dayOverheads = dayExp + daySal + dayCom + dayLd;
                const dayNet = daySales - dayOverheads;

                const tipText = `${x.day}\nSales: ${peso(daySales)} (${x.count} orders)\nExpenses: ${peso(dayExp)}\nSalaries: ${peso(daySal)}\nCommissions: ${peso(dayCom)}\nLD Comm: ${peso(dayLd)}\nNet: ${peso(dayNet)}`;

                return (
                  <div className="bar-col" key={x.day} style={{ flex: 1, minWidth: 42 }}>
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(8, (daySales / maxSales) * 100)}%`,
                        background:
                          dayNet >= 0
                            ? "var(--grad)"
                            : "linear-gradient(180deg, #ff5470, #c41e3a)",
                      }}
                      data-tip={tipText}
                    />
                    <small style={{ fontSize: 11, marginTop: 6, fontWeight: 500 }}>
                      {x.day.slice(5)}
                    </small>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                marginTop: 18,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)" }} />
                <span>Sales Revenue</span>
              </div>
              {showExpenses && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f97316" }} />
                  <span>Expenses</span>
                </div>
              )}
              {showSalary && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#38bdf8" }} />
                  <span>Salaries</span>
                </div>
              )}
              {showCommission && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#a855f7" }} />
                  <span>Commissions</span>
                </div>
              )}
              {showLdCommission && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#06b6d4" }} />
                  <span>LD Commissions</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--bad)" }} />
                <span>Negative Net Day</span>
              </div>
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
                  const daySales = Number(x.total || 0);
                  const dayExp = showExpenses ? Number(x.expenses || 0) : 0;
                  const daySal = showSalary ? Number(x.salaries || 0) : 0;
                  const dayCom = showCommission ? Number(x.commissions || 0) : 0;
                  const dayLd = showLdCommission ? Number(x.ld_commissions || 0) : 0;
                  const dayNet = daySales - dayExp - daySal - dayCom - dayLd;

                  return (
                    <tr key={x.day} className="row-hover">
                      <td><b>{x.day}</b></td>
                      <td className="num">{x.count}</td>
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
