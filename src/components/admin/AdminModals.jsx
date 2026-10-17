import {
  Boxes,
  Plus,
  X,
  XCircle,
  Printer,
  AlertTriangle,
} from "lucide-react";
import { ConfirmModal, Field, Modal, Receipt, StatusBadge } from "../ui";
import { peso } from "../../utils";
import { EXPENSE_CATEGORIES } from "./adminUtils";
import { api } from "../../api";
import { errText } from "../../utils";

export function AdminCrudModals({
  editingProduct,
  setEditingProduct,
  handleSaveProduct,
  allProductCategories,
  restockModal,
  setRestockModal,
  handleRestockSubmit,
  editingExpense,
  setEditingExpense,
  handleSaveExpense,
  editingSalary,
  setEditingSalary,
  handleSaveSalary,
  employeesList,
  editingCommission,
  setEditingCommission,
  handleSaveCommission,
  commissionTypes,
  setCommissionTypes,
  editingLdCommission,
  setEditingLdCommission,
  handleSaveLdCommission,
  editingEmployee,
  setEditingEmployee,
  handleSaveEmployee,
  viewingSale,
  setViewingSale,
  setVoidingSale,
  voidingSale,
  voidReason,
  setVoidReason,
  handleVoidSaleSubmit,
  viewingShift,
  setViewingShift,
  shiftNotesDraft,
  setShiftNotesDraft,
  handleSaveShiftNotes,
  viewingAuditItem,
  setViewingAuditItem,
  showAddCommType,
  setShowAddCommType,
  newCommTypeName,
  setNewCommTypeName,
  confirmAction,
  setConfirmAction,
  settings,
  toast,
}) {
  return (
    <>
      {/* 1. Product Create / Edit Modal */}
      {editingProduct && (
        <Modal
          title={editingProduct.id ? `Edit Product — ${editingProduct.name}` : "Add New Product to Catalog"}
          onClose={() => setEditingProduct(null)}
        >
          <form className="form" onSubmit={handleSaveProduct}>
            <Field label="Product Name *">
              <input
                required
                autoFocus
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                placeholder="e.g. San Miguel Pale Pilsen"
              />
            </Field>
            <div className="row">
              <Field label="Category">
                <input
                  list="admin-cat-list"
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  placeholder="General"
                />
                <datalist id="admin-cat-list">
                  {allProductCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Low-Stock Alert Threshold">
                <input
                  type="number"
                  min="0"
                  value={editingProduct.low_stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, low_stock: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Selling Price (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                />
              </Field>
              <Field label="Unit Cost / COGS (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingProduct.cost}
                  onChange={(e) => setEditingProduct({ ...editingProduct, cost: e.target.value })}
                />
              </Field>
              <Field label="Current Stock">
                <input
                  type="number"
                  value={editingProduct.stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Price Variants (Optional)">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(editingProduct.variants || []).map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      style={{ flex: 2 }}
                      placeholder="Variant name (e.g. Bucket, Grande)"
                      value={v.name}
                      onChange={(e) => {
                        const next = [...editingProduct.variants];
                        next[i] = { ...next[i], name: e.target.value };
                        setEditingProduct({ ...editingProduct, variants: next });
                      }}
                    />
                    <input
                      style={{ flex: 1 }}
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={v.price}
                      onChange={(e) => {
                        const next = [...editingProduct.variants];
                        next[i] = { ...next[i], price: e.target.value };
                        setEditingProduct({ ...editingProduct, variants: next });
                      }}
                    />
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() =>
                        setEditingProduct({
                          ...editingProduct,
                          variants: editingProduct.variants.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() =>
                    setEditingProduct({
                      ...editingProduct,
                      variants: [...(editingProduct.variants || []), { name: "", price: editingProduct.price || 0 }],
                    })
                  }
                >
                  <Plus size={14} /> Add Variant
                </button>
              </div>
            </Field>

            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingProduct(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Product
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Quick Restock Modal */}
      {restockModal && (
        <Modal
          title={`Restock Inventory — ${restockModal.product.name}`}
          onClose={() => setRestockModal(null)}
        >
          <form className="form" onSubmit={handleRestockSubmit}>
            <div className="alert-banner info">
              <Boxes size={18} />
              <div>
                Current Stock: <b>{restockModal.product.stock}</b> units • Current Unit Cost:{" "}
                <b>{peso(restockModal.product.cost)}</b>
              </div>
            </div>
            <div className="row">
              <Field label="Quantity to Add (+)*">
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={restockModal.qty}
                  onChange={(e) => setRestockModal({ ...restockModal, qty: e.target.value })}
                />
              </Field>
              <Field label="Supplier Unit Cost (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={restockModal.unitCost}
                  onChange={(e) => setRestockModal({ ...restockModal, unitCost: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Delivery / Restock Note">
              <input
                value={restockModal.note}
                onChange={(e) => setRestockModal({ ...restockModal, note: e.target.value })}
                placeholder="e.g. Supplier delivery invoice #104"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setRestockModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Confirm Restock (+{restockModal.qty || 0})
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Expense Create / Edit Modal */}
      {editingExpense && (
        <Modal
          title={editingExpense.id ? "Edit Store Expense" : "Record Store Expense"}
          onClose={() => setEditingExpense(null)}
        >
          <form className="form" onSubmit={handleSaveExpense}>
            <div className="row">
              <Field label="Expense Category *">
                <select
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date Incurred *">
                <input
                  type="date"
                  required
                  value={editingExpense.incurred_on}
                  onChange={(e) => setEditingExpense({ ...editingExpense, incurred_on: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Amount (₱) *">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                value={editingExpense.amount}
                onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Description / Payee / Reference">
              <input
                value={editingExpense.description}
                onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                placeholder="e.g. Meralco electric bill, Ice delivery"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingExpense(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Expense
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Salary Create / Edit Modal */}
      {editingSalary && (
        <Modal
          title={editingSalary.id ? "Edit Salary Record" : "Record Staff Salary"}
          onClose={() => setEditingSalary(null)}
        >
          <form className="form" onSubmit={handleSaveSalary}>
            <div className="row">
              <Field label="Staff Member *">
                <input
                  list="admin-staff-list"
                  required
                  autoFocus
                  value={editingSalary.staff_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const emp = employeesList.find((x) => x.name.toLowerCase() === name.toLowerCase());
                    setEditingSalary({
                      ...editingSalary,
                      staff_name: name,
                      role: emp?.role || editingSalary.role,
                      amount: !editingSalary.id && emp?.daily_rate ? emp.daily_rate : editingSalary.amount,
                    });
                  }}
                  placeholder="Select or type staff name"
                />
                <datalist id="admin-staff-list">
                  {employeesList.map((e) => (
                    <option key={e.id} value={e.name}>{e.role}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Role">
                <input
                  value={editingSalary.role}
                  onChange={(e) => setEditingSalary({ ...editingSalary, role: e.target.value })}
                  placeholder="e.g. Cashier, Server, Cook"
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Salary Amount (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingSalary.amount}
                  onChange={(e) => setEditingSalary({ ...editingSalary, amount: e.target.value })}
                />
              </Field>
              <Field label="Date Paid *">
                <input
                  type="date"
                  required
                  value={editingSalary.paid_on}
                  onChange={(e) => setEditingSalary({ ...editingSalary, paid_on: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Payroll Notes">
              <input
                value={editingSalary.note}
                onChange={(e) => setEditingSalary({ ...editingSalary, note: e.target.value })}
                placeholder="e.g. Full shift payout + overtime"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingSalary(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Salary Record
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Regular Commission Create / Edit Modal */}
      {editingCommission && (
        <Modal
          title={editingCommission.id ? "Edit Commission Record" : "Record Staff Commission"}
          onClose={() => setEditingCommission(null)}
        >
          <form className="form" onSubmit={handleSaveCommission}>
            <div className="row">
              <Field label="Staff Member *">
                <input
                  list="admin-staff-list"
                  required
                  autoFocus
                  value={editingCommission.staff_name}
                  onChange={(e) => setEditingCommission({ ...editingCommission, staff_name: e.target.value })}
                />
              </Field>
              <Field label="Commission Type *">
                <select
                  value={editingCommission.commission_type}
                  onChange={(e) => setEditingCommission({ ...editingCommission, commission_type: e.target.value })}
                >
                  {commissionTypes.map((ct) => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="row">
              <Field label="Commission Amount (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingCommission.amount}
                  onChange={(e) => setEditingCommission({ ...editingCommission, amount: e.target.value })}
                />
              </Field>
              <Field label="Date Earned *">
                <input
                  type="date"
                  required
                  value={editingCommission.earned_on}
                  onChange={(e) => setEditingCommission({ ...editingCommission, earned_on: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Sales / Table Reference">
                <input
                  value={editingCommission.sales_ref}
                  onChange={(e) => setEditingCommission({ ...editingCommission, sales_ref: e.target.value })}
                  placeholder="Optional receipt or VIP table ref"
                />
              </Field>
              <Field label="Rate (%)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editingCommission.rate_pct}
                  onChange={(e) => setEditingCommission({ ...editingCommission, rate_pct: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <input
                value={editingCommission.note}
                onChange={(e) => setEditingCommission({ ...editingCommission, note: e.target.value })}
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingCommission(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Commission
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. LD Commission Create / Edit Modal */}
      {editingLdCommission && (
        <Modal
          title={editingLdCommission.id ? "Edit LD Commission" : "Record Ladies Drink (LD) Commission"}
          onClose={() => setEditingLdCommission(null)}
        >
          <form className="form" onSubmit={handleSaveLdCommission}>
            <div className="row">
              <Field label="Staff / Server Name *">
                <input
                  list="admin-staff-list"
                  required
                  autoFocus
                  value={editingLdCommission.staff_name}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, staff_name: e.target.value })}
                />
              </Field>
              <Field label="Date Earned *">
                <input
                  type="date"
                  required
                  value={editingLdCommission.earned_on}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, earned_on: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Customer / Table">
                <input
                  value={editingLdCommission.customer_table}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, customer_table: e.target.value })}
                  placeholder="e.g. VIP 2, Table 5"
                />
              </Field>
              <Field label="Drink Name">
                <input
                  value={editingLdCommission.drink_name}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, drink_name: e.target.value })}
                  placeholder="Ladies Drink"
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Number of Drinks (Qty) *">
                <input
                  type="number"
                  min="1"
                  required
                  value={editingLdCommission.quantity}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, quantity: e.target.value })}
                />
              </Field>
              <Field label="Commission per Drink (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={editingLdCommission.unit_comm}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, unit_comm: e.target.value })}
                />
              </Field>
              <Field label="Auto-Calculated Total">
                <input
                  disabled
                  value={peso(Number(editingLdCommission.quantity || 0) * Number(editingLdCommission.unit_comm || 0))}
                />
              </Field>
            </div>
            <Field label="Notes">
              <input
                value={editingLdCommission.note}
                onChange={(e) => setEditingLdCommission({ ...editingLdCommission, note: e.target.value })}
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingLdCommission(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save LD Commission
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Employee Create / Edit Modal */}
      {editingEmployee && (
        <Modal
          title={editingEmployee.id ? `Edit Employee — ${editingEmployee.name}` : "Add New Employee"}
          onClose={() => setEditingEmployee(null)}
        >
          <form className="form" onSubmit={handleSaveEmployee}>
            <Field label="Full Name *">
              <input
                required
                autoFocus
                value={editingEmployee.name}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                placeholder="e.g. Maria Santos"
              />
            </Field>
            <div className="row">
              <Field label="Role / Designation">
                <input
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  placeholder="e.g. Cashier, Server, Manager"
                />
              </Field>
              <Field label="Contact Number">
                <input
                  value={editingEmployee.contact}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, contact: e.target.value })}
                  placeholder="09XX-XXX-XXXX"
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Default Daily Rate (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingEmployee.daily_rate}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, daily_rate: e.target.value })}
                />
              </Field>
              <Field label="Date Hired">
                <input
                  type="date"
                  value={editingEmployee.hired_on}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, hired_on: e.target.value })}
                />
              </Field>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingEmployee(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Employee
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 8. View Receipt Modal */}
      {viewingSale && (
        <Modal title={`Receipt ${viewingSale.receipt_no}`} onClose={() => setViewingSale(null)}>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
            <Receipt sale={viewingSale} settings={settings} />
          </div>
          <div className="modal-foot">
            {viewingSale.status !== "voided" && (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const sale = viewingSale;
                  setViewingSale(null);
                  setVoidingSale(sale);
                  setVoidReason("");
                }}
              >
                <XCircle size={15} /> Void Receipt
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Browser Print
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                api
                  .printReceipt(viewingSale.id)
                  .then(() => toast("Printed receipt"))
                  .catch((e) => toast(errText(e), "bad"))
              }
            >
              <Printer size={15} /> Thermal Print
            </button>
          </div>
        </Modal>
      )}

      {/* 9. Void Sale Confirmation Modal */}
      {voidingSale && (
        <Modal title={`Void Receipt ${voidingSale.receipt_no}`} onClose={() => setVoidingSale(null)}>
          <form className="form" onSubmit={handleVoidSaleSubmit}>
            <div className="alert-banner bad">
              <AlertTriangle size={18} />
              <div>
                Voiding <b>{voidingSale.receipt_no}</b> ({peso(voidingSale.total)}) will return all sold items back to stock and record a permanent audit entry.
              </div>
            </div>
            <Field label="Reason for Voiding *">
              <input
                required
                autoFocus
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer changed order, wrong item punched"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setVoidingSale(null)}>
                Cancel
              </button>
              <button type="submit" className="btn danger">
                Confirm Void & Restore Stock
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 10. Shift Z-Reading & Audit Notes Modal */}
      {viewingShift && (
        <Modal
          title={`Shift Z-Reading & Audit — ${viewingShift.business_date}`}
          onClose={() => setViewingShift(null)}
        >
          <form className="form" onSubmit={handleSaveShiftNotes}>
            <div className="pnl-table" style={{ marginBottom: 12 }}>
              <div className="pnl-row">
                <span>Business Date</span>
                <b>{viewingShift.business_date}</b>
              </div>
              <div className="pnl-row">
                <span>Opened By</span>
                <span>{viewingShift.opened_by} ({viewingShift.opened_at})</span>
              </div>
              <div className="pnl-row">
                <span>Closed By</span>
                <span>{viewingShift.closed_by || "Open Shift"} ({viewingShift.closed_at || "—"})</span>
              </div>
              <div className="pnl-row">
                <span>Opening Drawer Float</span>
                <b>{peso(viewingShift.opening_cash)}</b>
              </div>
              <div className="pnl-row">
                <span>Expected Drawer Cash</span>
                <b>{peso(viewingShift.expected_cash)}</b>
              </div>
              <div className="pnl-row">
                <span>Counted Closing Cash</span>
                <b>
                  {viewingShift.closing_cash !== null && viewingShift.closing_cash !== undefined
                    ? peso(viewingShift.closing_cash)
                    : "—"}
                </b>
              </div>
              <div className="pnl-row highlight">
                <b>Drawer Variance</b>
                <b
                  style={{
                    color:
                      Number(viewingShift.variance || 0) < 0
                        ? "var(--bad)"
                        : "var(--ok)",
                  }}
                >
                  {viewingShift.variance !== null && viewingShift.variance !== undefined
                    ? peso(viewingShift.variance)
                    : "—"}
                </b>
              </div>
            </div>

            <Field label="Shift Audit Notes">
              <input
                value={shiftNotesDraft}
                onChange={(e) => setShiftNotesDraft(e.target.value)}
                placeholder="Add administrative audit notes for this shift"
              />
            </Field>

            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => window.print()}>
                <Printer size={15} /> Print Z-Reading
              </button>
              <button type="submit" className="btn primary">
                Save Audit Notes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 11. Audit Log Detail Modal */}
      {viewingAuditItem && (
        <Modal
          title={`Audit Event #${viewingAuditItem.id} — ${viewingAuditItem.action}`}
          onClose={() => setViewingAuditItem(null)}
        >
          <div className="form">
            <div className="pnl-table">
              <div className="pnl-row">
                <span>Timestamp</span>
                <b>{viewingAuditItem.timestamp}</b>
              </div>
              <div className="pnl-row">
                <span>Actor & Role</span>
                <b>{viewingAuditItem.actor} ({viewingAuditItem.role})</b>
              </div>
              <div className="pnl-row">
                <span>Action & Module</span>
                <span>
                  <StatusBadge tone="info" label={viewingAuditItem.action} />{" "}
                  <StatusBadge tone="neutral" label={viewingAuditItem.entity_type} />
                </span>
              </div>
              <div className="pnl-row">
                <span>Record ID</span>
                <b>{viewingAuditItem.entity_id || "—"}</b>
              </div>
              <div className="pnl-row">
                <span>Summary</span>
                <b>{viewingAuditItem.summary}</b>
              </div>
            </div>
            <Field label="JSON Snapshot / Before & After Payload">
              <pre className="audit-json-pre">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(viewingAuditItem.details_json || "{}"), null, 2);
                  } catch {
                    return viewingAuditItem.details_json || "{}";
                  }
                })()}
              </pre>
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn primary" onClick={() => setViewingAuditItem(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 12. Add Commission Type Modal */}
      {showAddCommType && (
        <Modal title="Add New Commission Category" onClose={() => setShowAddCommType(false)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCommTypeName.trim()) return;
              try {
                const list = await api.addCommissionType(newCommTypeName.trim());
                setCommissionTypes(list || []);
                setNewCommTypeName("");
                setShowAddCommType(false);
                toast("Commission category added");
              } catch (err) {
                toast(errText(err), "bad");
              }
            }}
          >
            <Field label="Commission Type Name *">
              <input
                required
                autoFocus
                value={newCommTypeName}
                onChange={(e) => setNewCommTypeName(e.target.value)}
                placeholder="e.g. VIP Bottle Service, Acoustic Tip"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setShowAddCommType(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Add Category
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 13. Destructive Action Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          detail={confirmAction.detail}
          confirmLabel={confirmAction.confirmLabel}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
