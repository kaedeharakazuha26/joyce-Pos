import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, RangeBar, useToast } from "../components/ui";
import { errText, monthStart, peso, ymd } from "../utils";

const blank = () => ({ category: "", description: "", amount: "", date: ymd() });

export default function Expenses() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(ymd());
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const toast = useToast();

  const load = useCallback(() => api.expenses(from, to).then(setList).catch((e) => toast(errText(e), "err")), [from, to, toast]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try { await api.saveExpense({ ...form, amount: Number(form.amount) }); toast("Expense saved"); setForm(null); load(); }
    catch (e) { toast(errText(e), "err"); }
  };
  const remove = async (x) => { if (confirm("Delete this expense?")) { await api.deleteExpense(x.id); load(); } };
  const total = list.reduce((a, x) => a + x.amount, 0);

  return (
    <>
      <PageHeader title="Expenses" subtitle={`Total ${peso(total)}`}>
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <button className="btn" onClick={() => setForm(blank())}><Plus size={16} /> Add expense</button>
      </PageHeader>
      <div className="card">
        {list.length === 0 ? <Empty text="No expenses recorded" /> : (
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="row-hover">
                  <td className="muted">{x.date}</td><td><span className="badge warn">{x.category || "General"}</span></td><td>{x.description}</td>
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
        <Modal title={form.id ? "Edit expense" : "Add expense"} onClose={() => setForm(null)}>
          <Field label="Category">
            <input list="exp-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Electricity, Rent, Supplies…" />
            <datalist id="exp-cats">{["Electricity", "Water", "Rent", "Supplies", "Transport", "Other"].map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid2">
            <Field label="Amount"><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Date"><input type="date" style={{ width: "100%" }} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <button className="btn" disabled={!(Number(form.amount) > 0)} onClick={save}>Save expense</button>
        </Modal>
      )}
    </>
  );
}
