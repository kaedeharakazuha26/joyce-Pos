import {
  BarChart3,
  Receipt as ReceiptIcon,
  Package,
  Wallet,
  Users,
  Coins,
  Smartphone,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { ymd } from "../../utils";

export const CHART_COLORS = [
  "#ff7a3d", // Primary Orange
  "#2fcf8a", // Positive Green
  "#38bdf8", // Info Blue
  "#a855f7", // Purple
  "#f5b83d", // Warning Amber
  "#ff5470", // Danger Red
  "#14b8a6", // Teal
  "#ec4899", // Pink
];

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Supplies",
  "Ingredients",
  "Salaries",
  "Maintenance",
  "Marketing",
  "Transport",
  "Taxes & Permits",
  "Other",
];

export const REPORT_TABS = [
  { id: "overview", label: "Overview & P&L", icon: BarChart3, badgeTone: "info" },
  { id: "sales", label: "Sales & Receipts", icon: ReceiptIcon, badgeTone: "ok" },
  { id: "products", label: "Products & Stock CRUD", icon: Package, badgeTone: "info" },
  { id: "expenses", label: "Expenses CRUD", icon: Wallet, badgeTone: "warn" },
  { id: "salaries", label: "Salaries CRUD", icon: Users, badgeTone: "info" },
  { id: "commissions", label: "Commissions CRUD", icon: Coins, badgeTone: "purple" },
  { id: "ld-commissions", label: "LD Commissions CRUD", icon: Smartphone, badgeTone: "purple" },
  { id: "employees", label: "Employee Directory & Pay", icon: Users, badgeTone: "ok" },
  { id: "shifts", label: "Shift Audit & Z-Reading", icon: Clock, badgeTone: "warn" },
  { id: "audit", label: "Activity & Audit Trail", icon: ShieldCheck, badgeTone: "neutral" },
];

export function aggregateDailySeries(daily = [], granularity = "daily") {
  if (!Array.isArray(daily) || daily.length === 0) return [];
  if (granularity === "daily") {
    return daily.map((d) => ({
      ...d,
      key: d.day,
      label: d.day.slice(5),
    }));
  }

  const buckets = new Map();
  for (const d of daily) {
    const dt = new Date(d.day + "T00:00:00");
    let key = d.day;
    let label = d.day;
    if (granularity === "weekly") {
      const dayOfWeek = dt.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - diff);
      key = ymd(mon);
      label = `Wk ${key.slice(5)}`;
    } else if (granularity === "monthly") {
      key = d.day.slice(0, 7);
      label = key;
    } else if (granularity === "quarterly") {
      const q = Math.floor(dt.getMonth() / 3) + 1;
      key = `${dt.getFullYear()}-Q${q}`;
      label = key;
    } else if (granularity === "yearly") {
      key = d.day.slice(0, 4);
      label = key;
    }

    const cur = buckets.get(key) || {
      key,
      day: key,
      label,
      revenue: 0,
      cogs: 0,
      gross_profit: 0,
      orders: 0,
      expenses: 0,
      salaries: 0,
      commissions: 0,
      ld_commissions: 0,
      total_overheads: 0,
      net_profit: 0,
    };
    cur.revenue += Number(d.revenue || 0);
    cur.cogs += Number(d.cogs || 0);
    cur.gross_profit += Number(d.gross_profit || 0);
    cur.orders += Number(d.orders || 0);
    cur.expenses += Number(d.expenses || 0);
    cur.salaries += Number(d.salaries || 0);
    cur.commissions += Number(d.commissions || 0);
    cur.ld_commissions += Number(d.ld_commissions || 0);
    cur.total_overheads += Number(d.total_overheads || 0);
    cur.net_profit += Number(d.net_profit || 0);
    buckets.set(key, cur);
  }
  return Array.from(buckets.values());
}

