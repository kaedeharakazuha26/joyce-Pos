import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Receipt,
  Wallet,
  Coins,
  Smartphone,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Ban,
  Search,
  X,
  Lock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Users,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../api";
import { Modal, Field, StatusBadge, Empty, useToast, Receipt as ReceiptDoc } from "./ui";
import { peso, errText, ymd } from "../utils";

export function DashboardCrudModule({
  from,
  to,
  activeBusinessDate,
  currentUser,
  settings,
  onDataChanged,
  inventoryReport = [],
  variantSales = [],
}) {
  const toast = useToast();

  const disabledMenus = useMemo(() => {
    try {
      return settings?.disabled_menus ? JSON.parse(settings.disabled_menus) : [];
    } catch {
      return [];
    }
  }, [settings?.disabled_menus]);

  const showExpenses = !disabledMenus.includes("expenses");
  const showSalary = !disabledMenus.includes("salary") && !disabledMenus.includes("salaries");
  const showCommission = !disabledMenus.includes("commission") && !disabledMenus.includes("commissions");
  const showLdCommission = !disabledMenus.includes("ld-commission") && !disabledMenus.includes("ld_commission");
  const showInventory = !disabledMenus.includes("inventory");

  const [tab, setTab] = useState("sales"); // sales | inventory-report | expenses | salary | commission | ld-commission

  useEffect(() => {
    if (tab === "expenses" && !showExpenses) setTab("sales");
    else if (tab === "salary" && !showSalary) setTab("sales");
    else if (tab === "commission" && !showCommission) setTab("sales");
    else if (tab === "ld-commission" && !showLdCommission) setTab("sales");
    else if (tab === "inventory-report" && !showInventory) setTab("sales");
  }, [tab, showExpenses, showSalary, showCommission, showLdCommission, showInventory]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedInventory, setExpandedInventory] = useState({});

  // Tab data lists
  const [salesList, setSalesList] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [salariesList, setSalariesList] = useState([]);
  const [commissionsList, setCommissionsList] = useState([]);
  const [ldCommissionsList, setLdCommissionsList] = useState([]);

  // Auxiliary data
  const [employees, setEmployees] = useState([]);
  const [commissionTypes, setCommissionTypes] = useState([]);

  // Modals
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [voidingSale, setVoidingSale] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingSalary, setEditingSalary] = useState(null);
  const [editingCommission, setEditingCommission] = useState(null);
  const [editingLdCommission, setEditingLdCommission] = useState(null);

  // Admin PIN Protection for Deletions
  const [adminPinModal, setAdminPinModal] = useState(null); // { action: () => Promise<void>, title: string, message: string }
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminPinError, setAdminPinError] = useState("");

  const loadActiveTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "sales") {
        const res = await api.sales(from, to, "");
        setSalesList(res || []);
      } else if (tab === "expenses") {
        const res = await api.expenses(from, to);
        setExpensesList(res || []);
      } else if (tab === "salary") {
        const res = await api.salaries(from, to);
        setSalariesList(res || []);
      } else if (tab === "commission") {
        const res = await api.commissions(from, to);
        setCommissionsList(res || []);
      } else if (tab === "ld-commission") {
        const res = await api.ldCommissions(from, to);
        setLdCommissionsList(res || []);
      }
    } catch (e) {
      toast(errText(e), "err");
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, toast]);

  useEffect(() => {
    loadActiveTab();
  }, [loadActiveTab]);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => {});
    api.commissionTypes().then(setCommissionTypes).catch(() => {});
  }, []);

  const refreshAll = () => {
    loadActiveTab();
    if (onDataChanged) onDataChanged();
  };

  // Helper to enforce admin authorization on any destructive action
  const requireAdminPrivilege = (actionFn, title, message) => {
    if (currentUser?.role === "admin") {
      if (window.confirm(message || "Are you sure you want to delete this record?")) {
        actionFn();
      }
    } else {
      setAdminPinModal({
        action: actionFn,
        title: title || "Admin Authorization Required",
        message: message || "This record deletion requires Administrator PIN verification.",
      });
      setAdminPinInput("");
      setAdminPinError("");
    }
  };

  const handleAdminPinSubmit = async (e) => {
    e?.preventDefault();
    if (!adminPinInput.trim()) {
      setAdminPinError("Please enter your Admin PIN");
      return;
    }
    try {
      const user = await api.verifyPin(adminPinInput.trim());
      if (user && user.role === "admin") {
        const fn = adminPinModal.action;
        setAdminPinModal(null);
        await fn();
        toast("Action authorized and completed by Administrator");
      } else {
        setAdminPinError("Invalid Admin PIN. Only administrators can delete records.");
      }
    } catch (err) {
      setAdminPinError(errText(err) || "Incorrect Admin PIN");
    }
  };

  // 1. Sales actions
  const handlePrintReceipt = async (sale) => {
    if (!settings?.printer_conn || settings.printer_conn === "none" || settings.printer_conn === "browser") {
      window.print();
      return;
    }
    try {
      await api.printReceipt(sale.id);
      toast("Receipt sent to printer");
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const executeVoidSale = async (sale, reason) => {
    try {
      const who = currentUser?.name || "Cashier";
      await api.voidSale(sale.id, reason || "Voided from Dashboard", who);
      toast(`Receipt ${sale.receipt_no} voided`);
      setVoidingSale(null);
      setVoidReason("");
      refreshAll();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const handleVoidClick = (sale) => {
    setVoidingSale(sale);
    setVoidReason("");
  };

  const confirmVoidSale = () => {
    if (!voidingSale) return;
    const s = voidingSale;
    const r = voidReason.trim();
    requireAdminPrivilege(
      () => executeVoidSale(s, r),
      "Authorize Void Sale",
      `Are you sure you want to void receipt ${s.receipt_no} for ${peso(s.total)}? Items will return to inventory.`
    );
  };

  // 2. Expenses actions
  const handleSaveExpense = async (e) => {
    e?.preventDefault();
    try {
      const payload = {
        ...editingExpense,
        amount: Number(editingExpense.amount),
        date: editingExpense.date || activeBusinessDate || ymd(),
      };
      await api.saveExpense(payload);
      toast("Expense saved");
      setEditingExpense(null);
      refreshAll();
    } catch (err) {
      toast(errText(err), "err");
    }
  };

  const handleDeleteExpense = (id) => {
    requireAdminPrivilege(
      async () => {
        try {
          await api.deleteExpense(id);
          toast("Expense deleted");
          refreshAll();
        } catch (e) {
          toast(errText(e), "err");
        }
      },
      "Delete Expense Record",
      "Are you sure you want to permanently delete this expense?"
    );
  };

  // 3. Salary actions
  const handleSaveSalary = async (e) => {
    e?.preventDefault();
    try {
      const payload = {
        ...editingSalary,
        amount: Number(editingSalary.amount),
        date: editingSalary.date || activeBusinessDate || ymd(),
      };
      await api.saveSalary(payload);
      toast("Salary record saved");
      setEditingSalary(null);
      refreshAll();
    } catch (err) {
      toast(errText(err), "err");
    }
  };

  const handleDeleteSalary = (id) => {
    requireAdminPrivilege(
      async () => {
        try {
          await api.deleteSalary(id);
          toast("Salary record deleted");
          refreshAll();
        } catch (e) {
          toast(errText(e), "err");
        }
      },
      "Delete Salary Record",
      "Are you sure you want to permanently delete this salary record?"
    );
  };

  // 4. Commission actions
  const handleSaveCommission = async (e) => {
    e?.preventDefault();
    try {
      const payload = {
        ...editingCommission,
        amount: Number(editingCommission.amount),
        date: editingCommission.date || activeBusinessDate || ymd(),
      };
      await api.saveCommission(payload);
      toast("Commission saved");
      setEditingCommission(null);
      refreshAll();
    } catch (err) {
      toast(errText(err), "err");
    }
  };

  const handleDeleteCommission = (id) => {
    requireAdminPrivilege(
      async () => {
        try {
          await api.deleteCommission(id);
          toast("Commission deleted");
          refreshAll();
        } catch (e) {
          toast(errText(e), "err");
        }
      },
      "Delete Commission",
      "Are you sure you want to delete this commission payout?"
    );
  };

  // 5. LD Commission actions
  const handleSaveLdCommission = async (e) => {
    e?.preventDefault();
    try {
      const payload = {
        ...editingLdCommission,
        quantity: Number(editingLdCommission.quantity || 1),
        amount: Number(editingLdCommission.amount),
        date: editingLdCommission.date || activeBusinessDate || ymd(),
      };
      await api.saveLdCommission(payload);
      toast("LD Commission saved");
      setEditingLdCommission(null);
      refreshAll();
    } catch (err) {
      toast(errText(err), "err");
    }
  };

  const handleDeleteLdCommission = (id) => {
    requireAdminPrivilege(
      async () => {
        try {
          await api.deleteLdCommission(id);
          toast("LD Commission deleted");
          refreshAll();
        } catch (e) {
          toast(errText(e), "err");
        }
      },
      "Delete LD Commission",
      "Are you sure you want to delete this LD Commission record?"
    );
  };

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      {/* Header & Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0 }}>Store Operations & Records (CRUD)</h3>
            <span
              className={`badge ${currentUser?.role === "admin" ? "tone-ok" : "tone-warn"}`}
              title={currentUser?.role === "admin" ? "Full Admin Privileges" : "Delete requires Admin PIN"}
              style={{ fontSize: 11 }}
            >
              {currentUser?.role === "admin" ? "🛡️ Admin Access" : "🔒 Deletions Locked (Admin Only)"}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Direct data management for sales, expenses, salary, and commissions for <b>{from}</b> to <b>{to}</b>. Shift dates are strictly tracked.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`chip ${tab === "sales" ? "active" : ""}`}
            onClick={() => setTab("sales")}
          >
            <Receipt size={14} /> Sales & Receipts
          </button>
          {showInventory && (
            <button
              type="button"
              className={`chip ${tab === "inventory-report" ? "active" : ""}`}
              onClick={() => setTab("inventory-report")}
            >
              <ClipboardList size={14} /> Inventory Report
            </button>
          )}
          {showExpenses && (
            <button
              type="button"
              className={`chip ${tab === "expenses" ? "active" : ""}`}
              onClick={() => setTab("expenses")}
            >
              <Wallet size={14} /> Store Expenses
            </button>
          )}
          {showSalary && (
            <button
              type="button"
              className={`chip ${tab === "salary" ? "active" : ""}`}
              onClick={() => setTab("salary")}
            >
              <Users size={14} /> Salary Payroll
            </button>
          )}
          {showCommission && (
            <button
              type="button"
              className={`chip ${tab === "commission" ? "active" : ""}`}
              onClick={() => setTab("commission")}
            >
              <Coins size={14} /> Commissions
            </button>
          )}
          {showLdCommission && (
            <button
              type="button"
              className={`chip ${tab === "ld-commission" ? "active" : ""}`}
              onClick={() => setTab("ld-commission")}
            >
              <Smartphone size={14} /> LD Commissions
            </button>
          )}
        </div>
      </div>

      {/* Toolbar (Search + New Record Button) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 260, flex: 1, maxWidth: 400 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, opacity: 0.5 }} />
          <input
            type="text"
            style={{ paddingLeft: 32, width: "100%", height: 36, fontSize: 13 }}
            placeholder={`Filter ${tab.replace("-", " ")} records…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="icon-btn sm"
              style={{ position: "absolute", right: 6, top: 6 }}
              onClick={() => setSearch("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {tab === "expenses" && (
          <button
            type="button"
            className="btn sm primary"
            onClick={() =>
              setEditingExpense({
                category: "Electricity",
                description: "",
                amount: "",
                date: activeBusinessDate || ymd(),
              })
            }
          >
            <Plus size={15} /> Add Expense
          </button>
        )}
        {tab === "salary" && (
          <button
            type="button"
            className="btn sm primary"
            onClick={() =>
              setEditingSalary({
                employee: employees[0]?.name || "",
                amount: employees[0]?.salary || "",
                period: "Regular Period",
                note: "",
                date: activeBusinessDate || ymd(),
              })
            }
          >
            <Plus size={15} /> Record Salary
          </button>
        )}
        {tab === "commission" && (
          <button
            type="button"
            className="btn sm primary"
            onClick={() =>
              setEditingCommission({
                employee_id: employees[0]?.id || null,
                employee_name: employees[0]?.name || "",
                type: commissionTypes[0]?.name || "Sales",
                amount: employees[0]?.commission || "",
                date: activeBusinessDate || ymd(),
              })
            }
          >
            <Plus size={15} /> Add Commission
          </button>
        )}
        {tab === "ld-commission" && (
          <button
            type="button"
            className="btn sm primary"
            onClick={() =>
              setEditingLdCommission({
                employee_id: employees[0]?.id || null,
                employee_name: employees[0]?.name || "",
                quantity: 1,
                amount: employees[0]?.ld_commission || "",
                date: activeBusinessDate || ymd(),
              })
            }
          >
            <Plus size={15} /> Add LD Commission
          </button>
        )}
        {tab === "inventory-report" && (
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => window.print()}
            title="Print Inventory Stock & Sales Report"
          >
            <Printer size={15} /> Print Report
          </button>
        )}
      </div>

      {/* Table Content */}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }} className="muted">
          Loading {tab} data…
        </div>
      ) : tab === "inventory-report" ? (
        (() => {
          const filtered = (inventoryReport || []).filter((p) => {
            const q = search.toLowerCase();
            return (
              (p.name || "").toLowerCase().includes(q) ||
              (p.category || "").toLowerCase().includes(q)
            );
          });

          if (filtered.length === 0) {
            return <Empty text="No inventory stock or sales records match your search." />;
          }

          return (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Item / Product</th>
                    <th>Category</th>
                    <th className="num">Current Stock</th>
                    <th>Health</th>
                    <th className="num">Price</th>
                    <th className="num" style={{ background: "rgba(255,122,61,0.06)" }}>Units Sold (Qty)</th>
                    <th className="num" style={{ background: "rgba(47,207,138,0.06)" }}>Total Amount Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isExp = !!expandedInventory[item.id];
                    const vs = (variantSales || []).filter((v) => v.product_id === item.id);
                    const hasVs = vs.length > 0;
                    const stock = Number(item.current_stock ?? item.stock ?? 0);
                    const isOut = stock <= 0;
                    const isLow = stock > 0 && stock <= Number(item.low_stock ?? 5);

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="row-hover">
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <b>{item.name}</b>
                              {hasVs && (
                                <button
                                  type="button"
                                  className="icon-btn xs"
                                  onClick={() =>
                                    setExpandedInventory((prev) => ({
                                      ...prev,
                                      [item.id]: !prev[item.id],
                                    }))
                                  }
                                  style={{
                                    color: "var(--accent, #ff7a3d)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    background: "rgba(255, 122, 61, 0.12)",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  <span>{vs.length} variant{vs.length > 1 ? "s" : ""} sold</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge tone-neutral" style={{ fontSize: "0.78rem" }}>
                              {item.category || "General"}
                            </span>
                          </td>
                          <td className="num"><b>{stock}</b></td>
                          <td>
                            <span className={`badge ${isOut ? "bad" : isLow ? "warn" : "ok"}`} style={{ fontSize: 11 }}>
                              {isOut ? "Out of Stock" : isLow ? "Low Stock" : "Healthy"}
                            </span>
                          </td>
                          <td className="num">{peso(item.price)}</td>
                          <td className="num" style={{ background: "rgba(255,122,61,0.05)" }}>
                            <span
                              className="badge"
                              style={{
                                fontWeight: 700,
                                background: Number(item.units_sold || 0) > 0 ? "rgba(255, 122, 61, 0.2)" : "transparent",
                                color: Number(item.units_sold || 0) > 0 ? "#ff7a3d" : "var(--muted)",
                              }}
                            >
                              {Number(item.units_sold || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="num" style={{ background: "rgba(47,207,138,0.05)" }}>
                            <b style={{ color: Number(item.total_sold_amount || 0) > 0 ? "var(--ok)" : "var(--muted)" }}>
                              {peso(item.total_sold_amount || 0)}
                            </b>
                          </td>
                        </tr>
                        {isExp && hasVs && (
                          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                            <td colSpan={7} style={{ padding: "8px 16px 12px 32px" }}>
                              <div
                                style={{
                                  background: "var(--bg-soft, #1e222d)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8,
                                  padding: "10px 14px",
                                }}
                              >
                                <b style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                                  Variant Sales for "{item.name}"
                                </b>
                                <table style={{ width: "100%", fontSize: "0.82rem", marginTop: 6 }}>
                                  <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Variant</th>
                                      <th className="num" style={{ padding: "4px 8px" }}>Packs/Qty Sold</th>
                                      <th className="num" style={{ padding: "4px 8px" }}>Units Sold</th>
                                      <th className="num" style={{ padding: "4px 8px" }}>Total Amount Sold</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {vs.map((v, i) => (
                                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                        <td style={{ padding: "6px 8px" }}><b>{v.variant_name}</b></td>
                                        <td className="num" style={{ padding: "6px 8px" }}>{Number(v.qty_sold || 0).toLocaleString()}</td>
                                        <td className="num" style={{ padding: "6px 8px" }}>
                                          <b style={{ color: "var(--accent)" }}>{Number(v.units_sold || 0).toLocaleString()}</b>
                                        </td>
                                        <td className="num" style={{ padding: "6px 8px" }}>
                                          <b style={{ color: "var(--ok)" }}>{peso(v.revenue || 0)}</b>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()
      ) : tab === "sales" ? (
        salesList.length === 0 ? (
          <Empty text="No sales recorded in this date range" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Shift Date</th>
                  <th>Items Purchased</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salesList
                  .filter((s) => (s.receipt_no || "").toLowerCase().includes(search.toLowerCase()))
                  .map((s) => (
                    <tr key={s.id} className="row-hover">
                      <td>
                        <b>{s.receipt_no}</b>
                      </td>
                      <td>
                        <b>{s.business_date || s.created_at?.slice(0, 10)}</b>{" "}
                        <small className="muted">{s.created_at?.slice(11, 16)}</small>
                      </td>
                      <td style={{ fontSize: 13, maxWidth: 280 }}>
                        {(s.items || [])
                          .map((i) => `${i.quantity}× ${i.name}`)
                          .join(", ") || "—"}
                      </td>
                      <td className="num">
                        <b>{peso(s.total)}</b>
                      </td>
                      <td>
                        <StatusBadge
                          tone={s.status === "voided" ? "bad" : "ok"}
                          label={s.status === "voided" ? "VOIDED" : "COMPLETED"}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn ghost sm"
                            onClick={() => setViewingReceipt(s)}
                            title="View receipt"
                          >
                            <Printer size={13} /> Receipt
                          </button>
                          {s.status === "completed" && (
                            <button
                              type="button"
                              className="btn danger sm"
                              onClick={() => handleVoidClick(s)}
                              title="Void sale (Requires Admin Authorization)"
                            >
                              <Ban size={13} /> Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      ) : tab === "expenses" ? (
        expensesList.length === 0 ? (
          <Empty text="No expenses recorded in this period" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Shift Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="num">Amount</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expensesList
                  .filter((e) =>
                    `${e.category || ""} ${e.description || ""}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((e) => (
                    <tr key={e.id} className="row-hover">
                      <td>
                        <b>{e.business_date || e.date}</b>
                      </td>
                      <td>
                        <span className="badge warn">{e.category || "General"}</span>
                      </td>
                      <td>{e.description || "—"}</td>
                      <td className="num">
                        <b>{peso(e.amount)}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="icon-btn sm"
                            onClick={() => setEditingExpense({ ...e })}
                            title="Edit expense"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            onClick={() => handleDeleteExpense(e.id)}
                            title="Delete expense (Admin Only)"
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
        )
      ) : tab === "salary" ? (
        salariesList.length === 0 ? (
          <Empty text="No salary payroll records in this period" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Shift Date</th>
                  <th>Employee</th>
                  <th>Period / Role</th>
                  <th>Note</th>
                  <th className="num">Amount</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {salariesList
                  .filter((sal) =>
                    `${sal.employee || ""} ${sal.note || ""}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((sal) => (
                    <tr key={sal.id} className="row-hover">
                      <td>
                        <b>{sal.business_date || sal.date}</b>
                      </td>
                      <td>
                        <b>{sal.employee}</b>
                      </td>
                      <td className="muted">{sal.period || "Regular Period"}</td>
                      <td>{sal.note || "—"}</td>
                      <td className="num">
                        <b>{peso(sal.amount)}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="icon-btn sm"
                            onClick={() => setEditingSalary({ ...sal })}
                            title="Edit salary"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            onClick={() => handleDeleteSalary(sal.id)}
                            title="Delete salary (Admin Only)"
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
        )
      ) : tab === "commission" ? (
        commissionsList.length === 0 ? (
          <Empty text="No commissions recorded in this period" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Shift Date</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th className="num">Amount</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commissionsList
                  .filter((c) =>
                    `${c.employee_name || ""} ${c.type || ""}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((c) => (
                    <tr key={c.id} className="row-hover">
                      <td>
                        <b>{c.business_date || c.date}</b>
                      </td>
                      <td>
                        <b>{c.employee_name}</b>
                      </td>
                      <td>
                        <span className="badge warn">{c.type || "Sales"}</span>
                      </td>
                      <td className="num">
                        <b>{peso(c.amount)}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="icon-btn sm"
                            onClick={() => setEditingCommission({ ...c })}
                            title="Edit commission"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            onClick={() => handleDeleteCommission(c.id)}
                            title="Delete commission (Admin Only)"
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
        )
      ) : (
        /* LD Commissions */
        ldCommissionsList.length === 0 ? (
            <Empty text="No LD commissions recorded in this period" />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Shift Date</th>
                    <th>Employee</th>
                    <th className="num">Drinks (Qty)</th>
                    <th className="num">Total Payout</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ldCommissionsList
                    .filter((ld) =>
                      (ld.employee_name || "").toLowerCase().includes(search.toLowerCase())
                    )
                    .map((ld) => (
                      <tr key={ld.id} className="row-hover">
                        <td>
                          <b>{ld.business_date || ld.date}</b>
                        </td>
                        <td>
                          <b>{ld.employee_name}</b>
                        </td>
                        <td className="num">{ld.quantity || 1}</td>
                        <td className="num">
                          <b>{peso(ld.amount)}</b>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              className="icon-btn sm"
                              onClick={() => setEditingLdCommission({ ...ld })}
                              title="Edit LD commission"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn sm danger"
                              onClick={() => handleDeleteLdCommission(ld.id)}
                              title="Delete LD commission (Admin Only)"
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
          )
        )}

      {/* ── Receipt View Modal ── */}
      {viewingReceipt && (
        <Modal title={`Receipt ${viewingReceipt.receipt_no}`} onClose={() => setViewingReceipt(null)}>
          <div className="receipt-wrap">
            <ReceiptDoc sale={viewingReceipt} settings={settings} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => handlePrintReceipt(viewingReceipt)}
            >
              <Printer size={16} /> Print Receipt
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={() => setViewingReceipt(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* ── Void Sale Reason & Confirmation Modal ── */}
      {voidingSale && (
        <Modal title="Void Customer Sale" onClose={() => setVoidingSale(null)}>
          <div className="form">
            <div className="alert-banner bad">
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <div>
                <b>Voiding Receipt {voidingSale.receipt_no}</b>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  Total: {peso(voidingSale.total)}. All items in this sale will be returned to inventory stock.
                </div>
              </div>
            </div>

            <Field label="Reason for Voiding (Required)">
              <input
                autoFocus
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Wrong item, customer refund, incorrect price…"
              />
            </Field>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setVoidingSale(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={!voidReason.trim()}
                onClick={confirmVoidSale}
              >
                <Ban size={15} /> Void Sale Now
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit / Add Expense Modal ── */}
      {editingExpense && (
        <Modal
          title={editingExpense.id ? "Edit Expense" : "Add Store Expense"}
          onClose={() => setEditingExpense(null)}
        >
          <form className="form" onSubmit={handleSaveExpense}>
            <Field label="Category">
              <select
                value={editingExpense.category}
                onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
              >
                {["Electricity", "Water", "Rent", "Supplies", "Transport", "Marketing", "Maintenance", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Description / Payee">
              <input
                type="text"
                value={editingExpense.description}
                onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                placeholder="Meralco bill, store snacks, cleaner fee…"
              />
            </Field>
            <div className="grid2">
              <Field label="Amount (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                />
              </Field>
              <Field label="Shift Date">
                <input
                  type="date"
                  value={editingExpense.date || activeBusinessDate || ymd()}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                />
              </Field>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setEditingExpense(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!(Number(editingExpense.amount) > 0)}>
                Save Expense
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit / Add Salary Modal ── */}
      {editingSalary && (
        <Modal
          title={editingSalary.id ? "Edit Salary Record" : "Record Staff Salary"}
          onClose={() => setEditingSalary(null)}
        >
          <form className="form" onSubmit={handleSaveSalary}>
            <Field label="Staff Member">
              <select
                value={editingSalary.employee}
                onChange={(e) => {
                  const emp = employees.find((x) => x.name === e.target.value);
                  setEditingSalary({
                    ...editingSalary,
                    employee: e.target.value,
                    amount: emp && emp.salary > 0 ? emp.salary : editingSalary.amount,
                  });
                }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Period / Role Label">
              <input
                type="text"
                value={editingSalary.period || ""}
                onChange={(e) => setEditingSalary({ ...editingSalary, period: e.target.value })}
                placeholder="1st Half Month, Weekly Pay, Day Shift…"
              />
            </Field>
            <Field label="Notes">
              <input
                type="text"
                value={editingSalary.note || ""}
                onChange={(e) => setEditingSalary({ ...editingSalary, note: e.target.value })}
                placeholder="Cash advance deduction, overtime bonus, etc."
              />
            </Field>
            <div className="grid2">
              <Field label="Amount Paid (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingSalary.amount}
                  onChange={(e) => setEditingSalary({ ...editingSalary, amount: e.target.value })}
                />
              </Field>
              <Field label="Shift Date">
                <input
                  type="date"
                  value={editingSalary.date || activeBusinessDate || ymd()}
                  onChange={(e) => setEditingSalary({ ...editingSalary, date: e.target.value })}
                />
              </Field>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setEditingSalary(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!(Number(editingSalary.amount) > 0)}>
                Save Salary Payout
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit / Add Commission Modal ── */}
      {editingCommission && (
        <Modal
          title={editingCommission.id ? "Edit Commission" : "Add Staff Commission"}
          onClose={() => setEditingCommission(null)}
        >
          <form className="form" onSubmit={handleSaveCommission}>
            <Field label="Staff Member">
              <select
                value={editingCommission.employee_name}
                onChange={(e) => {
                  const emp = employees.find((x) => x.name === e.target.value);
                  setEditingCommission({
                    ...editingCommission,
                    employee_id: emp ? emp.id : null,
                    employee_name: emp ? emp.name : e.target.value,
                    amount: emp?.commission || editingCommission.amount,
                  });
                }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Commission Type">
              <select
                value={editingCommission.type}
                onChange={(e) => setEditingCommission({ ...editingCommission, type: e.target.value })}
              >
                {commissionTypes.map((ct) => (
                  <option key={ct.id || ct.name} value={ct.name}>{ct.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid2">
              <Field label="Amount (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingCommission.amount}
                  onChange={(e) => setEditingCommission({ ...editingCommission, amount: e.target.value })}
                />
              </Field>
              <Field label="Shift Date">
                <input
                  type="date"
                  value={editingCommission.date || activeBusinessDate || ymd()}
                  onChange={(e) => setEditingCommission({ ...editingCommission, date: e.target.value })}
                />
              </Field>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setEditingCommission(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!(Number(editingCommission.amount) > 0)}>
                Save Commission
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit / Add LD Commission Modal ── */}
      {editingLdCommission && (
        <Modal
          title={editingLdCommission.id ? "Edit LD Commission" : "Add Ladies Drink (LD) Commission"}
          onClose={() => setEditingLdCommission(null)}
        >
          <form className="form" onSubmit={handleSaveLdCommission}>
            <Field label="Staff Member">
              <select
                value={editingLdCommission.employee_name}
                onChange={(e) => {
                  const emp = employees.find((x) => x.name === e.target.value);
                  const rate = emp?.ld_commission || 0;
                  const qty = Number(editingLdCommission.quantity || 1);
                  setEditingLdCommission({
                    ...editingLdCommission,
                    employee_id: emp ? emp.id : null,
                    employee_name: emp ? emp.name : e.target.value,
                    amount: rate * qty > 0 ? rate * qty : editingLdCommission.amount,
                  });
                }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid2">
              <Field label="Quantity of LD Drinks">
                <input
                  type="number"
                  min="1"
                  required
                  value={editingLdCommission.quantity || 1}
                  onChange={(e) => {
                    const q = Math.max(1, Number(e.target.value) || 1);
                    const emp = employees.find(
                      (x) => x.id === editingLdCommission.employee_id || x.name === editingLdCommission.employee_name
                    );
                    const rate = emp?.ld_commission || 0;
                    setEditingLdCommission({
                      ...editingLdCommission,
                      quantity: q,
                      amount: rate * q > 0 ? rate * q : editingLdCommission.amount,
                    });
                  }}
                />
              </Field>
              <Field label="Total Payout Amount (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingLdCommission.amount}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, amount: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Shift Date">
              <input
                type="date"
                value={editingLdCommission.date || activeBusinessDate || ymd()}
                onChange={(e) => setEditingLdCommission({ ...editingLdCommission, date: e.target.value })}
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setEditingLdCommission(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!(Number(editingLdCommission.amount) > 0)}>
                Save LD Commission
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Admin PIN Authorization Modal for Deletions ── */}
      {adminPinModal && (
        <Modal title={adminPinModal.title} onClose={() => setAdminPinModal(null)}>
          <form className="form" onSubmit={handleAdminPinSubmit}>
            <div className="alert-banner warn">
              <ShieldAlert size={22} style={{ flexShrink: 0 }} />
              <div>
                <b>Administrator Privilege Required</b>
                <div style={{ fontSize: 13, marginTop: 2 }}>{adminPinModal.message}</div>
              </div>
            </div>

            <Field label="Enter Administrator PIN to Authorize Deletion">
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 10, top: 12, opacity: 0.5 }} />
                <input
                  autoFocus
                  type="password"
                  maxLength={10}
                  style={{ paddingLeft: 34 }}
                  placeholder="Admin PIN…"
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    setAdminPinError("");
                  }}
                />
              </div>
              {adminPinError && (
                <div style={{ color: "var(--bad)", fontSize: 13, marginTop: 4 }}>
                  {adminPinError}
                </div>
              )}
            </Field>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setAdminPinModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn danger" disabled={!adminPinInput.trim()}>
                <ShieldCheck size={16} /> Authorize & Delete
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

export default DashboardCrudModule;
