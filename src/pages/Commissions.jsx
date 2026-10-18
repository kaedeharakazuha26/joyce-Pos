import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, RangeBar, useToast } from "../components/ui";
import { errText, monthStart, peso, ymd } from "../utils";
import { useSettings } from "../App";

/**
 * Shared page for "Commission" (with a type) and "LD Commission" (with quantity multiplier).
 * Employee is picked from the Employees tab.
 * For LD Commission: quantity automatically multiplies the employee's LD commission rate,
 * and the resulting amount remains completely editable.
 */
function CommissionBase({ kind }) {
  const { activeBusinessDate } = useSettings();
  const isLd = kind === "ld";
  const title = isLd ? "LD Commission" : "Commission";
  const [from, setFrom] = useState(() => monthStart(activeBusinessDate));
  const [to, setTo] = useState(() => activeBusinessDate || ymd());
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(null);
  const [newType, setNewType] = useState(null); // string while the "+" modal is open
  const toast = useToast();

  useEffect(() => {
    if (activeBusinessDate) {
      setTo(activeBusinessDate);
      setFrom(monthStart(activeBusinessDate));
    }
  }, [activeBusinessDate]);

  const load = useCallback(() => {
    (isLd ? api.ldCommissions(from, to) : api.commissions(from, to))
      .then(setList)
      .catch((e) => toast(errText(e), "err"));
  }, [isLd, from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => {});
    if (!isLd) api.commissionTypes().then(setTypes).catch(() => {});
  }, [isLd]);

  const pickEmployee = (id) => {
    const emp = employees.find((x) => String(x.id) === id);
    const qty = isLd ? Number(form?.quantity || 1) : 1;
    const baseRate = emp ? (isLd ? emp.ld_commission : emp.commission) || 0 : 0;
    const computedAmt = isLd ? qty * baseRate : baseRate;
    setForm((f) => ({
      ...f,
      employee_id: emp ? emp.id : null,
      employee_name: emp ? emp.name : "",
      amount: computedAmt > 0 ? computedAmt : (f?.amount || ""),
    }));
  };

  const changeQuantity = (q) => {
    const qty = Number(q) || 0;
    const emp = employees.find((x) => String(x.id) === String(form?.employee_id));
    const baseRate = emp?.ld_commission || 0;
    const computedAmt = qty * baseRate;
    setForm((f) => ({
      ...f,
      quantity: q,
      amount: computedAmt > 0 ? computedAmt : f.amount,
    }));
  };

  const open = () =>
    setForm({
      date: activeBusinessDate || ymd(),
      employee_id: null,
      employee_name: "",
      type: types[0]?.name || "",
      quantity: isLd ? 1 : undefined,
      amount: "",
    });

  const save = async () => {
    try {
      const payload = {
        ...form,
        quantity: isLd ? (Number(form.quantity) || 1) : undefined,
        amount: Number(form.amount),
      };
      await (isLd ? api.saveLdCommission(payload) : api.saveCommission(payload));
      toast(`${title} saved`);
      setForm(null);
      load();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const remove = async (x) => {
    if (!confirm("Delete this record?")) return;
    await (isLd ? api.deleteLdCommission(x.id) : api.deleteCommission(x.id));
    load();
  };

  const addType = async () => {
    try {
      const name = newType.trim();
      await api.addCommissionType(name);
      setTypes(await api.commissionTypes());
      setForm((f) => ({ ...f, type: name }));
      setNewType(null);
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const total = list.reduce((a, x) => a + x.amount, 0);
  const selectedMissing = form?.employee_id && !employees.some((x) => x.id === form.employee_id);
  const selectedEmp = employees.find((x) => x.id === form?.employee_id);

  return (
    <>
      <PageHeader title={title} subtitle={`Total ${peso(total)}`}>
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} businessDate={activeBusinessDate} />
        <button className="btn" onClick={open}>
          <Plus size={16} /> Add {title.toLowerCase()}
        </button>
      </PageHeader>

      <div className="card">
        {list.length === 0 ? (
          <Empty text="No records for this period" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Shift Date</th>
                <th>Name</th>
                {!isLd && <th>Type</th>}
                {isLd && <th className="num">Quantity</th>}
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="row-hover">
                  <td className="muted"><b>{x.business_date || x.date}</b></td>
                  <td><b>{x.employee_name}</b></td>
                  {!isLd && <td><span className="badge warn">{x.type}</span></td>}
                  {isLd && <td className="num">{x.quantity ?? 1}</td>}
                  <td className="num">{peso(x.amount)}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="icon-btn"
                        onClick={() =>
                          setForm({
                            ...x,
                            quantity: x.quantity ?? 1,
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button className="icon-btn" onClick={() => remove(x)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title={form.id ? `Edit ${title}` : `Add ${title}`} onClose={() => setForm(null)}>
          <Field label="Date">
            <input
              type="date"
              style={{ width: "100%" }}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Name" hint={employees.length === 0 ? "Add employees in the Employees tab first." : undefined}>
            <select value={form.employee_id ?? ""} onChange={(e) => pickEmployee(e.target.value)}>
              <option value="">Select employee…</option>
              {selectedMissing && <option value={form.employee_id}>{form.employee_name}</option>}
              {employees.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.position ? ` — ${x.position}` : ""}
                  {isLd && x.ld_commission ? ` (₱${x.ld_commission}/unit)` : ""}
                </option>
              ))}
            </select>
          </Field>

          {!isLd && (
            <Field label="Commission type">
              <div style={{ display: "flex", gap: 8 }}>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="">Select type…</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn ghost"
                  title="Add new type"
                  aria-label="Add new commission type"
                  onClick={() => setNewType("")}
                >
                  <Plus size={16} />
                </button>
              </div>
            </Field>
          )}

          {isLd ? (
            <div className="grid2">
              <Field label="Quantity">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity ?? 1}
                  onChange={(e) => changeQuantity(e.target.value)}
                  placeholder="1"
                />
              </Field>
              <Field
                label="Total Amount (₱)"
                hint={
                  selectedEmp?.ld_commission
                    ? `${form.quantity || 1} × ₱${selectedEmp.ld_commission} = ₱${((Number(form.quantity) || 1) * selectedEmp.ld_commission).toFixed(2)}`
                    : "Editable"
                }
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </Field>
            </div>
          ) : (
            <Field label="Amount (₱)" hint="Pre-filled from employee rate — you can change it.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
          )}

          <button
            className="btn"
            disabled={!form.employee_name || !(Number(form.amount) > 0) || (!isLd && !form.type)}
            onClick={save}
          >
            Save
          </button>
        </Modal>
      )}

      {newType !== null && (
        <Modal title="New commission type" onClose={() => setNewType(null)}>
          <Field label="Type name">
            <input
              autoFocus
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newType.trim() && addType()}
              placeholder="e.g. Delivery"
            />
          </Field>
          <button className="btn" disabled={!newType.trim()} onClick={addType}>
            Add type
          </button>
        </Modal>
      )}
    </>
  );
}

export const Commission = () => <CommissionBase kind="commission" />;
export const LDCommission = () => <CommissionBase kind="ld" />;
