import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X } from "lucide-react";
import { daysAgo, monthStart, ymd } from "../utils";

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className={"modal" + (wide ? " wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((msg, type = "ok") => {
    const id = Math.random();
    setList((l) => [...l, { id, msg, type }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {list.map((t) => (
          <div key={t.id} className={"toast " + t.type}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="head-actions">{children}</div>
    </header>
  );
}

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** Date range picker with quick presets. */
export function RangeBar({ from, to, setFrom, setTo }) {
  const preset = (a, b) => { setFrom(a); setTo(b); };
  return (
    <div className="range">
      <button className="chip" onClick={() => preset(ymd(), ymd())}>Today</button>
      <button className="chip" onClick={() => preset(daysAgo(6), ymd())}>7 days</button>
      <button className="chip" onClick={() => preset(daysAgo(29), ymd())}>30 days</button>
      <button className="chip" onClick={() => preset(monthStart(), ymd())}>This month</button>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <span>→</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
    </div>
  );
}

/** On-screen receipt that mirrors the thermal layout (also used for browser printing). */
export function Receipt({ sale, settings }) {
  const paper = settings.paper_width || "58";
  const cpl = Number(settings.chars_per_line) || (paper === "80" ? 48 : 32);
  const align = (k, d) => ({ textAlign: settings[k] || d });
  const dash = "-".repeat(cpl);
  const row = (l, r) => {
    const left = String(l).slice(0, Math.max(0, cpl - String(r).length - 1));
    return left + " ".repeat(Math.max(1, cpl - left.length - String(r).length)) + r;
  };
  const m = (n) => Number(n || 0).toFixed(2);
  return (
    <div id="receipt-print" className={"receipt" + (settings.font_size === "large" ? " large" : "")} style={{ width: `${cpl}ch` }}>
      <div style={align("header_align", "center")}>
        <b className="r-title">{settings.store_name || "JOYCE POS"}</b>
        {settings.store_address && <div>{settings.store_address}</div>}
        {settings.store_phone && <div>{settings.store_phone}</div>}
        {settings.receipt_header && <div>{settings.receipt_header}</div>}
      </div>
      <pre>{dash}</pre>
      <pre>{`Receipt: ${sale.receipt_no}\nDate: ${sale.created_at}`}</pre>
      {sale.status === "voided" && <pre>*** VOIDED ***</pre>}
      <pre>{dash}</pre>
      <pre>
        {sale.items
          .map((i) => {
            const label = i.variant_name ? `${i.name} (${i.variant_name})` : i.name;
            return row(`${i.quantity}x ${label}`, m(i.subtotal)) + (i.quantity > 1 ? `\n   @ ${m(i.unit_price)}` : "");
          })
          .join("\n")}
      </pre>
      <pre>{dash}</pre>
      <pre><b>{row("TOTAL", m(sale.total))}</b>{"\n" + row("Cash", m(sale.paid)) + "\n" + row("Change", m(sale.change_amt))}</pre>
      <pre>{dash}</pre>
      <div style={align("footer_align", "center")}>{settings.receipt_footer ?? "Thank you! Come again."}</div>
    </div>
  );
}
