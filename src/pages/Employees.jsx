import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, useToast } from "../components/ui";
import { errText, peso } from "../utils";

const blank = { name: "", position: "", commission: "", ld_commission: "", salary: "" };

export default function Employees() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const toast = useToast();

  const load = useCallback(() => api.employees().then(setList).catch((e) => toast(errText(e), "err")), [toast]);
  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    try {
      await api.saveEmployee({
        ...form,
        commission: Number(form.commission || 0),
        ld_commission: Number(form.ld_commission || 0),
        salary: Number(form.salary || 0),
      });
      toast("Employee saved"); setForm(null); load();
    } catch (e) { toast(errText(e), "err"); }
  };
  const remove = async (x) => {
    if (!confirm(`Remove ${x.name}? Past salary records stay.`)) return;
    await api.deleteEmployee(x.id); load();
  };

  return (
    <>
      <PageHeader title="Employees" subtitle={`${list.length} employees`}>
        <button id="add-employee" className="btn" onClick={() => setForm({ ...blank })}><Plus size={16} /> Add employee</button>
      </PageHeader>
      <div className="card">
        {list.length === 0 ? <Empty text="No employees yet" /> : (
          <table>
            <thead><tr><th>Name</th><th>Position</th><th className="num">Commission</th><th className="num">LD commission</th><th className="num">Salary</th><th></th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="row-hover">
                  <td><b>{x.name}</b></td>
                  <td>{x.position || "—"}</td>
                  <td className="num">{peso(x.commission)}</td>
                  <td className="num">{peso(x.ld_commission)}</td>
                  <td className="num">{peso(x.salary)}</td>
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
        <Modal title={form.id ? "Edit employee" : "Add employee"} onClose={() => setForm(null)}>
          <Field label="Name"><input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Position"><input value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="Cashier, Helper…" /></Field>
          <div className="grid2">
            <Field label="Commission (₱ flat)"><input type="number" min="0" step="0.01" value={form.commission} onChange={(e) => set("commission", e.target.value)} /></Field>
            <Field label="LD commission (₱ flat)"><input type="number" min="0" step="0.01" value={form.ld_commission} onChange={(e) => set("ld_commission", e.target.value)} /></Field>
          </div>
          <Field label="Salary"><input type="number" min="0" value={form.salary} onChange={(e) => set("salary", e.target.value)} /></Field>
          <button className="btn" disabled={!form.name.trim()} onClick={save}>Save employee</button>
        </Modal>
      )}
    </>
  );
}
