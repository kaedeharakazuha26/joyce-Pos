import { useCallback, useEffect, useState } from "react";
import { PackagePlus } from "lucide-react";
import { api } from "../api";
import { Empty, Field, Modal, PageHeader, useToast } from "../components/ui";
import { errText, peso } from "../utils";

export default function Inventory() {
  const [list, setList] = useState([]);
  const [hist, setHist] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("stock");
  const [target, setTarget] = useState(null);
  const [f, setF] = useState({ qty: "", cost: "", note: "" });
  const toast = useToast();

  const load = useCallback(() => {
    api.products().then(setList).catch((e) => toast(errText(e), "err"));
    api.restocks().then(setHist).catch(() => {});
  }, [toast]);
  useEffect(load, [load]);

  const submit = async () => {
    try {
      await api.restock(target.id, Number(f.qty), Number(f.cost || 0), f.note);
      toast(`Restocked ${target.name} +${f.qty}`);
      setTarget(null); setF({ qty: "", cost: "", note: "" }); load();
    } catch (e) { toast(errText(e), "err"); }
  };

  const shown = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Inventory" subtitle="Restock and track stock levels" />
      <div className="tabs">
        <button className={"chip" + (view === "stock" ? " active" : "")} onClick={() => setView("stock")}>Stock levels</button>
        <button className={"chip" + (view === "history" ? " active" : "")} onClick={() => setView("history")}>Restock history</button>
      </div>
      {view === "stock" ? (
        <>
          <div className="toolbar"><input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="card">
            {shown.length === 0 ? <Empty text="No products" /> : (
              <table>
                <thead><tr><th>Product</th><th className="num">In stock</th><th className="num">Cost</th><th className="num">Stock value</th><th></th></tr></thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className="row-hover">
                      <td><b>{p.name}</b><br /><small className="muted">{p.category}</small></td>
                      <td className="num"><span className={"badge" + (p.stock <= 0 ? " bad" : p.stock <= p.low_stock ? " warn" : "")}>{p.stock}</span></td>
                      <td className="num">{peso(p.cost)}</td>
                      <td className="num">{peso(p.cost * p.stock)}</td>
                      <td><div className="actions"><button className="btn sm" onClick={() => { setTarget(p); setF({ qty: "", cost: p.cost || "", note: "" }); }}><PackagePlus size={14} /> Restock</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          {hist.length === 0 ? <Empty text="No restocks recorded yet" /> : (
            <table>
              <thead><tr><th>Date</th><th>Product</th><th className="num">Qty added</th><th className="num">Unit cost</th><th>Note</th></tr></thead>
              <tbody>
                {hist.map((h) => (
                  <tr key={h.id} className="row-hover">
                    <td className="muted">{h.created_at}</td><td><b>{h.product_name}</b></td>
                    <td className="num">+{h.qty}</td><td className="num">{h.unit_cost ? peso(h.unit_cost) : "—"}</td><td>{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {target && (
        <Modal title={`Restock ${target.name}`} onClose={() => setTarget(null)}>
          <p className="muted">Current stock: <b>{target.stock}</b></p>
          <Field label="Quantity to add (pcs)"><input autoFocus type="number" min="1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
          <Field label="Unit cost (optional — updates product cost)"><input type="number" min="0" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
          <Field label="Note"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Supplier, receipt no…" /></Field>
          <button className="btn" disabled={!(Number(f.qty) > 0)} onClick={submit}>Save restock</button>
        </Modal>
      )}
    </>
  );
}
