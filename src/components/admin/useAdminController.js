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
 * Encapsulates data loading, normalization against the Rust SQLite schema,
 * date/preset state, contextual filtering, CRUD form submit handlers,
 * bulk deletion, Google Drive EOD snapshot trigger, and CSV/Excel/Print export logic.
 */
export function useAdminController({
  toast: propToast,
  activeBusinessDate: propBusinessDate,
  currentUser,
  externalCommand,
  onClearExternalCommand,
  refreshBranchInfo,
}) {
  const safeToast = useCallback(
    (msg, type) => {
      if (typeof propToast === "function") {
        propToast(msg, type === "bad" ? "err" : type);
      } else {
        console.log(`[Toast ${type || "ok"}]:`, msg);
      }
    },
    [propToast]
  );

  const activeBusinessDate = propBusinessDate || ymd();

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
  const [syncingGdrive, setSyncingGdrive] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [salesList, setSalesList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [commissionTypes, setCommissionTypes] = useState([
    "Sales",
    "Bonus",
    "Referral",
  ]);
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
          rawDash,
          salesData,
          prodsData,
          expensesData,
          salariesData,
          commissionsData,
          ldCommissionsData,
          empsData,
          commTypesData,
          auditData,
        ] = await Promise.all([
          api.adminDashboard(f, t),
          api.sales(f, t, ""),
          api.products(),
          api.expenses(f, t),
          api.salaries(f, t),
          api.commissions(f, t),
          api.ldCommissions(f, t),
          api.employees(),
          api.commissionTypes(),
          api.auditLogs(f, t, 300),
        ]);

        const normEmployees = (empsData || []).map((emp) => ({
          ...emp,
          role: emp.position || emp.role || "Staff",
          daily_rate: Number(emp.salary ?? emp.daily_rate ?? 0),
          contact: emp.contact || `Comm: ₱${Number(emp.commission || 0)} | LD: ₱${Number(emp.ld_commission || 0)}`,
          hired_on: (emp.created_at || emp.hired_on || "").slice(0, 10) || ymd(),
        }));

        const normExpenses = (expensesData || []).map((ex) => ({
          ...ex,
          incurred_on: ex.date || ex.incurred_on || ymd(),
        }));

        const normSalaries = (salariesData || []).map((sal) => ({
          ...sal,
          staff_name: sal.employee || sal.staff_name || "Staff",
          role: sal.period || sal.role || "Regular Period",
          paid_on: sal.date || sal.paid_on || ymd(),
        }));

        const normCommissions = (commissionsData || []).map((c) => ({
          ...c,
          staff_name: c.employee_name || c.staff_name || "Staff",
          commission_type: c.type || c.commission_type || "Sales",
          earned_on: c.date || c.earned_on || ymd(),
          sales_ref: c.sales_ref || "",
          rate_pct: Number(c.rate_pct || 0),
          note: c.note || "",
        }));

        const normLdCommissions = (ldCommissionsData || []).map((ld) => {
          const qty = Number(ld.quantity || 1);
          const amt = Number(ld.amount ?? ld.total ?? 0);
          return {
            ...ld,
            staff_name: ld.employee_name || ld.staff_name || "Staff",
            customer_table: ld.customer_table || "POS / Bar",
            drink_name: ld.drink_name || "Ladies Drink (LD)",
            quantity: qty,
            unit_comm: qty > 0 ? amt / qty : amt,
            total: amt,
            amount: amt,
            note: ld.note || "",
            earned_on: ld.date || ld.earned_on || ymd(),
          };
        });

        // Count LD drinks per employee
        const ldDrinksByStaff = {};
        normLdCommissions.forEach((ld) => {
          const k = (ld.staff_name || "").toLowerCase();
          ldDrinksByStaff[k] = (ldDrinksByStaff[k] || 0) + Number(ld.quantity || 0);
        });

        const empRoleByName = {};
        normEmployees.forEach((e) => {
          empRoleByName[(e.name || "").toLowerCase()] = e.role || "Staff";
        });

        const normEmpPerf = (rawDash?.top_employees || []).map((ep) => {
          const sName = ep.employee_name || ep.staff_name || "Staff";
          const k = sName.toLowerCase();
          return {
            ...ep,
            staff_name: sName,
            role: empRoleByName[k] || "Staff",
            salary_total: Number(ep.salary ?? ep.salary_total ?? 0),
            commission_total: Number(ep.commission ?? ep.commission_total ?? 0),
            ld_total: Number(ep.ld_commission ?? ep.ld_total ?? 0),
            ld_drinks: ldDrinksByStaff[k] || 0,
            total_payout: Number(ep.total ?? ep.total_payout ?? 0),
          };
        });

        const normDaily = (rawDash?.daily || []).map((d) => {
          const salesVal = Number(d.sales ?? d.total ?? 0);
          const cogsVal = Number(d.cogs || 0);
          const gpVal = Number(d.gross_profit ?? salesVal - cogsVal);
          const expVal = Number(d.expenses || 0);
          const salVal = Number(d.salaries || 0);
          const comVal = Number(d.commissions || 0);
          const ldVal = Number(d.ld_commissions || 0);
          const netVal = Number(
            d.net_after_cogs ?? d.net ?? gpVal - expVal - salVal - comVal - ldVal
          );
          return {
            ...d,
            date: d.day || d.date,
            total: salesVal,
            sales: salesVal,
            cogs: cogsVal,
            gross_profit: gpVal,
            expenses: expVal,
            salaries: salVal,
            commissions: comVal,
            ld_commissions: ldVal,
            net: netVal,
            count: Number(d.count || 0),
          };
        });

        const normPrevDaily = (rawDash?.previous_period?.daily || []).map((d) => ({
          ...d,
          date: d.day || d.date,
          total: Number(d.sales ?? d.total ?? 0),
        }));

        const normShifts = (rawDash?.shift_history || []).map((s) => ({
          ...s,
          variance:
            s.status === "closed"
              ? Number(s.closing_cash || 0) - Number(s.expected_cash || 0)
              : 0,
        }));

        const normAlerts = (rawDash?.alerts || []).map((a) => ({
          ...a,
          message: a.description || a.message || "",
          actionTab: a.target_tab || a.actionTab || "overview",
          actionFilter:
            a.filter === "low_stock"
              ? "low"
              : a.filter === "out_of_stock"
              ? "out"
              : a.filter,
        }));

        const normalizedDashboard = {
          ...rawDash,
          financials: {
            revenue: Number(rawDash?.revenue || 0),
            gross_sales: Number(rawDash?.revenue || 0),
            orders: Number(rawDash?.orders || 0),
            completed_orders: Number(rawDash?.orders || 0),
            avg_ticket: Number(rawDash?.avg_ticket || 0),
            cogs: Number(rawDash?.cogs || 0),
            gross_profit: Number(rawDash?.gross_profit || 0),
            gross_margin: Number(rawDash?.gross_margin || 0),
            gross_margin_pct: Number(rawDash?.gross_margin || 0),
            expenses: Number(rawDash?.expenses || 0),
            expenses_total: Number(rawDash?.expenses || 0),
            salaries: Number(rawDash?.salaries || 0),
            salaries_total: Number(rawDash?.salaries || 0),
            commissions: Number(rawDash?.commissions || 0),
            commissions_total: Number(rawDash?.commissions || 0),
            ld_commissions: Number(rawDash?.ld_commissions || 0),
            ld_commissions_total: Number(rawDash?.ld_commissions || 0),
            total_overheads: Number(rawDash?.total_overheads || 0),
            net_profit: Number(rawDash?.net_profit || 0),
            net_margin: Number(rawDash?.net_margin || 0),
            net_margin_pct: Number(rawDash?.net_margin || 0),
            void_total: Number(rawDash?.voided_total || 0),
            voided_total: Number(rawDash?.voided_total || 0),
            void_count: Number(rawDash?.voided_count || 0),
            voided_count: Number(rawDash?.voided_count || 0),
            void_rate_pct: Number(rawDash?.void_rate || 0),
            stock_cost_value: Number(rawDash?.inventory_cost || 0),
            inventory_cost_value: Number(rawDash?.inventory_cost || 0),
            stock_retail_value: Number(rawDash?.inventory_retail || 0),
            inventory_retail_value: Number(rawDash?.inventory_retail || 0),
          },
          previous: {
            gross_sales: Number(rawDash?.previous_period?.revenue || 0),
            completed_orders: Number(rawDash?.previous_period?.orders || 0),
            cogs: Number(rawDash?.previous_period?.cogs || 0),
            gross_profit: Number(rawDash?.previous_period?.gross_profit || 0),
            total_overheads: Number(rawDash?.previous_period?.total_overheads || 0),
            net_profit: Number(rawDash?.previous_period?.net_profit || 0),
            voided_total: Number(rawDash?.previous_period?.voided_total || 0),
            daily: normPrevDaily,
          },
          today: {
            date: rawDash?.today?.date || activeBusinessDate,
            sales: Number(rawDash?.today?.revenue || 0),
            orders: Number(rawDash?.today?.orders || 0),
            records_created: Number(rawDash?.today?.records_created || 0),
            net_profit: Number(rawDash?.today?.net_profit || 0),
          },
          mtd: {
            from: rawDash?.mtd?.from || f,
            to: rawDash?.mtd?.to || t,
            sales: Number(rawDash?.mtd?.revenue || 0),
            orders: Number(rawDash?.mtd?.orders || 0),
            gross_profit: Number(rawDash?.mtd?.gross_profit || 0),
            overheads: Number(rawDash?.mtd?.total_overheads || 0),
            net_profit: Number(rawDash?.mtd?.net_profit || 0),
          },
          counts: {
            ...(rawDash?.counts || {}),
            low_stock: Number(rawDash?.counts?.products_low_stock || 0),
            out_of_stock: Number(rawDash?.counts?.products_out_of_stock || 0),
            healthy_stock: Number(rawDash?.counts?.products_healthy || 0),
            active_products: Number(rawDash?.counts?.products_active || 0),
            active_employees: Number(rawDash?.counts?.employees_active || 0),
            expenses_count: Number(rawDash?.counts?.expenses_count || normExpenses.length),
            salaries_count: Number(rawDash?.counts?.salaries_count || normSalaries.length),
            commissions_count: Number(rawDash?.counts?.commissions_count || normCommissions.length),
            ld_commissions_count: Number(rawDash?.counts?.ld_commissions_count || normLdCommissions.length),
          },
          daily: normDaily,
          by_category: rawDash?.categories || [],
          expenses_by_category: rawDash?.expense_categories || [],
          top_products: (rawDash?.product_performance || []).map((p) => ({
            ...p,
            total: Number(p.revenue ?? p.total ?? 0),
            qty: Number(p.qty || 0),
            profit: Number(p.profit || 0),
          })),
          catalog_performance: rawDash?.catalog_performance || [],
          employee_performance: normEmpPerf,
          expenses_list: normExpenses,
          salaries_list: normSalaries,
          commissions_list: normCommissions,
          ld_commissions_list: normLdCommissions,
          shifts: normShifts,
          alerts: normAlerts,
        };

        setData(normalizedDashboard);
        setSalesList(salesData || []);
        setProductsList(prodsData || []);
        setEmployeesList(normEmployees);
        const normCommTypes = (commTypesData || [])
          .map((ct) => (typeof ct === "string" ? ct : ct?.name))
          .filter(Boolean);
        setCommissionTypes(normCommTypes.length ? normCommTypes : ["Sales", "Bonus", "Referral"]);
        setAuditLogs(auditData || []);
      } catch (err) {
        const msg = errText(err);
        setError(msg);
        safeToast(`Failed to load analytics: ${msg}`, "bad");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to, activeBusinessDate, safeToast]
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
    if (externalCommand.statusFilter !== undefined) setStatusFilter(externalCommand.statusFilter);

    const openAction = externalCommand.action || externalCommand.openModal;
    if (openAction === "new_product" || openAction === "add-product") {
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
    } else if (openAction === "new_expense" || openAction === "add-expense") {
      setReportTab("expenses");
      setEditingExpense({
        category: "Supplies",
        description: "",
        amount: "",
        incurred_on: activeBusinessDate || ymd(),
      });
    } else if (openAction === "new_salary" || openAction === "add-salary") {
      setReportTab("salaries");
      setEditingSalary({
        staff_name: "",
        role: "",
        amount: "",
        note: "",
        paid_on: activeBusinessDate || ymd(),
      });
    } else if (openAction === "new_commission" || openAction === "add-commission") {
      setReportTab("commissions");
      setEditingCommission({
        staff_name: "",
        commission_type: commissionTypes[0] || "Sales",
        amount: "",
        sales_ref: "",
        rate_pct: 0,
        note: "",
        earned_on: activeBusinessDate || ymd(),
      });
    } else if (openAction === "new_ld" || openAction === "add-ld") {
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
      safeToast("Start date cannot be after end date.", "warn");
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

  const handleSyncGdriveNow = async () => {
    setSyncingGdrive(true);
    try {
      const res = await api.syncToGdrive();
      if (refreshBranchInfo) await refreshBranchInfo();
      safeToast(
        res?.is_google_drive
          ? `☁️ Atomic snapshot saved to Google Drive (${res.archive_path})`
          : `📁 Atomic snapshot saved to local EOD_Backups (${res?.archive_path || ""})`
      );
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    } finally {
      setSyncingGdrive(false);
    }
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
    (data?.employee_performance || []).forEach((ep) =>
      perfMap.set((ep.staff_name || "").toLowerCase(), ep)
    );

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

  // CRUD Submit Handlers (mapped to exact SQLite column names in cmds.rs)
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct.name?.trim()) return safeToast("Product name is required", "bad");
    if (Number(editingProduct.price) < 0) return safeToast("Price cannot be negative", "bad");
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
          .map((v) => ({
            name: v.name.trim(),
            qty: Number(v.qty || 1),
            price: Number(v.price) || 0,
          })),
      });
      safeToast(editingProduct.id ? "Product updated" : "Product added to catalog");
      setEditingProduct(null);
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockModal?.product) return;
    const qty = Number(restockModal.qty || 0);
    if (qty <= 0) return safeToast("Restock quantity must be greater than 0", "bad");
    try {
      await api.restock(
        restockModal.product.id,
        qty,
        Number(restockModal.unitCost || 0),
        restockModal.note || ""
      );
      safeToast(`Restocked +${qty} ${restockModal.product.name}`);
      setRestockModal(null);
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const amt = Number(editingExpense?.amount || 0);
    if (amt <= 0) return safeToast("Expense amount must be greater than zero", "bad");
    const dateVal = editingExpense.incurred_on || editingExpense.date || activeBusinessDate || ymd();
    try {
      await api.saveExpense({
        id: editingExpense.id,
        amount: amt,
        category: editingExpense.category || "General",
        description: editingExpense.description || "",
        date: dateVal,
        incurred_on: dateVal,
      });
      safeToast(editingExpense.id ? "Expense updated" : "Expense recorded");
      setEditingExpense(null);
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    const empName = (editingSalary?.staff_name || editingSalary?.employee || "").trim();
    if (!empName) return safeToast("Staff name is required", "bad");
    const amt = Number(editingSalary?.amount || 0);
    if (amt <= 0) return safeToast("Salary amount must be greater than zero", "bad");
    const dateVal = editingSalary.paid_on || editingSalary.date || activeBusinessDate || ymd();
    try {
      await api.saveSalary({
        id: editingSalary.id,
        employee: empName,
        staff_name: empName,
        period: editingSalary.role || editingSalary.period || "",
        amount: amt,
        note: editingSalary.note || "",
        date: dateVal,
      });
      safeToast(editingSalary.id ? "Salary record updated" : "Salary payment recorded");
      setEditingSalary(null);
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleSaveCommission = async (e) => {
    e.preventDefault();
    const empName = (editingCommission?.staff_name || editingCommission?.employee_name || "").trim();
    if (!empName) return safeToast("Staff name is required", "bad");
    const amt = Number(editingCommission?.amount || 0);
    if (amt <= 0) return safeToast("Commission amount must be greater than zero", "bad");
    const dateVal = editingCommission.earned_on || editingCommission.date || activeBusinessDate || ymd();
    try {
      await api.saveCommission({
        id: editingCommission.id,
        employee_name: empName,
        staff_name: empName,
        type: editingCommission.commission_type || editingCommission.type || "Sales",
        amount: amt,
        date: dateVal,
      });
      safeToast(editingCommission.id ? "Commission updated" : "Commission recorded");
      setEditingCommission(null);
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleSaveLdCommission = async (e) => {
    e.preventDefault();
    const empName = (editingLdCommission?.staff_name || editingLdCommission?.employee_name || "").trim();
    if (!empName) return safeToast("Staff name is required", "bad");
    const qty = Number(editingLdCommission?.quantity || 0);
    const unit = Number(editingLdCommission?.unit_comm || 0);
    if (qty <= 0 || unit <= 0)
      return safeToast("Quantity and rate per drink must be greater than zero", "bad");
    const dateVal = editingLdCommission.earned_on || editingLdCommission.date || activeBusinessDate || ymd();
    try {
      await api.saveLdCommission({
        id: editingLdCommission.id,
        employee_name: empName,
        staff_name: empName,
        quantity: qty,
        amount: qty * unit,
        total: qty * unit,
        date: dateVal,
      });
      safeToast(editingLdCommission.id ? "LD Commission updated" : "LD Commission recorded");
      setEditingLdCommission(null);
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmployee?.name?.trim()) return safeToast("Employee full name is required", "bad");
    try {
      await api.saveEmployee({
        id: editingEmployee.id,
        name: editingEmployee.name.trim(),
        position: (editingEmployee.role || editingEmployee.position || "").trim(),
        salary: Number(editingEmployee.daily_rate ?? editingEmployee.salary ?? 0),
        commission: Number(editingEmployee.commission || 0),
        ld_commission: Number(editingEmployee.ld_commission || 50),
      });
      safeToast(editingEmployee.id ? "Employee profile updated" : "New employee added");
      setEditingEmployee(null);
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleVoidSaleSubmit = async (e) => {
    e.preventDefault();
    if (!voidingSale) return;
    if (!voidReason.trim()) return safeToast("Please enter a reason for voiding this receipt", "bad");
    try {
      await api.voidSale(voidingSale.id, voidReason.trim(), currentUser?.name || "Admin");
      safeToast(`Receipt ${voidingSale.receipt_no} voided & stock restored`);
      setVoidingSale(null);
      setVoidReason("");
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
    }
  };

  const handleSaveShiftNotes = async (e) => {
    e.preventDefault();
    if (!viewingShift) return;
    try {
      await api.updateShiftNotes(viewingShift.id, shiftNotesDraft);
      safeToast("Shift audit notes saved");
      setViewingShift((s) => (s ? { ...s, notes: shiftNotesDraft } : null));
      loadAll(from, to, true);
    } catch (err) {
      safeToast(errText(err), "bad");
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
          safeToast(`Processed ${selectedIds.length} records`);
          setSelectedIds([]);
          setConfirmAction(null);
          loadAll(from, to, true);
        } catch (err) {
          safeToast(errText(err), "bad");
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
    safeToast(`Exported ${ds.rows.length} rows to CSV`);
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
    safeToast(`Exported ${ds.rows.length} rows to Excel (.xls)`);
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
    toast: safeToast,
    preset,
    from,
    to,
    draftFrom,
    setDraftFrom,
    draftTo,
    setDraftTo,
    loading,
    refreshing,
    syncingGdrive,
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
    handleSyncGdriveNow,
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
