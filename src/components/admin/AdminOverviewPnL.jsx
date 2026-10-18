import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { peso, pctChange } from "../../utils";
import { Empty, StatusBadge } from "../ui";

/**
 * Reusable Table Pagination Control
 */
export function TablePagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIdx = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, page * pageSize);

  return (
    <div className="table-pagination-bar no-print">
      <div className="pagination-summary">
        Showing <b>{startIdx}</b>–<b>{endIdx}</b> of <b>{totalItems}</b> records
      </div>

      <div className="pagination-controls">
        <label className="page-size-select">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        <div className="page-buttons">
          <button
            type="button"
            className="btn ghost sm"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            title="Previous Page"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="page-indicator">
            Page <b>{page}</b> of <b>{totalPages}</b>
          </span>
          <button
            type="button"
            className="btn ghost sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            title="Next Page"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tab 1: Executive Overview, Comprehensive Profit & Loss (P&L) Statement,
 * Period-over-Period Comparison, and Daily Financial Ledger.
 */
export function AdminOverviewPnL({
  data,
  from,
  to,
  jumpToReport,
  onApplyDateRange,
}) {
  if (!data) return null;

  const fin = data.financials || {};
  const prev = data.previous_period || {};

  const revCompare = pctChange(fin.revenue, prev.revenue);
  const netCompare = pctChange(fin.net_profit, prev.net_profit);
  const grossCompare = pctChange(fin.gross_profit, prev.gross_profit);
  const ordersCompare = pctChange(fin.orders, prev.orders);

  return (
    <div className="overview-report-pane">
      <div className="pnl-grid">
        {/* Formal Income Statement Card */}
        <div className="pnl-statement-box">
          <h3>
            Comprehensive Profit & Loss (P&L) Statement ({from} → {to})
          </h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            Click any line item to drill down into the underlying source records.
          </p>

          <div className="pnl-table">
            <div
              className="pnl-row clickable"
              onClick={() => jumpToReport("sales", { status: "completed" })}
            >
              <span>Gross Sales Revenue ({fin.orders || 0} completed orders)</span>
              <b className="text-ok">{peso(fin.revenue)}</b>
            </div>
            <div
              className="pnl-row clickable sub"
              onClick={() => jumpToReport("sales", { status: "voided" })}
            >
              <span>
                Memo: Voided Receipts ({fin.void_count || 0} voided, excluded from revenue)
              </span>
              <span className="muted">{peso(fin.void_total)}</span>
            </div>
            <div
              className="pnl-row clickable"
              onClick={() => jumpToReport("products")}
            >
              <span>Less: Cost of Goods Sold (COGS)</span>
              <b className="text-bad">−{peso(fin.cogs)}</b>
            </div>
            <div className="pnl-row highlight">
              <b>Gross Profit ({Number(fin.gross_margin_pct || 0).toFixed(1)}% margin)</b>
              <b className="text-info">{peso(fin.gross_profit)}</b>
            </div>

            <div className="pnl-section-label">Operating Overheads & Payroll</div>
            <div
              className="pnl-row clickable"
              onClick={() => jumpToReport("expenses")}
            >
              <span>
                Store Operating Expenses ({(data.expenses_list || []).length} records)
              </span>
              <b className="text-bad">−{peso(fin.expenses)}</b>
            </div>
            <div
              className="pnl-row clickable"
              onClick={() => jumpToReport("salaries")}
            >
              <span>
                Staff Salaries Payroll ({(data.salaries_list || []).length} records)
              </span>
              <b className="text-bad">−{peso(fin.salaries)}</b>
            </div>
            <div
              className="pnl-row clickable"
              onClick={() => jumpToReport("commissions")}
            >
              <span>
                Regular Staff Commissions ({(data.commissions_list || []).length} records)
              </span>
              <b className="text-bad">−{peso(fin.commissions)}</b>
            </div>
            <div
              className="pnl-row clickable"
              onClick={() => jumpToReport("ld-commissions")}
            >
              <span>
                Ladies Drink (LD) Commissions ({(data.ld_commissions_list || []).length} records)
              </span>
              <b className="text-bad">−{peso(fin.ld_commissions)}</b>
            </div>
            <div className="pnl-row sub">
              <b>Total Operating Overheads</b>
              <b className="text-bad">−{peso(fin.total_overheads)}</b>
            </div>

            <div
              className={`pnl-row total ${
                Number(fin.net_profit || 0) >= 0 ? "positive" : "negative"
              }`}
            >
              <div>
                <b>Net Operating Income / Profit</b>
                <div style={{ fontSize: 11, fontWeight: 400 }} className="muted">
                  Net Profit Margin: {Number(fin.net_margin_pct || 0).toFixed(2)}%
                </div>
              </div>
              <b>{peso(fin.net_profit)}</b>
            </div>
          </div>
        </div>

        {/* Period-over-Period Comparison Table */}
        <div className="pnl-statement-box">
          <h3>Period-over-Period Comparison</h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            Current ({from} → {to}) vs. Previous ({prev.from} → {prev.to})
          </p>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="num">Current</th>
                  <th className="num">Previous</th>
                  <th className="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Gross Sales",
                    cur: fin.revenue,
                    prv: prev.revenue,
                    cmp: revCompare,
                    money: true,
                  },
                  {
                    label: "Completed Orders",
                    cur: fin.orders,
                    prv: prev.orders,
                    cmp: ordersCompare,
                    money: false,
                  },
                  {
                    label: "Gross Profit",
                    cur: fin.gross_profit,
                    prv: prev.gross_profit,
                    cmp: grossCompare,
                    money: true,
                  },
                  {
                    label: "Store Expenses",
                    cur: fin.expenses,
                    prv: prev.expenses,
                    cmp: pctChange(fin.expenses, prev.expenses),
                    money: true,
                    invertTone: true,
                  },
                  {
                    label: "Staff Salaries",
                    cur: fin.salaries,
                    prv: prev.salaries,
                    cmp: pctChange(fin.salaries, prev.salaries),
                    money: true,
                    invertTone: true,
                  },
                  {
                    label: "Regular Commissions",
                    cur: fin.commissions,
                    prv: prev.commissions,
                    cmp: pctChange(fin.commissions, prev.commissions),
                    money: true,
                    invertTone: true,
                  },
                  {
                    label: "LD Commissions",
                    cur: fin.ld_commissions,
                    prv: prev.ld_commissions,
                    cmp: pctChange(fin.ld_commissions, prev.ld_commissions),
                    money: true,
                    invertTone: true,
                  },
                  {
                    label: "Net Operating Profit",
                    cur: fin.net_profit,
                    prv: prev.net_profit,
                    cmp: netCompare,
                    money: true,
                  },
                ].map((row, idx) => {
                  const isGood = row.invertTone ? row.cmp.delta <= 0 : row.cmp.delta >= 0;
                  return (
                    <tr key={idx}>
                      <td>
                        <b>{row.label}</b>
                      </td>
                      <td className="num">
                        {row.money ? peso(row.cur) : Number(row.cur || 0).toLocaleString()}
                      </td>
                      <td className="num muted">
                        {row.money ? peso(row.prv) : Number(row.prv || 0).toLocaleString()}
                      </td>
                      <td className="num">
                        <StatusBadge
                          tone={
                            Math.abs(row.cmp.delta) < 0.01 ? "neutral" : isGood ? "ok" : "bad"
                          }
                          label={`${row.cmp.delta >= 0 ? "+" : ""}${row.cmp.pct.toFixed(1)}%`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Daily Financial Breakdown Table */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 10 }}>
          Daily Financial Ledger ({(data.daily || []).length} days)
        </h3>
        {(data.daily || []).length === 0 ? (
          <Empty text="No daily ledger activity for the selected period." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Orders</th>
                  <th className="num">Gross Sales</th>
                  <th className="num">COGS</th>
                  <th className="num">Gross Profit</th>
                  <th className="num">Expenses</th>
                  <th className="num">Salaries</th>
                  <th className="num">Commissions</th>
                  <th className="num">LD Comm</th>
                  <th className="num">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {[...(data.daily || [])].reverse().map((d) => {
                  const orders = Number(d.orders ?? d.count ?? 0);
                  const sales = Number(d.revenue ?? d.sales ?? d.total ?? 0);
                  const cogs = Number(d.cogs || 0);
                  const gross = Number(d.gross_profit ?? (sales - cogs));
                  const exp = Number(d.expenses || 0);
                  const sal = Number(d.salaries || 0);
                  const com = Number(d.commissions || 0);
                  const ld = Number(d.ld_commissions || 0);
                  const net = Number(d.net_profit ?? d.net ?? (gross - (exp + sal + com + ld)));
                  return (
                    <tr
                      key={d.day || d.date}
                      className="clickable-row"
                      onClick={() => {
                        onApplyDateRange(d.day || d.date, d.day || d.date);
                        jumpToReport("sales");
                      }}
                      title={`Click to filter dashboard to ${d.day || d.date}`}
                    >
                      <td>
                        <b>{d.day || d.date}</b>
                      </td>
                      <td className="num">{orders}</td>
                      <td className="num">{peso(sales)}</td>
                      <td className="num muted">{peso(cogs)}</td>
                      <td className="num">{peso(gross)}</td>
                      <td className="num">{peso(exp)}</td>
                      <td className="num">{peso(sal)}</td>
                      <td className="num">{peso(com)}</td>
                      <td className="num">{peso(ld)}</td>
                      <td className="num">
                        <b
                          style={{
                            color: net >= 0 ? "var(--ok)" : "var(--bad)",
                          }}
                        >
                          {peso(net)}
                        </b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                  <td>Totals for Period</td>
                  <td className="num">
                    {(data.daily || []).reduce((acc, d) => acc + Number(d.orders ?? d.count ?? 0), 0)}
                  </td>
                  <td className="num text-ok">
                    {peso((data.daily || []).reduce((acc, d) => acc + Number(d.revenue ?? d.sales ?? d.total ?? 0), 0))}
                  </td>
                  <td className="num muted">
                    {peso((data.daily || []).reduce((acc, d) => acc + Number(d.cogs || 0), 0))}
                  </td>
                  <td className="num text-info">
                    {peso((data.daily || []).reduce((acc, d) => acc + Number(d.gross_profit ?? ((d.revenue ?? d.sales ?? 0) - (d.cogs || 0))), 0))}
                  </td>
                  <td className="num text-bad">
                    {peso((data.daily || []).reduce((acc, d) => acc + Number(d.expenses || 0), 0))}
                  </td>
                  <td className="num text-bad">
                    {peso((data.daily || []).reduce((acc, d) => acc + Number(d.salaries || 0), 0))}
                  </td>
                  <td className="num text-bad">
                    {peso((data.daily || []).reduce((acc, d) => acc + Number(d.commissions || 0), 0))}
                  </td>
                  <td className="num text-bad">
                    {peso((data.daily || []).reduce((acc, d) => acc + Number(d.ld_commissions || 0), 0))}
                  </td>
                  <td className="num">
                    {(() => {
                      const netTot = (data.daily || []).reduce((acc, d) => acc + Number(d.net_profit ?? d.net ?? 0), 0);
                      return (
                        <b style={{ color: netTot >= 0 ? "var(--ok)" : "var(--bad)", fontSize: 14 }}>
                          {peso(netTot)}
                        </b>
                      );
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
