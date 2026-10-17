import {
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Wallet,
  Sparkles,
  Calendar,
  Boxes,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { StatusBadge, Empty } from "../ui";
import { monthStart, pctChange, peso, pesoShort, ymd } from "../../utils";

export function AdminKpiGrid({
  loading,
  data,
  activeBusinessDate,
  handleApplyDateRange,
  jumpToReport,
}) {
  if (loading && !data) {
    return (
      <div className="kpi-skeleton-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card skeleton-card" />
        ))}
      </div>
    );
  }

  const fin = data?.financials || {};
  const prev = data?.previous_period || data?.previous || {};
  const todayStats = data?.today || {};
  const mtdStats = data?.mtd || {};
  const counts = data?.counts || {};

  const grossSales = Number(fin.gross_sales ?? fin.revenue ?? data?.revenue ?? 0);
  const prevSales = Number(prev.revenue ?? prev.gross_sales ?? 0);
  const cogs = Number(fin.cogs ?? data?.cogs ?? 0);
  const grossProfit = Number(fin.gross_profit ?? data?.gross_profit ?? 0);
  const prevGross = Number(prev.gross_profit ?? 0);
  const totalOverheads = Number(fin.total_overheads ?? data?.total_overheads ?? 0);
  const prevOverheads = Number(prev.total_overheads ?? 0);
  const netProfit = Number(fin.net_profit ?? data?.net_profit ?? 0);
  const prevNet = Number(prev.net_profit ?? 0);

  const expensesAmt = Number(fin.expenses_total ?? fin.expenses ?? data?.expenses ?? 0);
  const salariesAmt = Number(fin.salaries_total ?? fin.salaries ?? data?.salaries ?? 0);
  const commAmt = Number(fin.commissions_total ?? fin.commissions ?? data?.commissions ?? 0);
  const ldCommAmt = Number(fin.ld_commissions_total ?? fin.ld_commissions ?? data?.ld_commissions ?? 0);

  const ordersCount = Number(fin.completed_orders ?? fin.orders ?? data?.orders ?? 0);
  const avgTicket = Number(fin.avg_ticket ?? data?.avg_ticket ?? 0);
  const grossMarginPct = Number(fin.gross_margin_pct ?? data?.gross_margin ?? 0);
  const netMarginPct = Number(fin.net_margin_pct ?? data?.net_margin ?? 0);

  const todaySales = Number(todayStats.sales ?? todayStats.revenue ?? 0);
  const todayNet = Number(todayStats.net_profit ?? 0);
  const todayOrders = Number(todayStats.orders ?? 0);

  const mtdSales = Number(mtdStats.sales ?? mtdStats.revenue ?? 0);
  const mtdNet = Number(mtdStats.net_profit ?? 0);
  const mtdOverheads = Number(mtdStats.overheads ?? mtdStats.total_overheads ?? 0);

  const stockRetailVal = Number(fin.inventory_retail_value ?? data?.inventory_retail ?? 0);
  const stockCostVal = Number(fin.inventory_cost_value ?? data?.inventory_cost ?? 0);
  const outCount = Number(counts.out_of_stock ?? counts.products_out_of_stock ?? 0);
  const lowCount = Number(counts.low_stock ?? counts.products_low_stock ?? 0);
  const okCount = Number(counts.healthy_stock ?? counts.products_healthy ?? 0);

  const voidTotal = Number(fin.voided_total ?? data?.voided_total ?? 0);
  const voidCount = Number(fin.voided_count ?? data?.voided_count ?? 0);

  const revCompare = pctChange(grossSales, prevSales);
  const netCompare = pctChange(netProfit, prevNet);
  const grossCompare = pctChange(grossProfit, prevGross);
  const overheadCompare = pctChange(totalOverheads, prevOverheads);

  return (
    <section className="kpi-grid-modern" aria-label="Key Performance Indicators">
      {/* Card 1: Total Sales (Money In) */}
      <div
        className="kpi-card-v2 tone-ok"
        onClick={() => jumpToReport("sales", { status: "completed" })}
        role="button"
        tabIndex={0}
        title="Click to view all completed customer receipts"
      >
        <div className="kpi-head">
          <span className="kpi-title">1. Total Sales (Money In)</span>
          <span className="kpi-icon-box tone-ok"><TrendingUp size={17} /></span>
        </div>
        <div className="kpi-val">{peso(grossSales)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={revCompare.delta >= 0 ? "ok" : "bad"}
            label={`${revCompare.delta >= 0 ? "+" : ""}${revCompare.pct.toFixed(1)}% (${revCompare.delta >= 0 ? "+" : ""}${pesoShort(revCompare.delta)})`}
          />
          <span className="kpi-sub">vs previous period</span>
        </div>
        <div className="kpi-foot">
          <span><b>{ordersCount}</b> paid receipts • Avg <b>{peso(avgTicket)}</b>/order</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 2: Gross Profit (Sales minus Product Cost) */}
      <div
        className="kpi-card-v2 tone-info"
        onClick={() => jumpToReport("products")}
        role="button"
        tabIndex={0}
        title="Click to see item costs vs selling prices"
      >
        <div className="kpi-head">
          <span className="kpi-title">2. Gross Profit (Sales − Cost)</span>
          <span className="kpi-icon-box tone-info"><BarChart3 size={17} /></span>
        </div>
        <div className="kpi-val">{peso(grossProfit)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={grossCompare.delta >= 0 ? "ok" : "bad"}
            label={`Margin: ${grossMarginPct.toFixed(1)}%`}
          />
          <span className="kpi-sub">Item Cost (COGS): <b>{peso(cogs)}</b></span>
        </div>
        <div className="kpi-foot">
          <span>Money left after paying supplier item cost</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 3: Store Expenses & Staff Pay */}
      <div
        className="kpi-card-v2 tone-warn"
        onClick={() => jumpToReport("expenses")}
        role="button"
        tabIndex={0}
        title="Click to view or add Store Expenses, Salaries & Commissions"
      >
        <div className="kpi-head">
          <span className="kpi-title">3. Expenses & Staff Pay</span>
          <span className="kpi-icon-box tone-warn"><Wallet size={17} /></span>
        </div>
        <div className="kpi-val">{peso(totalOverheads)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={overheadCompare.delta <= 0 ? "ok" : "warn"}
            label={`Bills: ${pesoShort(expensesAmt)} • Staff: ${pesoShort(salariesAmt + commAmt + ldCommAmt)}`}
          />
        </div>
        <div className="kpi-foot">
          <span>Sal {pesoShort(salariesAmt)} • Comm {pesoShort(commAmt)} • LD {pesoShort(ldCommAmt)}</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 4: Take-Home Net Profit */}
      <div
        className={`kpi-card-v2 ${netProfit >= 0 ? "tone-ok" : "tone-bad"}`}
        onClick={() => jumpToReport("overview")}
        role="button"
        tabIndex={0}
        title="Click to see the step-by-step Profit & Loss (P&L) table"
      >
        <div className="kpi-head">
          <span className="kpi-title">4. Take-Home Net Profit</span>
          <span className={`kpi-icon-box ${netProfit >= 0 ? "tone-ok" : "tone-bad"}`}>
            <ShieldCheck size={17} />
          </span>
        </div>
        <div
          className="kpi-val"
          style={{ color: netProfit >= 0 ? "var(--ok)" : "var(--bad)" }}
        >
          {peso(netProfit)}
        </div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={netProfit >= 0 ? "ok" : "bad"}
            label={netProfit >= 0 ? `PROFIT (${netMarginPct.toFixed(1)}% margin)` : `LOSS (${netMarginPct.toFixed(1)}%)`}
          />
          <span className="kpi-sub">{netCompare.delta >= 0 ? "+" : ""}{pesoShort(netCompare.delta)} vs prev</span>
        </div>
        <div className="kpi-foot">
          <span>Gross Profit minus all Bills & Staff Pay</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 5: Today's Live Sales */}
      <div
        className="kpi-card-v2 tone-info"
        onClick={() => {
          const td = activeBusinessDate || ymd();
          handleApplyDateRange(td, td);
          jumpToReport("sales");
        }}
        role="button"
        tabIndex={0}
        title="Click to filter dashboard to Today only"
      >
        <div className="kpi-head">
          <span className="kpi-title">Today's Sales ({todayStats.date || activeBusinessDate})</span>
          <span className="kpi-icon-box tone-info"><Sparkles size={17} /></span>
        </div>
        <div className="kpi-val">{peso(todaySales)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={todayNet >= 0 ? "ok" : "bad"}
            label={`Today's Net: ${peso(todayNet)}`}
          />
          <span className="kpi-sub">{todayOrders} orders today</span>
        </div>
        <div className="kpi-foot">
          <span><b>{todayStats.records_created || 0}</b> new records logged today</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 6: This Month (Month-to-Date) */}
      <div
        className="kpi-card-v2 tone-purple"
        onClick={() => {
          handleApplyDateRange(monthStart(), ymd());
          jumpToReport("overview");
        }}
        role="button"
        tabIndex={0}
        title="Click to view entire current month"
      >
        <div className="kpi-head">
          <span className="kpi-title">This Month's Sales (MTD)</span>
          <span className="kpi-icon-box tone-purple"><Calendar size={17} /></span>
        </div>
        <div className="kpi-val">{peso(mtdSales)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={mtdNet >= 0 ? "ok" : "bad"}
            label={`Month Net: ${pesoShort(mtdNet)}`}
          />
          <span className="kpi-sub">{mtdStats.orders || 0} orders</span>
        </div>
        <div className="kpi-foot">
          <span>Month Expenses & Pay: <b>{peso(mtdOverheads)}</b></span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 7: Stock on Shelf & Low-Stock Alerts */}
      <div
        className={`kpi-card-v2 ${
          outCount > 0 ? "tone-bad" : lowCount > 0 ? "tone-warn" : "tone-ok"
        }`}
        onClick={() =>
          jumpToReport("products", {
            status: outCount > 0 ? "out" : lowCount > 0 ? "low" : "all",
          })
        }
        role="button"
        tabIndex={0}
        title="Click to check product stock levels and restock"
      >
        <div className="kpi-head">
          <span className="kpi-title">Inventory Shelf Value</span>
          <span className="kpi-icon-box tone-info"><Boxes size={17} /></span>
        </div>
        <div className="kpi-val">{peso(stockRetailVal)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={outCount > 0 ? "bad" : lowCount > 0 ? "warn" : "ok"}
            label={`${outCount} Out • ${lowCount} Low • ${okCount} Healthy`}
          />
        </div>
        <div className="kpi-foot">
          <span>Supplier Cost: <b>{peso(stockCostVal)}</b> ({counts.active_products || 0} items)</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 8: Cancelled / Voided Receipts & Staff Count */}
      <div
        className={`kpi-card-v2 ${voidCount > 0 ? "tone-warn" : "tone-neutral"}`}
        onClick={() => jumpToReport("sales", { status: "voided" })}
        role="button"
        tabIndex={0}
        title="Click to inspect cancelled/voided receipts"
      >
        <div className="kpi-head">
          <span className="kpi-title">Voided / Cancelled Receipts</span>
          <span className="kpi-icon-box tone-warn"><AlertTriangle size={17} /></span>
        </div>
        <div className="kpi-val">{peso(voidTotal)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={voidCount > 0 ? "warn" : "ok"}
            label={`${voidCount} voided receipts`}
          />
          <span className="kpi-sub">{counts.active_employees || 0} active staff</span>
        </div>
        <div className="kpi-foot">
          <span><b>{counts.total_records || 0}</b> total records in database</span>
          <ExternalLink size={12} />
        </div>
      </div>
    </section>
  );
}

