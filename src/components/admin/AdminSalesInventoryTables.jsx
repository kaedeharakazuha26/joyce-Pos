import React, { useState } from "react";
import {
  Eye,
  Printer,
  XCircle,
  Boxes,
  Edit3,
  Trash2,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { api } from "../../api";
import { peso, ymd, errText } from "../../utils";
import { Empty, StatusBadge } from "../ui";
import { TablePagination } from "./AdminOverviewPnL";

/**
 * Report Tabs 2–5:
 * - Sales & Transactions (`sales`)
 * - Products & Stock CRUD (`products`)
 * - Store Expenses CRUD (`expenses`)
 * - Staff Salaries CRUD (`salaries`)
 */
export function AdminSalesInventoryTables({
  reportTab,
  page,
  pageSize,
  setPage,
  setPageSize,
  sortRows,
  toggleSort,
  renderSortIcon,
  selectedIds,
  toggleSelectOne,
  toggleSelectAll,
  filteredSales,
  filteredProducts,
  filteredExpenses,
  filteredSalaries,
  employeesList,
  activeBusinessDate,
  setViewingSale,
  setVoidingSale,
  setVoidReason,
  setEditingProduct,
  setRestockModal,
  setEditingExpense,
  setEditingSalary,
  setConfirmAction,
  from,
  to,
  loadAll,
  toast,
}) {
  const [expandedVariants, setExpandedVariants] = useState({});

  if (reportTab === "sales") {
    const sorted = sortRows(filteredSales);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div>
        {sorted.length === 0 ? (
          <Empty text="No sales receipts match your current filter criteria." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("receipt_no")} className="sortable">
                      Receipt No {renderSortIcon("receipt_no")}
                    </th>
                    <th onClick={() => toggleSort("created_at")} className="sortable">
                      Shift Date & Time {renderSortIcon("created_at")}
                    </th>
                    <th>Items Purchased</th>
                    <th onClick={() => toggleSort("total")} className="sortable num">
                      Total {renderSortIcon("total")}
                    </th>
                    <th className="num">Cash Paid</th>
                    <th className="num">Change</th>
                    <th onClick={() => toggleSort("status")} className="sortable">
                      Status {renderSortIcon("status")}
                    </th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((s) => (
                    <tr key={s.id} className={s.status === "voided" ? "row-voided" : ""}>
                      <td><b>{s.receipt_no}</b></td>
                      <td>
                        <b>{s.business_date || s.created_at?.slice(0, 10)}</b>{" "}
                        <small className="muted">{s.created_at?.slice(11, 16)}</small>
                      </td>
                      <td className="items-cell">
                        {(s.items || [])
                          .map((i) => `${i.quantity}× ${i.name}${i.variant_name ? ` (${i.variant_name})` : ""}`)
                          .join(", ")}
                      </td>
                      <td className="num"><b>{peso(s.total)}</b></td>
                      <td className="num">{peso(s.paid)}</td>
                      <td className="num">{peso(s.change_amt)}</td>
                      <td>
                        <StatusBadge
                          tone={s.status === "voided" ? "bad" : "ok"}
                          label={s.status === "voided" ? "VOIDED" : "COMPLETED"}
                        />
                      </td>
                      <td className="actions-col no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="View & Print Receipt"
                            onClick={() => setViewingSale(s)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Print Thermal Receipt"
                            onClick={() =>
                              api
                                .printReceipt(s.id)
                                .then(() => toast("Sent to thermal printer"))
                                .catch((e) => toast(errText(e), "bad"))
                            }
                          >
                            <Printer size={15} />
                          </button>
                          {s.status !== "voided" && (
                            <button
                              type="button"
                              className="icon-btn sm danger"
                              title="Void Receipt & Restore Inventory"
                              onClick={() => {
                                setVoidingSale(s);
                                setVoidReason("");
                              }}
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={sorted.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    );
  }

  if (reportTab === "products") {
    const sorted = sortRows(filteredProducts);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div>
        {sorted.length === 0 ? (
          <Empty
            text="No products match your filter criteria."
            actionLabel="+ Add New Product"
            onAction={() =>
              setEditingProduct({
                name: "",
                category: "General",
                price: 0,
                cost: 0,
                stock: 0,
                low_stock: 5,
                image: "",
                variants: [],
              })
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="checkbox-col no-print">
                      <input
                        type="checkbox"
                        checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                        onChange={() => toggleSelectAll(paged)}
                        aria-label="Select all products on page"
                      />
                    </th>
                    <th onClick={() => toggleSort("name")} className="sortable">
                      Product {renderSortIcon("name")}
                    </th>
                    <th onClick={() => toggleSort("category")} className="sortable">
                      Category {renderSortIcon("category")}
                    </th>
                    <th onClick={() => toggleSort("price")} className="sortable num">
                      Price {renderSortIcon("price")}
                    </th>
                    <th onClick={() => toggleSort("cost")} className="sortable num">
                      Unit Cost {renderSortIcon("cost")}
                    </th>
                    <th onClick={() => toggleSort("margin_pct")} className="sortable num">
                      Margin {renderSortIcon("margin_pct")}
                    </th>
                    <th onClick={() => toggleSort("stock")} className="sortable num">
                      Stock {renderSortIcon("stock")}
                    </th>
                    <th>Health</th>
                    <th onClick={() => toggleSort("sold_qty")} className="sortable num">
                      Sold (Period) {renderSortIcon("sold_qty")}
                    </th>
                    <th onClick={() => toggleSort("period_revenue")} className="sortable num">
                      Revenue (Period) {renderSortIcon("period_revenue")}
                    </th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => (
                    <React.Fragment key={p.id}>
                      <tr>
                      <td className="checkbox-col no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelectOne(p.id)}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {p.image ? (
                            <img
                              src={p.image}
                              alt=""
                              style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
                            />
                          ) : (
                            <div className="prod-avatar-mini">{p.name?.slice(0, 2).toUpperCase()}</div>
                          )}
                          <div>
                            <b>{p.name}</b>
                            {p.variants?.length > 0 && (
                              <button
                                type="button"
                                className="btn ghost sm"
                                style={{
                                  fontSize: 11,
                                  padding: "2px 6px",
                                  height: "auto",
                                  marginTop: 4,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                onClick={() =>
                                  setExpandedVariants((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                                }
                                title="View variants and sales breakdown"
                              >
                                <ChevronDown
                                  size={12}
                                  style={{
                                    transform: expandedVariants[p.id] ? "rotate(180deg)" : "none",
                                    transition: "transform 0.2s",
                                  }}
                                />
                                <span>{p.variants.length} variant(s)</span>
                                {p.has_variant_sales && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: "rgba(47,207,138,0.2)",
                                      color: "var(--ok)",
                                      fontSize: 10,
                                      padding: "1px 4px",
                                      marginLeft: 2,
                                    }}
                                  >
                                    {p.variant_sales.length} with sales
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge tone="neutral" label={p.category || "General"} /></td>
                      <td className="num"><b>{peso(p.price)}</b></td>
                      <td className="num muted">{peso(p.cost)}</td>
                      <td className="num">
                        <span style={{ color: p.margin_pct >= 25 ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>
                          {Number(p.margin_pct || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="num"><b>{p.stock}</b></td>
                      <td>
                        <StatusBadge
                          tone={p.stock_status === "out" ? "bad" : p.stock_status === "low" ? "warn" : "ok"}
                          label={
                            p.stock_status === "out"
                              ? "OUT OF STOCK"
                              : p.stock_status === "low"
                              ? "LOW STOCK"
                              : "HEALTHY"
                          }
                        />
                      </td>
                      <td className="num">{p.sold_qty}</td>
                      <td className="num"><b>{peso(p.period_revenue)}</b></td>
                      <td className="actions-col no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Quick Restock Inventory"
                            onClick={() =>
                              setRestockModal({
                                product: p,
                                qty: 10,
                                unitCost: p.cost || 0,
                                note: "",
                              })
                            }
                          >
                            <Boxes size={15} color="var(--ok)" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Edit Product Details"
                            onClick={() =>
                              setEditingProduct({
                                ...p,
                                variants: p.variants ? [...p.variants] : [],
                              })
                            }
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            title="Archive Product"
                            onClick={() =>
                              setConfirmAction({
                                title: "Archive Product",
                                message: `Archive "${p.name}" from the active catalog?`,
                                detail: "Past sales receipts referencing this product will remain intact.",
                                confirmLabel: "Archive Product",
                                onConfirm: async () => {
                                  try {
                                    await api.deleteProduct(p.id);
                                    toast(`Archived "${p.name}"`);
                                    setConfirmAction(null);
                                    loadAll(from, to, true);
                                  } catch (e) {
                                    toast(errText(e), "bad");
                                  }
                                },
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedVariants[p.id] && (
                      <tr key={`${p.id}-variants`} style={{ background: "rgba(255,255,255,0.02)" }}>
                        <td colSpan={11} style={{ padding: "8px 16px 12px 48px" }}>
                          <div style={{ background: "var(--bg-soft, #1e222d)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <b style={{ fontSize: "0.85rem", color: "var(--text)" }}>Variant Sales & Packaging for "{p.name}"</b>
                              <span className="muted" style={{ fontSize: "0.78rem" }}>Period: {from} to {to}</span>
                            </div>
                            <table style={{ width: "100%", fontSize: "0.82rem" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                                  <th style={{ textAlign: "left", padding: "4px 8px" }}>Variant Name</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px" }}>Units Per Pack</th>
                                  <th className="num" style={{ padding: "4px 8px" }}>List Price</th>
                                  <th className="num" style={{ padding: "4px 8px" }}>Quantity Sold</th>
                                  <th className="num" style={{ padding: "4px 8px" }}>Units Equivalent Sold</th>
                                  <th className="num" style={{ padding: "4px 8px" }}>Total Amount Sold</th>
                                  <th style={{ textAlign: "center", padding: "4px 8px" }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(p.variants || []).map((v) => {
                                  const vs = (p.variant_sales || []).find(
                                    (s) => s.variant_id === v.id || s.variant_name?.toLowerCase() === v.name?.toLowerCase()
                                  );
                                  const vQty = vs ? Number(vs.qty_sold || 0) : 0;
                                  const vUnits = vs ? Number(vs.units_sold || 0) : 0;
                                  const vRev = vs ? Number(vs.revenue || 0) : 0;
                                  return (
                                    <tr key={v.id || v.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                      <td style={{ padding: "6px 8px" }}><b>{v.name}</b></td>
                                      <td style={{ padding: "6px 8px" }}>{v.qty || 1} item(s)</td>
                                      <td className="num" style={{ padding: "6px 8px" }}>{peso(v.price)}</td>
                                      <td className="num" style={{ padding: "6px 8px" }}><b>{vQty}</b></td>
                                      <td className="num" style={{ padding: "6px 8px" }}>{vUnits}</td>
                                      <td className="num" style={{ padding: "6px 8px" }}>
                                        <b style={{ color: vRev > 0 ? "var(--ok)" : "var(--muted)" }}>{peso(vRev)}</b>
                                      </td>
                                      <td style={{ textAlign: "center", padding: "6px 8px" }}>
                                        {vQty > 0 ? (
                                          <span className="badge" style={{ background: "rgba(47,207,138,0.18)", color: "var(--ok)", fontSize: 10 }}>
                                            Active Sales
                                          </span>
                                        ) : (
                                          <span className="badge tone-neutral" style={{ fontSize: 10 }}>0 Sold</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={sorted.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    );
  }

  if (reportTab === "inventory-report") {
    const sorted = sortRows(filteredProducts);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    const totalItemsCount = sorted.length;
    const totalUnitsSold = sorted.reduce((s, p) => s + Number(p.sold_qty || 0), 0);
    const totalRevenue = sorted.reduce((s, p) => s + Number(p.period_revenue || 0), 0);
    const totalCostValue = sorted.reduce((s, p) => s + Number(p.stock_value || 0), 0);
    const totalRetailValue = sorted.reduce((s, p) => s + Number(p.retail_value || 0), 0);

    return (
      <div>
        {/* Inventory Report Key Stats Strip */}
        <div className="table-summary-strip" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <span>Active Products: <b>{totalItemsCount}</b></span>
            <span>Total Units Sold: <b style={{ color: "var(--accent, #ff7a3d)" }}>{totalUnitsSold.toLocaleString()}</b></span>
            <span>Total Amount Sold: <b style={{ color: "var(--ok, #2fcf8a)" }}>{peso(totalRevenue)}</b></span>
            <span>Stock Valuation (Cost): <b>{peso(totalCostValue)}</b></span>
            <span>Stock Valuation (Retail): <b>{peso(totalRetailValue)}</b></span>
          </div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Period: {from} to {to}
          </div>
        </div>

        {sorted.length === 0 ? (
          <Empty text="No inventory stock or sales records match your filter criteria." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("name")} className="sortable">
                      Item / Product {renderSortIcon("name")}
                    </th>
                    <th onClick={() => toggleSort("category")} className="sortable">
                      Category {renderSortIcon("category")}
                    </th>
                    <th onClick={() => toggleSort("stock")} className="sortable num">
                      Current Stock {renderSortIcon("stock")}
                    </th>
                    <th>Health</th>
                    <th onClick={() => toggleSort("cost")} className="sortable num">
                      Cost {renderSortIcon("cost")}
                    </th>
                    <th onClick={() => toggleSort("price")} className="sortable num">
                      Price {renderSortIcon("price")}
                    </th>
                    <th onClick={() => toggleSort("sold_qty")} className="sortable num" style={{ background: "rgba(255,122,61,0.06)" }}>
                      Units Sold (Qty) {renderSortIcon("sold_qty")}
                    </th>
                    <th onClick={() => toggleSort("period_revenue")} className="sortable num" style={{ background: "rgba(47,207,138,0.06)" }}>
                      Total Amount Sold {renderSortIcon("period_revenue")}
                    </th>
                    <th onClick={() => toggleSort("period_profit")} className="sortable num">
                      Gross Profit {renderSortIcon("period_profit")}
                    </th>
                    <th onClick={() => toggleSort("margin_pct")} className="sortable num">
                      Margin {renderSortIcon("margin_pct")}
                    </th>
                    <th className="actions-col no-print">Restock</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => (
                    <React.Fragment key={p.id}>
                      <tr>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {p.image ? (
                              <img
                                src={p.image}
                                alt=""
                                style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
                              />
                            ) : (
                              <div className="prod-avatar-mini">{p.name?.slice(0, 2).toUpperCase()}</div>
                            )}
                            <div>
                              <b>{p.name}</b>
                              {p.barcode && (
                                <span className="muted" style={{ fontSize: 10, display: "block" }}>
                                  {p.barcode}
                                </span>
                              )}
                              {p.variants?.length > 0 && (
                                <button
                                  type="button"
                                  className="btn ghost sm"
                                  style={{
                                    fontSize: 10,
                                    padding: "1px 5px",
                                    height: "auto",
                                    marginTop: 2,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                  onClick={() =>
                                    setExpandedVariants((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                                  }
                                >
                                  <ChevronDown
                                    size={11}
                                    style={{
                                      transform: expandedVariants[p.id] ? "rotate(180deg)" : "none",
                                      transition: "transform 0.2s",
                                    }}
                                  />
                                  <span>{p.variants.length} variant(s)</span>
                                  {p.has_variant_sales && (
                                    <span
                                      className="badge"
                                      style={{
                                        background: "rgba(47,207,138,0.2)",
                                        color: "var(--ok)",
                                        fontSize: 9,
                                        padding: "0 4px",
                                      }}
                                    >
                                      {p.variant_sales.length} with sales
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td><StatusBadge tone="neutral" label={p.category || "General"} /></td>
                        <td className="num"><b>{p.stock}</b></td>
                        <td>
                          <StatusBadge
                            tone={p.stock_status === "out" ? "bad" : p.stock_status === "low" ? "warn" : "ok"}
                            label={
                              p.stock_status === "out"
                                ? "OUT OF STOCK"
                                : p.stock_status === "low"
                                ? "LOW STOCK"
                                : "HEALTHY"
                            }
                          />
                        </td>
                        <td className="num muted">{peso(p.cost)}</td>
                        <td className="num">{peso(p.price)}</td>
                        <td className="num" style={{ background: "rgba(255,122,61,0.06)", fontWeight: 700 }}>
                          <span style={{ color: p.sold_qty > 0 ? "var(--accent)" : "var(--muted)" }}>
                            {p.sold_qty}
                          </span>
                        </td>
                        <td className="num" style={{ background: "rgba(47,207,138,0.06)", fontWeight: 700 }}>
                          <span style={{ color: p.period_revenue > 0 ? "var(--ok)" : "var(--muted)", fontSize: "0.95rem" }}>
                            {peso(p.period_revenue)}
                          </span>
                        </td>
                        <td className="num">
                          <span style={{ color: p.period_profit >= 0 ? "var(--ok)" : "var(--bad)" }}>
                            {peso(p.period_profit)}
                          </span>
                        </td>
                        <td className="num">
                          <span style={{ color: p.margin_pct >= 25 ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>
                            {Number(p.margin_pct || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="actions-col no-print">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Quick Restock Inventory"
                            onClick={() =>
                              setRestockModal({
                                product: p,
                                qty: 10,
                                unitCost: p.cost || 0,
                                note: "",
                              })
                            }
                          >
                            <Boxes size={15} color="var(--ok)" />
                          </button>
                        </td>
                      </tr>
                      {expandedVariants[p.id] && (
                        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                          <td colSpan={11} style={{ padding: "8px 16px 12px 48px" }}>
                            <div style={{ background: "var(--bg-soft, #1e222d)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <b style={{ fontSize: "0.85rem", color: "var(--text)" }}>Variant Sales Breakdown for "{p.name}"</b>
                                <span className="muted" style={{ fontSize: "0.78rem" }}>Period: {from} to {to}</span>
                              </div>
                              <table style={{ width: "100%", fontSize: "0.82rem" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                                    <th style={{ textAlign: "left", padding: "4px 8px" }}>Variant Name</th>
                                    <th style={{ textAlign: "left", padding: "4px 8px" }}>Units Per Pack</th>
                                    <th className="num" style={{ padding: "4px 8px" }}>Price</th>
                                    <th className="num" style={{ padding: "4px 8px" }}>Quantity Sold</th>
                                    <th className="num" style={{ padding: "4px 8px" }}>Units Equivalent Sold</th>
                                    <th className="num" style={{ padding: "4px 8px" }}>Total Amount Sold</th>
                                    <th style={{ textAlign: "center", padding: "4px 8px" }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(p.variants || []).map((v) => {
                                    const vs = (p.variant_sales || []).find(
                                      (s) => s.variant_id === v.id || s.variant_name?.toLowerCase() === v.name?.toLowerCase()
                                    );
                                    const vQty = vs ? Number(vs.qty_sold || 0) : 0;
                                    const vUnits = vs ? Number(vs.units_sold || 0) : 0;
                                    const vRev = vs ? Number(vs.revenue || 0) : 0;
                                    return (
                                      <tr key={v.id || v.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                        <td style={{ padding: "6px 8px" }}><b>{v.name}</b></td>
                                        <td style={{ padding: "6px 8px" }}>{v.qty || 1} item(s)</td>
                                        <td className="num" style={{ padding: "6px 8px" }}>{peso(v.price)}</td>
                                        <td className="num" style={{ padding: "6px 8px" }}><b>{vQty}</b></td>
                                        <td className="num" style={{ padding: "6px 8px" }}>{vUnits}</td>
                                        <td className="num" style={{ padding: "6px 8px" }}>
                                          <b style={{ color: vRev > 0 ? "var(--ok)" : "var(--muted)" }}>{peso(vRev)}</b>
                                        </td>
                                        <td style={{ textAlign: "center", padding: "6px 8px" }}>
                                          {vQty > 0 ? (
                                            <span className="badge" style={{ background: "rgba(47,207,138,0.18)", color: "var(--ok)", fontSize: 10 }}>
                                              Active Sales
                                            </span>
                                          ) : (
                                            <span className="badge tone-neutral" style={{ fontSize: 10 }}>0 Sold</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={sorted.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    );
  }

  if (reportTab === "expenses") {
    const sorted = sortRows(filteredExpenses);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    const filteredTotal = sorted.reduce((s, e) => s + Number(e.amount || 0), 0);
    return (
      <div>
        <div className="table-summary-strip">
          <span>Showing <b>{sorted.length}</b> expense entries</span>
          <span>Filtered Total: <b className="text-bad">{peso(filteredTotal)}</b></span>
        </div>
        {sorted.length === 0 ? (
          <Empty
            text="No expense records found for the selected filter."
            actionLabel="+ Record Store Expense"
            onAction={() =>
              setEditingExpense({
                category: "Supplies",
                description: "",
                amount: "",
                incurred_on: activeBusinessDate || ymd(),
              })
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="checkbox-col no-print">
                      <input
                        type="checkbox"
                        checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                        onChange={() => toggleSelectAll(paged)}
                      />
                    </th>
                    <th onClick={() => toggleSort("incurred_on")} className="sortable">
                      Date {renderSortIcon("incurred_on")}
                    </th>
                    <th onClick={() => toggleSort("category")} className="sortable">
                      Category {renderSortIcon("category")}
                    </th>
                    <th onClick={() => toggleSort("description")} className="sortable">
                      Description / Payee {renderSortIcon("description")}
                    </th>
                    <th onClick={() => toggleSort("amount")} className="sortable num">
                      Amount {renderSortIcon("amount")}
                    </th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((e) => (
                    <tr key={e.id}>
                      <td className="checkbox-col no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(e.id)}
                          onChange={() => toggleSelectOne(e.id)}
                        />
                      </td>
                      <td><b>{e.incurred_on}</b></td>
                      <td><StatusBadge tone="warn" label={e.category} /></td>
                      <td>{e.description || <span className="muted">—</span>}</td>
                      <td className="num"><b>{peso(e.amount)}</b></td>
                      <td className="actions-col no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Edit Expense"
                            onClick={() => setEditingExpense({ ...e })}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            title="Delete Expense"
                            onClick={() =>
                              setConfirmAction({
                                title: "Delete Expense Record",
                                message: `Delete ${e.category} expense of ${peso(e.amount)} on ${e.incurred_on}?`,
                                detail: "This deletion will be logged in the Audit Trail.",
                                confirmLabel: "Delete Expense",
                                onConfirm: async () => {
                                  try {
                                    await api.deleteExpense(e.id);
                                    toast("Expense deleted");
                                    setConfirmAction(null);
                                    loadAll(from, to, true);
                                  } catch (err) {
                                    toast(errText(err), "bad");
                                  }
                                },
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={sorted.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    );
  }

  if (reportTab === "salaries") {
    const sorted = sortRows(filteredSalaries);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    const filteredTotal = sorted.reduce((s, r) => s + Number(r.amount || 0), 0);
    return (
      <div>
        <div className="table-summary-strip">
          <span>Showing <b>{sorted.length}</b> salary disbursements</span>
          <span>Filtered Total: <b className="text-info">{peso(filteredTotal)}</b></span>
        </div>
        {sorted.length === 0 ? (
          <Empty
            text="No salary records found for the selected filter."
            actionLabel="+ Record Salary Disbursement"
            onAction={() =>
              setEditingSalary({
                staff_name: employeesList[0]?.name || "",
                role: employeesList[0]?.role || "",
                amount: employeesList[0]?.daily_rate || "",
                note: "",
                paid_on: activeBusinessDate || ymd(),
              })
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="checkbox-col no-print">
                      <input
                        type="checkbox"
                        checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                        onChange={() => toggleSelectAll(paged)}
                      />
                    </th>
                    <th onClick={() => toggleSort("paid_on")} className="sortable">
                      Date Paid {renderSortIcon("paid_on")}
                    </th>
                    <th onClick={() => toggleSort("staff_name")} className="sortable">
                      Staff Member {renderSortIcon("staff_name")}
                    </th>
                    <th onClick={() => toggleSort("role")} className="sortable">
                      Role {renderSortIcon("role")}
                    </th>
                    <th>Notes</th>
                    <th onClick={() => toggleSort("amount")} className="sortable num">
                      Amount {renderSortIcon("amount")}
                    </th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((s) => (
                    <tr key={s.id}>
                      <td className="checkbox-col no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelectOne(s.id)}
                        />
                      </td>
                      <td><b>{s.paid_on}</b></td>
                      <td><b>{s.staff_name}</b></td>
                      <td><StatusBadge tone="info" label={s.role || "Staff"} /></td>
                      <td>{s.note || <span className="muted">—</span>}</td>
                      <td className="num"><b>{peso(s.amount)}</b></td>
                      <td className="actions-col no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Edit Salary Record"
                            onClick={() => setEditingSalary({ ...s })}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            title="Delete Salary Record"
                            onClick={() =>
                              setConfirmAction({
                                title: "Delete Salary Record",
                                message: `Delete salary payment of ${peso(s.amount)} for ${s.staff_name} (${s.paid_on})?`,
                                detail: "This deletion will be logged in the Audit Trail.",
                                confirmLabel: "Delete Salary",
                                onConfirm: async () => {
                                  try {
                                    await api.deleteSalary(s.id);
                                    toast("Salary record deleted");
                                    setConfirmAction(null);
                                    loadAll(from, to, true);
                                  } catch (err) {
                                    toast(errText(err), "bad");
                                  }
                                },
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              totalItems={sorted.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    );
  }

  return null;
}
