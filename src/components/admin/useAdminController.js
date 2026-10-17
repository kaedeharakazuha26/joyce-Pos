import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "../../api";
import {
  ymd,
  daysAgo,
  DATE_PRESETS,
  errText,
  downloadBlob,
} from "../../utils";
import { buildExportDataset, buildExcelHtml } from "./adminUtils";

/**
 * Custom Controller Hook for the Admin Dashboard.
 * Encapsulates data loading, date/preset state, contextual filtering,
 * CRUD form submit handlers, bulk deletion, and CSV/Excel/Print export logic.
 */
export function useAdminController({
  toast,
  activeBusinessDate,
  currentUser,
  externalCommand,
  onClearExternalCommand,
}) {
  // 1. Date Range & Preset Filters
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState(() => {
    const p = DATE_PRESETS.find((d) => d.id === "this_month");
    return p ? p.range()[0] : daysAgo(29);
  });
  const [to, setTo] = useState(() => ymd());
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  // 2. Core Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [salesList, setSalesList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [commissionTypes, setCommissionTypes] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // 3. Centralized Report Module & Filter State
  const [reportTab, setReportTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);

  // 4. CRUD Modal States
  const [editingProduct, setEditingProduct] = useState(null);
  const [restockModal, setRestockModal] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingSalary, setEditingSalary] = useState(null);
  const [editingCommission, setEditingCommission] = useState(null);
  const [editingLdCommission, setEditingLdCommission] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingSale, setViewingSale] = useState(null);
  const [voidingSale, setVoidingSale] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [viewingShift, setViewingShift] = useState(null);
  const [shiftNotesDraft, setShiftNotesDraft] = useState("");
  const [viewingAuditItem, setViewingAuditItem] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [newCommTypeModal, setNewCommTypeModal] = useState("");
  const [showAddCommType, setShowAddCommType] = useState(false);

  const reportSectionRef = useRef(null);

  const loadAll = useCallback(
    async (f = from, t = to, isSilent = false) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [
          dashData,
          salesData,
          prodsData,
          empsData,
          commTypesData,
          auditData,
        ] = await Promise.all([
          api.dashboard(f, t),
          api.listSales(f, t, ""),
          api.listProducts(),
          api.listEmployees(),
          api.listCommissionTypes(),
          api.listAuditLog(f, t, 300),
        ]);

        setData(dashData);
        setSalesList(salesData || []);
        setProductsList(prodsData || []);
        setEmployeesList(empsData || []);
        setCommissionTypes(commTypesData || []);
        setAuditLogs(auditData || []);
      } catch (err) {
        const msg = errText(err);
        setError(msg);
        toast(`Failed to load analytics: ${msg}`, "bad");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to, toast]
  );

  useEffect(() => {
    loadAll(from, to);
  }, [from, to, loadAll]);

  useEffect(() => {
    setSelectedIds([]);
  }, [reportTab, search, categoryFilter, statusFilter, staffFilter, from, to]);

  useEffect(() => {
    if (!externalCommand) return;
    if (externalCommand.reportTab) setReportTab(externalCommand.reportTab);
    if (externalCommand.search !== undefined) setSearch(externalCommand.search);
    if (externalCommand.category !== undefined) setCategoryFilter(externalCommand.category);
    if (externalCommand.status !== undefined) setStatusFilter(externalCommand.status);

    if (externalCommand.action === "new_product") {
      setReportTab("products");
      setEditingProduct({
        name: "",
        category: "General",
        price: 0,
        cost: 0,
        stock: 0,
        low_stock: 5,
        image: "",
        variants: [],
      });
    } else if (externalCommand.action === "new_expense") {
      setReportTab("expenses");
      setEditingExpense({
        category: "Supplies",
        description: "",
        amount: "",
        incurred_on: activeBusinessDate || ymd(),
      });
    } else if (externalCommand.action === "new_salary") {
      setReportTab("salaries");
      setEditingSalary({
        staff_name: "",
        role: "",
        amount: "",
        note: "",
        paid_on: activeBusinessDate || ymd(),
      });
    } else if (externalCommand.action === "new_commission") {
      setReportTab("commissions");
      setEditingCommission({
        staff_name: "",
        commission_type: commissionTypes[0] || "Sales Bonus",
        amount: "",
        sales_ref: "",
        rate_pct: 0,
        note: "",
        earned_on: activeBusinessDate || ymd(),
      });
    } else if (externalCommand.action === "new_ld") {
      setReportTab("ld-commissions");
      setEditingLdCommission({
        staff_name: "",
        customer_table: "",
        drink_name: "Ladies Drink",
        quantity: 1,
        unit_comm: 50,
        note: "",
        earned_on: activeBusinessDate || ymd(),
      });
    }
    if (externalCommand.scrollToReports && reportSectionRef.current) {
      reportSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (onClearExternalCommand) onClearExternalCommand();
  }, [externalCommand, onClearExternalCommand, activeBusinessDate, commissionTypes]);

  const handleSelectPreset = (presetId) => {
    setPreset(presetId);
    const found = DATE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      const [f, t] = found.range(activeBusinessDate);
      setDraftFrom(f);
      setDraftTo(t);
      setFrom(f);
      setTo(t);
    }
  };

  const handleApplyDateRange = (e, explicitTo) => {
    if (e && typeof e === "string" && explicitTo) {
      setDraftFrom(e);
      setDraftTo(explicitTo);
      setFrom(e);
      setTo(explicitTo);
      setPreset("custom");
      return;
    }
    if (e && e.preventDefault) e.preventDefault();
    if (draftFrom > draftTo) {
      toast("Start date cannot be after end date.", "warn");
      return;
    }
    setFrom(draftFrom);
    setTo(draftTo);
    setPreset("custom");
  };

  const handleResetAllFilters = () => {
    const def = DATE_PRESETS.find((d) => d.id === "this_month");
    const [f, t] = def ? def.range() : [daysAgo(29), ymd()];
    setPreset("this_month");
    setDraftFrom(f);
    setDraftTo(t);
    setFrom(f);
    setTo(t);
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStaffFilter("all");
  };

  const jumpToReport = (tabId, filters = {}) => {
    setReportTab(tabId);
    setCategoryFilter(filters.category !== undefined ? filters.category : "all");
    setStatusFilter(filters.status !== undefined ? filters.status : "all");
    setStaffFilter(filters.staff !== undefined ? filters.staff : "all");
    setSearch(filters.search !== undefined ? filters.search : "");

    setTimeout(() => {
      if (reportSectionRef.current) {
        reportSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  const allProductCategories = useMemo(() => {
    const set = new Set();
    productsList.forEach((p) => p.category && set.add(p.category));
    (data?.by_category || []).forEach((c) => c.category && set.add(c.category));
    return Array.from(set).sort();
  }, [productsList, data]);

  const allStaffNames = useMemo(() => {
    const set = new Set();
    employeesList.forEach((e) => e.name && set.add(e.name));
    (data?.employee_performance || []).forEach((e) => e.staff_name && set.add(e.staff_name));
    return Array.from(set).sort();
  }, [employeesList, data]);

  const qLower = search.trim().toLowerCase();

  const filteredSales = useMemo(() => {
    return salesList.filter((s) => {
      if (
        statusFilter !== "all" &&
        statusFilter !== "healthy" &&
        statusFilter !== "low" &&
        statusFilter !== "out"
      ) {
        if (s.status !== statusFilter) return false;
      }
      if (categoryFilter !== "all") {
        const hasCat = (s.items || []).some((i) => {
          const prod = productsList.find((p) => p.id === i.product_id);
          return (prod?.category || "General") === categoryFilter;
        });
        if (!hasCat) return false;
      }
      if (qLower) {
        const matchReceipt = s.receipt_no?.toLowerCase().includes(qLower);
        const matchItem = (s.items || []).some((i) => i.name?.toLowerCase().includes(qLower));
        if (!matchReceipt && !matchItem) return false;
      }
      return true;
    });
  }, [salesList, statusFilter, categoryFilter, qLower, productsList]);

  const filteredProducts = useMemo(() => {
    const perfMap = new Map();
    (data?.catalog_performance || []).forEach((cp) => perfMap.set(cp.id, cp));

    return productsList
      .map((p) => {
        const perf = perfMap.get(p.id) || {};
        const soldQty = Number(perf.sold_qty || 0);
        const revenue = Number(perf.revenue || 0);
        const profit = Number(perf.profit || 0);
        const marginPct = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
        const stockStatus = p.stock <= 0 ? "out" : p.stock <= p.low_stock ? "low" : "healthy";
        return {
          ...p,
          sold_qty: soldQty,
          period_revenue: revenue,
          period_profit: profit,
          margin_pct: marginPct,
          stock_value: Number(p.stock || 0) * Number(p.cost || 0),
          retail_value: Number(p.stock || 0) * Number(p.price || 0),
          stock_status: stockStatus,
        };
      })
      .filter((p) => {
        if (categoryFilter !== "all" && (p.category || "General") !== categoryFilter) return false;
        if (statusFilter === "healthy" && p.stock_status !== "healthy") return false;
        if (statusFilter === "low" && p.stock_status !== "low") return false;
        if (statusFilter === "out" && p.stock_status !== "out") return false;
        if (qLower) {
          const match =
            p.name?.toLowerCase().includes(qLower) ||
            p.category?.toLowerCase().includes(qLower);
          if (!match) return false;
        }
        return true;
      });
  }, [productsList, data?.catalog_performance, categoryFilter, statusFilter, qLower]);

  const filteredExpenses = useMemo(() => {
    return (data?.expenses_list || []).filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (qLower) {
        const match =
          e.category?.toLowerCase().includes(qLower) ||
          e.description?.toLowerCase().includes(qLower) ||
          e.incurred_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.expenses_list, categoryFilter, qLower]);

  const filteredSalaries = useMemo(() => {
    return (data?.salaries_list || []).filter((s) => {
      if (staffFilter !== "all" && s.staff_name !== staffFilter) return false;
      if (qLower) {
        const match =
          s.staff_name?.toLowerCase().includes(qLower) ||
          s.role?.toLowerCase().includes(qLower) ||
          s.note?.toLowerCase().includes(qLower) ||
          s.paid_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.salaries_list, staffFilter, qLower]);

  const filteredCommissions = useMemo(() => {
    return (data?.commissions_list || []).filter((c) => {
      if (staffFilter !== "all" && c.staff_name !== staffFilter) return false;
      if (categoryFilter !== "all" && c.commission_type !== categoryFilter) return false;
      if (qLower) {
        const match =
          c.staff_name?.toLowerCase().includes(qLower) ||
          c.commission_type?.toLowerCase().includes(qLower) ||
          c.note?.toLowerCase().includes(qLower) ||
          c.earned_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.commissions_list, staffFilter, categoryFilter, qLower]);

  const filteredLdCommissions = useMemo(() => {
    return (data?.ld_commissions_list || []).filter((c) => {
      if (staffFilter !== "all" && c.staff_name !== staffFilter) return false;
      if (qLower) {
        const match =
          c.staff_name?.toLowerCase().includes(qLower) ||
          c.customer_table?.toLowerCase().includes(qLower) ||
          c.drink_name?.toLowerCase().includes(qLower) ||
          c.note?.toLowerCase().includes(qLower) ||
          c.earned_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.ld_commissions_list, staffFilter, qLower]);

  const filteredEmployees = useMemo(() => {
    const perfMap = new Map();
    (data?.employee_performance || []).forEach((ep) => perfMap.set(ep.staff_name.toLowerCase(), ep));

    return employeesList
      .map((emp) => {
        const perf = perfMap.get((emp.name || "").toLowerCase()) || {};
        return {
          ...emp,
          salary_total: Number(perf.salary_total || 0),
          commission_total: Number(perf.commission_total || 0),
          ld_total: Number(perf.ld_total || 0),
          ld_drinks: Number(perf.ld_drinks || 0),
          total_payout: Number(perf.total_payout || 0),
        };
      })
      .filter((emp) => {
        if (staffFilter !== "all" && emp.name !== staffFilter) return false;
        if (qLower) {
          const match =
            emp.name?.toLowerCase().includes(qLower) ||
            emp.role?.toLowerCase().includes(qLower) ||
            emp.contact?.toLowerCase().includes(qLower);
          if (!match) return false;
        }
        return true;
      });
  }, [employeesList, data?.employee_performance, staffFilter, qLower]);

  const filteredShifts = useMemo(() => {
    return (data?.shifts || []).filter((s) => {
      const v = Number(s.variance || 0);
      if (statusFilter === "open" && s.status !== "open") return false;
      if (statusFilter === "closed" && s.status !== "closed") return false;
      if (statusFilter === "balanced" && (s.status !== "closed" || Math.abs(v) >= 0.01)) return false;
      if (statusFilter === "overage" && (s.status !== "closed" || v < 0.01)) return false;
      if (statusFilter === "shortage" && (s.status !== "closed" || v > -0.01)) return false;
      if (qLower) {
        const match =
          s.business_date?.toLowerCase().includes(qLower) ||
          s.opened_by?.toLowerCase().includes(qLower) ||
          s.closed_by?.toLowerCase().includes(qLower) ||
          s.notes?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.shifts, statusFilter, qLower]);

  const filteredAudit = useMemo(() => {
    return auditLogs.filter((a) => {
      if (statusFilter !== "all" && a.action?.toLowerCase() !== statusFilter.toLowerCase()) {
        if (
          ["create", "update", "delete", "void", "restock", "shift_open", "shift_close"].includes(
            statusFilter
          )
        ) {
          return false;
        }
      }
      if (qLower) {
        const match =
          a.summary?.toLowerCase().includes(qLower) ||
          a.actor?.toLowerCase().includes(qLower) ||
          a.entity_type?.toLowerCase().includes(qLower) ||
          a.action?.toLowerCase().includes(qLower) ||
          a.timestamp?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [auditLogs, statusFilter, qLower]);

  // CRUD Submit Handlers
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct.name?.trim()) return toast("Product name is required", "bad");
    if (Number(editingProduct.price) < 0) return toast("Price cannot be negative", "bad");
    try {
      await api.saveProduct({
        ...editingProduct,
        name: editingProduct.name.trim(),
        category: (editingProduct.category || "General").trim(),
        price: Number(editingProduct.price) || 0,
        cost: Number(editingProduct.cost) || 0,
        stock: Number(editingProduct.stock) || 0,
        low_stock: Number(editingProduct.low_stock) || 0,
        variants: (editingProduct.variants || [])
          .filter((v) => v.name && v.name.trim())
          .map((v) => ({ name: v.name.trim(), price: Number(v.price) || 0 })),
      });
      toast(editingProduct.id ? "Product updated" : "Product added to catalog");
      setEditingProduct(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockModal?.product) return;
    const qty = Number(restockModal.qty || 0);
    if (qty <= 0) return toast("Restock quantity must be greater than 0", "bad");
    try {
      await api.restock(
        restockModal.product.id,
        qty,
        Number(restockModal.unitCost || 0),
        restockModal.note || ""
      );
      toast(`Restocked +${qty} ${restockModal.product.name}`);
      setRestockModal(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const amt = Number(editingExpense?.amount || 0);
    if (amt <= 0) return toast("Expense amount must be greater than zero", "bad");
    try {
      await api.saveExpense({
        ...editingExpense,
        amount: amt,
        category: editingExpense.category || "Other",
        description: editingExpense.description || "",
        incurred_on: editingExpense.incurred_on || activeBusinessDate || ymd(),
      });
      toast(editingExpense.id ? "Expense updated" : "Expense recorded");
      setEditingExpense(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!editingSalary?.staff_name?.trim()) return toast("Staff name is required", "bad");
    const amt = Number(editingSalary?.amount || 0);
    if (amt <= 0) return toast("Salary amount must be greater than zero", "bad");
    try {
      await api.saveSalary({
        ...editingSalary,
        staff_name: editingSalary.staff_name.trim(),
        role: editingSalary.role || "",
        amount: amt,
        note: editingSalary.note || "",
        paid_on: editingSalary.paid_on || activeBusinessDate || ymd(),
      });
      toast(editingSalary.id ? "Salary record updated" : "Salary payment recorded");
      setEditingSalary(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveCommission = async (e) => {
    e.preventDefault();
    if (!editingCommission?.staff_name?.trim()) return toast("Staff name is required", "bad");
    const amt = Number(editingCommission?.amount || 0);
    if (amt <= 0) return toast("Commission amount must be greater than zero", "bad");
    try {
      await api.saveCommission({
        ...editingCommission,
        staff_name: editingCommission.staff_name.trim(),
        commission_type: editingCommission.commission_type || "Sales Bonus",
        amount: amt,
        sales_ref: editingCommission.sales_ref || "",
        rate_pct: Number(editingCommission.rate_pct || 0),
        note: editingCommission.note || "",
        earned_on: editingCommission.earned_on || activeBusinessDate || ymd(),
      });
      toast(editingCommission.id ? "Commission updated" : "Commission recorded");
      setEditingCommission(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveLdCommission = async (e) => {
    e.preventDefault();
    if (!editingLdCommission?.staff_name?.trim()) return toast("Staff name is required", "bad");
    const qty = Number(editingLdCommission?.quantity || 0);
    const unit = Number(editingLdCommission?.unit_comm || 0);
    if (qty <= 0 || unit <= 0)
      return toast("Quantity and rate per drink must be greater than zero", "bad");
    try {
      await api.saveLdCommission({
        ...editingLdCommission,
        staff_name: editingLdCommission.staff_name.trim(),
        customer_table: editingLdCommission.customer_table || "",
        drink_name: editingLdCommission.drink_name || "Ladies Drink",
        quantity: qty,
        unit_comm: unit,
        total: qty * unit,
        note: editingLdCommission.note || "",
        earned_on: editingLdCommission.earned_on || activeBusinessDate || ymd(),
      });
      toast(editingLdCommission.id ? "LD Commission updated" : "LD Commission recorded");
      setEditingLdCommission(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmployee?.name?.trim()) return toast("Employee full name is required", "bad");
    try {
      await api.saveEmployee({
        ...editingEmployee,
        name: editingEmployee.name.trim(),
        role: (editingEmployee.role || "").trim(),
        contact: (editingEmployee.contact || "").trim(),
        daily_rate: Number(editingEmployee.daily_rate || 0),
        hired_on: editingEmployee.hired_on || ymd(),
      });
      toast(editingEmployee.id ? "Employee profile updated" : "New employee added");
      setEditingEmployee(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleVoidSaleSubmit = async (e) => {
    e.preventDefault();
    if (!voidingSale) return;
    if (!voidReason.trim()) return toast("Please enter a reason for voiding this receipt", "bad");
    try {
      await api.voidSale(voidingSale.id, voidReason.trim(), currentUser?.name || "Admin");
      toast(`Receipt ${voidingSale.receipt_no} voided & stock restored`);
      setVoidingSale(null);
      setVoidReason("");
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveShiftNotes = async (e) => {
    e.preventDefault();
    if (!viewingShift) return;
    try {
      await api.updateShiftNotes(viewingShift.id, shiftNotesDraft);
      toast("Shift audit notes saved");
      setViewingShift((s) => (s ? { ...s, notes: shiftNotesDraft } : null));
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const labelMap = {
      products: "products (will be safely archived)",
      expenses: "expense records",
      salaries: "salary records",
      commissions: "commission records",
      "ld-commissions": "LD commission records",
      employees: "employee profiles (will be safely archived)",
    };
    const targetName = labelMap[reportTab];
    if (!targetName) return;

    setConfirmAction({
      title: `Confirm Bulk Action (${selectedIds.length} selected)`,
      message: `Are you sure you want to remove ${selectedIds.length} selected ${targetName}?`,
      detail: "All changes are logged in the Activity & Audit Trail.",
      confirmLabel: `Remove ${selectedIds.length} Records`,
      onConfirm: async () => {
        try {
          for (const id of selectedIds) {
            if (reportTab === "products") await api.deleteProduct(id);
            else if (reportTab === "expenses") await api.deleteExpense(id);
            else if (reportTab === "salaries") await api.deleteSalary(id);
            else if (reportTab === "commissions") await api.deleteCommission(id);
            else if (reportTab === "ld-commissions") await api.deleteLdCommission(id);
            else if (reportTab === "employees") await api.deleteEmployee(id);
          }
          toast(`Processed ${selectedIds.length} records`);
          setSelectedIds([]);
          setConfirmAction(null);
          loadAll(from, to, true);
        } catch (err) {
          toast(errText(err), "bad");
        }
      },
    });
  };

  const getExportDataset = () =>
    buildExportDataset({
      reportTab,
      filteredSales,
      filteredProducts,
      filteredExpenses,
      filteredSalaries,
      filteredCommissions,
      filteredLdCommissions,
      filteredEmployees,
      filteredShifts,
      filteredAudit,
      daily: data?.daily || [],
    });

  const handleExportCSV = () => {
    const ds = getExportDataset();
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ds.headers.map(esc).join(","),
      ...ds.rows.map((r) => r.map(esc).join(",")),
    ];
    downloadBlob(`${ds.title}_${from}_to_${to}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
    toast(`Exported ${ds.rows.length} rows to CSV`);
  };

  const handleExportExcel = () => {
    const ds = getExportDataset();
    const html = buildExcelHtml({
      ds,
      from,
      to,
      categoryFilter,
      statusFilter,
      staffFilter,
      search,
    });
    downloadBlob(`${ds.title}_${from}_to_${to}.xls`, html, "application/vnd.ms-excel");
    toast(`Exported ${ds.rows.length} rows to Excel (.xls)`);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const activeFiltersList = [];
  if (categoryFilter !== "all")
    activeFiltersList.push({
      label: `Category: ${categoryFilter}`,
      clear: () => setCategoryFilter("all"),
    });
  if (statusFilter !== "all")
    activeFiltersList.push({
      label: `Status: ${statusFilter.toUpperCase()}`,
      clear: () => setStatusFilter("all"),
    });
  if (staffFilter !== "all")
    activeFiltersList.push({
      label: `Staff: ${staffFilter}`,
      clear: () => setStaffFilter("all"),
    });
  if (search.trim())
    activeFiltersList.push({
      label: `Search: "${search.trim()}"`,
      clear: () => setSearch(""),
    });

  return {
    preset,
    from,
    to,
    draftFrom,
    setDraftFrom,
    draftTo,
    setDraftTo,
    loading,
    refreshing,
    error,
    data,
    employeesList,
    commissionTypes,
    setCommissionTypes,
    auditLogs,
    reportTab,
    setReportTab,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    staffFilter,
    setStaffFilter,
    selectedIds,
    setSelectedIds,
    editingProduct,
    setEditingProduct,
    restockModal,
    setRestockModal,
    editingExpense,
    setEditingExpense,
    editingSalary,
    setEditingSalary,
    editingCommission,
    setEditingCommission,
    editingLdCommission,
    setEditingLdCommission,
    editingEmployee,
    setEditingEmployee,
    viewingSale,
    setViewingSale,
    voidingSale,
    setVoidingSale,
    voidReason,
    setVoidReason,
    viewingShift,
    setViewingShift,
    shiftNotesDraft,
    setShiftNotesDraft,
    viewingAuditItem,
    setViewingAuditItem,
    confirmAction,
    setConfirmAction,
    newCommTypeModal,
    setNewCommTypeModal,
    showAddCommType,
    setShowAddCommType,
    reportSectionRef,
    loadAll,
    handleSelectPreset,
    handleApplyDateRange,
    handleResetAllFilters,
    jumpToReport,
    allProductCategories,
    allStaffNames,
    filteredSales,
    filteredProducts,
    filteredExpenses,
    filteredSalaries,
    filteredCommissions,
    filteredLdCommissions,
    filteredEmployees,
    filteredShifts,
    filteredAudit,
    handleSaveProduct,
    handleRestockSubmit,
    handleSaveExpense,
    handleSaveSalary,
    handleSaveCommission,
    handleSaveLdCommission,
    handleSaveEmployee,
    handleVoidSaleSubmit,
    handleSaveShiftNotes,
    handleBulkDelete,
    handleExportCSV,
    handleExportExcel,
    handlePrintReport,
    activeFiltersList,
  };
}