export function AdminAlertsAndActivity({
  data,
  auditLogs,
  openSod,
  jumpToReport,
  onInspectAudit,
}) {
  if (!data) return null;

  return (
    <section className="alerts-activity-grid no-print">
      {/* Important Alerts & Pending Actions */}
      <div className="card">
        <div className="section-title-row">
          <h3>
            <AlertTriangle size={16} color="var(--warn)" /> Things That Need Your Attention
          </h3>
          <StatusBadge
            tone={(data.alerts || []).length > 0 ? "warn" : "ok"}
            label={`${(data.alerts || []).length} alert${(data.alerts || []).length === 1 ? "" : "s"}`}
          />
        </div>

        {(data.alerts || []).length === 0 ? (
          <div className="empty-compact">
            <CheckCircle2 size={20} color="var(--ok)" />
            <span>Everything looks great! Stock levels, cash shifts, and profits are healthy.</span>
          </div>
        ) : (
          <div className="alerts-list">
            {data.alerts.map((a) => (
              <div
                key={a.id}
                className={`alert-card-row tone-${a.severity || "info"}`}
                onClick={() => {
                  const target = a.actionTab || a.target_tab || a.target || "overview";
                  if (target === "shifts" && a.filter === "open_sod" && openSod) {
                    openSod();
                  } else {
                    jumpToReport(target, { status: a.actionFilter || a.filter || "all" });
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="alert-card-body">
                  <div className="alert-card-title">
                    <StatusBadge
                      tone={a.severity === "bad" ? "bad" : a.severity === "warn" ? "warn" : "info"}
                      label={a.severity === "bad" ? "URGENT" : a.severity === "warn" ? "CHECK" : "INFO"}
                    />
                    <b>{a.title}</b>
                  </div>
                  <p className="muted">{a.message || a.description}</p>
                </div>
                <ExternalLink size={14} className="muted" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Activity Feed */}
      <div className="card">
        <div className="section-title-row">
          <h3>
            <Activity size={16} color="var(--info)" /> Recent Store Activity (Who Did What)
          </h3>
          <button
            type="button"
            className="link-btn"
            onClick={() => jumpToReport("audit")}
          >
            View All Activity <ExternalLink size={12} />
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <Empty text="No recent actions recorded in this date range." />
        ) : (
          <div className="activity-feed-compact">
            {auditLogs.slice(0, 6).map((item, idx) => {
              const act = (item.action || "INFO").toUpperCase();
              const tone =
                act.includes("DELETE") || act.includes("VOID")
                  ? "bad"
                  : act.includes("CREATE") || act.includes("SALE") || act.includes("RESTOCK") || act.includes("BACKUP")
                  ? "ok"
                  : act.includes("UPDATE")
                  ? "warn"
                  : "info";
              return (
                <div
                  key={item.uid || item.id || idx}
                  className="activity-feed-row"
                  onClick={() => onInspectAudit && onInspectAudit(item)}
                  role="button"
                  tabIndex={0}
                  title="Click to inspect full activity details"
                >
                  <StatusBadge tone={tone} label={act} />
                  <div className="activity-feed-text">
                    <b>{item.summary}</b>
                    <small className="muted">
                      {item.actor || "System"} ({item.role || "admin"}) • {item.timestamp}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