export function buildExportDataset({
  reportTab,
  filteredSales,
  filteredProducts,
  filteredExpenses,
  filteredSalaries,
  filteredCommissions,
  filteredLdCommissions,
  filteredEmployees,
  filteredShifts,
  filteredAudit,
  daily = [],
}) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  if (reportTab === "sales") {
    return {
      title: "Sales_and_Transactions_Report",
      headers: ["Receipt No", "Date & Time", "Items Summary", "Total (PHP)", "Cash Paid", "Change", "Status"],
      rows: filteredSales.map((s) => [
        s.receipt_no,
        s.created_at,
        (s.items || []).map((i) => `${i.quantity}x ${i.name}`).join("; "),
        Number(s.total || 0).toFixed(2),
        Number(s.paid || 0).toFixed(2),
        Number(s.change_amt || 0).toFixed(2),
        s.status,
      ]),
      esc,
    };
  }
  if (reportTab === "products") {
    return {
      title: "Products_and_Profitability_Report",
      headers: [
        "Product Name",
        "Category",
        "Price",
        "Unit Cost",
        "Margin %",
        "Stock",
        "Status",
        "Units Sold (Period)",
        "Revenue (Period)",
        "Gross Profit (Period)",
      ],
      rows: filteredProducts.map((p) => [
        p.name,
        p.category,
        Number(p.price || 0).toFixed(2),
        Number(p.cost || 0).toFixed(2),
        Number(p.margin_pct || 0).toFixed(1) + "%",
        p.stock,
        p.stock_status.toUpperCase(),
        p.sold_qty,
        Number(p.period_revenue || 0).toFixed(2),
        Number(p.period_profit || 0).toFixed(2),
      ]),
      esc,
    };
  }
  if (reportTab === "expenses") {
    return {
      title: "Store_Expenses_Report",
      headers: ["Date", "Category", "Description", "Amount (PHP)"],
      rows: filteredExpenses.map((e) => [
        e.incurred_on,
        e.category,
        e.description,
        Number(e.amount || 0).toFixed(2),
      ]),
      esc,
    };
  }
  if (reportTab === "salaries") {
    return {
      title: "Staff_Salaries_Report",
      headers: ["Date Paid", "Staff Name", "Role", "Notes", "Amount (PHP)"],
      rows: filteredSalaries.map((s) => [
        s.paid_on,
        s.staff_name,
        s.role,
        s.note,
        Number(s.amount || 0).toFixed(2),
      ]),
      esc,
    };
  }
  if (reportTab === "commissions") {
    return {
      title: "Staff_Commissions_Report",
      headers: ["Date Earned", "Staff Name", "Commission Type", "Reference", "Rate %", "Notes", "Amount (PHP)"],
      rows: filteredCommissions.map((c) => [
        c.earned_on,
        c.staff_name,
        c.commission_type,
        c.sales_ref,
        c.rate_pct,
        c.note,
        Number(c.amount || 0).toFixed(2),
      ]),
      esc,
    };
  }
  if (reportTab === "ld-commissions") {
    return {
      title: "Ladies_Drink_Commissions_Report",
      headers: ["Date Earned", "Staff Name", "Table / Customer", "Drink Name", "Qty", "Rate/Drink", "Total (PHP)", "Notes"],
      rows: filteredLdCommissions.map((c) => [
        c.earned_on,
        c.staff_name,
        c.customer_table,
        c.drink_name,
        c.quantity,
        Number(c.unit_comm || 0).toFixed(2),
        Number(c.total || 0).toFixed(2),
        c.note,
      ]),
      esc,
    };
  }
  if (reportTab === "employees") {
    return {
      title: "Employee_Performance_and_Directory_Report",
      headers: [
        "Employee Name",
        "Role",
        "Contact",
        "Daily Rate",
        "Date Hired",
        "Salaries (Period)",
        "Commissions (Period)",
        "LD Drinks",
        "LD Total (Period)",
        "Total Payout (Period)",
      ],
      rows: filteredEmployees.map((e) => [
        e.name,
        e.role,
        e.contact,
        Number(e.daily_rate || 0).toFixed(2),
        e.hired_on,
        Number(e.salary_total || 0).toFixed(2),
        Number(e.commission_total || 0).toFixed(2),
        e.ld_drinks,
        Number(e.ld_total || 0).toFixed(2),
        Number(e.total_payout || 0).toFixed(2),
      ]),
      esc,
    };
  }
  if (reportTab === "shifts") {
    return {
      title: "Shift_Audit_and_Drawer_Reconciliation_Report",
      headers: [
        "Business Date",
        "Opened By",
        "Opened At",
        "Closed By",
        "Closed At",
        "Opening Float",
        "Expected Cash",
        "Closing Count",
        "Variance",
        "Status",
        "Notes",
      ],
      rows: filteredShifts.map((s) => [
        s.business_date,
        s.opened_by,
        s.opened_at,
        s.closed_by || "—",
        s.closed_at || "—",
        Number(s.opening_cash || 0).toFixed(2),
        Number(s.expected_cash || 0).toFixed(2),
        s.closing_cash !== null && s.closing_cash !== undefined ? Number(s.closing_cash).toFixed(2) : "—",
        s.variance !== null && s.variance !== undefined ? Number(s.variance).toFixed(2) : "—",
        s.status,
        s.notes || "",
      ]),
      esc,
    };
  }
  if (reportTab === "audit") {
    return {
      title: "System_Activity_and_Audit_Trail",
      headers: ["Timestamp", "Actor", "Role", "Action", "Module", "Record ID", "Summary"],
      rows: filteredAudit.map((a) => [
        a.timestamp,
        a.actor,
        a.role,
        a.action,
        a.entity_type,
        a.entity_id,
        a.summary,
      ]),
      esc,
    };
  }

  return {
    title: "Executive_PnL_and_Daily_Financial_Report",
    headers: [
      "Date",
      "Orders",
      "Gross Sales",
      "COGS",
      "Gross Profit",
      "Expenses",
      "Salaries",
      "Commissions",
      "LD Commissions",
      "Total Overheads",
      "Net Operating Profit",
    ],
    rows: daily.map((d) => [
      d.day,
      d.orders,
      Number(d.revenue || 0).toFixed(2),
      Number(d.cogs || 0).toFixed(2),
      Number(d.gross_profit || 0).toFixed(2),
      Number(d.expenses || 0).toFixed(2),
      Number(d.salaries || 0).toFixed(2),
      Number(d.commissions || 0).toFixed(2),
      Number(d.ld_commissions || 0).toFixed(2),
      Number(d.total_overheads || 0).toFixed(2),
      Number(d.net_profit || 0).toFixed(2),
    ]),
    esc,
  };
}

