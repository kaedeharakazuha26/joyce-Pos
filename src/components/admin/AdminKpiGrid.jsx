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
  const prev = data?.previous_period || {};
  const todayStats = data?.today || {};
  const mtdStats = data?.mtd || {};
  const counts = data?.counts || {};

  const revCompare = pctChange(fin.revenue, prev.revenue);
  const netCompare = pctChange(fin.net_profit, prev.net_profit);
  const grossCompare = pctChange(fin.gross_profit, prev.gross_profit);
  const overheadCompare = pctChange(fin.total_overheads, prev.total_overheads);

  return (
    <section className="kpi-grid-modern" aria-label="Key Performance Indicators">
      {/* Card 1: Gross Sales Revenue */}
      <div
        className="kpi-card-v2 tone-ok"
        onClick={() => jumpToReport("sales", { status: "completed" })}
        role="button"
        tabIndex={0}
        title="Click to inspect Completed Sales & Receipts"
      >
        <div className="kpi-head">
          <span className="kpi-title">Gross Sales Revenue</span>
          <span className="kpi-icon-box tone-ok"><TrendingUp size={17} /></span>
        </div>
        <div className="kpi-val">{peso(fin.revenue)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={revCompare.delta >= 0 ? "ok" : "bad"}
            label={`${revCompare.delta >= 0 ? "+" : ""}${revCompare.pct.toFixed(1)}% (${revCompare.delta >= 0 ? "+" : ""}${pesoShort(revCompare.delta)})`}
          />
          <span className="kpi-sub">vs prev period</span>
        </div>
        <div className="kpi-foot">
          <span><b>{fin.orders || 0}</b> completed receipts • Avg <b>{peso(fin.avg_ticket)}</b></span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 2: Net Operating Profit */}
      <div
        className={`kpi-card-v2 ${Number(fin.net_profit || 0) >= 0 ? "tone-ok" : "tone-bad"}`}
        onClick={() => jumpToReport("overview")}
        role="button"
        tabIndex={0}
        title="Click to view full P&L Breakdown"
      >
        <div className="kpi-head">
          <span className="kpi-title">Net Operating Profit</span>
          <span className={`kpi-icon-box ${Number(fin.net_profit || 0) >= 0 ? "tone-ok" : "tone-bad"}`}>
            <ShieldCheck size={17} />
          </span>
        </div>
        <div
          className="kpi-val"
          style={{ color: Number(fin.net_profit || 0) >= 0 ? "var(--ok)" : "var(--bad)" }}
        >
          {peso(fin.net_profit)}
        </div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={netCompare.delta >= 0 ? "ok" : "bad"}
            label={`${netCompare.delta >= 0 ? "+" : ""}${netCompare.pct.toFixed(1)}% (${netCompare.delta >= 0 ? "+" : ""}${pesoShort(netCompare.delta)})`}
          />
          <span className="kpi-sub">Net Margin {Number(fin.net_margin_pct || 0).toFixed(1)}%</span>
        </div>
        <div className="kpi-foot">
          <span>After COGS, Expenses, Salaries & Commissions</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 3: Gross Profit & COGS */}
      <div
        className="kpi-card-v2 tone-info"
        onClick={() => jumpToReport("products")}
        role="button"
        tabIndex={0}
        title="Click to inspect Product Profitability & Margins"
      >
        <div className="kpi-head">
          <span className="kpi-title">Gross Profit (Sales − COGS)</span>
          <span className="kpi-icon-box tone-info"><BarChart3 size={17} /></span>
        </div>
        <div className="kpi-val">{peso(fin.gross_profit)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={grossCompare.delta >= 0 ? "ok" : "bad"}
            label={`${grossCompare.delta >= 0 ? "+" : ""}${grossCompare.pct.toFixed(1)}%`}
          />
          <span className="kpi-sub">Gross Margin {Number(fin.gross_margin_pct || 0).toFixed(1)}%</span>
        </div>
        <div className="kpi-foot">
          <span>COGS: <b>{peso(fin.cogs)}</b></span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 4: Total Overheads */}
      <div
        className="kpi-card-v2 tone-warn"
        onClick={() => jumpToReport("expenses")}
        role="button"
        tabIndex={0}
        title="Click to manage Expenses, Payroll, and Commissions"
      >
        <div className="kpi-head">
          <span className="kpi-title">Total Operating Overheads</span>
          <span className="kpi-icon-box tone-warn"><Wallet size={17} /></span>
        </div>
        <div className="kpi-val">{peso(fin.total_overheads)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={overheadCompare.delta <= 0 ? "ok" : "warn"}
            label={`${overheadCompare.delta >= 0 ? "+" : ""}${overheadCompare.pct.toFixed(1)}% vs prev`}
          />
          <span className="kpi-sub">
            Exp {pesoShort(fin.expenses)} • Pay {pesoShort((fin.salaries || 0) + (fin.commissions || 0) + (fin.ld_commissions || 0))}
          </span>
        </div>
        <div className="kpi-foot">
          <span>Sal {pesoShort(fin.salaries)} • Comm {pesoShort(fin.commissions)} • LD {pesoShort(fin.ld_commissions)}</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 5: Today's Live Performance */}
      <div
        className="kpi-card-v2 tone-info"
        onClick={() => {
          const td = activeBusinessDate || ymd();
          handleApplyDateRange(td, td);
          jumpToReport("sales");
        }}
        role="button"
        tabIndex={0}
        title="Click to filter dashboard to Active Business Date"
      >
        <div className="kpi-head">
          <span className="kpi-title">Today ({todayStats.business_date || activeBusinessDate})</span>
          <span className="kpi-icon-box tone-info"><Sparkles size={17} /></span>
        </div>
        <div className="kpi-val">{peso(todayStats.revenue)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={Number(todayStats.net_profit || 0) >= 0 ? "ok" : "bad"}
            label={`Net Today: ${peso(todayStats.net_profit)}`}
          />
          <span className="kpi-sub">{todayStats.orders || 0} orders</span>
        </div>
        <div className="kpi-foot">
          <span><b>{todayStats.records_created || 0}</b> records created today</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 6: Month-to-Date (MTD) Performance */}
      <div
        className="kpi-card-v2 tone-purple"
        onClick={() => {
          handleApplyDateRange(monthStart(), ymd());
          jumpToReport("overview");
        }}
        role="button"
        tabIndex={0}
        title="Click to set filter to Month-to-Date"
      >
        <div className="kpi-head">
          <span className="kpi-title">Month-to-Date (MTD)</span>
          <span className="kpi-icon-box tone-purple"><Calendar size={17} /></span>
        </div>
        <div className="kpi-val">{peso(mtdStats.revenue)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={Number(mtdStats.net_profit || 0) >= 0 ? "ok" : "bad"}
            label={`MTD Net: ${pesoShort(mtdStats.net_profit)}`}
          />
          <span className="kpi-sub">{mtdStats.orders || 0} orders</span>
        </div>
        <div className="kpi-foot">
          <span>Overheads MTD: <b>{peso(mtdStats.total_overheads)}</b></span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 7: Inventory Valuation & Stock Alerts */}
      <div
        className={`kpi-card-v2 ${
          Number(counts.out_of_stock_count || 0) > 0
            ? "tone-bad"
            : Number(counts.low_stock_count || 0) > 0
            ? "tone-warn"
            : "tone-ok"
        }`}
        onClick={() =>
          jumpToReport("products", {
            status:
              Number(counts.out_of_stock_count || 0) > 0
                ? "out"
                : Number(counts.low_stock_count || 0) > 0
                ? "low"
                : "all",
          })
        }
        role="button"
        tabIndex={0}
        title="Click to inspect Inventory Stock Health & Restock"
      >
        <div className="kpi-head">
          <span className="kpi-title">Inventory & Stock Health</span>
          <span className="kpi-icon-box tone-info"><Boxes size={17} /></span>
        </div>
        <div className="kpi-val">{peso(fin.stock_retail_value)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={
              Number(counts.out_of_stock_count || 0) > 0
                ? "bad"
                : Number(counts.low_stock_count || 0) > 0
                ? "warn"
                : "ok"
            }
            label={`${counts.out_of_stock_count || 0} Out • ${counts.low_stock_count || 0} Low • ${counts.healthy_stock_count || 0} OK`}
          />
        </div>
        <div className="kpi-foot">
          <span>Cost Value: <b>{peso(fin.stock_cost_value)}</b> ({counts.active_products || 0} SKUs)</span>
          <ExternalLink size={12} />
        </div>
      </div>

      {/* Card 8: Void / Leakage & Active Staff */}
      <div
        className={`kpi-card-v2 ${Number(fin.void_count || 0) > 0 ? "tone-warn" : "tone-neutral"}`}
        onClick={() => jumpToReport("sales", { status: "voided" })}
        role="button"
        tabIndex={0}
        title="Click to audit Voided Receipts & Reasons"
      >
        <div className="kpi-head">
          <span className="kpi-title">Void Audit & System Records</span>
          <span className="kpi-icon-box tone-warn"><AlertTriangle size={17} /></span>
        </div>
        <div className="kpi-val">{peso(fin.void_total)}</div>
        <div className="kpi-compare-row">
          <StatusBadge
            tone={Number(fin.void_count || 0) > 0 ? "warn" : "ok"}
            label={`${fin.void_count || 0} voided receipts`}
          />
          <span className="kpi-sub">{counts.active_employees || 0} staff • {counts.total_records || 0} total DB records</span>
        </div>
        <div className="kpi-foot">
          <span>Click to inspect voided transactions</span>
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
            <AlertTriangle size={16} color="var(--warn)" /> Important Alerts & Action Required
          </h3>
          <StatusBadge
            tone={(data.alerts || []).length > 0 ? "warn" : "ok"}
            label={`${(data.alerts || []).length} active`}
          />
        </div>

        {(data.alerts || []).length === 0 ? (
          <div className="empty-compact">
            <CheckCircle2 size={20} color="var(--ok)" />
            <span>All systems nominal. Stock levels, shift reconciliations, and margins are healthy.</span>
          </div>
        ) : (
          <div className="alerts-list">
            {data.alerts.map((a) => (
              <div
                key={a.id}
                className={`alert-card-row tone-${a.severity || "info"}`}
                onClick={() => {
                  if (a.target === "shift") openSod();
                  else jumpToReport(a.target || "overview", { status: a.filter || "all" });
                }}
                role="button"
                tabIndex={0}
              >
                <div className="alert-card-body">
                  <div className="alert-card-title">
                    <StatusBadge
                      tone={a.severity === "bad" ? "bad" : a.severity === "warn" ? "warn" : "info"}
                      label={a.severity === "bad" ? "CRITICAL" : a.severity === "warn" ? "WARNING" : "NOTICE"}
                    />
                    <b>{a.title}</b>
                  </div>
                  <p className="muted">{a.message}</p>
                </div>
                <ExternalLink size={14} className="muted" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Recent Activity Stream */}
      <div className="card">
        <div className="section-title-row">
          <h3>
            <Activity size={16} color="var(--info)" /> Recent System Activity
          </h3>
          <button
            type="button"
            className="link-btn"
            onClick={() => jumpToReport("audit")}
          >
            View Full Audit Trail →
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <Empty text="No recent activity recorded in this period." />
        ) : (
          <div className="recent-activity-feed">
            {auditLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="activity-feed-item"
                onClick={() => onInspectAudit(log)}
                role="button"
                tabIndex={0}
              >
                <StatusBadge
                  tone={
                    log.action === "VOID" || log.action === "DELETE"
                      ? "bad"
                      : log.action === "CREATE" || log.action === "SALE" || log.action === "RESTOCK"
                      ? "ok"
                      : "info"
                  }
                  label={log.action}
                />
                <div className="activity-feed-text">
                  <b>{log.summary}</b>
                  <small className="muted">
                    {log.timestamp} • by {log.actor} ({log.role})
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
