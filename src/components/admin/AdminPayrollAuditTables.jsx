import React from "react";
import { Edit3, Trash2, Wallet, Eye, ShieldCheck } from "lucide-react";
import { api } from "../../api";
import { peso, ymd, errText } from "../../utils";
import { Empty, StatusBadge } from "../ui";
import { TablePagination } from "./AdminOverviewPnL";

/**
 * Report Tabs 6–10:
 * - Regular Commissions CRUD (`commissions`)
 * - Ladies Drink (LD) Commissions CRUD (`ld-commissions`)
 * - Employees Directory & Pay CRUD (`employees`)
 * - Shift Audit & Z-Readings (`shifts`)
 * - Activity & Audit Trail (`audit`)
 */
export function AdminPayrollAuditTables({
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
  filteredCommissions,
  filteredLdCommissions,
  filteredEmployees,
  filteredShifts,
  filteredAudit,
  employeesList,
  commissionTypes,
  activeBusinessDate,
  setEditingCommission,
  setEditingLdCommission,
  setEditingEmployee,
  setEditingSalary,
  setViewingShift,
  setShiftNotesDraft,
  setViewingAuditItem,
  setConfirmAction,
  from,
  to,
  loadAll,
  toast,
}) {
  if (reportTab === "commissions") {
    const sorted = sortRows(filteredCommissions);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    const filteredTotal = sorted.reduce((s, r) => s + Number(r.amount || 0), 0);
    return (
      <div>
        <div className="table-summary-strip">
          <span>Showing <b>{sorted.length}</b> commission records</span>
          <span>Filtered Total: <b className="text-purple">{peso(filteredTotal)}</b></span>
        </div>
        {sorted.length === 0 ? (
          <Empty
            text="No regular commission records found for the selected filter."
            actionLabel="+ Add Commission Record"
            onAction={() =>
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
                    <th onClick={() => toggleSort("earned_on")} className="sortable">
                      Date Earned {renderSortIcon("earned_on")}
                    </th>
                    <th onClick={() => toggleSort("staff_name")} className="sortable">
                      Staff Member {renderSortIcon("staff_name")}
                    </th>
                    <th onClick={() => toggleSort("commission_type")} className="sortable">
                      Type {renderSortIcon("commission_type")}
                    </th>
                    <th>Sales Ref</th>
                    <th className="num">Rate %</th>
                    <th>Notes</th>
                    <th onClick={() => toggleSort("amount")} className="sortable num">
                      Amount {renderSortIcon("amount")}
                    </th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => (
                    <tr key={c.id}>
                      <td className="checkbox-col no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelectOne(c.id)}
                        />
                      </td>
                      <td><b>{c.earned_on}</b></td>
                      <td><b>{c.staff_name}</b></td>
                      <td><StatusBadge tone="purple" label={c.commission_type} /></td>
                      <td>{c.sales_ref || <span className="muted">—</span>}</td>
                      <td className="num">{c.rate_pct ? `${c.rate_pct}%` : "—"}</td>
                      <td>{c.note || <span className="muted">—</span>}</td>
                      <td className="num"><b>{peso(c.amount)}</b></td>
                      <td className="actions-col no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Edit Commission"
                            onClick={() => setEditingCommission({ ...c })}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            title="Delete Commission"
                            onClick={() =>
                              setConfirmAction({
                                title: "Delete Commission Record",
                                message: `Delete ${c.commission_type} commission of ${peso(c.amount)} for ${c.staff_name}?`,
                                detail: "This deletion will be logged in the Audit Trail.",
                                confirmLabel: "Delete Commission",
                                onConfirm: async () => {
                                  try {
                                    await api.deleteCommission(c.id);
                                    toast("Commission deleted");
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

  if (reportTab === "ld-commissions") {
    const sorted = sortRows(filteredLdCommissions);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    const totalDrinks = sorted.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const filteredTotal = sorted.reduce((s, r) => s + Number(r.total || 0), 0);
    return (
      <div>
        <div className="table-summary-strip">
          <span>Showing <b>{sorted.length}</b> LD entries (<b>{totalDrinks}</b> total drinks)</span>
          <span>Filtered LD Payout: <b className="text-purple">{peso(filteredTotal)}</b></span>
        </div>
        {sorted.length === 0 ? (
          <Empty
            text="No Ladies Drink (LD) commission records found for the selected filter."
            actionLabel="+ Log LD Commission"
            onAction={() =>
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
                    <th onClick={() => toggleSort("earned_on")} className="sortable">
                      Date {renderSortIcon("earned_on")}
                    </th>
                    <th onClick={() => toggleSort("staff_name")} className="sortable">
                      Staff / Server {renderSortIcon("staff_name")}
                    </th>
                    <th>Customer / Table</th>
                    <th>Drink</th>
                    <th onClick={() => toggleSort("quantity")} className="sortable num">
                      Qty {renderSortIcon("quantity")}
                    </th>
                    <th className="num">Rate/Drink</th>
                    <th onClick={() => toggleSort("total")} className="sortable num">
                      Total LD {renderSortIcon("total")}
                    </th>
                    <th>Notes</th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => (
                    <tr key={c.id}>
                      <td className="checkbox-col no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelectOne(c.id)}
                        />
                      </td>
                      <td><b>{c.earned_on}</b></td>
                      <td><b>{c.staff_name}</b></td>
                      <td>{c.customer_table || <span className="muted">—</span>}</td>
                      <td><StatusBadge tone="purple" label={c.drink_name || "Ladies Drink"} /></td>
                      <td className="num"><b>{c.quantity}</b></td>
                      <td className="num muted">{peso(c.unit_comm)}</td>
                      <td className="num"><b>{peso(c.total)}</b></td>
                      <td>{c.note || <span className="muted">—</span>}</td>
                      <td className="actions-col no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Edit LD Commission"
                            onClick={() => setEditingLdCommission({ ...c })}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            title="Delete LD Commission"
                            onClick={() =>
                              setConfirmAction({
                                title: "Delete LD Commission",
                                message: `Delete LD commission (${c.quantity} drinks = ${peso(c.total)}) for ${c.staff_name}?`,
                                detail: "This deletion will be logged in the Audit Trail.",
                                confirmLabel: "Delete Record",
                                onConfirm: async () => {
                                  try {
                                    await api.deleteLdCommission(c.id);
                                    toast("LD Commission deleted");
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

  if (reportTab === "employees") {
    const sorted = sortRows(filteredEmployees);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div>
        {sorted.length === 0 ? (
          <Empty
            text="No employees found."
            actionLabel="+ Add Employee Profile"
            onAction={() =>
              setEditingEmployee({
                name: "",
                role: "Cashier",
                contact: "",
                daily_rate: 500,
                hired_on: ymd(),
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
                    <th onClick={() => toggleSort("name")} className="sortable">
                      Employee Name {renderSortIcon("name")}
                    </th>
                    <th onClick={() => toggleSort("role")} className="sortable">
                      Role {renderSortIcon("role")}
                    </th>
                    <th>Contact</th>
                    <th onClick={() => toggleSort("daily_rate")} className="sortable num">
                      Daily Rate {renderSortIcon("daily_rate")}
                    </th>
                    <th onClick={() => toggleSort("salary_total")} className="sortable num">
                      Salaries (Period) {renderSortIcon("salary_total")}
                    </th>
                    <th onClick={() => toggleSort("commission_total")} className="sortable num">
                      Reg Comm (Period) {renderSortIcon("commission_total")}
                    </th>
                    <th onClick={() => toggleSort("ld_total")} className="sortable num">
                      LD Comm (Period) {renderSortIcon("ld_total")}
                    </th>
                    <th onClick={() => toggleSort("total_payout")} className="sortable num">
                      Total Payout {renderSortIcon("total_payout")}
                    </th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((emp) => (
                    <tr key={emp.id}>
                      <td className="checkbox-col no-print">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(emp.id)}
                          onChange={() => toggleSelectOne(emp.id)}
                        />
                      </td>
                      <td><b>{emp.name}</b></td>
                      <td><StatusBadge tone="info" label={emp.role || "Staff"} /></td>
                      <td>{emp.contact || <span className="muted">—</span>}</td>
                      <td className="num">{peso(emp.daily_rate)}</td>
                      <td className="num">{peso(emp.salary_total)}</td>
                      <td className="num">{peso(emp.commission_total)}</td>
                      <td className="num">
                        {peso(emp.ld_total)}
                        {emp.ld_drinks > 0 && (
                          <span className="muted" style={{ fontSize: 11 }}> ({emp.ld_drinks})</span>
                        )}
                      </td>
                      <td className="num"><b>{peso(emp.total_payout)}</b></td>
                      <td className="actions-col no-print">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Pay Salary to Employee"
                            onClick={() =>
                              setEditingSalary({
                                staff_name: emp.name,
                                role: emp.role || "",
                                amount: emp.daily_rate || "",
                                note: "Regular daily rate",
                                paid_on: activeBusinessDate || ymd(),
                              })
                            }
                          >
                            <Wallet size={15} color="var(--ok)" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm"
                            title="Edit Employee Profile"
                            onClick={() => setEditingEmployee({ ...emp })}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm danger"
                            title="Archive Employee"
                            onClick={() =>
                              setConfirmAction({
                                title: "Archive Employee Profile",
                                message: `Archive employee "${emp.name}"?`,
                                detail: "Historical salary and commission payouts for this employee will remain preserved.",
                                confirmLabel: "Archive Employee",
                                onConfirm: async () => {
                                  try {
                                    await api.deleteEmployee(emp.id);
                                    toast(`Archived ${emp.name}`);
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

  if (reportTab === "shifts") {
    const sorted = sortRows(filteredShifts);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div>
        {sorted.length === 0 ? (
          <Empty text="No shift reconciliation records match your filter." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("business_date")} className="sortable">
                      Business Date {renderSortIcon("business_date")}
                    </th>
                    <th>Opened By</th>
                    <th>Closed By</th>
                    <th className="num">Opening Float</th>
                    <th className="num">Expected Cash</th>
                    <th className="num">Closing Count</th>
                    <th className="num">Variance</th>
                    <th>Audit Status</th>
                    <th>Notes</th>
                    <th className="actions-col no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((s) => {
                    const v = Number(s.variance || 0);
                    const isOpen = s.status === "open";
                    return (
                      <tr key={s.id}>
                        <td><b>{s.business_date}</b></td>
                        <td>
                          {s.opened_by}
                          <div className="muted" style={{ fontSize: 11 }}>{s.opened_at}</div>
                        </td>
                        <td>
                          {isOpen ? (
                            <span className="muted">Still Open</span>
                          ) : (
                            <>
                              {s.closed_by || "—"}
                              <div className="muted" style={{ fontSize: 11 }}>{s.closed_at}</div>
                            </>
                          )}
                        </td>
                        <td className="num">{peso(s.opening_cash)}</td>
                        <td className="num"><b>{peso(s.expected_cash)}</b></td>
                        <td className="num">
                          {isOpen ? <span className="muted">—</span> : <b>{peso(s.closing_cash)}</b>}
                        </td>
                        <td className="num">
                          {isOpen ? (
                            <span className="muted">—</span>
                          ) : (
                            <b style={{ color: Math.abs(v) < 0.01 ? "var(--ok)" : v > 0 ? "var(--info)" : "var(--bad)" }}>
                              {v >= 0 ? `+${peso(v)}` : peso(v)}
                            </b>
                          )}
                        </td>
                        <td>
                          {isOpen ? (
                            <StatusBadge tone="warn" label="SHIFT OPEN" />
                          ) : Math.abs(v) < 0.01 ? (
                            <StatusBadge tone="ok" label="BALANCED" />
                          ) : v > 0 ? (
                            <StatusBadge tone="info" label="OVERAGE" />
                          ) : (
                            <StatusBadge tone="bad" label="SHORTAGE" />
                          )}
                        </td>
                        <td>{s.notes || <span className="muted">—</span>}</td>
                        <td className="actions-col no-print">
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn sm"
                              title="Inspect Z-Reading & Edit Audit Notes"
                              onClick={() => {
                                setViewingShift(s);
                                setShiftNotesDraft(s.notes || "");
                              }}
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

  if (reportTab === "audit") {
    const sorted = sortRows(filteredAudit);
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div>
        <div className="table-summary-strip">
          <span>
            <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Immutable Audit Trail — Historical records cannot be deleted or tampered with.
          </span>
          <span><b>{sorted.length}</b> events</span>
        </div>
        {sorted.length === 0 ? (
          <Empty text="No audit trail events match your search in this date range." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("timestamp")} className="sortable">
                      Timestamp {renderSortIcon("timestamp")}
                    </th>
                    <th onClick={() => toggleSort("actor")} className="sortable">
                      Actor {renderSortIcon("actor")}
                    </th>
                    <th onClick={() => toggleSort("action")} className="sortable">
                      Action {renderSortIcon("action")}
                    </th>
                    <th onClick={() => toggleSort("entity_type")} className="sortable">
                      Module {renderSortIcon("entity_type")}
                    </th>
                    <th>Summary Description</th>
                    <th className="actions-col no-print">Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((a) => (
                    <tr key={a.id}>
                      <td><b>{a.timestamp}</b></td>
                      <td>
                        {a.actor}{" "}
                        <span className="muted" style={{ fontSize: 11 }}>({a.role})</span>
                      </td>
                      <td>
                        <StatusBadge
                          tone={
                            a.action === "VOID" || a.action === "DELETE" || a.action === "RESET"
                              ? "bad"
                              : a.action === "CREATE" || a.action === "SALE" || a.action === "RESTOCK"
                              ? "ok"
                              : a.action === "UPDATE"
                              ? "warn"
                              : "info"
                          }
                          label={a.action}
                        />
                      </td>
                      <td><StatusBadge tone="neutral" label={a.entity_type} /></td>
                      <td>{a.summary}</td>
                      <td className="actions-col no-print">
                        <button
                          type="button"
                          className="icon-btn sm"
                          title="Inspect Payload Details"
                          onClick={() => setViewingAuditItem(a)}
                        >
                          <Eye size={15} />
                        </button>
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
