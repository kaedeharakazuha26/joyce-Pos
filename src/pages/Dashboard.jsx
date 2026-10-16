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
} from "lucide-react";
import { api } from "../api";
import { PageHeader, RangeBar, Empty, useToast } from "../components/ui";
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
  const avgTicket = d.orders > 0 ? (d.revenue / d.orders) : 0;

  const activeBranch =
    branchInfo?.branches?.find((b) => b.id === branchInfo?.active_branch) || {
      name: "Main Store",
    };

  const max = Math.max(1, ...(d.daily || []).map((x) => x.total));

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

        {(showExpenses || showPayroll) && (
          <Stat
            label="Total overheads"
            value={peso(totalOverheads)}
            sub={`${showExpenses ? `Exp: ${peso(activeExpenses)}` : ""} ${
              showPayroll ? `· Payroll: ${peso(totalActivePayout)}` : ""
            }`.trim()}
            color="#ffb020"
            icon={Receipt}
          />
        )}

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

        <Stat
          label="Voided sales"
          value={peso(d.voided_total)}
          sub={`${d.voided_count} voided`}
          color="#ff5470"
          icon={Ban}
        />

        {showInventory && (
          <Stat
            label="Inventory value"
            value={peso(d.inventory_cost)}
            sub={`Retail: ${peso(d.inventory_retail)}`}
            color="#5b8def"
            icon={Boxes}
          />
        )}
      </section>

      {/* Highest income per employee (Only rendered if payroll is active for this branch) */}
      {showPayroll && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Highest income per employee</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Active payroll components for {activeBranch.name}
              </p>
            </div>
            <span
              className="badge"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Award size={14} /> Total Paid: {peso(totalActivePayout)}
            </span>
          </div>

          {!d.top_employees || d.top_employees.length === 0 ? (
            <Empty text="No salary or commission records recorded in this period" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Rank</th>
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

      <section className="two-col">
        <div className="card">
          <h3>Daily sales trend</h3>
          {d.daily.length === 0 ? (
            <Empty text="No sales in this period" />
          ) : (
            <div className="bars">
              {d.daily.map((x) => (
                <div className="bar-col" key={x.day}>
                  <div
                    className="bar"
                    style={{ height: `${(x.total / max) * 100}%` }}
                    data-tip={`${peso(x.total)} · ${x.count} sales`}
                  />
                  <small>{x.day.slice(5)}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Low stock alerts</h3>
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
      </section>

      <section className="card">
        <h3>Top selling products</h3>
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
      </section>
    </>
  );
}
