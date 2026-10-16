import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, RangeBar, useToast } from "../components/ui";
import { errText, monthStart, peso, ymd } from "../utils";

const blank = () => ({ employee: "", amount: "", date: ymd(), note: "" });

export default function Salary() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(ymd());
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    api.salaries(from, to).then(setList).catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.employees().then(setEmployees).catch(() => {});
  }, []);

  const pickEmployee = (name) => {
    const emp = employees.find((e) => e.name === name);
    setForm((f) => ({
      ...f,
      employee: name,
      amount: emp && emp.salary > 0 ? emp.salary : (f?.amount || ""),
    }));
  };

  const save = async () => {
    try {
      await api.saveSalary({ ...form, amount: Number(form.amount) });
      toast("Salary recorded");
      setForm(null);
      load();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const remove = async (x) => {
    if (confirm("Delete this salary record?")) {
      await api.deleteSalary(x.id);
      load();
    }
  };

  const total = list.reduce((a, x) => a + x.amount, 0);
  const selectedMissing = form?.employee && !employees.some((e) => e.name === form.employee);

  return (
    <>
      <PageHeader title="Salary" subtitle={`Total paid ${peso(total)}`}>
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <button className="btn" onClick={() => setForm(blank())}>
          <Plus size={16} /> Record salary
        </button>
      </PageHeader>
      <div className="card">
        {list.length === 0 ? (
          <Empty text="No salary records" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Note</th>
                <th className="num">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="row-hover">
                  <td className="muted">{x.date}</td>
                  <td><b>{x.employee}</b></td>
                  <td>{x.note}</td>
                  <td className="num">{peso(x.amount)}</td>
                  <td>
                    <div className="actions">
                      <button className="icon-btn" onClick={() => setForm({ ...x })}>
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
        <Modal title={form.id ? "Edit salary" : "Record salary"} onClose={() => setForm(null)}>
          <Field
            label="Employee"
            hint={employees.length === 0 ? "Add employees in the Employees tab first." : undefined}
          >
            <select
              autoFocus
              value={form.employee}
              onChange={(e) => pickEmployee(e.target.value)}
            >
              <option value="">Select employee…</option>
              {selectedMissing && <option value={form.employee}>{form.employee}</option>}
              {employees.map((x) => (
                <option key={x.id} value={x.name}>
                  {x.name}
                  {x.position ? ` — ${x.position}` : ""}
                  {x.salary > 0 ? ` (₱${x.salary})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Amount" hint="Pre-filled from employee salary (editable)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Date paid">
              <input
                type="date"
                style={{ width: "100%" }}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Note">
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="e.g. Regular payout / bonus"
            />
          </Field>
          <button
            className="btn"
            disabled={!form.employee || !(Number(form.amount) > 0)}
            onClick={save}
          >
            Save salary
          </button>
        </Modal>
      )}
    </>
  );
}
