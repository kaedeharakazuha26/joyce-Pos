import React, { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Search,
  X,
  Trash2,
  Sunrise,
  Sunset,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Package,
  Printer,
} from "lucide-react";
import { ymd } from "../../utils";
import { EXPENSE_CATEGORIES, REPORT_TABS } from "./adminUtils";
import { AdminOverviewPnL } from "./AdminOverviewPnL";
import { AdminSalesInventoryTables } from "./AdminSalesInventoryTables";
import { AdminPayrollAuditTables } from "./AdminPayrollAuditTables";

/**
 * Centralized Reports & Record Management (CRUD) Module
 * Renders the 10-tab navigation bar, contextual search & filter toolbar,
 * bulk selection controls, and delegates table rendering to focused subcomponents.
 */
export function AdminReportsModule({
  reportSectionRef,
  reportTab,
  setReportTab,
  data,
  from,
  to,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  staffFilter,
  setStaffFilter,
  allProductCategories,
  allStaffNames,
  commissionTypes,
  employeesList,
  activeBusinessDate,
  shiftStatus,
  openSod,
  openEod,
  filteredSales,
  filteredProducts,
  filteredExpenses,
  filteredSalaries,
  filteredCommissions,
  filteredLdCommissions,
  filteredEmployees,
  filteredShifts,
  filteredAudit,
  selectedIds,
  setSelectedIds,
  handleBulkDelete,
  setEditingProduct,
  setRestockModal,
  setEditingExpense,
  setEditingSalary,
  setEditingCommission,
  setShowAddCommType,
  setEditingLdCommission,
  setEditingEmployee,
  setViewingSale,
  setVoidingSale,
  setVoidReason,
  setViewingShift,
  setShiftNotesDraft,
  setViewingAuditItem,
  setConfirmAction,
  jumpToReport,
  onApplyDateRange,
  loadAll,
  toast,
  visibleTabs = {},
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const availableTabs = REPORT_TABS.filter(
    (t) => !visibleTabs || visibleTabs[`tab_${t.id}`] !== false
  );

  useEffect(() => {
    if (visibleTabs && availableTabs.length > 0 && !availableTabs.some((t) => t.id === reportTab)) {
      setReportTab(availableTabs[0].id);
    }
  }, [visibleTabs, availableTabs, reportTab, setReportTab]);
  const [sortConfig, setSortConfig] = useState({ key: "", dir: "desc" });

  useEffect(() => {
    setPage(1);
    setSortConfig({ key: "", dir: "desc" });
  }, [reportTab, search, categoryFilter, statusFilter, staffFilter, from, to]);

  const sortRows = useCallback(
    (rows) => {
      const { key, dir } = sortConfig;
      if (!key) return rows;
      const mult = dir === "asc" ? 1 : -1;
      return [...rows].sort((a, b) => {
        const va = a[key];
        const vb = b[key];
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * mult;
        }
        return (
          String(va ?? "").localeCompare(String(vb ?? ""), undefined, {
            numeric: true,
          }) * mult
        );
      });
    },
    [sortConfig]
  );

  const toggleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="sort-icon muted" />;
    return sortConfig.dir === "asc" ? (
      <ArrowUp size={12} className="sort-icon active" />
    ) : (
      <ArrowDown size={12} className="sort-icon active" />
    );
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (rows) => {
    const allIds = rows.map((r) => r.id);
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  return (
    <section
      ref={reportSectionRef}
      className="central-reports-section"
      aria-label="Centralized Reports and CRUD Management"
    >
      <div className="card reports-shell-card">
        <div className="reports-header-bar no-print">
          <div>
            <h2>Centralized Reports & Record Management (CRUD)</h2>
            <p className="muted">
              View, filter, sort, export, and directly create, update, or archive underlying database records.
            </p>
          </div>

          <div className="reports-primary-actions">
            {reportTab === "products" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setReportTab("inventory-report")}
                  title="View items sold, stock levels, and total amounts sold"
                >
                  <ClipboardList size={15} /> Inventory Report
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
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
                >
                  <Plus size={16} /> Add New Product
                </button>
              </div>
            )}
            {reportTab === "inventory-report" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setReportTab("products")}
                  title="Manage and edit product items"
                >
                  <Package size={15} /> Manage Products (CRUD)
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => window.print()}
                  title="Print Inventory Stock & Sales Report"
                >
                  <Printer size={15} /> Print Report
                </button>
              </div>
            )}
            {reportTab === "expenses" && (
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setEditingExpense({
                    category: "Supplies",
                    description: "",
                    amount: "",
                    incurred_on: activeBusinessDate || ymd(),
                  })
                }
              >
                <Plus size={16} /> Add Expense Record
              </button>
            )}
            {reportTab === "salaries" && (
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setEditingSalary({
                    staff_name: employeesList[0]?.name || "",
                    role: employeesList[0]?.role || "",
                    amount: employeesList[0]?.daily_rate || "",
                    note: "",
                    paid_on: activeBusinessDate || ymd(),
                  })
                }
              >
                <Plus size={16} /> Add Salary Record
              </button>
            )}
            {reportTab === "commissions" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowAddCommType(true)}
                >
                  <Plus size={15} /> New Commission Type
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    setEditingCommission({
                      staff_name: employeesList[0]?.name || "",
                      commission_type: commissionTypes[0] || "Sales Bonus",
                      amount: "",
                      sales_ref: "",
                      rate_pct: 0,
                      note: "",
                      earned_on: activeBusinessDate || ymd(),
                    })
                  }
                >
                  <Plus size={16} /> Add Commission
                </button>
              </div>
            )}
            {reportTab === "ld-commissions" && (
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setEditingLdCommission({
                    staff_name: employeesList[0]?.name || "",
                    customer_table: "",
                    drink_name: "Ladies Drink",
                    quantity: 1,
                    unit_comm: 50,
                    note: "",
                    earned_on: activeBusinessDate || ymd(),
                  })
                }
              >
                <Plus size={16} /> Add LD Commission
              </button>
            )}
            {reportTab === "employees" && (
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setEditingEmployee({
                    name: "",
                    role: "Cashier",
                    contact: "",
                    daily_rate: 500,
                    hired_on: ymd(),
                  })
                }
              >
                <Plus size={16} /> Add Employee
              </button>
            )}
            {reportTab === "shifts" && (
              <button
                type="button"
                className="btn primary"
                onClick={() => (shiftStatus?.is_open ? openEod() : openSod())}
              >
                {shiftStatus?.is_open ? <Sunset size={16} /> : <Sunrise size={16} />}
                {shiftStatus?.is_open
                  ? "Execute End of Day (EOD)"
                  : "Start Business Day (SOD)"}
              </button>
            )}
          </div>
        </div>

        {/* Report Category Tabs */}
        <div className="report-tabs-nav no-print" role="tablist">
          {availableTabs.map((t) => {
            const Icon = t.icon;
            let countBadge = null;
            if (t.id === "sales") countBadge = filteredSales.length;
            else if (t.id === "products" || t.id === "inventory-report") countBadge = filteredProducts.length;
            else if (t.id === "expenses") countBadge = filteredExpenses.length;
            else if (t.id === "salaries") countBadge = filteredSalaries.length;
            else if (t.id === "commissions") countBadge = filteredCommissions.length;
            else if (t.id === "ld-commissions") countBadge = filteredLdCommissions.length;
            else if (t.id === "employees") countBadge = filteredEmployees.length;
            else if (t.id === "shifts") countBadge = filteredShifts.length;
            else if (t.id === "audit") countBadge = filteredAudit.length;

            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={reportTab === t.id}
                className={`report-tab-btn ${reportTab === t.id ? "active" : ""}`}
                onClick={() => setReportTab(t.id)}
              >
                <Icon size={15} />
                <span>{t.label}</span>
                {countBadge !== null && (
                  <span className="tab-count-pill">{countBadge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Unified Table Search & Contextual Filter Toolbar */}
        {reportTab !== "overview" && (
          <div className="table-filter-toolbar no-print">
            <div className="table-search-box">
              <Search size={15} className="muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search in ${
                  REPORT_TABS.find((t) => t.id === reportTab)?.label
                }…`}
                aria-label="Filter table records"
              />
              {search && (
                <button
                  type="button"
                  className="icon-btn sm"
                  onClick={() => setSearch("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="table-contextual-filters">
              {["sales", "products", "inventory-report", "expenses", "commissions"].includes(reportTab) && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All Categories</option>
                  {reportTab === "expenses"
                    ? EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))
                    : reportTab === "commissions"
                    ? commissionTypes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))
                    : allProductCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                </select>
              )}

              {reportTab === "sales" && (
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Receipt Statuses</option>
                  <option value="completed">Completed Only</option>
                  <option value="voided">Voided Only</option>
                </select>
              )}
              {["products", "inventory-report"].includes(reportTab) && (
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Stock Levels</option>
                  <option value="healthy">Healthy Stock</option>
                  <option value="low">Low Stock Alert</option>
                  <option value="out">Out of Stock (0)</option>
                </select>
              )}
              {reportTab === "shifts" && (
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Shift Statuses</option>
                  <option value="open">Open Shift</option>
                  <option value="balanced">Closed — Balanced</option>
                  <option value="overage">Closed — Cash Overage</option>
                  <option value="shortage">Closed — Cash Shortage</option>
                </select>
              )}

              {["salaries", "commissions", "ld-commissions", "employees"].includes(reportTab) && (
                <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                  <option value="all">All Staff Members</option>
                  {allStaffNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}

              {selectedIds.length > 0 &&
                [
                  "products",
                  "expenses",
                  "salaries",
                  "commissions",
                  "ld-commissions",
                  "employees",
                ].includes(reportTab) && (
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 size={14} /> Remove Selected ({selectedIds.length})
                  </button>
                )}
            </div>
          </div>
        )}

        {/* Tab 1: Executive Overview & P&L Statement */}
        {reportTab === "overview" && data && (
          <AdminOverviewPnL
            data={data}
            from={from}
            to={to}
            jumpToReport={jumpToReport}
            onApplyDateRange={onApplyDateRange}
          />
        )}

        {/* Tabs 2–5: Sales, Products, Expenses, Salaries */}
        <AdminSalesInventoryTables
          reportTab={reportTab}
          page={page}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize}
          sortRows={sortRows}
          toggleSort={toggleSort}
          renderSortIcon={renderSortIcon}
          selectedIds={selectedIds}
          toggleSelectOne={toggleSelectOne}
          toggleSelectAll={toggleSelectAll}
          filteredSales={filteredSales}
          filteredProducts={filteredProducts}
          filteredExpenses={filteredExpenses}
          filteredSalaries={filteredSalaries}
          employeesList={employeesList}
          activeBusinessDate={activeBusinessDate}
          setViewingSale={setViewingSale}
          setVoidingSale={setVoidingSale}
          setVoidReason={setVoidReason}
          setEditingProduct={setEditingProduct}
          setRestockModal={setRestockModal}
          setEditingExpense={setEditingExpense}
          setEditingSalary={setEditingSalary}
          setConfirmAction={setConfirmAction}
          from={from}
          to={to}
          loadAll={loadAll}
          toast={toast}
        />

        {/* Tabs 6–10: Commissions, LD Commissions, Employees, Shifts, Audit */}
        <AdminPayrollAuditTables
          reportTab={reportTab}
          page={page}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize}
          sortRows={sortRows}
          toggleSort={toggleSort}
          renderSortIcon={renderSortIcon}
          selectedIds={selectedIds}
          toggleSelectOne={toggleSelectOne}
          toggleSelectAll={toggleSelectAll}
          filteredCommissions={filteredCommissions}
          filteredLdCommissions={filteredLdCommissions}
          filteredEmployees={filteredEmployees}
          filteredShifts={filteredShifts}
          filteredAudit={filteredAudit}
          employeesList={employeesList}
          commissionTypes={commissionTypes}
          activeBusinessDate={activeBusinessDate}
          setEditingCommission={setEditingCommission}
          setEditingLdCommission={setEditingLdCommission}
          setEditingEmployee={setEditingEmployee}
          setEditingSalary={setEditingSalary}
          setViewingShift={setViewingShift}
          setShiftNotesDraft={setShiftNotesDraft}
          setViewingAuditItem={setViewingAuditItem}
          setConfirmAction={setConfirmAction}
          from={from}
          to={to}
          loadAll={loadAll}
          toast={toast}
        />
      </div>
    </section>
  );
}
