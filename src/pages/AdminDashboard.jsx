import React, { useState } from "react";
import {
  Calendar,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Printer,
  Filter,
  X,
  AlertTriangle,
  Sunrise,
  Sunset,
  Cloud,
  DatabaseBackup,
  HelpCircle,
  BookOpen,
  ShieldCheck,
  SlidersHorizontal,
  Eye,
  EyeOff,
  LayoutGrid,
} from "lucide-react";
import { DATE_PRESETS, peso, ymd } from "../utils";
import { useSettings } from "../App";
import { Modal, useToast } from "../components/ui";
import { REPORT_TABS } from "../components/admin/adminUtils";
import { useAdminController } from "../components/admin/useAdminController";
import {
  AdminKpiGrid,
  AdminAlertsAndActivity,
} from "../components/admin/AdminKpiGrid";
import { AdminChartsSection } from "../components/admin/AdminCharts";
import { AdminReportsModule } from "../components/admin/AdminReportsModule";
import { AdminCrudModals } from "../components/admin/AdminModals";

const DEFAULT_VISIBILITY = {
  sections: {
    kpi_grid: true,
    alerts_activity: true,
    charts: true,
    reports: true,
  },
  tiles: {
    tile_sales: true,
    tile_gross: true,
    tile_expenses: true,
    tile_net: true,
    tile_today: true,
    tile_mtd: true,
    tile_stock: true,
    tile_voided: true,
  },
  tabs: {
    tab_overview: true,
    tab_sales: true,
    tab_products: true,
    "tab_inventory-report": true,
    tab_expenses: true,
    tab_salaries: true,
    tab_commissions: true,
    "tab_ld-commissions": true,
    tab_employees: true,
    tab_shifts: true,
    tab_audit: true,
  },
};

/**
 * Modern Executive Admin Dashboard, Reporting, Analytics & Full CRUD System
 * Designed to be beginner/user-friendly with step-by-step visual formulas
 * and Safe End-of-Day (EOD) Google Drive Backup protection.
 */
