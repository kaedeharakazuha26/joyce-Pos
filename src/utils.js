export const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};
export const monthStart = () => {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
};
export const errText = (e) => (typeof e === "string" ? e : e?.message || "Something went wrong");
