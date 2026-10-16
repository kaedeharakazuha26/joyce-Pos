import { useCallback, useEffect, useState } from "react";
import { PackagePlus, Info, TrendingUp, Layers } from "lucide-react";
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
      setTarget(null);
      setF({ qty: "", cost: "", note: "" });
      load();
    } catch (e) {
      toast(errText(e), "err");
    }
  };

  const shown = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const totalStockValue = list.reduce((sum, p) => sum + (p.stock * p.cost || 0), 0);
  const totalUnits = list.reduce((sum, p) => sum + (p.stock || 0), 0);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Restock and track stock levels" />

      {/* Explanatory Stock Value Card */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, rgba(91, 141, 239, 0.08), rgba(255, 122, 61, 0.08))",
          border: "1px solid rgba(91, 141, 239, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(91, 141, 239, 0.15)",
              color: "#5b8def",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Info size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <b style={{ fontSize: 15, color: "var(--text)" }}>Understanding Stock Value in JOYCE POS</b>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <span>Total On-Hand: <b>{totalUnits} units</b></span>
                <span>Total Inventory Value: <b style={{ color: "var(--accent)" }}>{peso(totalStockValue)}</b></span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
              <b>Stock Value</b> is the total asset capital (<b>puhunan</b>) currently tied up in your warehouse/store shelves.
              It is calculated as <code>Stock Value = In Stock Quantity × Unit Cost (Puhunan)</code>.
              When you <b>restock</b>, adding incoming inventory increases both your available units and your total store asset value.
            </p>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={"chip" + (view === "stock" ? " active" : "")} onClick={() => setView("stock")}>
          Stock levels
        </button>
        <button className={"chip" + (view === "history" ? " active" : "")} onClick={() => setView("history")}>
          Restock history
        </button>
      </div>

      {view === "stock" ? (
        <>
          <div className="toolbar">
            <input type="search" placeholder="Search product…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="card">
            {shown.length === 0 ? (
              <Empty text="No products" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">In stock</th>
                    <th className="num">Cost (Puhunan)</th>
                    <th className="num" title="Stock Value = In Stock × Cost">
                      Stock value ℹ️
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className="row-hover">
                      <td>
                        <b>{p.name}</b>
                        <br />
                        <small className="muted">{p.category}</small>
                      </td>
                      <td className="num">
                        <span className={"badge" + (p.stock <= 0 ? " bad" : p.stock <= p.low_stock ? " warn" : "")}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="num">{peso(p.cost)}</td>
                      <td className="num" style={{ fontWeight: 600, color: "var(--accent)" }}>
                        {peso(p.cost * p.stock)}
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="btn sm"
                            onClick={() => {
                              setTarget(p);
                              setF({ qty: "", cost: p.cost || "", note: "" });
                            }}
                          >
                            <PackagePlus size={14} /> Restock
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          {hist.length === 0 ? (
            <Empty text="No restocks recorded yet" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="num">Qty added</th>
                  <th className="num">Unit cost</th>
                  <th className="num">Added value</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h) => (
                  <tr key={h.id} className="row-hover">
                    <td className="muted">{h.created_at}</td>
                    <td><b>{h.product_name}</b></td>
                    <td className="num"><span className="badge" style={{ color: "var(--ok)" }}>+{h.qty}</span></td>
                    <td className="num">{h.unit_cost ? peso(h.unit_cost) : "—"}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{h.unit_cost ? peso(h.qty * h.unit_cost) : "—"}</td>
                    <td>{h.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Restock Modal with Live Stock Value Explanation ── */}
      {target && (() => {
        const addQty = Math.max(0, Number(f.qty) || 0);
        const unitCost = Number(f.cost) > 0 ? Number(f.cost) : Number(target.cost) || 0;
        const currentStock = target.stock || 0;
        const currentVal = currentStock * (Number(target.cost) || 0);
        const addedVal = addQty * unitCost;
        const projectedStock = currentStock + addQty;
        const projectedVal = projectedStock * unitCost;

        return (
          <Modal title={`Restock ${target.name}`} onClose={() => setTarget(null)}>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, background: "var(--card)", padding: 12, borderRadius: 10 }}>
              <Layers size={18} color="var(--accent)" />
              <div style={{ fontSize: 13 }}>
                <div>Current Stock: <b>{currentStock} units</b></div>
                <div className="muted">Current Stock Value: <b>{peso(currentVal)}</b></div>
              </div>
            </div>

            <Field label="Quantity to add (pcs / units)">
              <input
                autoFocus
                type="number"
                min="1"
                value={f.qty}
                onChange={(e) => setF({ ...f, qty: e.target.value })}
                placeholder="e.g. 24"
              />
            </Field>

            <Field label="Unit Cost / Puhunan (₱)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={f.cost}
                onChange={(e) => setF({ ...f, cost: e.target.value })}
                placeholder={`Current: ${target.cost || 0}`}
              />
              <small className="muted" style={{ display: "block", marginTop: 4 }}>
                Unit cost determines the purchase price you paid. Updating this recalculates your inventory value.
              </small>
            </Field>

            <Field label="Restock Note (Supplier / Receipt #)">
              <input
                value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })}
                placeholder="e.g. Supplier invoice #8821, Divisoria delivery"
              />
            </Field>

            {/* Live Stock Value Calculation Impact */}
            {addQty > 0 && (
              <div
                style={{
                  background: "rgba(47, 207, 138, 0.08)",
                  border: "1px solid rgba(47, 207, 138, 0.3)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--ok)", marginBottom: 6 }}>
                  <TrendingUp size={15} /> Projected Stock & Value Impact
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>Added Capital: <b>+{peso(addedVal)}</b></div>
                  <div>New Stock Total: <b>{projectedStock} units</b></div>
                  <div style={{ gridColumn: "span 2" }}>
                    New Product Stock Value: <b style={{ color: "var(--accent)" }}>{peso(projectedVal)}</b>
                  </div>
                </div>
              </div>
            )}

            <button className="btn" disabled={!(addQty > 0)} onClick={submit} style={{ width: "100%" }}>
              <PackagePlus size={16} /> Confirm Restock & Update Stock Value
            </button>
          </Modal>
        );
      })()}
    </>
  );
}