export function AdminDashboard(props = {}) {
  const ctx = useSettings() || {};
  const ctxToast = useToast();

  const toast = props.toast || ctxToast;
  const activeBusinessDate = props.activeBusinessDate || ctx.activeBusinessDate;
  const shiftStatus = props.shiftStatus || ctx.shiftStatus;
  const openSod = props.openSod || ctx.openSod;
  const openEod = props.openEod || ctx.openEod;
  const currentUser = props.currentUser || ctx.currentUser;
  const branchInfo = props.branchInfo || ctx.branchInfo;
  const refreshBranchInfo = props.refreshBranchInfo || ctx.refreshBranchInfo;
  const externalCommand = props.externalCommand || ctx.adminReportIntent;
  const onClearExternalCommand =
    props.onClearExternalCommand || ctx.clearAdminReportIntent;

  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [visibility, setVisibility] = useState(() => {
    try {
      const raw = localStorage.getItem("joy_pos_admin_dashboard_visibility");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          sections: { ...DEFAULT_VISIBILITY.sections, ...(parsed.sections || {}) },
          tiles: { ...DEFAULT_VISIBILITY.tiles, ...(parsed.tiles || {}) },
          tabs: { ...DEFAULT_VISIBILITY.tabs, ...(parsed.tabs || {}) },
        };
      }
    } catch (e) {}
    return DEFAULT_VISIBILITY;
  });

  const toggleVisibility = (group, key) => {
    setVisibility((prev) => {
      const next = {
        ...prev,
        [group]: {
          ...prev[group],
          [key]: !prev[group][key],
        },
      };
      try {
        localStorage.setItem("joy_pos_admin_dashboard_visibility", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const resetVisibility = () => {
    setVisibility(DEFAULT_VISIBILITY);
    try {
      localStorage.removeItem("joy_pos_admin_dashboard_visibility");
    } catch (e) {}
  };

  const ctrl = useAdminController({
    toast,
    activeBusinessDate,
    currentUser,
    externalCommand,
    onClearExternalCommand,
    refreshBranchInfo,
  });

  const {
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
  } = ctrl;

  const fin = data?.financials || {};
  const grossSales = Number(fin.gross_sales ?? data?.revenue ?? 0);
  const cogs = Number(fin.cogs ?? data?.cogs ?? 0);
  const grossProfit = Number(fin.gross_profit ?? data?.gross_profit ?? 0);
  const totalOverheads = Number(fin.total_overheads ?? data?.total_overheads ?? 0);
  const netProfit = Number(fin.net_profit ?? data?.net_profit ?? 0);

  const openShiftObj = shiftStatus?.shift || shiftStatus?.current;
  const expectedDrawerCash = Number(
    openShiftObj?.expected_cash ?? shiftStatus?.expected_cash ?? 0
  );

  return (
    <div className="admin-dashboard-root">
      {/* Print-Only Formal Report Header (hidden on screen, visible when printing) */}
      <div className="print-only-header">
        <h1>JOYCE POS — Official Business & Financial Report</h1>
        <p>
          Reporting Period: <b>{from}</b> to <b>{to}</b> • Active Module:{" "}
          <b>{REPORT_TABS.find((t) => t.id === reportTab)?.label}</b> •
          Generated by: <b>{currentUser?.name || "Administrator"}</b> on{" "}
          {new Date().toLocaleString()}
        </p>
        <hr />
      </div>

      {/* 1. Executive Control Bar & Date Filter Panel */}
      <section
        className="admin-control-bar card no-print"
        aria-label="Dashboard Date and Global Filters"
      >
        <div className="admin-control-top">
          <div className="admin-period-presets">
            <span className="preset-label">
              <Calendar size={14} /> Date Filter:
            </span>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`preset-pill ${preset === p.id ? "active" : ""}`}
                onClick={() => handleSelectPreset(p.id)}
                title={p.id === "today" && activeBusinessDate ? `Shift Date: ${activeBusinessDate}` : p.label}
              >
                {p.id === "today" ? (activeBusinessDate ? "Today (Shift)" : "Today") : p.label}
              </button>
            ))}
          </div>

          <form className="admin-custom-dates" onSubmit={handleApplyDateRange}>
            <div className="date-input-group">
              <label htmlFor="dash-from">From</label>
              <input
                id="dash-from"
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="dash-to">To</label>
              <input
                id="dash-to"
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn primary sm"
              title="Apply Custom Date Range"
            >
              <Filter size={14} /> Apply
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={handleResetAllFilters}
              title="Reset Date & Report Filters"
            >
              Reset
            </button>
          </form>
        </div>

        <div className="admin-control-bottom">
          <div className="admin-shift-quick">
            {shiftStatus?.is_open ? (
              <div className="shift-indicator open">
                <Sunrise size={15} />
                <span>
                  Open Shift:{" "}
                  <b>{openShiftObj?.business_date || activeBusinessDate}</b> •
                  Expected Drawer: <b>{peso(expectedDrawerCash)}</b>
                </span>
                <button type="button" className="btn sm warn" onClick={openEod}>
                  <Sunset size={13} /> End of Day (EOD + Auto Backup)
                </button>
              </div>
            ) : (
              <div className="shift-indicator closed">
                <AlertTriangle size={15} />
                <span>
                  Shift is Closed — Start Day (SOD) before ringing up sales
                </span>
                <button type="button" className="btn sm ok" onClick={openSod}>
                  <Sunrise size={13} /> Start Day (SOD)
                </button>
              </div>
            )}

            {/* Overnight Shift Midnight-Persistence Badge */}
            {shiftStatus?.is_open && (openShiftObj?.business_date || activeBusinessDate) && (openShiftObj?.business_date || activeBusinessDate) !== ymd() && (
              <div
                className="shift-indicator"
                style={{
                  background: "linear-gradient(90deg, rgba(124, 92, 255, 0.2), rgba(77, 166, 255, 0.2))",
                  border: "1px solid rgba(124, 92, 255, 0.5)",
                  color: "#d0d4ff",
                }}
              >
                <span>🌙</span>
                <span>
                  <b>Overnight Active:</b> Midnight passed; all transactions remain on Business Date <b>{openShiftObj?.business_date || activeBusinessDate}</b> until EOD close.
                </span>
              </div>
            )}

            {/* Safe Google Drive EOD Snapshot Quick Button */}
            <button
              type="button"
              className="btn ghost sm"
              onClick={handleSyncGdriveNow}
              disabled={syncingGdrive}
              title={
                branchInfo?.storage_dir
                  ? `Save a corruption-free snapshot to Google Drive (${branchInfo.storage_dir}/EOD_Backups)`
                  : "Save a corruption-free snapshot to local EOD_Backups folder"
              }
            >
              <DatabaseBackup size={14} color="var(--accent)" />
              {syncingGdrive
                ? "Backing up…"
                : branchInfo?.storage_dir
                  ? "☁️ Save EOD Backup Now"
                  : "📁 Save EOD Backup Now"}
            </button>
          </div>

          <div className="admin-export-actions">
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setShowCustomizeModal(true)}
              title="Show or hide dashboard tiles, sections, and reports"
            >
              <SlidersHorizontal size={14} /> Customize View
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => loadAll(from, to, true)}
              disabled={refreshing}
              title="Refresh Live Database Metrics"
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={handleExportCSV}
              title="Export active report to CSV"
            >
              <Download size={14} /> CSV
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={handleExportExcel}
              title="Export active report to Excel (.xls)"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={handlePrintReport}
              title="Print or Save as PDF"
            >
              <Printer size={14} /> Print / PDF
            </button>
          </div>
        </div>

        {activeFiltersList.length > 0 && (
          <div className="active-filters-bar">
            <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
              Active Filters:
            </span>
            {activeFiltersList.map((af, idx) => (
              <span key={idx} className="filter-chip">
                {af.label}
                <button
                  type="button"
                  onClick={af.clear}
                  aria-label={`Remove ${af.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="clear-all-link"
              onClick={() => {
                setCategoryFilter("all");
                setStatusFilter("all");
                setStaffFilter("all");
                setSearch("");
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </section>



      {/* 2. Loading & Error States */}
      {loading && !data && (
        <div className="card loading-state-card">
          <RefreshCw size={28} className="spin" color="var(--accent)" />
          <h3>Loading Store Reports & Financial Numbers…</h3>
          <p className="muted">
            Reading receipts, product stock, expenses, staff pay, and activity logs.
          </p>
        </div>
      )}

      {error && (
        <div
          className="card error-state-card"
          style={{ borderColor: "var(--bad)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={24} color="var(--bad)" />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, color: "var(--bad)" }}>
                Could Not Load Dashboard Data
              </h3>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {error}
              </p>
            </div>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => loadAll(from, to)}
            >
              Retry Now
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Dashboard Content */}
      {data && (
        <>
          {visibility.sections?.kpi_grid !== false && (
            <AdminKpiGrid
              loading={loading}
              data={data}
              activeBusinessDate={activeBusinessDate}
              handleApplyDateRange={handleApplyDateRange}
              jumpToReport={jumpToReport}
              visibleTiles={visibility.tiles}
            />
          )}

          {visibility.sections?.alerts_activity !== false && (
            <AdminAlertsAndActivity
              data={data}
              auditLogs={auditLogs}
              openSod={openSod}
              jumpToReport={jumpToReport}
              onInspectAudit={(item) => setViewingAuditItem(item)}
            />
          )}

          {visibility.sections?.charts !== false && (
            <AdminChartsSection
              data={data}
              from={from}
              to={to}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              jumpToReport={jumpToReport}
            />
          )}

          {visibility.sections?.reports !== false && (
            <AdminReportsModule
              reportSectionRef={reportSectionRef}
              reportTab={reportTab}
              setReportTab={setReportTab}
              visibleTabs={visibility.tabs}
              from={from}
              to={to}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              staffFilter={staffFilter}
              setStaffFilter={setStaffFilter}
              allProductCategories={allProductCategories}
              allStaffNames={allStaffNames}
              commissionTypes={commissionTypes}
              employeesList={employeesList}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              handleBulkDelete={handleBulkDelete}
              setEditingProduct={setEditingProduct}
              setRestockModal={setRestockModal}
              setEditingExpense={setEditingExpense}
              setEditingSalary={setEditingSalary}
              setEditingCommission={setEditingCommission}
              setEditingLdCommission={setEditingLdCommission}
              setEditingEmployee={setEditingEmployee}
              setShowAddCommType={setShowAddCommType}
              setViewingSale={setViewingSale}
              setVoidingSale={setVoidingSale}
              setVoidReason={setVoidReason}
              setViewingShift={setViewingShift}
              setShiftNotesDraft={setShiftNotesDraft}
              setViewingAuditItem={setViewingAuditItem}
              setConfirmAction={setConfirmAction}
              activeBusinessDate={activeBusinessDate}
              shiftStatus={shiftStatus}
              openSod={openSod}
              openEod={openEod}
              onApplyDateRange={handleApplyDateRange}
              data={data}
              fin={fin}
              filteredSales={filteredSales}
              filteredProducts={filteredProducts}
              filteredExpenses={filteredExpenses}
              filteredSalaries={filteredSalaries}
              filteredCommissions={filteredCommissions}
              filteredLdCommissions={filteredLdCommissions}
              filteredEmployees={filteredEmployees}
              filteredShifts={filteredShifts}
              filteredAudit={filteredAudit}
              jumpToReport={jumpToReport}
              loadAll={loadAll}
              toast={ctrl.toast}
            />
          )}
        </>
      )}

      {/* 4. All CRUD, Inspection & Confirmation Modals */}
      <AdminCrudModals
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}
        handleSaveProduct={handleSaveProduct}
        allProductCategories={allProductCategories}
        restockModal={restockModal}
        setRestockModal={setRestockModal}
        handleRestockSubmit={handleRestockSubmit}
        editingExpense={editingExpense}
        setEditingExpense={setEditingExpense}
        handleSaveExpense={handleSaveExpense}
        editingSalary={editingSalary}
        setEditingSalary={setEditingSalary}
        handleSaveSalary={handleSaveSalary}
        employeesList={employeesList}
        editingCommission={editingCommission}
        setEditingCommission={setEditingCommission}
        handleSaveCommission={handleSaveCommission}
        commissionTypes={commissionTypes}
        editingLdCommission={editingLdCommission}
        setEditingLdCommission={setEditingLdCommission}
        handleSaveLdCommission={handleSaveLdCommission}
        editingEmployee={editingEmployee}
        setEditingEmployee={setEditingEmployee}
        handleSaveEmployee={handleSaveEmployee}
        showAddCommType={showAddCommType}
        setShowAddCommType={setShowAddCommType}
        newCommTypeModal={newCommTypeModal}
        setNewCommTypeModal={setNewCommTypeModal}
        setCommissionTypes={setCommissionTypes}
        toast={ctrl.toast}
        viewingSale={viewingSale}
        setViewingSale={setViewingSale}
        setVoidingSale={setVoidingSale}
        setVoidReason={setVoidReason}
        voidingSale={voidingSale}
        voidReason={voidReason}
        handleVoidSaleSubmit={handleVoidSaleSubmit}
        viewingShift={viewingShift}
        setViewingShift={setViewingShift}
        shiftNotesDraft={shiftNotesDraft}
        setShiftNotesDraft={setShiftNotesDraft}
        handleSaveShiftNotes={handleSaveShiftNotes}
        viewingAuditItem={viewingAuditItem}
        setViewingAuditItem={setViewingAuditItem}
        confirmAction={confirmAction}
        setConfirmAction={setConfirmAction}
      />

      {/* 5. View Customization Modal */}
      {showCustomizeModal && (
        <Modal
          title="Customize Admin Dashboard & Reports"
          onClose={() => setShowCustomizeModal(false)}
        >
          <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 6 }}>
            <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
              Configure which sections, executive KPI tiles, and report tabs are displayed on this dashboard. Preferences are saved automatically on this device.
            </p>

            {/* A. High-level Dashboard Sections */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "var(--accent)" }}>
                Main Dashboard Sections
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { key: "kpi_grid", label: "Executive KPI Cards" },
                  { key: "alerts_activity", label: "Shift Alerts & Activity" },
                  { key: "charts", label: "Analytics & Financial Charts" },
                  { key: "reports", label: "Store Reports & CRUD Module" },
                ].map((sec) => (
                  <label
                    key={sec.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "var(--card-bg, rgba(255,255,255,0.03))",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibility.sections[sec.key] !== false}
                      onChange={() => toggleVisibility("sections", sec.key)}
                    />
                    <span>{sec.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* B. Executive KPI Tiles */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "var(--accent)" }}>
                Executive KPI Tiles
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { key: "tile_sales", label: "Total Net Sales" },
                  { key: "tile_gross", label: "Gross Profit (P&L)" },
                  { key: "tile_expenses", label: "Overheads & Payroll" },
                  { key: "tile_net", label: "Net Store Profit" },
                  { key: "tile_today", label: "Today's Shift Sales" },
                  { key: "tile_mtd", label: "Month to Date (MTD)" },
                  { key: "tile_stock", label: "Stock Alerts" },
                  { key: "tile_voided", label: "Voided Orders" },
                ].map((tile) => (
                  <label
                    key={tile.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "var(--card-bg, rgba(255,255,255,0.03))",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibility.tiles[tile.key] !== false}
                      onChange={() => toggleVisibility("tiles", tile.key)}
                    />
                    <span>{tile.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* C. Report & Management Tabs */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "var(--accent)" }}>
                Store Reports & CRUD Tabs
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {REPORT_TABS.map((tab) => {
                  const tabKey = `tab_${tab.id}`;
                  const Icon = tab.icon;
                  return (
                    <label
                      key={tab.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        background: "var(--card-bg, rgba(255,255,255,0.03))",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibility.tabs[tabKey] !== false}
                        onChange={() => toggleVisibility("tabs", tabKey)}
                      />
                      {Icon && <Icon size={14} style={{ opacity: 0.7 }} />}
                      <span>{tab.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 18,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            <button
              type="button"
              className="btn ghost sm"
              onClick={resetVisibility}
              title="Reset all tiles and reports to visible"
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => setShowCustomizeModal(false)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AdminDashboard;