export function buildExcelHtml({ ds, storeName, from, to, author }) {
  const escHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const oTag = (name, attrs = "") => "<" + name + (attrs ? " " + attrs : "") + ">";
  const cTag = (name) => "</" + name + ">";
  const headRow = ds.headers.map((h) => oTag("th") + escHtml(h) + cTag("th")).join("");
  const bodyRows = ds.rows
    .map((r) => oTag("tr") + r.map((c) => oTag("td") + escHtml(c) + cTag("td")).join("") + cTag("tr"))
    .join("");
  return [
    oTag("html", 'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"'),
    oTag("head"),
    oTag("meta", 'charset="UTF-8"'),
    oTag("style"),
    "table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }",
    "th { background: #1e2433; color: #ffffff; font-weight: bold; padding: 8px; border: 1px solid #cbd5e1; }",
    "td { padding: 6px 8px; border: 1px solid #cbd5e1; }",
    ".title { font-size: 16px; font-weight: bold; }",
    cTag("style"),
    cTag("head"),
    oTag("body"),
    oTag("div", 'class="title"') + escHtml(storeName || "JOYCE POS") + " — " + escHtml(ds.title.replace(/_/g, " ")) + cTag("div"),
    oTag("div") + "Period: " + escHtml(from) + " to " + escHtml(to) + " | Generated by: " + escHtml(author || "Admin") + " on " + escHtml(new Date().toLocaleString()) + cTag("div"),
    oTag("br/"),
    oTag("table"),
    oTag("thead") + oTag("tr") + headRow + cTag("tr") + cTag("thead"),
    oTag("tbody") + bodyRows + cTag("tbody"),
    cTag("table"),
    cTag("body"),
    cTag("html"),
  ].join("\n");
}
