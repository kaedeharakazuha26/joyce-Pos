export const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pesoShort = (n) => {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}₱${(abs / 1_000).toFixed(1)}k`;
  return peso(v);
};

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};

export const yesterday = () => daysAgo(1);

export const weekStart = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setDate(d.getDate() - diff);
  return ymd(d);
};

export const lastWeekRange = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  return [ymd(start), ymd(end)];
};

export const monthStart = () => {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
};

export const lastMonthRange = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 0);
  return [ymd(start), ymd(end)];
};

export const quarterStart = () => {
  const d = new Date();
  const qMonth = Math.floor(d.getMonth() / 3) * 3;
  return ymd(new Date(d.getFullYear(), qMonth, 1));
};

export const yearStart = () => {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), 0, 1));
};

export const pctChange = (current, previous) => {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  const delta = cur - prev;
  if (Math.abs(prev) < 0.0001) {
    return {
      pct: Math.abs(cur) < 0.0001 ? 0 : 100,
      delta,
      hasPrev: Math.abs(cur) > 0.0001,
      isNew: Math.abs(cur) > 0.0001 && Math.abs(prev) < 0.0001,
    };
  }
  return {
    pct: ((cur - prev) / Math.abs(prev)) * 100,
    delta,
    hasPrev: true,
    isNew: false,
  };
};

export const DATE_PRESETS = [
  { id: "today", label: "Today", range: (bizDate) => [bizDate || ymd(), bizDate || ymd()] },
  { id: "yesterday", label: "Yesterday", range: () => [yesterday(), yesterday()] },
  { id: "this_week", label: "This Week", range: () => [weekStart(), ymd()] },
  { id: "last_week", label: "Last Week", range: () => lastWeekRange() },
  { id: "this_month", label: "This Month", range: () => [monthStart(), ymd()] },
  { id: "last_month", label: "Last Month", range: () => lastMonthRange() },
  { id: "this_quarter", label: "This Quarter", range: () => [quarterStart(), ymd()] },
  { id: "this_year", label: "This Year", range: () => [yearStart(), ymd()] },
];

export const downloadBlob = (filename, content, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const errText = (e) => (typeof e === "string" ? e : e?.message || "Something went wrong");
