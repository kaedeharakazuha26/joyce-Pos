import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, RangeBar, useToast } from "../components/ui";
import { errText, monthStart, peso, ymd } from "../utils";

/**
 * Shared page for "Commission" (with a type) and "LD Commission" (no type).
 * Employee is picked from the Employees tab; amount is pre-filled from the
 * employee's flat commission but stays editable.
 */
function CommissionBase({ kind }) {
  const isLd = kind === "ld";
  const title = isLd ? "LD Commission" : "Commission";
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(ymd());
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(null);
  const [newType, setNewType] = useState(null); // string while the "+" modal is open
  const toast = useToast();

  const load = useCallback(() => {
    (isLd ? api.ldCommissions(from, to) : api.commissions(from, to)).then(setList).catch((e) => toast(errText(e), "err"));
  }, [isLd, from, to, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.employees().then(setEmployees).catch(() => {});
    if (!isLd) api.commissionTypes().then(setTypes).catch(() => {});
  }, [isLd]);

  const defaultAmount = (emp) => (emp ? (isLd ? emp.ld_commission : emp.commission) || "" : "");

  const pickEmployee = (id) => {
    const emp = employees.find((x) => String(x.id) === id);
    setForm((f) => ({ ...f, employee_id: emp ? emp.id : null, employee_name: emp ? emp.name : "", amount: defaultAmount(emp) }));
  };

  const open = () => setForm({ date: ymd(), employee_id: null, employee_name: "", type: types[0]?.name || "", amount: "" });

  const save = async () => {
    try {
      const payload = { ...form, amount: Number(form.amount) };
      await (isLd ? api.saveLdCommission(payload) : api.saveCommission(payload));
      toast(`${title} saved`); setForm(null); load();
    } catch (e) { toast(errText(e), "err"); }
  };
  const remove = async (x) => {
    if (!confirm("Delete this record?")) return;
    await (isLd ? api.deleteLdCommission(x.id) : api.deleteCommission(x.id)); load();
  };
  const addType = async () => {
    try {
      const name = newType.trim();
      await api.addCommissionType(name);
      setTypes(await api.commissionTypes());
      setForm((f) => ({ ...f, type: name }));
      setNewType(null);
    } catch (e) { toast(errText(e), "err"); }
  };

  const total = list.reduce((a, x) => a + x.amount, 0);
  // keep the selected employee selectable even if removed from the Employees tab
  const selectedMissing = form?.employee_id && !employees.some((x) => x.id === form.employee_id);

  return (
    <>
      <PageHeader title={title} subtitle={`Total ${peso(total)}`}>
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <button className="btn" onClick={open}><Plus size={16} /> Add {title.toLowerCase()}</button>
      </PageHeader>

      <div className="card">
        {list.length === 0 ? <Empty text="No records for this period" /> : (
          <table>
            <thead><tr><th>Date</th><th>Name</th>{!isLd && <th>Type</th>}<th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="row-hover">
                  <td className="muted">{x.date}</td>
                  <td><b>{x.employee_name}</b></td>
                  {!isLd && <td><span className="badge warn">{x.type}</span></td>}
                  <td className="num">{peso(x.amount)}</td>
                  <td><div className="actions">
                    <button className="icon-btn" onClick={() => setForm({ ...x })}><Pencil size={16} /></button>
                    <button className="icon-btn" onClick={() => remove(x)}><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title={form.id ? `Edit ${title}` : `Add ${title}`} onClose={() => setForm(null)}>
          <Field label="Date"><input type="date" style={{ width: "100%" }} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Name" hint={employees.length === 0 ? "Add employees in the Employees tab first." : undefined}>
            <select value={form.employee_id ?? ""} onChange={(e) => pickEmployee(e.target.value)}>
              <option value="">Select employee…</option>
              {selectedMissing && <option value={form.employee_id}>{form.employee_name}</option>}
              {employees.map((x) => <option key={x.id} value={x.id}>{x.name}{x.position ? ` — ${x.position}` : ""}</option>)}
            </select>
          </Field>
          {!isLd && (
            <Field label="Commission type">
              <div style={{ display: "flex", gap: 8 }}>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="">Select type…</option>
                  {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
                <button type="button" className="btn ghost" title="Add new type" aria-label="Add new commission type" onClick={() => setNewType("")}><Plus size={16} /></button>
              </div>
            </Field>
          )}
          <Field label="Amount (₱)" hint="Pre-filled from the Employees tab — you can change it.">
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <button className="btn" disabled={!form.employee_name || !(Number(form.amount) > 0) || (!isLd && !form.type)} onClick={save}>Save</button>
        </Modal>
      )}

      {newType !== null && (
        <Modal title="New commission type" onClose={() => setNewType(null)}>
          <Field label="Type name"><input autoFocus value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newType.trim() && addType()} placeholder="e.g. Delivery" /></Field>
          <button className="btn" disabled={!newType.trim()} onClick={addType}>Add type</button>
        </Modal>
      )}
    </>
  );
}

export const Commission = () => <CommissionBase kind="commission" />;
export const LDCommission = () => <CommissionBase kind="ld" />;
