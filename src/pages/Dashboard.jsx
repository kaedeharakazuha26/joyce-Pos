import { useCallback, useEffect, useState } from "react";
import { Award, TrendingUp } from "lucide-react";
import { api } from "../api";
import { PageHeader, RangeBar, Empty, useToast } from "../components/ui";
import { daysAgo, errText, peso, ymd } from "../utils";

const Stat = ({ label, value, sub, color }) => (
  <div className="card stat" style={{ "--c": color }}>
    <div className="label">{label}</div>
    <div className="value">{value}</div>
    <div className="sub">{sub}</div>
  </div>
);

export default function Dashboard() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(ymd());
  const [d, setD] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    api.dashboard(from, to).then(setD).catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  useEffect(load, [load]);

  if (!d) return <PageHeader title="Dashboard" subtitle="Loading…" />;
  const max = Math.max(1, ...(d.daily || []).map((x) => x.total));

  const totalPayout =
    Number(d.salaries || 0) +
    Number(d.commissions || 0) +
    Number(d.ld_commissions || 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Sales, payroll & performance reporting">
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </PageHeader>

      <section className="stats">
        <Stat
          label="Sales revenue"
          value={peso(d.revenue)}
          sub={`${d.orders} completed transactions`}
          color="#ff7a3d"
        />
        <Stat
          label="Gross profit"
          value={peso(d.gross_profit)}
          sub={`Cost of goods: ${peso(d.cogs)}`}
          color="#2fcf8a"
        />
        <Stat
          label="Total expenses & payouts"
          value={peso(Number(d.expenses || 0) + totalPayout)}
          sub={`Expenses ${peso(d.expenses)} · Payroll ${peso(totalPayout)}`}
          color="#ffb020"
        />
        <Stat
          label="Net profit"
          value={peso(d.net_profit)}
          sub="Gross − (expenses + salaries + commissions)"
          color="#ec3f8e"
        />
        <Stat
          label="Voided sales"
          value={peso(d.voided_total)}
          sub={`${d.voided_count} voided`}
          color="#ff5470"
        />
        <Stat
          label="Inventory value"
          value={peso(d.inventory_cost)}
          sub={`Retail value: ${peso(d.inventory_retail)}`}
          color="#5b8def"
        />
      </section>

      {/* Highest income per employee */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3>Highest income per employee (Payroll & Commissions)</h3>
          <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Award size={14} /> Total Paid: {peso(totalPayout)}
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
                <th className="num">Salary</th>
                <th className="num">Commission</th>
                <th className="num">LD Commission</th>
                <th className="num">Total Income</th>
              </tr>
            </thead>
            <tbody>
              {d.top_employees.map((emp, i) => (
                <tr key={emp.employee_name} className="row-hover">
                  <td>
                    {i === 0 ? (
                      <span className="badge" style={{ background: "rgba(255,176,32,0.2)", color: "#ffb020" }}>
                        🥇 1st
                      </span>
                    ) : i === 1 ? (
                      <span className="badge" style={{ background: "rgba(180,180,190,0.2)", color: "var(--muted)" }}>
                        🥈 2nd
                      </span>
                    ) : i === 2 ? (
                      <span className="badge" style={{ background: "rgba(205,127,50,0.2)", color: "#cd7f32" }}>
                        🥉 3rd
                      </span>
                    ) : (
                      `#${i + 1}`
                    )}
                  </td>
                  <td>
                    <b>{emp.employee_name}</b>
                  </td>
                  <td className="num">{peso(emp.salary)}</td>
                  <td className="num">{peso(emp.commission)}</td>
                  <td className="num">{peso(emp.ld_commission)}</td>
                  <td className="num">
                    <b style={{ color: "var(--ok)", fontSize: 16 }}>{peso(emp.total)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
                  {p.stock} left
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
                  <td>{i + 1}</td>
                  <td>{t.name}</td>
                  <td className="num">{t.units}</td>
                  <td className="num">{peso(t.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
