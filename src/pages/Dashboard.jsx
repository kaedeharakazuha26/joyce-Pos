import { useCallback, useEffect, useState } from "react";
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
  const max = Math.max(1, ...d.daily.map((x) => x.total));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Product & sales reporting">
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </PageHeader>

      <section className="stats">
        <Stat label="Sales" value={peso(d.revenue)} sub={`${d.orders} transactions`} color="#ff7a3d" />
        <Stat label="Gross profit" value={peso(d.gross_profit)} sub={`Cost of goods ${peso(d.cogs)}`} color="#2fcf8a" />
        <Stat label="Expenses + Salary" value={peso(d.expenses + d.salaries)} sub={`${peso(d.expenses)} exp · ${peso(d.salaries)} salary`} color="#ffb020" />
        <Stat label="Net profit" value={peso(d.net_profit)} sub="Gross − expenses − salary" color="#ec3f8e" />
        <Stat label="Voided sales" value={peso(d.voided_total)} sub={`${d.voided_count} voided`} color="#ff5470" />
        <Stat label="Inventory value" value={peso(d.inventory_cost)} sub={`Retail ${peso(d.inventory_retail)}`} color="#5b8def" />
      </section>

      <section className="two-col">
        <div className="card">
          <h3>Daily sales</h3>
          {d.daily.length === 0 ? <Empty text="No sales in this period" /> : (
            <div className="bars">
              {d.daily.map((x) => (
                <div className="bar-col" key={x.day}>
                  <div className="bar" style={{ height: `${(x.total / max) * 100}%` }} data-tip={`${peso(x.total)} · ${x.count} sales`} />
                  <small>{x.day.slice(5)}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Low stock</h3>
          {d.low_stock.length === 0 ? <Empty text="All stocked up 🎉" /> : d.low_stock.map((p) => (
            <div className="list-row" key={p.id}>
              <span>{p.name}</span>
              <span className={"badge " + (p.stock === 0 ? "bad" : "warn")}>{p.stock} left</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Top selling products</h3>
        {d.top.length === 0 ? <Empty text="Nothing sold yet" /> : (
          <table>
            <thead><tr><th>#</th><th>Product</th><th className="num">Units sold</th><th className="num">Revenue</th></tr></thead>
            <tbody>
              {d.top.map((t, i) => (
                <tr key={t.name + i} className="row-hover">
                  <td>{i + 1}</td><td>{t.name}</td><td className="num">{t.units}</td><td className="num">{peso(t.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
