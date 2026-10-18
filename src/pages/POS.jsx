import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Trash2, Printer, ShoppingBag, Minus, Plus } from "lucide-react";
import { api } from "../api";
import { Modal, Receipt, useToast, Empty } from "../components/ui";
import { useSettings } from "../App";
import { errText, peso } from "../utils";

export default function POS() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState([]); // {key, product, variant|null, quantity}
  const [paid, setPaid] = useState("");
  const [picker, setPicker] = useState(null);
  const [done, setDone] = useState(null);
  const toast = useToast();
  const { settings } = useSettings();

  const load = useCallback(() => api.products().then(setProducts).catch((e) => toast(errText(e), "err")), [toast]);
  useEffect(() => { load(); }, [load]);

  const cats = useMemo(() => ["All", ...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const shown = products.filter(
    (p) => (cat === "All" || p.category === cat) && (p.name + p.barcode).toLowerCase().includes(q.toLowerCase())
  );

  // base units already committed in the cart for a product (variants share the same stock)
  const unitsInCart = (pid) =>
    cart.filter((l) => l.product.id === pid).reduce((s, l) => s + l.quantity * (l.variant ? l.variant.qty : 1), 0);
  const remaining = (p) => p.stock - unitsInCart(p.id);

  const add = (product, variant) => {
    const key = `${product.id}-${variant?.id ?? 0}`;
    setCart((c) => (c.find((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)) : [...c, { key, product, variant, quantity: 1 }]));
    setPicker(null);
  };
  const step = (line, d) => {
    setCart((c) => c.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + d } : l)).filter((l) => l.quantity > 0));
  };
  const click = (p) => (p.variants.length ? setPicker(p) : add(p, null));

  const onSearchKeyDown = (e) => {
    if (e.key === "Enter" && q.trim()) {
      const match =
        shown.find(
          (p) =>
            p.barcode &&
            p.barcode.toLowerCase() === q.trim().toLowerCase()
        ) ||
        shown.find(
          (p) => p.name.toLowerCase() === q.trim().toLowerCase()
        ) ||
        (shown.length === 1 ? shown[0] : null);
      if (match) {
        click(match);
        setQ("");
      }
    }
  };

  const price = (l) => (l.variant ? l.variant.price : l.product.price);
  const total = cart.reduce((s, l) => s + price(l) * l.quantity, 0);
  const change = Number(paid || 0) - total;

  const checkout = async () => {
    try {
      const sale = await api.createSale(
        cart.map((l) => ({ product_id: l.product.id, variant_id: l.variant?.id ?? null, quantity: l.quantity })),
        Number(paid || total)
      );
      setDone(sale); setCart([]); setPaid(""); load();
      if (settings.auto_print === "1") api.printReceipt(sale.id).catch((e) => toast(errText(e), "err"));
    } catch (e) { toast(errText(e), "err"); }
  };

  const print = async () => {
    if (!settings.printer_conn || settings.printer_conn === "none" || settings.printer_conn === "browser") return window.print();
    try { await api.printReceipt(done.id); toast("Sent to printer"); } catch (e) { toast(errText(e), "err"); }
  };

  const quick = [...new Set([total, 20, 50, 100, 200, 500, 1000].filter((x) => x >= total && x > 0))].slice(0, 5);

  return (
    <div className="pos">
      <section className="pos-left">
        <div className="toolbar">
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 13, opacity: 0.5 }} />
            <input
              id="pos-search"
              style={{ paddingLeft: 36 }}
              autoFocus
              placeholder="Search product or scan barcode…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>
        </div>
        <div className="cats">{cats.map((c) => <button key={c} className={"chip" + (cat === c ? " active" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
        {shown.length === 0 ? <Empty text="No products found. Add some in the Products tab." /> : (
          <div className="products">
            {shown.map((p) => (
              <button key={p.id} className="pcard" onClick={() => click(p)}>
                {p.variants.length > 0 && <span className="vtag">{p.variants.length + 1} options</span>}
                {p.image ? (
                  <img src={p.image} alt={p.name} className="pcard-img" />
                ) : (
                  <div className="pcard-img-placeholder" />
                )}
                <span className="pname">{p.name}</span>
                <span className="pprice">{peso(p.price)}</span>
                <span
                  className="pstock"
                  style={remaining(p) <= 0 ? { color: "var(--warn, #f59e0b)", fontWeight: 600 } : undefined}
                >
                  {remaining(p)} in stock
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="pos-right">
        <div className="cart-head">
          <h3>Current sale</h3>
          {cart.length > 0 && <button className="icon-btn" title="Clear" onClick={() => setCart([])}><Trash2 size={17} /></button>}
        </div>
        <div className="cart-lines">
          {cart.length === 0 ? <Empty text="Tap a product to start" /> : cart.map((l) => (
            <div className="cart-line" key={l.key}>
              <div>
                <div className="t">{l.product.name}</div>
                <div className="v">{l.variant ? `${l.variant.name} · ${peso(l.variant.price)}` : `${peso(l.product.price)} each`}</div>
              </div>
              <b style={{ textAlign: "right" }}>{peso(price(l) * l.quantity)}</b>
              <div className="qty">
                <button onClick={() => step(l, -1)}><Minus size={14} /></button>
                <b>{l.quantity}</b>
                <button onClick={() => step(l, 1)}><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="cart-foot">
          <div className="total-row"><span>Total</span><span>{peso(total)}</span></div>
          <input id="pos-paid" type="number" min="0" placeholder="Cash received" value={paid} onChange={(e) => setPaid(e.target.value)} />
          <div className="quick">
            {quick.map((x) => <button key={x} className="chip" onClick={() => setPaid(String(x))}>{x === total ? "Exact" : peso(x).replace(".00", "")}</button>)}
          </div>
          {paid !== "" && <div className="total-row" style={{ fontSize: 16 }}><span className="muted">Change</span><span style={{ color: change < 0 ? "var(--bad)" : "var(--ok)" }}>{peso(Math.max(change, 0))}</span></div>}
          <button id="pos-charge" className="btn big" disabled={!cart.length || (paid !== "" && change < 0)} onClick={checkout}><ShoppingBag size={20} /> Charge {peso(total)}</button>
        </div>
      </aside>

      {picker && (
        <Modal title={picker.name} onClose={() => setPicker(null)}>
          <div className="variant-pick">
            {[{ id: null, name: "1 pc (regular)", qty: 1, price: picker.price }, ...picker.variants].map((v) => (
              <button key={v.id ?? "base"} className="vopt" onClick={() => add(picker, v.id ? v : null)}>
                <span><b>{v.name}</b><br /><small className="muted">uses {v.qty} from stock</small></span>
                <b>{peso(v.price)}</b>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {done && (
        <Modal title="Sale complete" onClose={() => setDone(null)}>
          <div className="stats" style={{ gridTemplateColumns: "1fr 1fr", margin: 0 }}>
            <div className="card"><div className="muted">Total</div><b style={{ fontSize: 22 }}>{peso(done.total)}</b></div>
            <div className="card"><div className="muted">Change</div><b style={{ fontSize: 22, color: "var(--ok)" }}>{peso(done.change_amt)}</b></div>
          </div>
          <div className="receipt-wrap"><Receipt sale={done} settings={settings} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={print}><Printer size={16} /> Print receipt</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => setDone(null)}>New sale</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
