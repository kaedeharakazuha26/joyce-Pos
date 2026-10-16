import { Fragment, useCallback, useEffect, useState } from "react";
import { Ban, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { api } from "../api";
import { Empty, Modal, PageHeader, RangeBar, Receipt, useToast, Field } from "../components/ui";
import { useSettings } from "../App";
import { errText, peso, ymd } from "../utils";

function Items({ items }) {
  return (
    <table>
      <tbody>
        {items.map((i, k) => (
          <tr key={k}>
            <td>{i.quantity}× {i.name} {i.variant_name && <span className="badge warn">{i.variant_name}</span>}</td>
            <td className="num">{peso(i.unit_price)}</td>
            <td className="num">{peso(i.subtotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Transactions() {
  const [from, setFrom] = useState(ymd());
  const [to, setTo] = useState(ymd());
  const [view, setView] = useState("sales"); // sales | voided
  const [sales, setSales] = useState([]);
  const [voided, setVoided] = useState([]);
  const [open, setOpen] = useState({});
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState("");
  const [reprint, setReprint] = useState(null);
  const toast = useToast();
  const { settings } = useSettings();

  const load = useCallback(() => {
    api.sales(from, to).then(setSales).catch((e) => toast(errText(e), "err"));
    api.voided(from, to).then(setVoided).catch((e) => toast(errText(e), "err"));
  }, [from, to, toast]);
  useEffect(load, [load]);

  const doVoid = async () => {
    try {
      await api.voidSale(voiding.id, reason.trim());
      toast(`${voiding.receipt_no} voided — items returned to inventory`);
      setVoiding(null); setReason(""); load();
    } catch (e) { toast(errText(e), "err"); }
  };

  const print = async (s) => {
    if (!settings.printer_conn || settings.printer_conn === "none" || settings.printer_conn === "browser") return window.print();
    try { await api.printReceipt(s.id); toast("Sent to printer"); } catch (e) { toast(errText(e), "err"); }
  };

  const completed = sales.filter((s) => s.status === "completed");
  const sum = completed.reduce((a, s) => a + s.total, 0);

  return (
    <>
      <PageHeader title="Transactions" subtitle={`${completed.length} sales · ${peso(sum)}`}>
        <RangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </PageHeader>

      <div className="tabs">
        <button className={"chip" + (view === "sales" ? " active" : "")} onClick={() => setView("sales")}>Sales ({sales.length})</button>
        <button className={"chip" + (view === "voided" ? " active" : "")} onClick={() => setView("voided")}>Voided history ({voided.length})</button>
      </div>

      <div className="card">
        {view === "sales" ? (
          sales.length === 0 ? <Empty text="No transactions for this period" /> : (
            <table>
              <thead><tr><th></th><th>Receipt</th><th>Date</th><th className="num">Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sales.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="row-hover">
                      <td style={{ width: 30 }}><button className="icon-btn" onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>{open[s.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td>
                      <td><b>{s.receipt_no}</b></td>
                      <td className="muted">{s.created_at}</td>
                      <td className="num">{peso(s.total)}</td>
                      <td><span className={"badge" + (s.status === "voided" ? " bad" : "")}>{s.status}</span></td>
                      <td>
                        <div className="actions">
                          <button className="btn ghost sm" onClick={() => setReprint(s)}><Printer size={14} /> Receipt</button>
                          {s.status === "completed" && <button className="btn danger sm" onClick={() => setVoiding(s)}><Ban size={14} /> Void</button>}
                        </div>
                      </td>
                    </tr>
                    {open[s.id] && <tr><td></td><td colSpan={5}><Items items={s.items} />{s.void_reason && <p className="muted">Void reason: {s.void_reason}</p>}</td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )
        ) : voided.length === 0 ? <Empty text="No voided sales in this period" /> : (
          <table>
            <thead><tr><th>Receipt</th><th>Sold</th><th>Voided</th><th>Reason</th><th>Items</th><th className="num">Total</th></tr></thead>
            <tbody>
              {voided.map((v) => (
                <tr key={v.id} className="row-hover">
                  <td><b>{v.receipt_no}</b></td>
                  <td className="muted">{v.sold_at}</td>
                  <td className="muted">{v.voided_at}</td>
                  <td>{v.reason || "—"}</td>
                  <td>{v.items.map((i) => `${i.quantity}× ${i.name}${i.variant_name ? ` (${i.variant_name})` : ""}`).join(", ")}</td>
                  <td className="num">{peso(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {voiding && (
        <Modal title={`Void ${voiding.receipt_no}?`} onClose={() => setVoiding(null)}>
          <p className="muted">The items below return to inventory and this sale is saved in voided history.</p>
          <Items items={voiding.items} />
          <Field label="Reason (optional)"><input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer changed mind" /></Field>
          <button className="btn danger" onClick={doVoid}><Ban size={16} /> Confirm void · {peso(voiding.total)}</button>
        </Modal>
      )}
      {reprint && (
        <Modal title="Receipt" onClose={() => setReprint(null)}>
          <div className="receipt-wrap"><Receipt sale={reprint} settings={settings} /></div>
          <button className="btn" onClick={() => print(reprint)}><Printer size={16} /> Print</button>
        </Modal>
      )}
    </>
  );
}
