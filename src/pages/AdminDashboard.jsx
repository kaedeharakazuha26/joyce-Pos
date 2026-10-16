import { useCallback, useEffect, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
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
  Users,
  GripVertical,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  Table as TableIcon,
} from "lucide-react";
import { api } from "../api";
import { PageHeader, RangeBar, Empty, Modal, Field, useToast } from "../components/ui";
import { useSettings } from "../App";
import { daysAgo, errText, monthStart, peso, ymd } from "../utils";

const DEFAULT_CARD_ORDER = [
  "revenue",
  "cogs",
  "gross_profit",
  "overheads",
  "net_profit",
  "void_rate",
  "stock",
];

export default function AdminDashboard() {
  const { branchInfo, currentUser, activeBusinessDate } = useSettings();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(ymd());
  const [d, setD] = useState(null);

  // Playground report tab: "products" | "salary" | "commission" | "ld_commission" | "shifts" | "expenses"
  const [reportTab, setReportTab] = useState("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("revenue"); // "revenue" | "gross_profit" | "margin_pct" | "units_sold" | "current_stock"
  const [sortOrder, setSortOrder] = useState("desc"); // "asc" | "desc"
  const [selectedShift, setSelectedShift] = useState(null);
  const [trendView, setTrendView] = useState("chart"); // "chart" | "table"
  const [showEmployeePdf, setShowEmployeePdf] = useState(false);

  // KPI Drag and Drop Card order
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("joyce-admin-kpi-order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_CARD_ORDER.length) {
          return parsed;
        }
      }
    } catch (_) {}
    return DEFAULT_CARD_ORDER;
  });
  const [draggedCardId, setDraggedCardId] = useState(null);

  // Sub-table CRUD states for Salaries, Commissions & LD Commissions
  const [salaryList, setSalaryList] = useState([]);
  const [salaryForm, setSalaryForm] = useState(null);

  const [commissionList, setCommissionList] = useState([]);
  const [commissionForm, setCommissionForm] = useState(null);
  const [commissionTypes, setCommissionTypes] = useState([]);
  const [newCommissionType, setNewCommissionType] = useState(null);

  const [ldList, setLdList] = useState([]);
  const [ldForm, setLdForm] = useState(null);

  const [employees, setEmployees] = useState([]);

  const toast = useToast();

  const loadData = useCallback(() => {
    api.adminDashboard(from, to)
      .then(setD)
      .catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load supporting employee list and commission types
  useEffect(() => {
    api.employees().then(setEmployees).catch(() => {});
    api.commissionTypes().then(setCommissionTypes).catch(() => {});
  }, []);

  // Load sub-lists when relevant tab is selected or dates change
  const loadSalaries = useCallback(() => {
    api.salaries(from, to).then(setSalaryList).catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  const loadCommissions = useCallback(() => {
    api.commissions(from, to).then(setCommissionList).catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  const loadLdCommissions = useCallback(() => {
    api.ldCommissions(from, to).then(setLdList).catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  useEffect(() => {
    if (reportTab === "salary") loadSalaries();
    if (reportTab === "commission") loadCommissions();
    if (reportTab === "ld_commission") loadLdCommissions();
  }, [reportTab, loadSalaries, loadCommissions, loadLdCommissions]);

  // Drag and Drop handlers for KPI cards
  const handleDragStart = (e, id) => {
    setDraggedCardId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedCardId || draggedCardId === targetId) return;

    setCardOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(draggedCardId);
      const toIdx = next.indexOf(targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, targetId);
        try {
          localStorage.setItem("joyce-admin-kpi-order", JSON.stringify(next));
        } catch (_) {}
      }
      return next;
    });
    setDraggedCardId(null);
  };

  const resetCardOrder = () => {
    setCardOrder(DEFAULT_CARD_ORDER);
    try {
      localStorage.removeItem("joyce-admin-kpi-order");
    } catch (_) {}
    toast("KPI cards layout reset to default");
  };

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

  // Daily trend calculations
  const dailyMax = Math.max(
    1,
    ...(d.daily || []).map((day) => {
      const s = Number(day.sales ?? day.total ?? 0);
      const ovh = Number(day.expenses || 0) + Number(day.salaries || 0) + Number(day.commissions || 0) + Number(day.ld_commissions || 0);
      return Math.max(s, ovh);
    })
  );

  // ── CSV Export with Native Folder / File Chooser ──
  const exportCsv = async () => {
    let headers = [];
    let rows = [];
    let filename = "";

    if (reportTab === "products") {
      if (filteredProducts.length === 0) return toast("No product data to export", "err");
      headers = ["Product ID", "Product Name", "Category", "Units Sold", "Total Revenue", "COGS", "Gross Profit", "Margin %", "Current Stock"];
      rows = filteredProducts.map((p) => [
        p.id,
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.category || "").replace(/"/g, '""')}"`,
        p.units_sold,
        p.revenue,
        p.cogs,
        p.gross_profit,
        p.margin_pct,
        p.current_stock,
      ]);
      filename = `JOYCE_POS_Products_${from}_to_${to}.csv`;
    } else if (reportTab === "salary") {
      if (salaryList.length === 0) return toast("No salary data to export", "err");
      headers = ["ID", "Date", "Employee", "Note", "Amount"];
      rows = salaryList.map((x) => [
        x.id,
        x.date,
        `"${(x.employee || "").replace(/"/g, '""')}"`,
        `"${(x.note || "").replace(/"/g, '""')}"`,
        x.amount,
      ]);
      filename = `JOYCE_POS_Salaries_${from}_to_${to}.csv`;
    } else if (reportTab === "commission") {
      if (commissionList.length === 0) return toast("No commission data to export", "err");
      headers = ["ID", "Date", "Employee Name", "Type", "Amount"];
      rows = commissionList.map((x) => [
        x.id,
        x.date,
        `"${(x.employee_name || "").replace(/"/g, '""')}"`,
        `"${(x.type || "").replace(/"/g, '""')}"`,
        x.amount,
      ]);
      filename = `JOYCE_POS_Commissions_${from}_to_${to}.csv`;
    } else if (reportTab === "ld_commission") {
      if (ldList.length === 0) return toast("No LD commission data to export", "err");
      headers = ["ID", "Date", "Employee Name", "Quantity", "Amount"];
      rows = ldList.map((x) => [
        x.id,
        x.date,
        `"${(x.employee_name || "").replace(/"/g, '""')}"`,
        x.quantity || 1,
        x.amount,
      ]);
      filename = `JOYCE_POS_LD_Commissions_${from}_to_${to}.csv`;
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
        `"${(c.category || "General").replace(/"/g, '""')}"`,
        c.count,
        c.total,
      ]);
      filename = `JOYCE_POS_Expenses_${from}_to_${to}.csv`;
    }

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    try {
      const selectedPath = await saveDialog({
        defaultPath: filename,
        filters: [{ name: "CSV File (*.csv)", extensions: ["csv"] }],
      });
      if (selectedPath) {
        await api.saveTextFile(selectedPath, csvContent);
        toast(`Export saved to ${selectedPath}`);
        return;
      }
    } catch (err) {
      console.warn("Native file chooser skipped or unsupported:", err);
    }

    // Fallback to browser blob download if user cancels or non-Tauri
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

  // ── Salary Actions ──
  const pickSalaryEmployee = (name) => {
    const emp = employees.find((e) => e.name === name);
    setSalaryForm((f) => ({
      ...f,
      employee: name,
      amount: emp && emp.salary > 0 ? emp.salary : (f?.amount || ""),
    }));
  };

  const saveSalaryRecord = async () => {
    try {
      await api.saveSalary({ ...salaryForm, amount: Number(salaryForm.amount) });
      toast("Salary record saved");
      setSalaryForm(null);
      loadSalaries();
      loadData();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const deleteSalaryRecord = async (x) => {
    if (confirm(`Delete salary record for ${x.employee}?`)) {
      try {
        await api.deleteSalary(x.id);
        toast("Salary record deleted");
        loadSalaries();
        loadData();
      } catch (e) {
        toast(errText(e), "err");
      }
    }
  };

  // ── Commission Actions ──
  const pickCommissionEmployee = (id) => {
    const emp = employees.find((x) => String(x.id) === id);
    const baseRate = emp?.commission || 0;
    setCommissionForm((f) => ({
      ...f,
      employee_id: emp ? emp.id : null,
      employee_name: emp ? emp.name : "",
      amount: baseRate > 0 ? baseRate : (f?.amount || ""),
    }));
  };

  const saveCommissionRecord = async () => {
    try {
      await api.saveCommission({ ...commissionForm, amount: Number(commissionForm.amount) });
      toast("Commission recorded");
      setCommissionForm(null);
      loadCommissions();
      loadData();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const deleteCommissionRecord = async (x) => {
    if (confirm(`Delete commission record for ${x.employee_name}?`)) {
      try {
        await api.deleteCommission(x.id);
        toast("Commission deleted");
        loadCommissions();
        loadData();
      } catch (e) {
        toast(errText(e), "err");
      }
    }
  };

  const createCommissionType = async () => {
    if (!newCommissionType?.trim()) return;
    try {
      await api.addCommissionType(newCommissionType.trim());
      toast("Commission type added");
      setNewCommissionType(null);
      const updated = await api.commissionTypes();
      setCommissionTypes(updated);
      setCommissionForm((f) => ({ ...f, type: newCommissionType.trim() }));
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  // ── LD Commission Actions ──
  const pickLdEmployee = (id) => {
    const emp = employees.find((x) => String(x.id) === id);
    const qty = Number(ldForm?.quantity || 1);
    const baseRate = emp?.ld_commission || 0;
    const computedAmt = qty * baseRate;
    setLdForm((f) => ({
      ...f,
      employee_id: emp ? emp.id : null,
      employee_name: emp ? emp.name : "",
      amount: computedAmt > 0 ? computedAmt : (f?.amount || ""),
    }));
  };

  const changeLdQuantity = (q) => {
    const qty = Number(q) || 0;
    const emp = employees.find((x) => String(x.id) === String(ldForm?.employee_id));
    const baseRate = emp?.ld_commission || 0;
    const computedAmt = qty * baseRate;
    setLdForm((f) => ({
      ...f,
      quantity: q,
      amount: computedAmt > 0 ? computedAmt : f.amount,
    }));
  };

  const saveLdRecord = async () => {
    try {
      await api.saveLdCommission({
        ...ldForm,
        quantity: Number(ldForm.quantity || 1),
        amount: Number(ldForm.amount),
      });
      toast("LD Commission recorded");
      setLdForm(null);
      loadLdCommissions();
      loadData();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const deleteLdRecord = async (x) => {
    if (confirm(`Delete LD commission for ${x.employee_name}?`)) {
      try {
        await api.deleteLdCommission(x.id);
        toast("LD Commission deleted");
        loadLdCommissions();
        loadData();
      } catch (e) {
        toast(errText(e), "err");
      }
    }
  };

  // ── Render Individual Draggable KPI Cards ──
  const renderCard = (cardId) => {
    switch (cardId) {
      case "revenue":
        return (
          <div
            key={cardId}
            draggable
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cardId)}
            className="card stat"
            style={{
              "--c": "#ff7a3d",
              cursor: "grab",
              opacity: draggedCardId === cardId ? 0.45 : 1,
              transform: draggedCardId === cardId ? "scale(0.98)" : "none",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            <div className="stat-top">
              <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GripVertical size={13} className="muted" /> Gross Sales Revenue
              </div>
              <div className="stat-icon"><DollarSign size={18} /></div>
            </div>
            <div className="value">{peso(d.revenue)}</div>
            <div className="sub">{d.orders} orders · Avg ticket {peso(d.avg_ticket)}</div>
          </div>
        );

      case "cogs":
        return (
          <div
            key={cardId}
            draggable
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cardId)}
            className="card stat"
            style={{
              "--c": "#38bdf8",
              cursor: "grab",
              opacity: draggedCardId === cardId ? 0.45 : 1,
              transform: draggedCardId === cardId ? "scale(0.98)" : "none",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            <div className="stat-top">
              <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GripVertical size={13} className="muted" /> Cost of Goods (COGS)
              </div>
              <div className="stat-icon"><Package size={18} /></div>
            </div>
            <div className="value">{peso(d.cogs)}</div>
            <div className="sub">Inventory cost of items sold</div>
          </div>
        );

      case "gross_profit":
        return (
          <div
            key={cardId}
            draggable
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cardId)}
            className="card stat"
            style={{
              "--c": "#2fcf8a",
              cursor: "grab",
              opacity: draggedCardId === cardId ? 0.45 : 1,
              transform: draggedCardId === cardId ? "scale(0.98)" : "none",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            <div className="stat-top">
              <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GripVertical size={13} className="muted" /> Gross Profit
              </div>
              <div className="stat-icon"><TrendingUp size={18} /></div>
            </div>
            <div className="value">{peso(d.gross_profit)}</div>
            <div className="sub">Gross Margin: <b>{d.gross_margin}%</b></div>
          </div>
        );

      case "overheads":
        return (
          <div
            key={cardId}
            draggable
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cardId)}
            className="card stat"
            style={{
              "--c": "#f59e0b",
              cursor: "grab",
              opacity: draggedCardId === cardId ? 0.45 : 1,
              transform: draggedCardId === cardId ? "scale(0.98)" : "none",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            <div className="stat-top">
              <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GripVertical size={13} className="muted" /> Total Overheads
              </div>
              <div className="stat-icon"><Receipt size={18} /></div>
            </div>
            <div className="value">{peso(d.total_overheads)}</div>
            <div className="sub">Exp: {peso(d.expenses)} · Payroll: {peso(d.salaries + d.commissions + d.ld_commissions)}</div>
          </div>
        );

      case "net_profit":
        return (
          <div
            key={cardId}
            draggable
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cardId)}
            className="card stat"
            style={{
              "--c": d.net_profit >= 0 ? "#10b981" : "#ff5470",
              cursor: "grab",
              opacity: draggedCardId === cardId ? 0.45 : 1,
              transform: draggedCardId === cardId ? "scale(0.98)" : "none",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            <div className="stat-top">
              <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GripVertical size={13} className="muted" /> Net Operating Profit
              </div>
              <div className="stat-icon"><DollarSign size={18} /></div>
            </div>
            <div className="value" style={{ color: d.net_profit >= 0 ? "var(--ok)" : "var(--bad)" }}>
              {peso(d.net_profit)}
            </div>
            <div className="sub">Net Margin: <b>{d.net_margin}%</b> (after all expenses)</div>
          </div>
        );

      case "void_rate":
        return (
          <div
            key={cardId}
            draggable
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cardId)}
            className="card stat"
            style={{
              "--c": "#ec4899",
              cursor: "grab",
              opacity: draggedCardId === cardId ? 0.45 : 1,
              transform: draggedCardId === cardId ? "scale(0.98)" : "none",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            <div className="stat-top">
              <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GripVertical size={13} className="muted" /> Void / Leakage Rate
              </div>
              <div className="stat-icon"><AlertTriangle size={18} /></div>
            </div>
            <div className="value">{d.void_rate}%</div>
            <div className="sub">{peso(d.voided_total)} voided ({d.voided_count} receipts)</div>
          </div>
        );

      case "stock":
        return (
          <div
            key={cardId}
            draggable
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cardId)}
            className="card stat"
            style={{
              "--c": "#8b5cf6",
              cursor: "grab",
              opacity: draggedCardId === cardId ? 0.45 : 1,
              transform: draggedCardId === cardId ? "scale(0.98)" : "none",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            <div className="stat-top">
              <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <GripVertical size={13} className="muted" /> Working Capital (Stock)
              </div>
              <div className="stat-icon"><Layers size={18} /></div>
            </div>
            <div className="value">{peso(d.inventory_cost)}</div>
            <div className="sub">Retail Potential: {peso(d.inventory_retail)} (+{peso(d.potential_profit)})</div>
          </div>
        );

      default:
        return null;
    }
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
          <button className="btn sm ghost" onClick={resetCardOrder} title="Reset KPI cards to default order">
            <RotateCcw size={13} /> Reset Cards
          </button>
        </div>
      </div>

      {/* ── 1. High-Level KPI Executive Cards (Draggable & Droppable) ── */}
      <section
        className="stats"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 24,
        }}
      >
        {cardOrder.map((cardId) => renderCard(cardId))}
      </section>

      {/* ── 2. Sales & Overheads Trend (Sales vs Expenses, Salary, Commission, LD Commission) ── */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={18} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Sales & Overheads Trend</h3>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ff7a3d" }} /> Sales
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ef4444" }} /> Expenses
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#8b5cf6" }} /> Salaries
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#38bdf8" }} /> Commissions
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#2fcf8a" }} /> LD Comm
              </span>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <button
                className={`chip ${trendView === "chart" ? "active" : ""}`}
                onClick={() => setTrendView("chart")}
                title="Chart View"
              >
                <BarChart3 size={13} /> Chart
              </button>
              <button
                className={`chip ${trendView === "table" ? "active" : ""}`}
                onClick={() => setTrendView("table")}
                title="Table View"
              >
                <TableIcon size={13} /> Table
              </button>
            </div>
          </div>
        </div>

        {!d.daily || d.daily.length === 0 ? (
          <Empty text="No daily transactions recorded in this date range" />
        ) : trendView === "chart" ? (
          <div className="bars" style={{ minHeight: 180, alignItems: "flex-end", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
            {(d.daily || []).map((day, idx) => {
              const dayDate = String(day.date || day.day || `Day ${idx + 1}`);
              const salesVal = Number(day.sales ?? day.total ?? 0);
              const expVal = Number(day.expenses || 0);
              const salVal = Number(day.salaries || 0);
              const comVal = Number(day.commissions || 0);
              const ldVal = Number(day.ld_commissions || 0);
              const totalOvh = expVal + salVal + comVal + ldVal;
              const netVal = Number(day.net ?? (salesVal - totalOvh));

              const salesH = Math.max(6, (salesVal / dailyMax) * 100);
              const ovhH = Math.max(6, (totalOvh / dailyMax) * 100);

              const expPct = totalOvh > 0 ? (expVal / totalOvh) * 100 : 0;
              const salPct = totalOvh > 0 ? (salVal / totalOvh) * 100 : 0;
              const comPct = totalOvh > 0 ? (comVal / totalOvh) * 100 : 0;
              const ldPct = totalOvh > 0 ? (ldVal / totalOvh) * 100 : 0;

              return (
                <div
                  key={dayDate || idx}
                  style={{
                    flex: 1,
                    minWidth: 50,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 4,
                      width: "100%",
                      height: 140,
                      justifyContent: "center",
                    }}
                    title={`${dayDate}\nSales: ${peso(salesVal)}\nStore Expenses: ${peso(expVal)}\nSalaries: ${peso(salVal)}\nCommissions: ${peso(comVal)}\nLD Comm: ${peso(ldVal)}\nNet Operating: ${peso(netVal)}`}
                  >
                    {/* Sales Column */}
                    <div
                      style={{
                        width: 16,
                        height: `${salesH}%`,
                        background: "linear-gradient(180deg, #ff7a3d, #ec3f8e)",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />

                    {/* Overheads Stacked Column */}
                    <div
                      style={{
                        width: 16,
                        height: `${ovhH}%`,
                        background: "var(--border)",
                        borderRadius: "4px 4px 0 0",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column-reverse",
                        transition: "height 0.3s ease",
                      }}
                    >
                      {expVal > 0 && <div style={{ height: `${expPct}%`, background: "#ef4444" }} />}
                      {salVal > 0 && <div style={{ height: `${salPct}%`, background: "#8b5cf6" }} />}
                      {comVal > 0 && <div style={{ height: `${comPct}%`, background: "#38bdf8" }} />}
                      {ldVal > 0 && <div style={{ height: `${ldPct}%`, background: "#2fcf8a" }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {dayDate.length >= 5 ? dayDate.slice(5) : dayDate}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Sales</th>
                  <th className="num">Expenses</th>
                  <th className="num">Salaries</th>
                  <th className="num">Commissions</th>
                  <th className="num">LD Comm</th>
                  <th className="num">Total Overheads</th>
                  <th className="num">Net Margin</th>
                </tr>
              </thead>
              <tbody>
                {(d.daily || []).map((day, idx) => {
                  const dayDate = String(day.date || day.day || `Day ${idx + 1}`);
                  const salesVal = Number(day.sales ?? day.total ?? 0);
                  const expVal = Number(day.expenses || 0);
                  const salVal = Number(day.salaries || 0);
                  const comVal = Number(day.commissions || 0);
                  const ldVal = Number(day.ld_commissions || 0);
                  const ovh = expVal + salVal + comVal + ldVal;
                  const netVal = Number(day.net ?? (salesVal - ovh));
                  const isPositive = netVal >= 0;
                  return (
                    <tr key={dayDate || idx} className="row-hover">
                      <td><b>{dayDate}</b></td>
                      <td className="num" style={{ fontWeight: 600, color: "#ff7a3d" }}>{peso(salesVal)}</td>
                      <td className="num" style={{ color: "#ef4444" }}>{peso(expVal)}</td>
                      <td className="num" style={{ color: "#8b5cf6" }}>{peso(salVal)}</td>
                      <td className="num" style={{ color: "#38bdf8" }}>{peso(comVal)}</td>
                      <td className="num" style={{ color: "#2fcf8a" }}>{peso(ldVal)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{peso(ovh)}</td>
                      <td className="num">
                        <span className={"badge " + (isPositive ? "ok" : "bad")}>
                          {isPositive ? `+${peso(netVal)}` : peso(netVal)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 3. Visual Charts (Hourly & Categories) ── */}
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

      {/* ── 4. Top Performer Employees (Highest Income Graph + Export as PDF) ── */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={18} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Top Performer Employees (Highest Income)</h3>
          </div>

          <div style={{ display: "flex", gap: 14, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#8b5cf6" }} /> Base Salary
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#38bdf8" }} /> Commissions
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#2fcf8a" }} /> LD Commissions
            </span>

            <button
              className="btn sm ghost"
              onClick={() => setShowEmployeePdf(true)}
              title="Export as printable PDF report to share"
              style={{ marginLeft: 8 }}
            >
              <Printer size={14} /> Export as PDF
            </button>
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

      {/* ── 5. Detailed Reporting & Full CRUD Playground ── */}
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
              className={`chip ${reportTab === "salary" ? "active" : ""}`}
              onClick={() => setReportTab("salary")}
            >
              <DollarSign size={14} /> Salaries (CRUD)
            </button>
            <button
              className={`chip ${reportTab === "commission" ? "active" : ""}`}
              onClick={() => setReportTab("commission")}
            >
              <Coins size={14} /> Commissions (CRUD)
            </button>
            <button
              className={`chip ${reportTab === "ld_commission" ? "active" : ""}`}
              onClick={() => setReportTab("ld_commission")}
            >
              <Wallet size={14} /> LD Commissions (CRUD)
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
            <button className="btn sm ghost" onClick={exportCsv} title="Export current tab to CSV (select folder)">
              <FileDown size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* ── Sub-Tab: Product Profitability & Ranking ── */}
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

        {/* ── Sub-Tab: Salary CRUD ── */}
        {reportTab === "salary" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Total Salary Payout: <b>{peso(salaryList.reduce((acc, s) => acc + Number(s.amount || 0), 0))}</b> ({salaryList.length} records)
              </div>
              <button
                className="btn sm"
                onClick={() =>
                  setSalaryForm({
                    date: activeBusinessDate || ymd(),
                    employee: employees[0]?.name || "",
                    amount: employees[0]?.salary || "",
                    period: "Daily",
                    note: "",
                  })
                }
              >
                <Plus size={14} /> Record Salary
              </button>
            </div>

            {salaryList.length === 0 ? (
              <Empty text="No salary records found for this period" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Note</th>
                      <th className="num">Amount</th>
                      <th style={{ width: 90 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryList.map((x) => (
                      <tr key={x.id} className="row-hover">
                        <td className="muted">{x.date}</td>
                        <td><b>{x.employee}</b></td>
                        <td className="muted">{x.note || "—"}</td>
                        <td className="num" style={{ fontWeight: 600, color: "#8b5cf6" }}>{peso(x.amount)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              className="btn sm ghost icon"
                              onClick={() => setSalaryForm({ ...x })}
                              title="Edit Salary"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="btn sm ghost icon"
                              onClick={() => deleteSalaryRecord(x)}
                              title="Delete Salary"
                            >
                              <Trash2 size={13} color="var(--bad)" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Sub-Tab: Commission CRUD ── */}
        {reportTab === "commission" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Total Regular Commission: <b>{peso(commissionList.reduce((acc, c) => acc + Number(c.amount || 0), 0))}</b> ({commissionList.length} records)
              </div>
              <button
                className="btn sm"
                onClick={() =>
                  setCommissionForm({
                    date: activeBusinessDate || ymd(),
                    employee_id: employees[0]?.id || null,
                    employee_name: employees[0]?.name || "",
                    type: commissionTypes[0]?.name || "Standard",
                    amount: employees[0]?.commission || "",
                  })
                }
              >
                <Plus size={14} /> Record Commission
              </button>
            </div>

            {commissionList.length === 0 ? (
              <Empty text="No commissions recorded for this period" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Commission Type</th>
                      <th className="num">Amount</th>
                      <th style={{ width: 90 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionList.map((x) => (
                      <tr key={x.id} className="row-hover">
                        <td className="muted">{x.date}</td>
                        <td><b>{x.employee_name}</b></td>
                        <td><span className="badge">{x.type}</span></td>
                        <td className="num" style={{ fontWeight: 600, color: "#38bdf8" }}>{peso(x.amount)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              className="btn sm ghost icon"
                              onClick={() => setCommissionForm({ ...x })}
                              title="Edit Commission"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="btn sm ghost icon"
                              onClick={() => deleteCommissionRecord(x)}
                              title="Delete Commission"
                            >
                              <Trash2 size={13} color="var(--bad)" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Sub-Tab: LD Commission CRUD ── */}
        {reportTab === "ld_commission" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Total LD Commission: <b>{peso(ldList.reduce((acc, c) => acc + Number(c.amount || 0), 0))}</b> ({ldList.length} records)
              </div>
              <button
                className="btn sm"
                onClick={() =>
                  setLdForm({
                    date: activeBusinessDate || ymd(),
                    employee_id: employees[0]?.id || null,
                    employee_name: employees[0]?.name || "",
                    quantity: 1,
                    amount: employees[0]?.ld_commission || "",
                  })
                }
              >
                <Plus size={14} /> Record LD Commission
              </button>
            </div>

            {ldList.length === 0 ? (
              <Empty text="No LD commissions recorded for this period" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th className="num">Qty</th>
                      <th className="num">Total Amount</th>
                      <th style={{ width: 90 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ldList.map((x) => (
                      <tr key={x.id} className="row-hover">
                        <td className="muted">{x.date}</td>
                        <td><b>{x.employee_name}</b></td>
                        <td className="num">{x.quantity || 1}</td>
                        <td className="num" style={{ fontWeight: 600, color: "#2fcf8a" }}>{peso(x.amount)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              className="btn sm ghost icon"
                              onClick={() => setLdForm({ ...x })}
                              title="Edit LD Commission"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="btn sm ghost icon"
                              onClick={() => deleteLdRecord(x)}
                              title="Delete LD Commission"
                            >
                              <Trash2 size={13} color="var(--bad)" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Sub-Tab: Shift Audit & Z-Readings ── */}
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

        {/* ── Sub-Tab: Expense Breakdown by Category ── */}
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

      {/* ── Modal: Salary Create / Edit ── */}
      {salaryForm && (
        <Modal
          title={salaryForm.id ? "Edit Salary" : "Record Salary"}
          onClose={() => setSalaryForm(null)}
        >
          <Field label="Business / Payment Date">
            <input
              type="date"
              value={salaryForm.date || ymd()}
              onChange={(e) => setSalaryForm({ ...salaryForm, date: e.target.value })}
            />
          </Field>

          <Field label="Employee">
            <select
              value={salaryForm.employee || ""}
              onChange={(e) => pickSalaryEmployee(e.target.value)}
            >
              <option value="" disabled>Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} {emp.salary > 0 ? `(${peso(emp.salary)})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Amount (₱)">
            <input
              type="number"
              step="0.01"
              value={salaryForm.amount || ""}
              onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <Field label="Note / Period">
            <input
              type="text"
              value={salaryForm.note || ""}
              onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
              placeholder="e.g. Daily salary, 15th cutoff"
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setSalaryForm(null)}>Cancel</button>
            <button className="btn" onClick={saveSalaryRecord}>Save Salary</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Commission Create / Edit ── */}
      {commissionForm && (
        <Modal
          title={commissionForm.id ? "Edit Commission" : "Record Commission"}
          onClose={() => setCommissionForm(null)}
        >
          <Field label="Date">
            <input
              type="date"
              value={commissionForm.date || ymd()}
              onChange={(e) => setCommissionForm({ ...commissionForm, date: e.target.value })}
            />
          </Field>

          <Field label="Employee">
            <select
              value={commissionForm.employee_id || ""}
              onChange={(e) => pickCommissionEmployee(e.target.value)}
            >
              <option value="" disabled>Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.commission > 0 ? `(Rate: ${peso(emp.commission)})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Commission Type">
            <div style={{ display: "flex", gap: 8 }}>
              <select
                style={{ flex: 1 }}
                value={commissionForm.type || ""}
                onChange={(e) => setCommissionForm({ ...commissionForm, type: e.target.value })}
              >
                <option value="" disabled>Select type</option>
                {commissionTypes.map((t) => (
                  <option key={t.id || t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setNewCommissionType("")}
                title="Create a new commission type"
              >
                <Plus size={14} /> New
              </button>
            </div>
          </Field>

          <Field label="Amount (₱)">
            <input
              type="number"
              step="0.01"
              value={commissionForm.amount || ""}
              onChange={(e) => setCommissionForm({ ...commissionForm, amount: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setCommissionForm(null)}>Cancel</button>
            <button className="btn" onClick={saveCommissionRecord}>Save Commission</button>
          </div>
        </Modal>
      )}

      {/* ── Quick Modal: Add Commission Type ── */}
      {newCommissionType !== null && (
        <Modal title="Add Commission Type" onClose={() => setNewCommissionType(null)}>
          <Field label="Type Name">
            <input
              autoFocus
              type="text"
              placeholder="e.g. Service, Referral, VIP Table"
              value={newCommissionType}
              onChange={(e) => setNewCommissionType(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setNewCommissionType(null)}>Cancel</button>
            <button className="btn" onClick={createCommissionType}>Add Type</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: LD Commission Create / Edit ── */}
      {ldForm && (
        <Modal
          title={ldForm.id ? "Edit LD Commission" : "Record LD Commission"}
          onClose={() => setLdForm(null)}
        >
          <Field label="Date">
            <input
              type="date"
              value={ldForm.date || ymd()}
              onChange={(e) => setLdForm({ ...ldForm, date: e.target.value })}
            />
          </Field>

          <Field label="Employee">
            <select
              value={ldForm.employee_id || ""}
              onChange={(e) => pickLdEmployee(e.target.value)}
            >
              <option value="" disabled>Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.ld_commission > 0 ? `(LD Rate: ${peso(emp.ld_commission)})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <Field label="Quantity">
              <input
                type="number"
                min="1"
                value={ldForm.quantity ?? 1}
                onChange={(e) => changeLdQuantity(e.target.value)}
              />
            </Field>

            <Field label="Total Amount (₱)">
              <input
                type="number"
                step="0.01"
                value={ldForm.amount || ""}
                onChange={(e) => setLdForm({ ...ldForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setLdForm(null)}>Cancel</button>
            <button className="btn" onClick={saveLdRecord}>Save LD Commission</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Printable Top Performer Employees Report (Export as PDF) ── */}
      {showEmployeePdf && (
        <Modal
          title="Export Employee Income & Commission Report"
          onClose={() => setShowEmployeePdf(false)}
        >
          <div className="printable-report" id="printable-admin-employee-report">
            <div style={{ textAlign: "center", borderBottom: "2px solid #222", paddingBottom: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: "#111", letterSpacing: 1 }}>JOYCE POS</h2>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#444", marginTop: 4 }}>
                OFFICIAL EMPLOYEE INCOME & COMMISSION SUMMARY
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Branch: <b>{activeBranch.name}</b> · Period: <b>{from} to {to}</b>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                Generated on: {new Date().toLocaleString()}
              </div>
            </div>

            {!d.top_employees || d.top_employees.length === 0 ? (
              <Empty text="No employee earnings recorded for this date range" />
            ) : (
              <>
                <table className="report-table" style={{ width: "100%", fontSize: 13, marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #333" }}>
                      <th style={{ textAlign: "left", padding: "8px 6px" }}>Rank</th>
                      <th style={{ textAlign: "left", padding: "8px 6px" }}>Employee Name</th>
                      <th style={{ textAlign: "right", padding: "8px 6px" }}>Base Salary</th>
                      <th style={{ textAlign: "right", padding: "8px 6px" }}>Commissions</th>
                      <th style={{ textAlign: "right", padding: "8px 6px" }}>LD Comm</th>
                      <th style={{ textAlign: "right", padding: "8px 6px" }}>Total Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.top_employees.map((emp, idx) => (
                      <tr key={emp.employee_name} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "8px 6px", fontWeight: 600 }}>#{idx + 1}</td>
                        <td style={{ padding: "8px 6px", fontWeight: 600 }}>{emp.employee_name}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right" }}>{peso(emp.salary)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: "#0284c7" }}>{peso(emp.commission)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: "#16a34a" }}>{peso(emp.ld_commission)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: "#111" }}>
                          {peso(emp.total)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: "2px solid #222", background: "#f9fafb", fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: "10px 6px" }}>Grand Total Payout:</td>
                      <td style={{ padding: "10px 6px", textAlign: "right" }}>
                        {peso(d.top_employees.reduce((acc, e) => acc + Number(e.salary || 0), 0))}
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right", color: "#0284c7" }}>
                        {peso(d.top_employees.reduce((acc, e) => acc + Number(e.commission || 0), 0))}
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right", color: "#16a34a" }}>
                        {peso(d.top_employees.reduce((acc, e) => acc + Number(e.ld_commission || 0), 0))}
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontSize: 14 }}>
                        {peso(d.top_employees.reduce((acc, e) => acc + Number(e.total || 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Formal Sign-off lines */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, marginTop: 32, fontSize: 12 }}>
                  <div>
                    <div style={{ borderBottom: "1px solid #333", marginBottom: 4, height: 26 }} />
                    <div style={{ color: "#555" }}>Prepared by (Admin / Accountant)</div>
                  </div>
                  <div>
                    <div style={{ borderBottom: "1px solid #333", marginBottom: 4, height: 26 }} />
                    <div style={{ color: "#555" }}>Approved by (Store Owner / Manager)</div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button className="btn ghost" onClick={() => setShowEmployeePdf(false)}>Close</button>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={16} /> Print / Save as PDF
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Z-Reading ── */}
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
