import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  AlertTriangle,
  Receipt as ReceiptIcon,
  Users,
  Coins,
  Smartphone,
  Clock,
  RefreshCw,
  Download,
  Printer,
  Filter,
  Search,
  Plus,
  Edit3,
  Trash2,
  Eye,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Boxes,
  FileSpreadsheet,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  SlidersHorizontal,
  Layers,
  Calendar,
  ExternalLink,
  CheckSquare,
  Square,
  ImagePlus,
  X,
  Sunrise,
  Sunset,
  Info,
  Sparkles,
} from "lucide-react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { useSettings } from "../App";
import {
  ConfirmModal,
  Empty,
  Field,
  Modal,
  PageHeader,
  RangeBar,
  Receipt,
  StatusBadge,
  useToast,
} from "../components/ui";
import {
  daysAgo,
  errText,
  lastMonthRange,
  lastWeekRange,
  monthStart,
  pctChange,
  peso,
  pesoShort,
  quarterStart,
  weekStart,
  yearStart,
  yesterday,
  ymd,
} from "../utils";

// Semantic Color Palette
const CHART_COLORS = [
  "#ff7a3d", // Primary Orange
  "#2fcf8a", // Positive Green
  "#38bdf8", // Info Blue
  "#a855f7", // Purple
  "#f5b83d", // Warning Amber
  "#ff5470", // Danger Red
  "#14b8a6", // Teal
  "#ec4899", // Pink
];

const EXPENSE_CATEGORIES = [
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

const REPORT_TABS = [
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

// Helper to group daily rows into Daily / Weekly / Monthly / Quarterly / Yearly buckets
function aggregateDailySeries(daily = [], granularity = "daily") {
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

// Interactive SVG Line / Area / Bar Trend Chart
function InteractiveTrendChart({
  data = [],
  prevData = [],
  mode = "area",
  showComparison = true,
  seriesConfig = [],
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!data || data.length === 0) {
    return <Empty text="No financial trend records for the selected date range." />;
  }

  const activeSeries = seriesConfig.filter((s) => s.enabled);
  if (activeSeries.length === 0) {
    return <Empty text="Select at least one metric series above to plot the chart." />;
  }

  const width = 820;
  const height = 265;
  const padL = 64;
  const padR = 24;
  const padT = 22;
  const padB = 38;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allVals = [0];
  data.forEach((d) => {
    activeSeries.forEach((s) => allVals.push(Number(d[s.key] || 0)));
  });
  if (showComparison && prevData.length > 0) {
    prevData.forEach((d) => {
      allVals.push(Number(d.revenue || 0));
    });
  }

  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(100, ...allVals);
  const span = Math.max(1, maxVal - minVal);

  const xAt = (idx, total) => {
    if (total <= 1) return padL + plotW / 2;
    return padL + (idx / (total - 1)) * plotW;
  };
  const yAt = (val) => padT + plotH - ((Number(val || 0) - minVal) / span) * plotH;
  const zeroY = yAt(0);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = minVal + span * t;
    return { val, y: yAt(val) };
  });

  const hoveredItem = hoverIdx !== null ? data[hoverIdx] : null;
  const hoveredPrev = hoverIdx !== null && prevData[hoverIdx] ? prevData[hoverIdx] : null;

  return (
    <div className="svg-chart-wrap" onMouseLeave={() => setHoverIdx(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="interactive-svg-chart"
        role="img"
        aria-label="Financial performance trend chart"
      >
        <defs>
          {activeSeries.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal Grid Lines & Y-Axis Labels */}
        {yTicks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={padL}
              y1={t.y}
              x2={width - padR}
              y2={t.y}
              stroke="var(--border)"
              strokeDasharray={Math.abs(t.val) < 0.01 ? "none" : "4 4"}
              strokeWidth={Math.abs(t.val) < 0.01 ? "1.4" : "1"}
            />
            <text
              x={padL - 8}
              y={t.y + 4}
              textAnchor="end"
              fill="var(--muted)"
              fontSize="10"
            >
              {pesoShort(t.val)}
            </text>
          </g>
        ))}

        {/* Previous Period Comparison Dashed Line (Revenue) */}
        {showComparison && prevData.length > 1 && (
          <path
            d={prevData
              .slice(0, data.length)
              .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i, data.length).toFixed(1)} ${yAt(d.revenue).toFixed(1)}`)
              .join(" ")}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            opacity="0.7"
          />
        )}

        {/* Bar Mode vs Line/Area Mode */}
        {mode === "bar" ? (
          data.map((d, i) => {
            const groupW = Math.min(48, Math.max(10, plotW / Math.max(1, data.length) - 8));
            const barW = Math.max(3, groupW / Math.max(1, activeSeries.length));
            const centerX =
              data.length === 1
                ? padL + plotW / 2
                : padL + ((i + 0.5) / data.length) * plotW;
            const startX = centerX - groupW / 2;

            return (
              <g key={d.key || i}>
                {activeSeries.map((s, sIdx) => {
                  const val = Number(d[s.key] || 0);
                  const yVal = yAt(val);
                  const top = Math.min(yVal, zeroY);
                  const barH = Math.max(2, Math.abs(zeroY - yVal));
                  return (
                    <rect
                      key={s.key}
                      x={startX + sIdx * barW}
                      y={top}
                      width={Math.max(2, barW - 1.5)}
                      height={barH}
                      rx="2"
                      fill={s.color}
                      opacity={hoverIdx === null || hoverIdx === i ? 0.92 : 0.45}
                    />
                  );
                })}
              </g>
            );
          })
        ) : (
          activeSeries.map((s) => {
            const pts = data.map((d, i) => ({
              x: xAt(i, data.length),
              y: yAt(d[s.key]),
            }));
            const linePath = pts
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(" ");
            const areaPath =
              pts.length > 1
                ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`
                : "";

            return (
              <g key={s.key}>
                {mode === "area" && areaPath && (
                  <path d={areaPath} fill={`url(#grad-${s.key})`} />
                )}
                <path
                  d={linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={hoverIdx === i ? 5 : data.length <= 35 ? 3 : 0}
                    fill={s.color}
                    stroke="var(--panel)"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
            );
          })
        )}

        {/* X-Axis Labels */}
        {data.map((d, i) => {
          const step = Math.max(1, Math.ceil(data.length / 9));
          if (i % step !== 0 && i !== data.length - 1) return null;
          const x =
            mode === "bar" && data.length > 1
              ? padL + ((i + 0.5) / data.length) * plotW
              : xAt(i, data.length);
          return (
            <text
              key={d.key || i}
              x={x}
              y={height - 12}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="10"
            >
              {d.label || d.day}
            </text>
          );
        })}

        {/* Hover Guideline & Interactive Hit Zones */}
        {hoverIdx !== null && data[hoverIdx] && (
          <line
            x1={
              mode === "bar" && data.length > 1
                ? padL + ((hoverIdx + 0.5) / data.length) * plotW
                : xAt(hoverIdx, data.length)
            }
            y1={padT}
            x2={
              mode === "bar" && data.length > 1
                ? padL + ((hoverIdx + 0.5) / data.length) * plotW
                : xAt(hoverIdx, data.length)
            }
            y2={padT + plotH}
            stroke="var(--text)"
            strokeOpacity="0.35"
            strokeDasharray="3 3"
          />
        )}

        {data.map((d, i) => {
          const sliceW = plotW / Math.max(1, data.length);
          const x = padL + i * sliceW;
          return (
            <rect
              key={i}
              x={x}
              y={padT}
              width={sliceW}
              height={plotH}
              fill="transparent"
              style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}
      </svg>

      {/* Rich Floating Tooltip */}
      {hoveredItem && (
        <div className="chart-tooltip-bar">
          <div className="tooltip-date">
            <Calendar size={13} />
            <b>{hoveredItem.day}</b>
            <span className="badge tone-info">{hoveredItem.orders || 0} orders</span>
          </div>
          <div className="tooltip-metrics">
            {activeSeries.map((s) => (
              <div key={s.key} className="tooltip-metric-pill">
                <span className="dot" style={{ background: s.color }} />
                <span>{s.label}:</span>
                <b>{peso(hoveredItem[s.key])}</b>
              </div>
            ))}
            {showComparison && hoveredPrev && (
              <div className="tooltip-metric-pill muted">
                <span>Prev Period Sales ({hoveredPrev.day}):</span>
                <b>{peso(hoveredPrev.revenue)}</b>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Interactive SVG Doughnut Chart with click-to-filter support
function InteractiveDoughnutChart({
  items = [],
  totalLabel = "Total",
  valueFormatter = peso,
  selectedKey = null,
  onSelectItem = null,
  emptyText = "No category breakdown data available.",
}) {
  if (!items || items.length === 0) {
    return <Empty text={emptyText} />;
  }

  const total = items.reduce((s, i) => s + Math.max(0, Number(i.value || 0)), 0);
  if (total <= 0) {
    return <Empty text={emptyText} />;
  }

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="doughnut-layout">
      <div className="doughnut-svg-box">
        <svg viewBox="0 0 180 180" className="doughnut-svg">
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="transparent"
            stroke="var(--bg-soft)"
            strokeWidth="22"
          />
          {items.map((item, idx) => {
            const val = Math.max(0, Number(item.value || 0));
            const pct = total > 0 ? val / total : 0;
            const dash = pct * circumference;
            const offset = circumference - accumulated * circumference;
            accumulated += pct;
            const color = item.color || CHART_COLORS[idx % CHART_COLORS.length];
            const isSelected = selectedKey && selectedKey === item.name;

            return (
              <circle
                key={item.name || idx}
                cx="90"
                cy="90"
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth={isSelected ? "26" : "22"}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
                transform="rotate(-90 90 90)"
                style={{
                  cursor: onSelectItem ? "pointer" : "default",
                  opacity: !selectedKey || isSelected ? 1 : 0.45,
                  transition: "all 0.2s ease",
                }}
                onClick={() => onSelectItem && onSelectItem(item)}
              >
                <title>{`${item.name}: ${valueFormatter(val)} (${(pct * 100).toFixed(1)}%)`}</title>
              </circle>
            );
          })}
          <text x="90" y="84" textAnchor="middle" fill="var(--muted)" fontSize="10" fontWeight="600">
            {totalLabel.toUpperCase()}
          </text>
          <text x="90" y="103" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="800">
            {valueFormatter === peso ? pesoShort(total) : total.toLocaleString()}
          </text>
        </svg>
      </div>

      <div className="doughnut-legend">
        {items.map((item, idx) => {
          const val = Math.max(0, Number(item.value || 0));
          const pct = total > 0 ? (val / total) * 100 : 0;
          const color = item.color || CHART_COLORS[idx % CHART_COLORS.length];
          const isSelected = selectedKey && selectedKey === item.name;
          return (
            <button
              key={item.name || idx}
              type="button"
              className={`doughnut-legend-item ${isSelected ? "active" : ""}`}
              onClick={() => onSelectItem && onSelectItem(item)}
              title={onSelectItem ? `Click to filter underlying records by "${item.name}"` : item.name}
            >
              <div className="legend-left">
                <span className="legend-dot" style={{ background: color }} />
                <span className="legend-name">{item.name}</span>
                {item.count !== undefined && (
                  <span className="muted" style={{ fontSize: 11 }}>({item.count})</span>
                )}
              </div>
              <div className="legend-right">
                <b>{valueFormatter(val)}</b>
                <span className="badge tone-neutral">{pct.toFixed(1)}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Reusable Table Pagination & Bulk Action Footer
function TablePagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const curPage = Math.min(Math.max(1, page), totalPages);
  const startIdx = totalItems === 0 ? 0 : (curPage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, curPage * pageSize);

  return (
    <div className="table-pagination no-print">
      <div className="pagination-info">
        Showing <b>{startIdx}–{endIdx}</b> of <b>{totalItems}</b> records
      </div>
      <div className="pagination-controls">
        <label className="page-size-label">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <div className="page-btns">
          <button
            type="button"
            className="btn sm ghost"
            disabled={curPage <= 1}
            onClick={() => onPageChange(1)}
          >
            «
          </button>
          <button
            type="button"
            className="btn sm ghost"
            disabled={curPage <= 1}
            onClick={() => onPageChange(curPage - 1)}
          >
            Prev
          </button>
          <span className="page-indicator">
            Page <b>{curPage}</b> of {totalPages}
          </span>
          <button
            type="button"
            className="btn sm ghost"
            disabled={curPage >= totalPages}
            onClick={() => onPageChange(curPage + 1)}
          >
            Next
          </button>
          <button
            type="button"
            className="btn sm ghost"
            disabled={curPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const {
    currentUser,
    settings,
    branchInfo,
    shiftStatus,
    activeBusinessDate,
    openSod,
    openEod,
    adminReportIntent,
    clearAdminReportIntent,
    refreshAlerts,
  } = useSettings();
  const toast = useToast();

  // Strictly protect admin route
  if (currentUser?.role !== "admin") {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <ShieldCheck size={48} color="var(--bad)" style={{ margin: "0 auto 12px" }} />
        <h2>Administrator Access Required</h2>
        <p className="muted">This analytics and data management console is restricted to Administrator accounts.</p>
      </div>
    );
  }

  // Applied & Draft Filter State
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(ymd());
  const [draftFrom, setDraftFrom] = useState(monthStart());
  const [draftTo, setDraftTo] = useState(ymd());

  const [reportTab, setReportTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");

  // Loading & Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [data, setData] = useState(null);
  const [salesList, setSalesList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [commissionTypes, setCommissionTypes] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Interactive Chart State
  const [trendGranularity, setTrendGranularity] = useState("daily");
  const [trendChartMode, setTrendChartMode] = useState("area");
  const [showPrevPeriod, setShowPrevPeriod] = useState(true);
  const [seriesEnabled, setSeriesEnabled] = useState({
    revenue: true,
    gross_profit: false,
    net_profit: true,
    total_overheads: true,
    expenses: false,
    salaries: false,
    commissions: false,
    ld_commissions: false,
  });
  const [doughnutMode, setDoughnutMode] = useState("category"); // "category" | "expense" | "overhead"
  const [statusChartMode, setStatusChartMode] = useState("sales"); // "sales" | "stock" | "shifts"
  const [comparativeMode, setComparativeMode] = useState("products"); // "products" | "employees" | "categories"
  const [comparativeMetric, setComparativeMetric] = useState("value"); // "value" | "qty"

  // Advanced Data Table State (Sorting, Pagination, Bulk Selection, Column Visibility)
  const [sortConfig, setSortConfig] = useState({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedIds, setSelectedIds] = useState([]);
  const [hiddenCols, setHiddenCols] = useState({});
  const [colMenuOpen, setColMenuOpen] = useState(false);

  // CRUD Modals State
  const [editingProduct, setEditingProduct] = useState(null);
  const [restockModal, setRestockModal] = useState(null); // { product, qty, unitCost, note }
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingSalary, setEditingSalary] = useState(null);
  const [editingCommission, setEditingCommission] = useState(null);
  const [editingLdCommission, setEditingLdCommission] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingSale, setViewingSale] = useState(null);
  const [voidingSale, setVoidingSale] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [viewingShift, setViewingShift] = useState(null);
  const [shiftNotesDraft, setShiftNotesDraft] = useState("");
  const [viewingAuditItem, setViewingAuditItem] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showAddCommType, setShowAddCommType] = useState(false);
  const [newCommTypeName, setNewCommTypeName] = useState("");

  const reportSectionRef = useRef(null);

  // Load all data from SQLite via Tauri backend
  const loadAll = useCallback(
    async (f = from, t = to, isSilent = false) => {
      if (!isSilent) setLoading(true);
      setRefreshing(true);
      setErrorMsg(null);
      try {
        const [dashRes, salesRes, prodsRes, empsRes, commTypesRes, auditRes] = await Promise.all([
          api.adminDashboard(f, t),
          api.sales(f, t, ""),
          api.products(),
          api.employees(),
          api.commissionTypes(),
          api.auditLogs(f, t, 300),
        ]);
        setData(dashRes);
        setSalesList(salesRes || []);
        setProductsList(prodsRes || []);
        setEmployeesList(empsRes || []);
        setCommissionTypes(commTypesRes || []);
        setAuditLogs(auditRes || []);
        refreshAlerts();
      } catch (e) {
        const msg = errText(e);
        setErrorMsg(msg);
        toast(msg, "bad");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to, toast, refreshAlerts]
  );

  useEffect(() => {
    loadAll(from, to);
  }, [from, to, loadAll]);

  // Handle incoming deep-link intents from Global Search, Notifications, or Quick Actions
  useEffect(() => {
    if (!adminReportIntent) return;
    if (adminReportIntent.reportTab) {
      setReportTab(adminReportIntent.reportTab);
      setPage(1);
      setSelectedIds([]);
    }
    if (adminReportIntent.search !== undefined) setSearch(adminReportIntent.search);
    if (adminReportIntent.statusFilter !== undefined) setStatusFilter(adminReportIntent.statusFilter);
    if (adminReportIntent.categoryFilter !== undefined) setCategoryFilter(adminReportIntent.categoryFilter);

    // Open Quick Action CRUD modals if requested
    if (adminReportIntent.openModal === "add-product") {
      setEditingProduct({
        name: "",
        category: "General",
        price: 0,
        cost: 0,
        stock: 0,
        low_stock: 5,
        image: "",
        variants: [],
      });
    } else if (adminReportIntent.openModal === "add-expense") {
      setEditingExpense({
        category: "Supplies",
        description: "",
        amount: "",
        incurred_on: activeBusinessDate || ymd(),
      });
    } else if (adminReportIntent.openModal === "add-salary") {
      setEditingSalary({
        staff_name: "",
        role: "",
        amount: "",
        note: "",
        paid_on: activeBusinessDate || ymd(),
      });
    } else if (adminReportIntent.openModal === "add-ld") {
      setEditingLdCommission({
        staff_name: "",
        customer_table: "",
        drink_name: "Ladies Drink",
        quantity: 1,
        unit_comm: 50,
        note: "",
        earned_on: activeBusinessDate || ymd(),
      });
    }

    setTimeout(() => {
      reportSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    clearAdminReportIntent();
  }, [adminReportIntent, clearAdminReportIntent, activeBusinessDate]);

  // Reset pagination & bulk selection when switching report tabs or filters
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [reportTab, search, categoryFilter, statusFilter, staffFilter, from, to]);

  const handleApplyDateRange = (newFrom, newTo) => {
    const f = newFrom ?? draftFrom;
    const t = newTo ?? draftTo;
    if (f > t) {
      toast("Start date cannot be after end date.", "bad");
      return;
    }
    setDraftFrom(f);
    setDraftTo(t);
    setFrom(f);
    setTo(t);
  };

  const handleResetFilters = () => {
    const mStart = monthStart();
    const todayStr = ymd();
    setDraftFrom(mStart);
    setDraftTo(todayStr);
    setFrom(mStart);
    setTo(todayStr);
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStaffFilter("all");
    toast("All filters reset to default Month-to-Date view.");
  };

  // Navigate to a specific report tab with filters applied (from KPI cards or Charts)
  const jumpToReport = (tabId, opts = {}) => {
    setReportTab(tabId);
    if (opts.category !== undefined) setCategoryFilter(opts.category);
    if (opts.status !== undefined) setStatusFilter(opts.status);
    if (opts.staff !== undefined) setStaffFilter(opts.staff);
    if (opts.search !== undefined) setSearch(opts.search);
    setTimeout(() => {
      reportSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // Derived Financial & Period Comparison Metrics
  const fin = data?.financials || {};
  const prev = data?.previous_period || {};
  const todayStats = data?.today || {};
  const mtdStats = data?.mtd || {};
  const counts = data?.counts || {};

  const revCompare = pctChange(fin.revenue, prev.revenue);
  const netCompare = pctChange(fin.net_profit, prev.net_profit);
  const grossCompare = pctChange(fin.gross_profit, prev.gross_profit);
  const overheadCompare = pctChange(fin.total_overheads, prev.total_overheads);
  const ordersCompare = pctChange(fin.orders, prev.orders);
  const voidCompare = pctChange(fin.void_total, prev.void_total);

  // Categories list for dropdown filter
  const allProductCategories = useMemo(() => {
    const set = new Set();
    productsList.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    (data?.by_category || []).forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [productsList, data]);

  const allStaffNames = useMemo(() => {
    const set = new Set();
    employeesList.forEach((e) => e.name && set.add(e.name));
    (data?.employee_performance || []).forEach((e) => e.staff_name && set.add(e.staff_name));
    return Array.from(set).sort();
  }, [employeesList, data]);

  // Aggregated Trend Chart Series
  const aggregatedTrend = useMemo(
    () => aggregateDailySeries(data?.daily || [], trendGranularity),
    [data?.daily, trendGranularity]
  );
  const aggregatedPrevTrend = useMemo(
    () => aggregateDailySeries(prev?.daily || [], trendGranularity),
    [prev?.daily, trendGranularity]
  );

  const trendSeriesConfig = [
    { key: "revenue", label: "Gross Sales", color: "#ff7a3d", enabled: seriesEnabled.revenue },
    { key: "gross_profit", label: "Gross Profit", color: "#38bdf8", enabled: seriesEnabled.gross_profit },
    { key: "net_profit", label: "Net Operating Profit", color: "#2fcf8a", enabled: seriesEnabled.net_profit },
    { key: "total_overheads", label: "Total Overheads", color: "#ff5470", enabled: seriesEnabled.total_overheads },
    { key: "expenses", label: "Store Expenses", color: "#f5b83d", enabled: seriesEnabled.expenses },
    { key: "salaries", label: "Salaries", color: "#a855f7", enabled: seriesEnabled.salaries },
    { key: "commissions", label: "Commissions", color: "#14b8a6", enabled: seriesEnabled.commissions },
    { key: "ld_commissions", label: "LD Commissions", color: "#ec4899", enabled: seriesEnabled.ld_commissions },
  ];

  // Category Breakdown Doughnut Items
  const doughnutItems = useMemo(() => {
    if (!data) return [];
    if (doughnutMode === "category") {
      return (data.by_category || []).map((c, idx) => ({
        name: c.category || "Uncategorized",
        value: Number(c.revenue || 0),
        count: `${c.qty} sold`,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }));
    }
    if (doughnutMode === "expense") {
      return (data.expenses_by_cat || []).map((c, idx) => ({
        name: c.category || "Other",
        value: Number(c.total || 0),
        count: `${c.count} items`,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }));
    }
    // Overhead distribution
    return [
      { name: "Cost of Goods (COGS)", value: Number(fin.cogs || 0), color: "#38bdf8", target: "products" },
      { name: "Store Expenses", value: Number(fin.expenses || 0), color: "#f5b83d", target: "expenses" },
      { name: "Staff Salaries", value: Number(fin.salaries || 0), color: "#a855f7", target: "salaries" },
      { name: "Regular Commissions", value: Number(fin.commissions || 0), color: "#14b8a6", target: "commissions" },
      { name: "LD Commissions", value: Number(fin.ld_commissions || 0), color: "#ec4899", target: "ld-commissions" },
    ].filter((i) => i.value > 0);
  }, [data, doughnutMode, fin]);

  // Status Distribution Items
  const statusChartItems = useMemo(() => {
    if (!data) return [];
    if (statusChartMode === "sales") {
      return [
        {
          name: "Completed Sales",
          value: Number(fin.orders || 0),
          amount: peso(fin.revenue),
          color: "#2fcf8a",
          filterStatus: "completed",
        },
        {
          name: "Voided Receipts",
          value: Number(fin.void_count || 0),
          amount: peso(fin.void_total),
          color: "#ff5470",
          filterStatus: "voided",
        },
      ];
    }
    if (statusChartMode === "stock") {
      return [
        {
          name: "Healthy Stock",
          value: Number(counts.healthy_stock_count || 0),
          color: "#2fcf8a",
          filterStatus: "healthy",
        },
        {
          name: "Low Stock Alert",
          value: Number(counts.low_stock_count || 0),
          color: "#f5b83d",
          filterStatus: "low",
        },
        {
          name: "Out of Stock",
          value: Number(counts.out_of_stock_count || 0),
          color: "#ff5470",
          filterStatus: "out",
        },
      ];
    }
    // Shift reconciliation status distribution
    const shifts = data.shifts || [];
    const openCnt = shifts.filter((s) => s.status === "open").length;
    const balancedCnt = shifts.filter((s) => s.status === "closed" && Math.abs(Number(s.variance || 0)) < 0.01).length;
    const overageCnt = shifts.filter((s) => s.status === "closed" && Number(s.variance || 0) >= 0.01).length;
    const shortageCnt = shifts.filter((s) => s.status === "closed" && Number(s.variance || 0) <= -0.01).length;
    return [
      { name: "Balanced Drawer", value: balancedCnt, color: "#2fcf8a", filterStatus: "balanced" },
      { name: "Cash Overage", value: overageCnt, color: "#38bdf8", filterStatus: "overage" },
      { name: "Cash Shortage", value: shortageCnt, color: "#ff5470", filterStatus: "shortage" },
      { name: "Active Open Shift", value: openCnt, color: "#f5b83d", filterStatus: "open" },
    ];
  }, [data, statusChartMode, fin, counts]);

  // Comparative Bar Chart Items
  const comparativeItems = useMemo(() => {
    if (!data) return [];
    if (comparativeMode === "products") {
      const list = [...(data.product_profitability || [])];
      list.sort((a, b) =>
        comparativeMetric === "qty" ? b.qty - a.qty : b.revenue - a.revenue
      );
      return list.slice(0, 8).map((p) => ({
        name: p.name,
        sub: p.category,
        primary: comparativeMetric === "qty" ? p.qty : p.revenue,
        secondary: p.profit,
        formatted: comparativeMetric === "qty" ? `${p.qty} sold` : peso(p.revenue),
        subFormatted: `Profit: ${peso(p.profit)} (${Number(p.margin_pct || 0).toFixed(1)}%)`,
        color: "#ff7a3d",
      }));
    }
    if (comparativeMode === "employees") {
      const list = [...(data.employee_performance || [])];
      list.sort((a, b) =>
        comparativeMetric === "qty" ? b.ld_drinks - a.ld_drinks : b.total_payout - a.total_payout
      );
      return list.slice(0, 8).map((e) => ({
        name: e.staff_name,
        sub: `Salary ${pesoShort(e.salary_total)} • Comm ${pesoShort(e.commission_total)} • LD ${pesoShort(e.ld_total)}`,
        primary: comparativeMetric === "qty" ? e.ld_drinks : e.total_payout,
        formatted: comparativeMetric === "qty" ? `${e.ld_drinks} LD drinks` : peso(e.total_payout),
        subFormatted: `${e.ld_drinks} Ladies Drinks`,
        color: "#a855f7",
      }));
    }
    const list = [...(data.by_category || [])];
    list.sort((a, b) =>
      comparativeMetric === "qty" ? b.qty - a.qty : b.revenue - a.revenue
    );
    return list.slice(0, 8).map((c) => ({
      name: c.category || "Uncategorized",
      sub: `${c.qty} units sold`,
      primary: comparativeMetric === "qty" ? c.qty : c.revenue,
      formatted: comparativeMetric === "qty" ? `${c.qty} units` : peso(c.revenue),
      subFormatted: `Gross Profit: ${peso(c.profit)}`,
      color: "#38bdf8",
    }));
  }, [data, comparativeMode, comparativeMetric]);

  // ── Filtered & Sorted Datasets per Report Tab ──
  const qLower = search.trim().toLowerCase();

  const filteredSales = useMemo(() => {
    return salesList.filter((s) => {
      if (statusFilter !== "all" && statusFilter !== "healthy" && statusFilter !== "low" && statusFilter !== "out") {
        if (s.status !== statusFilter) return false;
      }
      if (categoryFilter !== "all") {
        const hasCat = (s.items || []).some((i) => {
          const prod = productsList.find((p) => p.id === i.product_id);
          return (prod?.category || "General") === categoryFilter;
        });
        if (!hasCat) return false;
      }
      if (qLower) {
        const matchReceipt = s.receipt_no?.toLowerCase().includes(qLower);
        const matchItem = (s.items || []).some((i) => i.name?.toLowerCase().includes(qLower));
        if (!matchReceipt && !matchItem) return false;
      }
      return true;
    });
  }, [salesList, statusFilter, categoryFilter, qLower, productsList]);

  const filteredProducts = useMemo(() => {
    const perfMap = new Map();
    (data?.catalog_performance || []).forEach((cp) => perfMap.set(cp.id, cp));

    return productsList
      .map((p) => {
        const perf = perfMap.get(p.id) || {};
        const soldQty = Number(perf.sold_qty || 0);
        const revenue = Number(perf.revenue || 0);
        const profit = Number(perf.profit || 0);
        const marginPct = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
        const stockStatus = p.stock <= 0 ? "out" : p.stock <= p.low_stock ? "low" : "healthy";
        return {
          ...p,
          sold_qty: soldQty,
          period_revenue: revenue,
          period_profit: profit,
          margin_pct: marginPct,
          stock_value: Number(p.stock || 0) * Number(p.cost || 0),
          retail_value: Number(p.stock || 0) * Number(p.price || 0),
          stock_status: stockStatus,
        };
      })
      .filter((p) => {
        if (categoryFilter !== "all" && (p.category || "General") !== categoryFilter) return false;
        if (statusFilter === "healthy" && p.stock_status !== "healthy") return false;
        if (statusFilter === "low" && p.stock_status !== "low") return false;
        if (statusFilter === "out" && p.stock_status !== "out") return false;
        if (qLower) {
          const match =
            p.name?.toLowerCase().includes(qLower) ||
            p.category?.toLowerCase().includes(qLower);
          if (!match) return false;
        }
        return true;
      });
  }, [productsList, data?.catalog_performance, categoryFilter, statusFilter, qLower]);

  const filteredExpenses = useMemo(() => {
    return (data?.expenses_list || []).filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (qLower) {
        const match =
          e.category?.toLowerCase().includes(qLower) ||
          e.description?.toLowerCase().includes(qLower) ||
          e.incurred_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.expenses_list, categoryFilter, qLower]);

  const filteredSalaries = useMemo(() => {
    return (data?.salaries_list || []).filter((s) => {
      if (staffFilter !== "all" && s.staff_name !== staffFilter) return false;
      if (qLower) {
        const match =
          s.staff_name?.toLowerCase().includes(qLower) ||
          s.role?.toLowerCase().includes(qLower) ||
          s.note?.toLowerCase().includes(qLower) ||
          s.paid_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.salaries_list, staffFilter, qLower]);

  const filteredCommissions = useMemo(() => {
    return (data?.commissions_list || []).filter((c) => {
      if (staffFilter !== "all" && c.staff_name !== staffFilter) return false;
      if (categoryFilter !== "all" && c.commission_type !== categoryFilter) return false;
      if (qLower) {
        const match =
          c.staff_name?.toLowerCase().includes(qLower) ||
          c.commission_type?.toLowerCase().includes(qLower) ||
          c.note?.toLowerCase().includes(qLower) ||
          c.earned_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.commissions_list, staffFilter, categoryFilter, qLower]);

  const filteredLdCommissions = useMemo(() => {
    return (data?.ld_commissions_list || []).filter((c) => {
      if (staffFilter !== "all" && c.staff_name !== staffFilter) return false;
      if (qLower) {
        const match =
          c.staff_name?.toLowerCase().includes(qLower) ||
          c.customer_table?.toLowerCase().includes(qLower) ||
          c.drink_name?.toLowerCase().includes(qLower) ||
          c.note?.toLowerCase().includes(qLower) ||
          c.earned_on?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.ld_commissions_list, staffFilter, qLower]);

  const filteredEmployees = useMemo(() => {
    const perfMap = new Map();
    (data?.employee_performance || []).forEach((ep) => perfMap.set(ep.staff_name.toLowerCase(), ep));

    return employeesList
      .map((emp) => {
        const perf = perfMap.get((emp.name || "").toLowerCase()) || {};
        return {
          ...emp,
          salary_total: Number(perf.salary_total || 0),
          commission_total: Number(perf.commission_total || 0),
          ld_total: Number(perf.ld_total || 0),
          ld_drinks: Number(perf.ld_drinks || 0),
          total_payout: Number(perf.total_payout || 0),
        };
      })
      .filter((emp) => {
        if (staffFilter !== "all" && emp.name !== staffFilter) return false;
        if (qLower) {
          const match =
            emp.name?.toLowerCase().includes(qLower) ||
            emp.role?.toLowerCase().includes(qLower) ||
            emp.contact?.toLowerCase().includes(qLower);
          if (!match) return false;
        }
        return true;
      });
  }, [employeesList, data?.employee_performance, staffFilter, qLower]);

  const filteredShifts = useMemo(() => {
    return (data?.shifts || []).filter((s) => {
      const v = Number(s.variance || 0);
      if (statusFilter === "open" && s.status !== "open") return false;
      if (statusFilter === "closed" && s.status !== "closed") return false;
      if (statusFilter === "balanced" && (s.status !== "closed" || Math.abs(v) >= 0.01)) return false;
      if (statusFilter === "overage" && (s.status !== "closed" || v < 0.01)) return false;
      if (statusFilter === "shortage" && (s.status !== "closed" || v > -0.01)) return false;
      if (qLower) {
        const match =
          s.business_date?.toLowerCase().includes(qLower) ||
          s.opened_by?.toLowerCase().includes(qLower) ||
          s.closed_by?.toLowerCase().includes(qLower) ||
          s.notes?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [data?.shifts, statusFilter, qLower]);

  const filteredAudit = useMemo(() => {
    return auditLogs.filter((a) => {
      if (statusFilter !== "all" && a.action?.toLowerCase() !== statusFilter.toLowerCase()) {
        // Only filter if statusFilter matches an audit action type
        if (["create", "update", "delete", "void", "restock", "shift_open", "shift_close"].includes(statusFilter)) {
          return false;
        }
      }
      if (qLower) {
        const match =
          a.summary?.toLowerCase().includes(qLower) ||
          a.actor?.toLowerCase().includes(qLower) ||
          a.entity_type?.toLowerCase().includes(qLower) ||
          a.action?.toLowerCase().includes(qLower) ||
          a.timestamp?.toLowerCase().includes(qLower);
        if (!match) return false;
      }
      return true;
    });
  }, [auditLogs, statusFilter, qLower]);

  // Generic sorting helper
  const sortRows = useCallback(
    (rows) => {
      const { key, dir } = sortConfig;
      if (!key) return rows;
      const mult = dir === "asc" ? 1 : -1;
      return [...rows].sort((a, b) => {
        const va = a[key];
        const vb = b[key];
        if (typeof va === "number" && typeof vb === "number") {
          return (va - vb) * mult;
        }
        return String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true }) * mult;
      });
    },
    [sortConfig]
  );

  const toggleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="sort-icon muted" />;
    return sortConfig.dir === "asc" ? (
      <ArrowUp size={12} className="sort-icon active" />
    ) : (
      <ArrowDown size={12} className="sort-icon active" />
    );
  };

  // Column visibility toggle helper
  const isColVisible = (colKey) => !hiddenCols[`${reportTab}:${colKey}`];
  const toggleColVisibility = (colKey) => {
    const k = `${reportTab}:${colKey}`;
    setHiddenCols((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  // Bulk Selection Helpers
  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleSelectAll = (rows) => {
    const allIds = rows.map((r) => r.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  // ── CRUD Handlers ──

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct.name?.trim()) return toast("Product name is required", "bad");
    if (Number(editingProduct.price) < 0) return toast("Price cannot be negative", "bad");
    try {
      await api.saveProduct({
        ...editingProduct,
        name: editingProduct.name.trim(),
        category: (editingProduct.category || "General").trim(),
        price: Number(editingProduct.price) || 0,
        cost: Number(editingProduct.cost) || 0,
        stock: Number(editingProduct.stock) || 0,
        low_stock: Number(editingProduct.low_stock) || 0,
        variants: (editingProduct.variants || [])
          .filter((v) => v.name && v.name.trim())
          .map((v) => ({ name: v.name.trim(), price: Number(v.price) || 0 })),
      });
      toast(editingProduct.id ? "Product updated" : "Product added to catalog");
      setEditingProduct(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockModal?.product) return;
    const qty = Number(restockModal.qty || 0);
    if (qty <= 0) return toast("Restock quantity must be greater than 0", "bad");
    try {
      await api.restock(
        restockModal.product.id,
        qty,
        Number(restockModal.unitCost || 0),
        restockModal.note || ""
      );
      toast(`Restocked +${qty} ${restockModal.product.name}`);
      setRestockModal(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const amt = Number(editingExpense?.amount || 0);
    if (amt <= 0) return toast("Expense amount must be greater than zero", "bad");
    try {
      await api.saveExpense({
        ...editingExpense,
        amount: amt,
        category: editingExpense.category || "Other",
        description: editingExpense.description || "",
        incurred_on: editingExpense.incurred_on || activeBusinessDate || ymd(),
      });
      toast(editingExpense.id ? "Expense updated" : "Expense recorded");
      setEditingExpense(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!editingSalary?.staff_name?.trim()) return toast("Staff name is required", "bad");
    const amt = Number(editingSalary?.amount || 0);
    if (amt <= 0) return toast("Salary amount must be greater than zero", "bad");
    try {
      await api.saveSalary({
        ...editingSalary,
        staff_name: editingSalary.staff_name.trim(),
        role: editingSalary.role || "",
        amount: amt,
        note: editingSalary.note || "",
        paid_on: editingSalary.paid_on || activeBusinessDate || ymd(),
      });
      toast(editingSalary.id ? "Salary record updated" : "Salary payment recorded");
      setEditingSalary(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveCommission = async (e) => {
    e.preventDefault();
    if (!editingCommission?.staff_name?.trim()) return toast("Staff name is required", "bad");
    const amt = Number(editingCommission?.amount || 0);
    if (amt <= 0) return toast("Commission amount must be greater than zero", "bad");
    try {
      await api.saveCommission({
        ...editingCommission,
        staff_name: editingCommission.staff_name.trim(),
        commission_type: editingCommission.commission_type || "Sales Bonus",
        amount: amt,
        sales_ref: editingCommission.sales_ref || "",
        rate_pct: Number(editingCommission.rate_pct || 0),
        note: editingCommission.note || "",
        earned_on: editingCommission.earned_on || activeBusinessDate || ymd(),
      });
      toast(editingCommission.id ? "Commission updated" : "Commission recorded");
      setEditingCommission(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveLdCommission = async (e) => {
    e.preventDefault();
    if (!editingLdCommission?.staff_name?.trim()) return toast("Staff name is required", "bad");
    const qty = Number(editingLdCommission?.quantity || 0);
    const unit = Number(editingLdCommission?.unit_comm || 0);
    if (qty <= 0 || unit <= 0) return toast("Quantity and rate per drink must be greater than zero", "bad");
    try {
      await api.saveLdCommission({
        ...editingLdCommission,
        staff_name: editingLdCommission.staff_name.trim(),
        customer_table: editingLdCommission.customer_table || "",
        drink_name: editingLdCommission.drink_name || "Ladies Drink",
        quantity: qty,
        unit_comm: unit,
        total: qty * unit,
        note: editingLdCommission.note || "",
        earned_on: editingLdCommission.earned_on || activeBusinessDate || ymd(),
      });
      toast(editingLdCommission.id ? "LD Commission updated" : "LD Commission recorded");
      setEditingLdCommission(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmployee?.name?.trim()) return toast("Employee full name is required", "bad");
    try {
      await api.saveEmployee({
        ...editingEmployee,
        name: editingEmployee.name.trim(),
        role: (editingEmployee.role || "").trim(),
        contact: (editingEmployee.contact || "").trim(),
        daily_rate: Number(editingEmployee.daily_rate || 0),
        hired_on: editingEmployee.hired_on || ymd(),
      });
      toast(editingEmployee.id ? "Employee profile updated" : "New employee added");
      setEditingEmployee(null);
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleVoidSaleSubmit = async (e) => {
    e.preventDefault();
    if (!voidingSale) return;
    if (!voidReason.trim()) return toast("Please enter a reason for voiding this receipt", "bad");
    try {
      await api.voidSale(voidingSale.id, voidReason.trim(), currentUser?.name || "Admin");
      toast(`Receipt ${voidingSale.receipt_no} voided & stock restored`);
      setVoidingSale(null);
      setVoidReason("");
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleSaveShiftNotes = async (e) => {
    e.preventDefault();
    if (!viewingShift) return;
    try {
      await api.updateShiftNotes(viewingShift.id, shiftNotesDraft);
      toast("Shift audit notes saved");
      setViewingShift((s) => (s ? { ...s, notes: shiftNotesDraft } : null));
      loadAll(from, to, true);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const labelMap = {
      products: "products (will be safely archived)",
      expenses: "expense records",
      salaries: "salary records",
      commissions: "commission records",
      "ld-commissions": "LD commission records",
      employees: "employee profiles (will be safely archived)",
    };
    const targetName = labelMap[reportTab];
    if (!targetName) return;

    setConfirmAction({
      title: `Confirm Bulk Action (${selectedIds.length} selected)`,
      message: `Are you sure you want to remove ${selectedIds.length} selected ${targetName}?`,
      detail: "All changes are logged in the Activity & Audit Trail.",
      confirmLabel: `Remove ${selectedIds.length} Records`,
      onConfirm: async () => {
        try {
          for (const id of selectedIds) {
            if (reportTab === "products") await api.deleteProduct(id);
            else if (reportTab === "expenses") await api.deleteExpense(id);
            else if (reportTab === "salaries") await api.deleteSalary(id);
            else if (reportTab === "commissions") await api.deleteCommission(id);
            else if (reportTab === "ld-commissions") await api.deleteLdCommission(id);
            else if (reportTab === "employees") await api.deleteEmployee(id);
          }
          toast(`Processed ${selectedIds.length} records`);
          setSelectedIds([]);
          setConfirmAction(null);
          loadAll(from, to, true);
        } catch (err) {
          toast(errText(err), "bad");
        }
      },
    });
  };

  // ── Export Functions (CSV, Excel .xls, Printable PDF Report) ──
  const buildExportDataset = () => {
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
        headers: ["Product Name", "Category", "Price", "Unit Cost", "Margin %", "Stock", "Status", "Units Sold (Period)", "Revenue (Period)", "Gross Profit (Period)"],
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
        headers: ["Employee Name", "Role", "Contact", "Daily Rate", "Date Hired", "Salaries (Period)", "Commissions (Period)", "LD Drinks", "LD Total (Period)", "Total Payout (Period)"],
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
        headers: ["Business Date", "Opened By", "Opened At", "Closed By", "Closed At", "Opening Float", "Expected Cash", "Closing Count", "Variance", "Status", "Notes"],
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

    // Default Overview P&L Export
    return {
      title: "Executive_PnL_and_Daily_Financial_Report",
      headers: ["Date", "Orders", "Gross Sales", "COGS", "Gross Profit", "Expenses", "Salaries", "Commissions", "LD Commissions", "Total Overheads", "Net Operating Profit"],
      rows: (data?.daily || []).map((d) => [
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
  };

  const handleExportCSV = async () => {
    try {
      const ds = buildExportDataset();
      const lines = [
        `"JOYCE POS — ${ds.title.replace(/_/g, " ")}"`,
        `"Period: ${from} to ${to} | Generated: ${new Date().toLocaleString()}"`,
        "",
        ds.headers.map(ds.esc).join(","),
        ...ds.rows.map((r) => r.map(ds.esc).join(",")),
      ];
      const csvContent = lines.join("\n");
      const filePath = await saveDialog({
        defaultPath: `${ds.title}_${from}_to_${to}.csv`,
        filters: [{ name: "CSV Spreadsheet", extensions: ["csv"] }],
      });
      if (!filePath) return;
      await api.saveTextFile(filePath, csvContent);
      toast(`Exported ${ds.rows.length} rows to CSV`);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handleExportExcel = async () => {
    try {
      const ds = buildExportDataset();
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
      const html = [
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
        oTag("div", 'class="title"') + escHtml(settings.store_name || "JOYCE POS") + " — " + escHtml(ds.title.replace(/_/g, " ")) + cTag("div"),
        oTag("div") + "Period: " + escHtml(from) + " to " + escHtml(to) + " | Generated by: " + escHtml(currentUser?.name || "Admin") + " on " + escHtml(new Date().toLocaleString()) + cTag("div"),
        oTag("br/"),
        oTag("table"),
        oTag("thead") + oTag("tr") + headRow + cTag("tr") + cTag("thead"),
        oTag("tbody") + bodyRows + cTag("tbody"),
        cTag("table"),
        cTag("body"),
        cTag("html"),
      ].join("\n");

      const filePath = await saveDialog({
        defaultPath: `${ds.title}_${from}_to_${to}.xls`,
        filters: [{ name: "Excel Workbook", extensions: ["xls"] }],
      });
      if (!filePath) return;
      await api.saveTextFile(filePath, html);
      toast(`Exported ${ds.rows.length} rows to Excel (.xls)`);
    } catch (err) {
      toast(errText(err), "bad");
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const activeBranchName =
    branchInfo?.branches?.find((b) => b.id === branchInfo.active_branch)?.name || "Main Store";

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (staffFilter !== "all" ? 1 : 0);

  return (
    <div className="admin-dashboard-page">
      {/* Print-Only Formal Report Header */}
      <div className="print-only-report-header">
        <h1>{settings.store_name || "JOYCE POS"} — Official Management Report</h1>
        <p>
          Branch: <b>{activeBranchName}</b> | Report Module:{" "}
          <b>{REPORT_TABS.find((t) => t.id === reportTab)?.label}</b> | Period:{" "}
          <b>{from} to {to}</b>
        </p>
        <p>
          Generated on {new Date().toLocaleString()} by {currentUser?.name || "Admin"} ({currentUser?.role})
        </p>
        <hr />
      </div>

      {/* 1. Executive Header & Quick Toolbar */}
      <PageHeader
        title="Executive Admin Dashboard & Analytics"
        subtitle={`Real-time financial intelligence, multi-period comparisons, and centralized CRUD data management for ${activeBranchName}.`}
      >
        <div className="admin-head-toolbar no-print">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => loadAll(from, to)}
            disabled={refreshing}
            title="Refresh all dashboard metrics, charts, and tables"
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={handleExportCSV}
            title="Export active report view to CSV"
          >
            <Download size={14} /> CSV
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={handleExportExcel}
            title="Export active report view to Excel (.xls)"
          >
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button
            type="button"
            className="btn primary sm"
            onClick={handlePrintReport}
            title="Print or Save as PDF"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </PageHeader>

      {/* Error Banner if Backend Query Failed */}
      {errorMsg && (
        <div className="alert-banner bad" style={{ marginBottom: 16 }}>
          <AlertTriangle size={18} />
          <div style={{ flex: 1 }}>
            <b>Failed to load dashboard data:</b> {errorMsg}
          </div>
          <button type="button" className="btn sm" onClick={() => loadAll(from, to)}>
            Retry
          </button>
        </div>
      )}

      {/* 2. Master Filter & Date Range Bar */}
      <div className="card filter-master-card no-print">
        <div className="filter-top-row">
          <div className="filter-title">
            <Calendar size={15} color="var(--accent)" />
            <b>Reporting Period</b>
            <span className="muted" style={{ fontSize: 12 }}>
              (Compared automatically against preceding {data?.previous_period?.from || "—"} → {data?.previous_period?.to || "—"})
            </span>
          </div>
          <div className="filter-actions">
            {(draftFrom !== from || draftTo !== to) && (
              <button
                type="button"
                className="btn sm primary"
                onClick={() => handleApplyDateRange(draftFrom, draftTo)}
              >
                Apply Date Range
              </button>
            )}
            <button
              type="button"
              className="btn sm ghost"
              onClick={handleResetFilters}
              title="Reset date range and all active filters"
            >
              <RotateCcw size={13} /> Reset Filters
            </button>
          </div>
        </div>

        <RangeBar
          from={draftFrom}
          to={draftTo}
          setFrom={(val) => {
            setDraftFrom(val);
            if (val <= draftTo) setFrom(val);
          }}
          setTo={(val) => {
            setDraftTo(val);
            if (draftFrom <= val) setTo(val);
          }}
        />

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="active-filters-bar">
            <span className="muted" style={{ fontSize: 12 }}>Active Filters:</span>
            {search.trim() && (
              <span className="filter-pill">
                Keyword: “{search}”
                <button type="button" onClick={() => setSearch("")}><X size={11} /></button>
              </span>
            )}
            {categoryFilter !== "all" && (
              <span className="filter-pill">
                Category: {categoryFilter}
                <button type="button" onClick={() => setCategoryFilter("all")}><X size={11} /></button>
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="filter-pill">
                Status: {statusFilter}
                <button type="button" onClick={() => setStatusFilter("all")}><X size={11} /></button>
              </span>
            )}
            {staffFilter !== "all" && (
              <span className="filter-pill">
                Staff: {staffFilter}
                <button type="button" onClick={() => setStaffFilter("all")}><X size={11} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Summary KPI Cards with Period Comparisons & Click-to-Navigate */}
      {loading && !data ? (
        <div className="kpi-skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card skeleton-card" />
          ))}
        </div>
      ) : (
        <section className="kpi-grid-modern" aria-label="Key Performance Indicators">
          {/* Card 1: Gross Sales Revenue */}
          <div
            className="kpi-card-v2 tone-ok"
            onClick={() => jumpToReport("sales", { status: "completed" })}
            role="button"
            tabIndex={0}
            title="Click to inspect Completed Sales & Receipts"
          >
            <div className="kpi-head">
              <span className="kpi-title">Gross Sales Revenue</span>
              <span className="kpi-icon-box tone-ok"><TrendingUp size={17} /></span>
            </div>
            <div className="kpi-val">{peso(fin.revenue)}</div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={revCompare.delta >= 0 ? "ok" : "bad"}
                label={`${revCompare.delta >= 0 ? "+" : ""}${revCompare.pct.toFixed(1)}% (${revCompare.delta >= 0 ? "+" : ""}${pesoShort(revCompare.delta)})`}
              />
              <span className="kpi-sub">vs prev period</span>
            </div>
            <div className="kpi-foot">
              <span><b>{fin.orders || 0}</b> completed receipts • Avg <b>{peso(fin.avg_ticket)}</b></span>
              <ExternalLink size={12} />
            </div>
          </div>

          {/* Card 2: Net Operating Profit */}
          <div
            className={`kpi-card-v2 ${Number(fin.net_profit || 0) >= 0 ? "tone-ok" : "tone-bad"}`}
            onClick={() => jumpToReport("overview")}
            role="button"
            tabIndex={0}
            title="Click to view full P&L Breakdown"
          >
            <div className="kpi-head">
              <span className="kpi-title">Net Operating Profit</span>
              <span className={`kpi-icon-box ${Number(fin.net_profit || 0) >= 0 ? "tone-ok" : "tone-bad"}`}>
                <ShieldCheck size={17} />
              </span>
            </div>
            <div
              className="kpi-val"
              style={{ color: Number(fin.net_profit || 0) >= 0 ? "var(--ok)" : "var(--bad)" }}
            >
              {peso(fin.net_profit)}
            </div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={netCompare.delta >= 0 ? "ok" : "bad"}
                label={`${netCompare.delta >= 0 ? "+" : ""}${netCompare.pct.toFixed(1)}% (${netCompare.delta >= 0 ? "+" : ""}${pesoShort(netCompare.delta)})`}
              />
              <span className="kpi-sub">Net Margin {Number(fin.net_margin_pct || 0).toFixed(1)}%</span>
            </div>
            <div className="kpi-foot">
              <span>After COGS, Expenses, Salaries & Commissions</span>
              <ExternalLink size={12} />
            </div>
          </div>

          {/* Card 3: Gross Profit & COGS */}
          <div
            className="kpi-card-v2 tone-info"
            onClick={() => jumpToReport("products")}
            role="button"
            tabIndex={0}
            title="Click to inspect Product Profitability & Margins"
          >
            <div className="kpi-head">
              <span className="kpi-title">Gross Profit (Sales − COGS)</span>
              <span className="kpi-icon-box tone-info"><BarChart3 size={17} /></span>
            </div>
            <div className="kpi-val">{peso(fin.gross_profit)}</div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={grossCompare.delta >= 0 ? "ok" : "bad"}
                label={`${grossCompare.delta >= 0 ? "+" : ""}${grossCompare.pct.toFixed(1)}%`}
              />
              <span className="kpi-sub">Gross Margin {Number(fin.gross_margin_pct || 0).toFixed(1)}%</span>
            </div>
            <div className="kpi-foot">
              <span>COGS: <b>{peso(fin.cogs)}</b></span>
              <ExternalLink size={12} />
            </div>
          </div>

          {/* Card 4: Total Overheads (Expenses + Salaries + Regular & LD Commissions) */}
          <div
            className="kpi-card-v2 tone-warn"
            onClick={() => jumpToReport("expenses")}
            role="button"
            tabIndex={0}
            title="Click to manage Expenses, Payroll, and Commissions"
          >
            <div className="kpi-head">
              <span className="kpi-title">Total Operating Overheads</span>
              <span className="kpi-icon-box tone-warn"><Wallet size={17} /></span>
            </div>
            <div className="kpi-val">{peso(fin.total_overheads)}</div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={overheadCompare.delta <= 0 ? "ok" : "warn"}
                label={`${overheadCompare.delta >= 0 ? "+" : ""}${overheadCompare.pct.toFixed(1)}% vs prev`}
              />
              <span className="kpi-sub">Exp {pesoShort(fin.expenses)} • Pay {pesoShort((fin.salaries || 0) + (fin.commissions || 0) + (fin.ld_commissions || 0))}</span>
            </div>
            <div className="kpi-foot">
              <span>Sal {pesoShort(fin.salaries)} • Comm {pesoShort(fin.commissions)} • LD {pesoShort(fin.ld_commissions)}</span>
              <ExternalLink size={12} />
            </div>
          </div>

          {/* Card 5: Today's Live Performance */}
          <div
            className="kpi-card-v2 tone-info"
            onClick={() => {
              const td = activeBusinessDate || ymd();
              handleApplyDateRange(td, td);
              jumpToReport("sales");
            }}
            role="button"
            tabIndex={0}
            title="Click to filter dashboard to Active Business Date"
          >
            <div className="kpi-head">
              <span className="kpi-title">Today ({todayStats.business_date || activeBusinessDate})</span>
              <span className="kpi-icon-box tone-info"><Sparkles size={17} /></span>
            </div>
            <div className="kpi-val">{peso(todayStats.revenue)}</div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={Number(todayStats.net_profit || 0) >= 0 ? "ok" : "bad"}
                label={`Net Today: ${peso(todayStats.net_profit)}`}
              />
              <span className="kpi-sub">{todayStats.orders || 0} orders</span>
            </div>
            <div className="kpi-foot">
              <span><b>{todayStats.records_created || 0}</b> records created today</span>
              <ExternalLink size={12} />
            </div>
          </div>

          {/* Card 6: Month-to-Date (MTD) Performance */}
          <div
            className="kpi-card-v2 tone-purple"
            onClick={() => {
              handleApplyDateRange(monthStart(), ymd());
              jumpToReport("overview");
            }}
            role="button"
            tabIndex={0}
            title="Click to set filter to Month-to-Date"
          >
            <div className="kpi-head">
              <span className="kpi-title">Month-to-Date (MTD)</span>
              <span className="kpi-icon-box tone-purple"><Calendar size={17} /></span>
            </div>
            <div className="kpi-val">{peso(mtdStats.revenue)}</div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={Number(mtdStats.net_profit || 0) >= 0 ? "ok" : "bad"}
                label={`MTD Net: ${pesoShort(mtdStats.net_profit)}`}
              />
              <span className="kpi-sub">{mtdStats.orders || 0} orders</span>
            </div>
            <div className="kpi-foot">
              <span>Overheads MTD: <b>{peso(mtdStats.total_overheads)}</b></span>
              <ExternalLink size={12} />
            </div>
          </div>

          {/* Card 7: Inventory Valuation & Stock Alerts */}
          <div
            className={`kpi-card-v2 ${
              Number(counts.out_of_stock_count || 0) > 0
                ? "tone-bad"
                : Number(counts.low_stock_count || 0) > 0
                ? "tone-warn"
                : "tone-ok"
            }`}
            onClick={() =>
              jumpToReport("products", {
                status:
                  Number(counts.out_of_stock_count || 0) > 0
                    ? "out"
                    : Number(counts.low_stock_count || 0) > 0
                    ? "low"
                    : "all",
              })
            }
            role="button"
            tabIndex={0}
            title="Click to inspect Inventory Stock Health & Restock"
          >
            <div className="kpi-head">
              <span className="kpi-title">Inventory & Stock Health</span>
              <span className="kpi-icon-box tone-info"><Boxes size={17} /></span>
            </div>
            <div className="kpi-val">{peso(fin.stock_retail_value)}</div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={
                  Number(counts.out_of_stock_count || 0) > 0
                    ? "bad"
                    : Number(counts.low_stock_count || 0) > 0
                    ? "warn"
                    : "ok"
                }
                label={`${counts.out_of_stock_count || 0} Out • ${counts.low_stock_count || 0} Low • ${counts.healthy_stock_count || 0} OK`}
              />
            </div>
            <div className="kpi-foot">
              <span>Cost Value: <b>{peso(fin.stock_cost_value)}</b> ({counts.active_products || 0} SKUs)</span>
              <ExternalLink size={12} />
            </div>
          </div>

          {/* Card 8: Void / Leakage & Active Staff */}
          <div
            className={`kpi-card-v2 ${Number(fin.void_count || 0) > 0 ? "tone-warn" : "tone-neutral"}`}
            onClick={() => jumpToReport("sales", { status: "voided" })}
            role="button"
            tabIndex={0}
            title="Click to audit Voided Receipts & Reasons"
          >
            <div className="kpi-head">
              <span className="kpi-title">Void Audit & System Records</span>
              <span className="kpi-icon-box tone-warn"><AlertTriangle size={17} /></span>
            </div>
            <div className="kpi-val">{peso(fin.void_total)}</div>
            <div className="kpi-compare-row">
              <StatusBadge
                tone={Number(fin.void_count || 0) > 0 ? "warn" : "ok"}
                label={`${fin.void_count || 0} voided receipts`}
              />
              <span className="kpi-sub">{counts.active_employees || 0} staff • {counts.total_records || 0} total DB records</span>
            </div>
            <div className="kpi-foot">
              <span>Click to inspect voided transactions</span>
              <ExternalLink size={12} />
            </div>
          </div>
        </section>
      )}

      {/* 4. Interactive Charts & Data Visualization Suite */}
      {data && (
        <section className="analytics-charts-section no-print" aria-label="Interactive Visualizations">
          {/* Primary Trend Chart: Line / Area / Bar + Granularity + Series Toggles */}
          <div className="card chart-card-wide">
            <div className="chart-card-head">
              <div>
                <h3>
                  <TrendingUp size={17} color="var(--accent)" /> Financial Performance & Trend Analysis
                </h3>
                <p className="muted">
                  Hover over any point to inspect exact values. Compare current period against previous period ({prev.from} → {prev.to}).
                </p>
              </div>

              <div className="chart-controls-row">
                {/* Granularity Selector */}
                <div className="segmented-control" title="Time aggregation granularity">
                  {[
                    { id: "daily", label: "Daily" },
                    { id: "weekly", label: "Weekly" },
                    { id: "monthly", label: "Monthly" },
                    { id: "quarterly", label: "Quarterly" },
                    { id: "yearly", label: "Yearly" },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={trendGranularity === g.id ? "active" : ""}
                      onClick={() => setTrendGranularity(g.id)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>

                {/* Chart Type Selector */}
                <div className="segmented-control" title="Chart visualization style">
                  <button
                    type="button"
                    className={trendChartMode === "area" ? "active" : ""}
                    onClick={() => setTrendChartMode("area")}
                  >
                    Area
                  </button>
                  <button
                    type="button"
                    className={trendChartMode === "line" ? "active" : ""}
                    onClick={() => setTrendChartMode("line")}
                  >
                    Line
                  </button>
                  <button
                    type="button"
                    className={trendChartMode === "bar" ? "active" : ""}
                    onClick={() => setTrendChartMode("bar")}
                  >
                    Bars
                  </button>
                </div>

                <label className="checkbox-pill" title="Overlay previous period revenue as a dashed line">
                  <input
                    type="checkbox"
                    checked={showPrevPeriod}
                    onChange={(e) => setShowPrevPeriod(e.target.checked)}
                  />
                  <span>Compare Prev Period</span>
                </label>
              </div>
            </div>

            {/* Metric Series Filter Pills */}
            <div className="series-toggle-bar">
              {trendSeriesConfig.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`series-chip ${s.enabled ? "active" : ""}`}
                  style={s.enabled ? { borderColor: s.color, background: `${s.color}1c` } : {}}
                  onClick={() =>
                    setSeriesEnabled((prevS) => ({ ...prevS, [s.key]: !prevS[s.key] }))
                  }
                >
                  <span className="dot" style={{ background: s.color }} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            <InteractiveTrendChart
              data={aggregatedTrend}
              prevData={aggregatedPrevTrend}
              mode={trendChartMode}
              showComparison={showPrevPeriod}
              seriesConfig={trendSeriesConfig}
            />
          </div>

          {/* Secondary Charts Grid: Category Doughnut, Status Distribution, Comparative Bar, Peak Hours */}
          <div className="charts-grid-2x2">
            {/* B. Category & Overhead Breakdown Doughnut */}
            <div className="card chart-card">
              <div className="chart-card-head">
                <div>
                  <h3>
                    <PieChartIcon size={16} color="var(--accent)" /> Category & Cost Breakdown
                  </h3>
                  <p className="muted">Click any slice or legend item to filter the underlying report records.</p>
                </div>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={doughnutMode === "category" ? "active" : ""}
                    onClick={() => setDoughnutMode("category")}
                  >
                    Sales by Cat
                  </button>
                  <button
                    type="button"
                    className={doughnutMode === "expense" ? "active" : ""}
                    onClick={() => setDoughnutMode("expense")}
                  >
                    Expenses
                  </button>
                  <button
                    type="button"
                    className={doughnutMode === "overhead" ? "active" : ""}
                    onClick={() => setDoughnutMode("overhead")}
                  >
                    All Costs
                  </button>
                </div>
              </div>

              <InteractiveDoughnutChart
                items={doughnutItems}
                totalLabel={
                  doughnutMode === "category"
                    ? "Gross Sales"
                    : doughnutMode === "expense"
                    ? "Expenses"
                    : "Total Costs"
                }
                selectedKey={categoryFilter !== "all" ? categoryFilter : null}
                onSelectItem={(item) => {
                  if (doughnutMode === "category") {
                    const nextCat = categoryFilter === item.name ? "all" : item.name;
                    jumpToReport("products", { category: nextCat });
                  } else if (doughnutMode === "expense") {
                    const nextCat = categoryFilter === item.name ? "all" : item.name;
                    jumpToReport("expenses", { category: nextCat });
                  } else if (item.target) {
                    jumpToReport(item.target);
                  }
                }}
              />
            </div>

            {/* C. Status Distribution Chart */}
            <div className="card chart-card">
              <div className="chart-card-head">
                <div>
                  <h3>
                    <CheckCircle2 size={16} color="var(--ok)" /> Status Distribution
                  </h3>
                  <p className="muted">Monitor transaction completion, stock health, and shift audits.</p>
                </div>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={statusChartMode === "sales" ? "active" : ""}
                    onClick={() => setStatusChartMode("sales")}
                  >
                    Receipts
                  </button>
                  <button
                    type="button"
                    className={statusChartMode === "stock" ? "active" : ""}
                    onClick={() => setStatusChartMode("stock")}
                  >
                    Inventory
                  </button>
                  <button
                    type="button"
                    className={statusChartMode === "shifts" ? "active" : ""}
                    onClick={() => setStatusChartMode("shifts")}
                  >
                    Shifts
                  </button>
                </div>
              </div>

              <InteractiveDoughnutChart
                items={statusChartItems}
                totalLabel="Records"
                valueFormatter={(v) => Number(v || 0).toLocaleString()}
                onSelectItem={(item) => {
                  if (statusChartMode === "sales") {
                    jumpToReport("sales", { status: item.filterStatus });
                  } else if (statusChartMode === "stock") {
                    jumpToReport("products", { status: item.filterStatus });
                  } else {
                    jumpToReport("shifts", { status: item.filterStatus });
                  }
                }}
              />
            </div>

            {/* D. Comparative Analysis Bar Chart */}
            <div className="card chart-card">
              <div className="chart-card-head">
                <div>
                  <h3>
                    <BarChart3 size={16} color="var(--info)" /> Comparative Ranking
                  </h3>
                  <p className="muted">Compare top products, staff compensation, or categories.</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={comparativeMode === "products" ? "active" : ""}
                      onClick={() => setComparativeMode("products")}
                    >
                      Products
                    </button>
                    <button
                      type="button"
                      className={comparativeMode === "employees" ? "active" : ""}
                      onClick={() => setComparativeMode("employees")}
                    >
                      Staff Pay
                    </button>
                    <button
                      type="button"
                      className={comparativeMode === "categories" ? "active" : ""}
                      onClick={() => setComparativeMode("categories")}
                    >
                      Categories
                    </button>
                  </div>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={comparativeMetric === "value" ? "active" : ""}
                      onClick={() => setComparativeMetric("value")}
                    >
                      ₱ Value
                    </button>
                    <button
                      type="button"
                      className={comparativeMetric === "qty" ? "active" : ""}
                      onClick={() => setComparativeMetric("qty")}
                    >
                      Count
                    </button>
                  </div>
                </div>
              </div>

              {comparativeItems.length === 0 ? (
                <Empty text="No comparative records in this period." />
              ) : (
                <div className="comparative-bars">
                  {(() => {
                    const maxP = Math.max(1, ...comparativeItems.map((i) => Number(i.primary || 0)));
                    return comparativeItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="comp-bar-row"
                        onClick={() => {
                          if (comparativeMode === "products") jumpToReport("products", { search: item.name });
                          else if (comparativeMode === "employees") jumpToReport("employees", { staff: item.name });
                          else jumpToReport("products", { category: item.name });
                        }}
                        role="button"
                        tabIndex={0}
                        title="Click to inspect underlying records"
                      >
                        <div className="comp-bar-labels">
                          <div>
                            <b>{idx + 1}. {item.name}</b>
                            {item.sub && <span className="muted"> • {item.sub}</span>}
                          </div>
                          <div className="comp-bar-values">
                            <b>{item.formatted}</b>
                            <span className="muted">{item.subFormatted}</span>
                          </div>
                        </div>
                        <div className="comp-bar-track">
                          <div
                            className="comp-bar-fill"
                            style={{
                              width: `${Math.min(100, (Number(item.primary || 0) / maxP) * 100)}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* E. Activity & Peak Trading Hours Tracking */}
            <div className="card chart-card">
              <div className="chart-card-head">
                <div>
                  <h3>
                    <Clock size={16} color="var(--purple)" /> Peak Trading Hours & Activity
                  </h3>
                  <p className="muted">Hourly sales volume distribution (00:00 – 23:00).</p>
                </div>
                <StatusBadge
                  tone="info"
                  label={`${(data.hourly || []).reduce((s, h) => s + Number(h.orders || 0), 0)} total orders`}
                />
              </div>

              {(data.hourly || []).length === 0 ? (
                <Empty text="No hourly transaction activity recorded in this period." />
              ) : (
                <div className="hourly-chart-box">
                  {(() => {
                    const map = new Map();
                    (data.hourly || []).forEach((h) => map.set(Number(h.hour), h));
                    const hours = Array.from({ length: 24 }, (_, hr) => ({
                      hour: hr,
                      orders: Number(map.get(hr)?.orders || 0),
                      revenue: Number(map.get(hr)?.revenue || 0),
                    }));
                    const maxRev = Math.max(1, ...hours.map((h) => h.revenue));
                    return (
                      <div className="hourly-bars-grid">
                        {hours.map((h) => {
                          const pct = (h.revenue / maxRev) * 100;
                          const label = `${String(h.hour).padStart(2, "0")}:00`;
                          return (
                            <div
                              key={h.hour}
                              className="hourly-col"
                              title={`${label} — ${peso(h.revenue)} (${h.orders} orders)`}
                            >
                              <div className="hourly-bar-wrap">
                                <div
                                  className="hourly-bar-fill"
                                  style={{
                                    height: `${Math.max(h.revenue > 0 ? 8 : 2, pct)}%`,
                                    background: h.revenue > 0 ? "var(--accent)" : "var(--border)",
                                  }}
                                />
                              </div>
                              <span className="hourly-lbl">{h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. Actionable Alerts & Recent Activity Strip */}
      {data && (
        <section className="alerts-activity-grid no-print">
          {/* Important Alerts & Pending Actions */}
          <div className="card">
            <div className="section-title-row">
              <h3>
                <AlertTriangle size={16} color="var(--warn)" /> Important Alerts & Action Required
              </h3>
              <StatusBadge
                tone={(data.alerts || []).length > 0 ? "warn" : "ok"}
                label={`${(data.alerts || []).length} active`}
              />
            </div>

            {(data.alerts || []).length === 0 ? (
              <div className="empty-compact">
                <CheckCircle2 size={20} color="var(--ok)" />
                <span>All systems nominal. Stock levels, shift reconciliations, and margins are healthy.</span>
              </div>
            ) : (
              <div className="alerts-list">
                {data.alerts.map((a) => (
                  <div
                    key={a.id}
                    className={`alert-card-row tone-${a.severity || "info"}`}
                    onClick={() => {
                      if (a.target === "shift") openSod();
                      else jumpToReport(a.target || "overview", { status: a.filter || "all" });
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="alert-card-body">
                      <div className="alert-card-title">
                        <StatusBadge
                          tone={a.severity === "bad" ? "bad" : a.severity === "warn" ? "warn" : "info"}
                          label={a.severity === "bad" ? "CRITICAL" : a.severity === "warn" ? "WARNING" : "NOTICE"}
                        />
                        <b>{a.title}</b>
                      </div>
                      <p className="muted">{a.message}</p>
                    </div>
                    <ExternalLink size={14} className="muted" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Recent Activity Stream */}
          <div className="card">
            <div className="section-title-row">
              <h3>
                <Activity size={16} color="var(--info)" /> Recent System Activity
              </h3>
              <button
                type="button"
                className="link-btn"
                onClick={() => jumpToReport("audit")}
              >
                View Full Audit Trail →
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <Empty text="No recent activity recorded in this period." />
            ) : (
              <div className="recent-activity-feed">
                {auditLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="activity-feed-item"
                    onClick={() => setViewingAuditItem(log)}
                    role="button"
                    tabIndex={0}
                  >
                    <StatusBadge
                      tone={
                        log.action === "VOID" || log.action === "DELETE"
                          ? "bad"
                          : log.action === "CREATE" || log.action === "SALE" || log.action === "RESTOCK"
                          ? "ok"
                          : "info"
                      }
                      label={log.action}
                    />
                    <div className="activity-feed-text">
                      <b>{log.summary}</b>
                      <small className="muted">
                        {log.timestamp} • by {log.actor} ({log.role})
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. CENTRALIZED REPORTS & FULL CRUD DATA MANAGEMENT MODULE */}
      <section ref={reportSectionRef} className="central-reports-section" aria-label="Centralized Reports and CRUD Management">
        <div className="card reports-shell-card">
          <div className="reports-header-bar no-print">
            <div>
              <h2>Centralized Reports & Record Management (CRUD)</h2>
              <p className="muted">
                View, filter, sort, export, and directly create, update, or archive underlying database records.
              </p>
            </div>

            {/* Contextual Primary CRUD Action Button per Report Tab */}
            <div className="reports-primary-actions">
              {reportTab === "products" && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    setEditingProduct({
                      name: "",
                      category: "General",
                      price: 0,
                      cost: 0,
                      stock: 0,
                      low_stock: 5,
                      image: "",
                      variants: [],
                    })
                  }
                >
                  <Plus size={16} /> Add New Product
                </button>
              )}
              {reportTab === "expenses" && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    setEditingExpense({
                      category: "Supplies",
                      description: "",
                      amount: "",
                      incurred_on: activeBusinessDate || ymd(),
                    })
                  }
                >
                  <Plus size={16} /> Add Expense Record
                </button>
              )}
              {reportTab === "salaries" && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    setEditingSalary({
                      staff_name: employeesList[0]?.name || "",
                      role: employeesList[0]?.role || "",
                      amount: employeesList[0]?.daily_rate || "",
                      note: "",
                      paid_on: activeBusinessDate || ymd(),
                    })
                  }
                >
                  <Plus size={16} /> Add Salary Record
                </button>
              )}
              {reportTab === "commissions" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setShowAddCommType(true)}
                  >
                    <Plus size={15} /> New Commission Type
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() =>
                      setEditingCommission({
                        staff_name: employeesList[0]?.name || "",
                        commission_type: commissionTypes[0] || "Sales Bonus",
                        amount: "",
                        sales_ref: "",
                        rate_pct: 0,
                        note: "",
                        earned_on: activeBusinessDate || ymd(),
                      })
                    }
                  >
                    <Plus size={16} /> Add Commission
                  </button>
                </div>
              )}
              {reportTab === "ld-commissions" && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    setEditingLdCommission({
                      staff_name: employeesList[0]?.name || "",
                      customer_table: "",
                      drink_name: "Ladies Drink",
                      quantity: 1,
                      unit_comm: 50,
                      note: "",
                      earned_on: activeBusinessDate || ymd(),
                    })
                  }
                >
                  <Plus size={16} /> Add LD Commission
                </button>
              )}
              {reportTab === "employees" && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    setEditingEmployee({
                      name: "",
                      role: "Cashier",
                      contact: "",
                      daily_rate: 500,
                      hired_on: ymd(),
                    })
                  }
                >
                  <Plus size={16} /> Add Employee
                </button>
              )}
              {reportTab === "shifts" && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => (shiftStatus?.is_open ? openEod() : openSod())}
                >
                  {shiftStatus?.is_open ? <Sunset size={16} /> : <Sunrise size={16} />}
                  {shiftStatus?.is_open ? "Execute End of Day (EOD)" : "Start Business Day (SOD)"}
                </button>
              )}
            </div>
          </div>

          {/* Report Category Tabs */}
          <div className="report-tabs-nav no-print" role="tablist">
            {REPORT_TABS.map((t) => {
              const Icon = t.icon;
              let countBadge = null;
              if (t.id === "sales") countBadge = filteredSales.length;
              else if (t.id === "products") countBadge = filteredProducts.length;
              else if (t.id === "expenses") countBadge = filteredExpenses.length;
              else if (t.id === "salaries") countBadge = filteredSalaries.length;
              else if (t.id === "commissions") countBadge = filteredCommissions.length;
              else if (t.id === "ld-commissions") countBadge = filteredLdCommissions.length;
              else if (t.id === "employees") countBadge = filteredEmployees.length;
              else if (t.id === "shifts") countBadge = filteredShifts.length;
              else if (t.id === "audit") countBadge = filteredAudit.length;

              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={reportTab === t.id}
                  className={`report-tab-btn ${reportTab === t.id ? "active" : ""}`}
                  onClick={() => setReportTab(t.id)}
                >
                  <Icon size={15} />
                  <span>{t.label}</span>
                  {countBadge !== null && (
                    <span className="tab-count-pill">{countBadge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Unified Table Search, Filter & Column Visibility Toolbar */}
          {reportTab !== "overview" && (
            <div className="table-filter-toolbar no-print">
              <div className="table-search-box">
                <Search size={15} className="muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search in ${REPORT_TABS.find((t) => t.id === reportTab)?.label}…`}
                  aria-label="Filter table records"
                />
                {search && (
                  <button type="button" className="icon-btn sm" onClick={() => setSearch("")}>
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="table-contextual-filters">
                {/* Category Filter for Sales, Products, Expenses, Commissions */}
                {["sales", "products", "expenses", "commissions"].includes(reportTab) && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filter by category"
                  >
                    <option value="all">All Categories</option>
                    {reportTab === "expenses"
                      ? EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      : reportTab === "commissions"
                      ? commissionTypes.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      : allProductCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                  </select>
                )}

                {/* Status Filter for Sales, Products, Shifts, Audit */}
                {reportTab === "sales" && (
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All Receipt Statuses</option>
                    <option value="completed">Completed Only</option>
                    <option value="voided">Voided Only</option>
                  </select>
                )}
                {reportTab === "products" && (
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All Stock Levels</option>
                    <option value="healthy">Healthy Stock</option>
                    <option value="low">Low Stock Alert</option>
                    <option value="out">Out of Stock (0)</option>
                  </select>
                )}
                {reportTab === "shifts" && (
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All Shift Statuses</option>
                    <option value="open">Open Shift</option>
                    <option value="balanced">Closed — Balanced</option>
                    <option value="overage">Closed — Cash Overage</option>
                    <option value="shortage">Closed — Cash Shortage</option>
                  </select>
                )}

                {/* Employee / Staff Filter for Payroll & Commissions */}
                {["salaries", "commissions", "ld-commissions", "employees"].includes(reportTab) && (
                  <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                    <option value="all">All Staff Members</option>
                    {allStaffNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}

                {/* Bulk Selection Action Bar */}
                {selectedIds.length > 0 &&
                  ["products", "expenses", "salaries", "commissions", "ld-commissions", "employees"].includes(reportTab) && (
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 size={14} /> Remove Selected ({selectedIds.length})
                    </button>
                  )}
              </div>
            </div>
          )}

          {/* ── TAB 1: OVERVIEW & EXECUTIVE P&L STATEMENT ── */}
          {reportTab === "overview" && data && (
            <div className="overview-report-pane">
              <div className="pnl-grid">
                {/* Formal Income Statement Card */}
                <div className="pnl-statement-box">
                  <h3>Comprehensive Profit & Loss (P&L) Statement ({from} → {to})</h3>
                  <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                    Click any line item to drill down into the underlying source records.
                  </p>

                  <div className="pnl-table">
                    <div
                      className="pnl-row clickable"
                      onClick={() => jumpToReport("sales", { status: "completed" })}
                    >
                      <span>Gross Sales Revenue ({fin.orders || 0} completed orders)</span>
                      <b className="text-ok">{peso(fin.revenue)}</b>
                    </div>
                    <div
                      className="pnl-row clickable sub"
                      onClick={() => jumpToReport("sales", { status: "voided" })}
                    >
                      <span>Memo: Voided Receipts ({fin.void_count || 0} voided, excluded from revenue)</span>
                      <span className="muted">{peso(fin.void_total)}</span>
                    </div>
                    <div
                      className="pnl-row clickable"
                      onClick={() => jumpToReport("products")}
                    >
                      <span>Less: Cost of Goods Sold (COGS)</span>
                      <b className="text-bad">−{peso(fin.cogs)}</b>
                    </div>
                    <div className="pnl-row highlight">
                      <b>Gross Profit ({Number(fin.gross_margin_pct || 0).toFixed(1)}% margin)</b>
                      <b className="text-info">{peso(fin.gross_profit)}</b>
                    </div>

                    <div className="pnl-section-label">Operating Overheads & Payroll</div>
                    <div
                      className="pnl-row clickable"
                      onClick={() => jumpToReport("expenses")}
                    >
                      <span>Store Operating Expenses ({(data.expenses_list || []).length} records)</span>
                      <b className="text-bad">−{peso(fin.expenses)}</b>
                    </div>
                    <div
                      className="pnl-row clickable"
                      onClick={() => jumpToReport("salaries")}
                    >
                      <span>Staff Salaries Payroll ({(data.salaries_list || []).length} records)</span>
                      <b className="text-bad">−{peso(fin.salaries)}</b>
                    </div>
                    <div
                      className="pnl-row clickable"
                      onClick={() => jumpToReport("commissions")}
                    >
                      <span>Regular Staff Commissions ({(data.commissions_list || []).length} records)</span>
                      <b className="text-bad">−{peso(fin.commissions)}</b>
                    </div>
                    <div
                      className="pnl-row clickable"
                      onClick={() => jumpToReport("ld-commissions")}
                    >
                      <span>Ladies Drink (LD) Commissions ({(data.ld_commissions_list || []).length} records)</span>
                      <b className="text-bad">−{peso(fin.ld_commissions)}</b>
                    </div>
                    <div className="pnl-row sub">
                      <b>Total Operating Overheads</b>
                      <b className="text-bad">−{peso(fin.total_overheads)}</b>
                    </div>

                    <div
                      className={`pnl-row total ${Number(fin.net_profit || 0) >= 0 ? "positive" : "negative"}`}
                    >
                      <div>
                        <b>Net Operating Income / Profit</b>
                        <div style={{ fontSize: 11, fontWeight: 400 }} className="muted">
                          Net Profit Margin: {Number(fin.net_margin_pct || 0).toFixed(2)}%
                        </div>
                      </div>
                      <b>{peso(fin.net_profit)}</b>
                    </div>
                  </div>
                </div>

                {/* Period-over-Period Comparison Table */}
                <div className="pnl-statement-box">
                  <h3>Period-over-Period Comparison</h3>
                  <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                    Current ({from} → {to}) vs. Previous ({prev.from} → {prev.to})
                  </p>
                  <div className="table-wrap">
                    <table className="data-table compact">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th className="num">Current</th>
                          <th className="num">Previous</th>
                          <th className="num">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Gross Sales", cur: fin.revenue, prv: prev.revenue, cmp: revCompare, money: true },
                          { label: "Completed Orders", cur: fin.orders, prv: prev.orders, cmp: ordersCompare, money: false },
                          { label: "Gross Profit", cur: fin.gross_profit, prv: prev.gross_profit, cmp: grossCompare, money: true },
                          { label: "Store Expenses", cur: fin.expenses, prv: prev.expenses, cmp: pctChange(fin.expenses, prev.expenses), money: true, invertTone: true },
                          { label: "Staff Salaries", cur: fin.salaries, prv: prev.salaries, cmp: pctChange(fin.salaries, prev.salaries), money: true, invertTone: true },
                          { label: "Regular Commissions", cur: fin.commissions, prv: prev.commissions, cmp: pctChange(fin.commissions, prev.commissions), money: true, invertTone: true },
                          { label: "LD Commissions", cur: fin.ld_commissions, prv: prev.ld_commissions, cmp: pctChange(fin.ld_commissions, prev.ld_commissions), money: true, invertTone: true },
                          { label: "Net Operating Profit", cur: fin.net_profit, prv: prev.net_profit, cmp: netCompare, money: true },
                        ].map((row, idx) => {
                          const isGood = row.invertTone ? row.cmp.delta <= 0 : row.cmp.delta >= 0;
                          return (
                            <tr key={idx}>
                              <td><b>{row.label}</b></td>
                              <td className="num">{row.money ? peso(row.cur) : Number(row.cur || 0).toLocaleString()}</td>
                              <td className="num muted">{row.money ? peso(row.prv) : Number(row.prv || 0).toLocaleString()}</td>
                              <td className="num">
                                <StatusBadge
                                  tone={Math.abs(row.cmp.delta) < 0.01 ? "neutral" : isGood ? "ok" : "bad"}
                                  label={`${row.cmp.delta >= 0 ? "+" : ""}${row.cmp.pct.toFixed(1)}%`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Daily Financial Breakdown Table */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ marginBottom: 10 }}>Daily Financial Ledger ({(data.daily || []).length} days)</h3>
                {(data.daily || []).length === 0 ? (
                  <Empty text="No daily ledger activity for the selected period." />
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th className="num">Orders</th>
                          <th className="num">Gross Sales</th>
                          <th className="num">COGS</th>
                          <th className="num">Gross Profit</th>
                          <th className="num">Expenses</th>
                          <th className="num">Salaries</th>
                          <th className="num">Commissions</th>
                          <th className="num">LD Comm</th>
                          <th className="num">Net Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(data.daily || [])].reverse().map((d) => (
                          <tr
                            key={d.day}
                            className="clickable-row"
                            onClick={() => {
                              handleApplyDateRange(d.day, d.day);
                              jumpToReport("sales");
                            }}
                            title={`Click to filter dashboard to ${d.day}`}
                          >
                            <td><b>{d.day}</b></td>
                            <td className="num">{d.orders}</td>
                            <td className="num">{peso(d.revenue)}</td>
                            <td className="num muted">{peso(d.cogs)}</td>
                            <td className="num">{peso(d.gross_profit)}</td>
                            <td className="num">{peso(d.expenses)}</td>
                            <td className="num">{peso(d.salaries)}</td>
                            <td className="num">{peso(d.commissions)}</td>
                            <td className="num">{peso(d.ld_commissions)}</td>
                            <td className="num">
                              <b style={{ color: Number(d.net_profit || 0) >= 0 ? "var(--ok)" : "var(--bad)" }}>
                                {peso(d.net_profit)}
                              </b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 2: SALES & TRANSACTIONS REPORT ── */}
          {reportTab === "sales" && (() => {
            const sorted = sortRows(filteredSales);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            return (
              <div>
                {sorted.length === 0 ? (
                  <Empty text="No sales receipts match your current filter criteria." />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => toggleSort("receipt_no")} className="sortable">
                              Receipt No {renderSortIcon("receipt_no")}
                            </th>
                            <th onClick={() => toggleSort("created_at")} className="sortable">
                              Date & Time {renderSortIcon("created_at")}
                            </th>
                            <th>Items Purchased</th>
                            <th onClick={() => toggleSort("total")} className="sortable num">
                              Total {renderSortIcon("total")}
                            </th>
                            <th className="num">Cash Paid</th>
                            <th className="num">Change</th>
                            <th onClick={() => toggleSort("status")} className="sortable">
                              Status {renderSortIcon("status")}
                            </th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((s) => (
                            <tr key={s.id} className={s.status === "voided" ? "row-voided" : ""}>
                              <td><b>{s.receipt_no}</b></td>
                              <td>{s.created_at}</td>
                              <td className="items-cell">
                                {(s.items || [])
                                  .map((i) => `${i.quantity}× ${i.name}${i.variant_name ? ` (${i.variant_name})` : ""}`)
                                  .join(", ")}
                              </td>
                              <td className="num"><b>{peso(s.total)}</b></td>
                              <td className="num">{peso(s.paid)}</td>
                              <td className="num">{peso(s.change_amt)}</td>
                              <td>
                                <StatusBadge
                                  tone={s.status === "voided" ? "bad" : "ok"}
                                  label={s.status === "voided" ? "VOIDED" : "COMPLETED"}
                                />
                              </td>
                              <td className="actions-col no-print">
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="View & Print Receipt"
                                    onClick={() => setViewingSale(s)}
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Print Thermal Receipt"
                                    onClick={() =>
                                      api
                                        .printReceipt(s.id)
                                        .then(() => toast("Sent to thermal printer"))
                                        .catch((e) => toast(errText(e), "bad"))
                                    }
                                  >
                                    <Printer size={15} />
                                  </button>
                                  {s.status !== "voided" && (
                                    <button
                                      type="button"
                                      className="icon-btn sm danger"
                                      title="Void Receipt & Restore Inventory"
                                      onClick={() => {
                                        setVoidingSale(s);
                                        setVoidReason("");
                                      }}
                                    >
                                      <XCircle size={15} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 3: PRODUCTS & CATALOG CRUD ── */}
          {reportTab === "products" && (() => {
            const sorted = sortRows(filteredProducts);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            return (
              <div>
                {sorted.length === 0 ? (
                  <Empty
                    text="No products match your filter criteria."
                    actionLabel="+ Add New Product"
                    onAction={() =>
                      setEditingProduct({
                        name: "",
                        category: "General",
                        price: 0,
                        cost: 0,
                        stock: 0,
                        low_stock: 5,
                        image: "",
                        variants: [],
                      })
                    }
                  />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col no-print">
                              <input
                                type="checkbox"
                                checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                                onChange={() => toggleSelectAll(paged)}
                                aria-label="Select all products on page"
                              />
                            </th>
                            <th onClick={() => toggleSort("name")} className="sortable">
                              Product {renderSortIcon("name")}
                            </th>
                            <th onClick={() => toggleSort("category")} className="sortable">
                              Category {renderSortIcon("category")}
                            </th>
                            <th onClick={() => toggleSort("price")} className="sortable num">
                              Price {renderSortIcon("price")}
                            </th>
                            <th onClick={() => toggleSort("cost")} className="sortable num">
                              Unit Cost {renderSortIcon("cost")}
                            </th>
                            <th onClick={() => toggleSort("margin_pct")} className="sortable num">
                              Margin {renderSortIcon("margin_pct")}
                            </th>
                            <th onClick={() => toggleSort("stock")} className="sortable num">
                              Stock {renderSortIcon("stock")}
                            </th>
                            <th>Health</th>
                            <th onClick={() => toggleSort("sold_qty")} className="sortable num">
                              Sold (Period) {renderSortIcon("sold_qty")}
                            </th>
                            <th onClick={() => toggleSort("period_revenue")} className="sortable num">
                              Revenue (Period) {renderSortIcon("period_revenue")}
                            </th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((p) => (
                            <tr key={p.id}>
                              <td className="checkbox-col no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(p.id)}
                                  onChange={() => toggleSelectOne(p.id)}
                                />
                              </td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {p.image ? (
                                    <img
                                      src={p.image}
                                      alt=""
                                      style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
                                    />
                                  ) : (
                                    <div className="prod-avatar-mini">{p.name?.slice(0, 2).toUpperCase()}</div>
                                  )}
                                  <div>
                                    <b>{p.name}</b>
                                    {p.variants?.length > 0 && (
                                      <div className="muted" style={{ fontSize: 11 }}>
                                        {p.variants.length} variant(s)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td><StatusBadge tone="neutral" label={p.category || "General"} /></td>
                              <td className="num"><b>{peso(p.price)}</b></td>
                              <td className="num muted">{peso(p.cost)}</td>
                              <td className="num">
                                <span style={{ color: p.margin_pct >= 25 ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>
                                  {Number(p.margin_pct || 0).toFixed(1)}%
                                </span>
                              </td>
                              <td className="num"><b>{p.stock}</b></td>
                              <td>
                                <StatusBadge
                                  tone={p.stock_status === "out" ? "bad" : p.stock_status === "low" ? "warn" : "ok"}
                                  label={
                                    p.stock_status === "out"
                                      ? "OUT OF STOCK"
                                      : p.stock_status === "low"
                                      ? "LOW STOCK"
                                      : "HEALTHY"
                                  }
                                />
                              </td>
                              <td className="num">{p.sold_qty}</td>
                              <td className="num"><b>{peso(p.period_revenue)}</b></td>
                              <td className="actions-col no-print">
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Quick Restock Inventory"
                                    onClick={() =>
                                      setRestockModal({
                                        product: p,
                                        qty: 10,
                                        unitCost: p.cost || 0,
                                        note: "",
                                      })
                                    }
                                  >
                                    <Boxes size={15} color="var(--ok)" />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Edit Product Details"
                                    onClick={() =>
                                      setEditingProduct({
                                        ...p,
                                        variants: p.variants ? [...p.variants] : [],
                                      })
                                    }
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm danger"
                                    title="Archive Product"
                                    onClick={() =>
                                      setConfirmAction({
                                        title: "Archive Product",
                                        message: `Archive "${p.name}" from the active catalog?`,
                                        detail: "Past sales receipts referencing this product will remain intact.",
                                        confirmLabel: "Archive Product",
                                        onConfirm: async () => {
                                          try {
                                            await api.deleteProduct(p.id);
                                            toast(`Archived "${p.name}"`);
                                            setConfirmAction(null);
                                            loadAll(from, to, true);
                                          } catch (e) {
                                            toast(errText(e), "bad");
                                          }
                                        },
                                      })
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 4: EXPENSES CRUD ── */}
          {reportTab === "expenses" && (() => {
            const sorted = sortRows(filteredExpenses);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            const filteredTotal = sorted.reduce((s, e) => s + Number(e.amount || 0), 0);
            return (
              <div>
                <div className="table-summary-strip">
                  <span>Showing <b>{sorted.length}</b> expense entries</span>
                  <span>Filtered Total: <b className="text-bad">{peso(filteredTotal)}</b></span>
                </div>
                {sorted.length === 0 ? (
                  <Empty
                    text="No expense records found for the selected filter."
                    actionLabel="+ Record Store Expense"
                    onAction={() =>
                      setEditingExpense({
                        category: "Supplies",
                        description: "",
                        amount: "",
                        incurred_on: activeBusinessDate || ymd(),
                      })
                    }
                  />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col no-print">
                              <input
                                type="checkbox"
                                checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                                onChange={() => toggleSelectAll(paged)}
                              />
                            </th>
                            <th onClick={() => toggleSort("incurred_on")} className="sortable">
                              Date {renderSortIcon("incurred_on")}
                            </th>
                            <th onClick={() => toggleSort("category")} className="sortable">
                              Category {renderSortIcon("category")}
                            </th>
                            <th onClick={() => toggleSort("description")} className="sortable">
                              Description / Payee {renderSortIcon("description")}
                            </th>
                            <th onClick={() => toggleSort("amount")} className="sortable num">
                              Amount {renderSortIcon("amount")}
                            </th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((e) => (
                            <tr key={e.id}>
                              <td className="checkbox-col no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(e.id)}
                                  onChange={() => toggleSelectOne(e.id)}
                                />
                              </td>
                              <td><b>{e.incurred_on}</b></td>
                              <td><StatusBadge tone="warn" label={e.category} /></td>
                              <td>{e.description || <span className="muted">—</span>}</td>
                              <td className="num"><b>{peso(e.amount)}</b></td>
                              <td className="actions-col no-print">
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Edit Expense"
                                    onClick={() => setEditingExpense({ ...e })}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm danger"
                                    title="Delete Expense"
                                    onClick={() =>
                                      setConfirmAction({
                                        title: "Delete Expense Record",
                                        message: `Delete ${e.category} expense of ${peso(e.amount)} on ${e.incurred_on}?`,
                                        detail: "This deletion will be logged in the Audit Trail.",
                                        confirmLabel: "Delete Expense",
                                        onConfirm: async () => {
                                          try {
                                            await api.deleteExpense(e.id);
                                            toast("Expense deleted");
                                            setConfirmAction(null);
                                            loadAll(from, to, true);
                                          } catch (err) {
                                            toast(errText(err), "bad");
                                          }
                                        },
                                      })
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 5: SALARIES CRUD ── */}
          {reportTab === "salaries" && (() => {
            const sorted = sortRows(filteredSalaries);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            const filteredTotal = sorted.reduce((s, r) => s + Number(r.amount || 0), 0);
            return (
              <div>
                <div className="table-summary-strip">
                  <span>Showing <b>{sorted.length}</b> salary disbursements</span>
                  <span>Filtered Total: <b className="text-info">{peso(filteredTotal)}</b></span>
                </div>
                {sorted.length === 0 ? (
                  <Empty
                    text="No salary records found for the selected filter."
                    actionLabel="+ Record Salary Disbursement"
                    onAction={() =>
                      setEditingSalary({
                        staff_name: employeesList[0]?.name || "",
                        role: employeesList[0]?.role || "",
                        amount: employeesList[0]?.daily_rate || "",
                        note: "",
                        paid_on: activeBusinessDate || ymd(),
                      })
                    }
                  />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col no-print">
                              <input
                                type="checkbox"
                                checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                                onChange={() => toggleSelectAll(paged)}
                              />
                            </th>
                            <th onClick={() => toggleSort("paid_on")} className="sortable">
                              Date Paid {renderSortIcon("paid_on")}
                            </th>
                            <th onClick={() => toggleSort("staff_name")} className="sortable">
                              Staff Member {renderSortIcon("staff_name")}
                            </th>
                            <th onClick={() => toggleSort("role")} className="sortable">
                              Role {renderSortIcon("role")}
                            </th>
                            <th>Notes</th>
                            <th onClick={() => toggleSort("amount")} className="sortable num">
                              Amount {renderSortIcon("amount")}
                            </th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((s) => (
                            <tr key={s.id}>
                              <td className="checkbox-col no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(s.id)}
                                  onChange={() => toggleSelectOne(s.id)}
                                />
                              </td>
                              <td><b>{s.paid_on}</b></td>
                              <td><b>{s.staff_name}</b></td>
                              <td><StatusBadge tone="info" label={s.role || "Staff"} /></td>
                              <td>{s.note || <span className="muted">—</span>}</td>
                              <td className="num"><b>{peso(s.amount)}</b></td>
                              <td className="actions-col no-print">
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Edit Salary Record"
                                    onClick={() => setEditingSalary({ ...s })}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm danger"
                                    title="Delete Salary Record"
                                    onClick={() =>
                                      setConfirmAction({
                                        title: "Delete Salary Record",
                                        message: `Delete salary payment of ${peso(s.amount)} for ${s.staff_name} (${s.paid_on})?`,
                                        detail: "This deletion will be logged in the Audit Trail.",
                                        confirmLabel: "Delete Salary",
                                        onConfirm: async () => {
                                          try {
                                            await api.deleteSalary(s.id);
                                            toast("Salary record deleted");
                                            setConfirmAction(null);
                                            loadAll(from, to, true);
                                          } catch (err) {
                                            toast(errText(err), "bad");
                                          }
                                        },
                                      })
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 6: REGULAR COMMISSIONS CRUD ── */}
          {reportTab === "commissions" && (() => {
            const sorted = sortRows(filteredCommissions);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            const filteredTotal = sorted.reduce((s, r) => s + Number(r.amount || 0), 0);
            return (
              <div>
                <div className="table-summary-strip">
                  <span>Showing <b>{sorted.length}</b> commission records</span>
                  <span>Filtered Total: <b className="text-purple">{peso(filteredTotal)}</b></span>
                </div>
                {sorted.length === 0 ? (
                  <Empty
                    text="No regular commission records found for the selected filter."
                    actionLabel="+ Add Commission Record"
                    onAction={() =>
                      setEditingCommission({
                        staff_name: employeesList[0]?.name || "",
                        commission_type: commissionTypes[0] || "Sales Bonus",
                        amount: "",
                        sales_ref: "",
                        rate_pct: 0,
                        note: "",
                        earned_on: activeBusinessDate || ymd(),
                      })
                    }
                  />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col no-print">
                              <input
                                type="checkbox"
                                checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                                onChange={() => toggleSelectAll(paged)}
                              />
                            </th>
                            <th onClick={() => toggleSort("earned_on")} className="sortable">
                              Date Earned {renderSortIcon("earned_on")}
                            </th>
                            <th onClick={() => toggleSort("staff_name")} className="sortable">
                              Staff Member {renderSortIcon("staff_name")}
                            </th>
                            <th onClick={() => toggleSort("commission_type")} className="sortable">
                              Type {renderSortIcon("commission_type")}
                            </th>
                            <th>Sales Ref</th>
                            <th className="num">Rate %</th>
                            <th>Notes</th>
                            <th onClick={() => toggleSort("amount")} className="sortable num">
                              Amount {renderSortIcon("amount")}
                            </th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((c) => (
                            <tr key={c.id}>
                              <td className="checkbox-col no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(c.id)}
                                  onChange={() => toggleSelectOne(c.id)}
                                />
                              </td>
                              <td><b>{c.earned_on}</b></td>
                              <td><b>{c.staff_name}</b></td>
                              <td><StatusBadge tone="purple" label={c.commission_type} /></td>
                              <td>{c.sales_ref || <span className="muted">—</span>}</td>
                              <td className="num">{c.rate_pct ? `${c.rate_pct}%` : "—"}</td>
                              <td>{c.note || <span className="muted">—</span>}</td>
                              <td className="num"><b>{peso(c.amount)}</b></td>
                              <td className="actions-col no-print">
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Edit Commission"
                                    onClick={() => setEditingCommission({ ...c })}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm danger"
                                    title="Delete Commission"
                                    onClick={() =>
                                      setConfirmAction({
                                        title: "Delete Commission Record",
                                        message: `Delete ${c.commission_type} commission of ${peso(c.amount)} for ${c.staff_name}?`,
                                        detail: "This deletion will be logged in the Audit Trail.",
                                        confirmLabel: "Delete Commission",
                                        onConfirm: async () => {
                                          try {
                                            await api.deleteCommission(c.id);
                                            toast("Commission deleted");
                                            setConfirmAction(null);
                                            loadAll(from, to, true);
                                          } catch (err) {
                                            toast(errText(err), "bad");
                                          }
                                        },
                                      })
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 7: LADIES DRINK (LD) COMMISSIONS CRUD ── */}
          {reportTab === "ld-commissions" && (() => {
            const sorted = sortRows(filteredLdCommissions);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            const totalDrinks = sorted.reduce((s, r) => s + Number(r.quantity || 0), 0);
            const filteredTotal = sorted.reduce((s, r) => s + Number(r.total || 0), 0);
            return (
              <div>
                <div className="table-summary-strip">
                  <span>Showing <b>{sorted.length}</b> LD entries (<b>{totalDrinks}</b> total drinks)</span>
                  <span>Filtered LD Payout: <b className="text-purple">{peso(filteredTotal)}</b></span>
                </div>
                {sorted.length === 0 ? (
                  <Empty
                    text="No Ladies Drink (LD) commission records found for the selected filter."
                    actionLabel="+ Log LD Commission"
                    onAction={() =>
                      setEditingLdCommission({
                        staff_name: employeesList[0]?.name || "",
                        customer_table: "",
                        drink_name: "Ladies Drink",
                        quantity: 1,
                        unit_comm: 50,
                        note: "",
                        earned_on: activeBusinessDate || ymd(),
                      })
                    }
                  />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col no-print">
                              <input
                                type="checkbox"
                                checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                                onChange={() => toggleSelectAll(paged)}
                              />
                            </th>
                            <th onClick={() => toggleSort("earned_on")} className="sortable">
                              Date {renderSortIcon("earned_on")}
                            </th>
                            <th onClick={() => toggleSort("staff_name")} className="sortable">
                              Staff / Server {renderSortIcon("staff_name")}
                            </th>
                            <th>Customer / Table</th>
                            <th>Drink</th>
                            <th onClick={() => toggleSort("quantity")} className="sortable num">
                              Qty {renderSortIcon("quantity")}
                            </th>
                            <th className="num">Rate/Drink</th>
                            <th onClick={() => toggleSort("total")} className="sortable num">
                              Total LD {renderSortIcon("total")}
                            </th>
                            <th>Notes</th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((c) => (
                            <tr key={c.id}>
                              <td className="checkbox-col no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(c.id)}
                                  onChange={() => toggleSelectOne(c.id)}
                                />
                              </td>
                              <td><b>{c.earned_on}</b></td>
                              <td><b>{c.staff_name}</b></td>
                              <td>{c.customer_table || <span className="muted">—</span>}</td>
                              <td><StatusBadge tone="purple" label={c.drink_name || "Ladies Drink"} /></td>
                              <td className="num"><b>{c.quantity}</b></td>
                              <td className="num muted">{peso(c.unit_comm)}</td>
                              <td className="num"><b>{peso(c.total)}</b></td>
                              <td>{c.note || <span className="muted">—</span>}</td>
                              <td className="actions-col no-print">
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Edit LD Commission"
                                    onClick={() => setEditingLdCommission({ ...c })}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm danger"
                                    title="Delete LD Commission"
                                    onClick={() =>
                                      setConfirmAction({
                                        title: "Delete LD Commission",
                                        message: `Delete LD commission (${c.quantity} drinks = ${peso(c.total)}) for ${c.staff_name}?`,
                                        detail: "This deletion will be logged in the Audit Trail.",
                                        confirmLabel: "Delete Record",
                                        onConfirm: async () => {
                                          try {
                                            await api.deleteLdCommission(c.id);
                                            toast("LD Commission deleted");
                                            setConfirmAction(null);
                                            loadAll(from, to, true);
                                          } catch (err) {
                                            toast(errText(err), "bad");
                                          }
                                        },
                                      })
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 8: EMPLOYEES DIRECTORY & COMPENSATION CRUD ── */}
          {reportTab === "employees" && (() => {
            const sorted = sortRows(filteredEmployees);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            return (
              <div>
                {sorted.length === 0 ? (
                  <Empty
                    text="No employees found."
                    actionLabel="+ Add Employee Profile"
                    onAction={() =>
                      setEditingEmployee({
                        name: "",
                        role: "Cashier",
                        contact: "",
                        daily_rate: 500,
                        hired_on: ymd(),
                      })
                    }
                  />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col no-print">
                              <input
                                type="checkbox"
                                checked={paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))}
                                onChange={() => toggleSelectAll(paged)}
                              />
                            </th>
                            <th onClick={() => toggleSort("name")} className="sortable">
                              Employee Name {renderSortIcon("name")}
                            </th>
                            <th onClick={() => toggleSort("role")} className="sortable">
                              Role {renderSortIcon("role")}
                            </th>
                            <th>Contact</th>
                            <th onClick={() => toggleSort("daily_rate")} className="sortable num">
                              Daily Rate {renderSortIcon("daily_rate")}
                            </th>
                            <th onClick={() => toggleSort("salary_total")} className="sortable num">
                              Salaries (Period) {renderSortIcon("salary_total")}
                            </th>
                            <th onClick={() => toggleSort("commission_total")} className="sortable num">
                              Reg Comm (Period) {renderSortIcon("commission_total")}
                            </th>
                            <th onClick={() => toggleSort("ld_total")} className="sortable num">
                              LD Comm (Period) {renderSortIcon("ld_total")}
                            </th>
                            <th onClick={() => toggleSort("total_payout")} className="sortable num">
                              Total Payout {renderSortIcon("total_payout")}
                            </th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((emp) => (
                            <tr key={emp.id}>
                              <td className="checkbox-col no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(emp.id)}
                                  onChange={() => toggleSelectOne(emp.id)}
                                />
                              </td>
                              <td><b>{emp.name}</b></td>
                              <td><StatusBadge tone="info" label={emp.role || "Staff"} /></td>
                              <td>{emp.contact || <span className="muted">—</span>}</td>
                              <td className="num">{peso(emp.daily_rate)}</td>
                              <td className="num">{peso(emp.salary_total)}</td>
                              <td className="num">{peso(emp.commission_total)}</td>
                              <td className="num">
                                {peso(emp.ld_total)}
                                {emp.ld_drinks > 0 && (
                                  <span className="muted" style={{ fontSize: 11 }}> ({emp.ld_drinks})</span>
                                )}
                              </td>
                              <td className="num"><b>{peso(emp.total_payout)}</b></td>
                              <td className="actions-col no-print">
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Pay Salary to Employee"
                                    onClick={() =>
                                      setEditingSalary({
                                        staff_name: emp.name,
                                        role: emp.role || "",
                                        amount: emp.daily_rate || "",
                                        note: "Regular daily rate",
                                        paid_on: activeBusinessDate || ymd(),
                                      })
                                    }
                                  >
                                    <Wallet size={15} color="var(--ok)" />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm"
                                    title="Edit Employee Profile"
                                    onClick={() => setEditingEmployee({ ...emp })}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn sm danger"
                                    title="Archive Employee"
                                    onClick={() =>
                                      setConfirmAction({
                                        title: "Archive Employee Profile",
                                        message: `Archive employee "${emp.name}"?`,
                                        detail: "Historical salary and commission payouts for this employee will remain preserved.",
                                        confirmLabel: "Archive Employee",
                                        onConfirm: async () => {
                                          try {
                                            await api.deleteEmployee(emp.id);
                                            toast(`Archived ${emp.name}`);
                                            setConfirmAction(null);
                                            loadAll(from, to, true);
                                          } catch (err) {
                                            toast(errText(err), "bad");
                                          }
                                        },
                                      })
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 9: SHIFT AUDIT & Z-READINGS ── */}
          {reportTab === "shifts" && (() => {
            const sorted = sortRows(filteredShifts);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            return (
              <div>
                {sorted.length === 0 ? (
                  <Empty text="No shift reconciliation records match your filter." />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => toggleSort("business_date")} className="sortable">
                              Business Date {renderSortIcon("business_date")}
                            </th>
                            <th>Opened By</th>
                            <th>Closed By</th>
                            <th className="num">Opening Float</th>
                            <th className="num">Expected Cash</th>
                            <th className="num">Closing Count</th>
                            <th className="num">Variance</th>
                            <th>Audit Status</th>
                            <th>Notes</th>
                            <th className="actions-col no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((s) => {
                            const v = Number(s.variance || 0);
                            const isOpen = s.status === "open";
                            return (
                              <tr key={s.id}>
                                <td><b>{s.business_date}</b></td>
                                <td>
                                  {s.opened_by}
                                  <div className="muted" style={{ fontSize: 11 }}>{s.opened_at}</div>
                                </td>
                                <td>
                                  {isOpen ? (
                                    <span className="muted">Still Open</span>
                                  ) : (
                                    <>
                                      {s.closed_by || "—"}
                                      <div className="muted" style={{ fontSize: 11 }}>{s.closed_at}</div>
                                    </>
                                  )}
                                </td>
                                <td className="num">{peso(s.opening_cash)}</td>
                                <td className="num"><b>{peso(s.expected_cash)}</b></td>
                                <td className="num">
                                  {isOpen ? <span className="muted">—</span> : <b>{peso(s.closing_cash)}</b>}
                                </td>
                                <td className="num">
                                  {isOpen ? (
                                    <span className="muted">—</span>
                                  ) : (
                                    <b style={{ color: Math.abs(v) < 0.01 ? "var(--ok)" : v > 0 ? "var(--info)" : "var(--bad)" }}>
                                      {v >= 0 ? `+${peso(v)}` : peso(v)}
                                    </b>
                                  )}
                                </td>
                                <td>
                                  {isOpen ? (
                                    <StatusBadge tone="warn" label="SHIFT OPEN" />
                                  ) : Math.abs(v) < 0.01 ? (
                                    <StatusBadge tone="ok" label="BALANCED" />
                                  ) : v > 0 ? (
                                    <StatusBadge tone="info" label="OVERAGE" />
                                  ) : (
                                    <StatusBadge tone="bad" label="SHORTAGE" />
                                  )}
                                </td>
                                <td>{s.notes || <span className="muted">—</span>}</td>
                                <td className="actions-col no-print">
                                  <div className="row-actions">
                                    <button
                                      type="button"
                                      className="icon-btn sm"
                                      title="Inspect Z-Reading & Edit Audit Notes"
                                      onClick={() => {
                                        setViewingShift(s);
                                        setShiftNotesDraft(s.notes || "");
                                      }}
                                    >
                                      <Eye size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}

          {/* ── TAB 10: ACTIVITY & AUDIT TRAIL REPORT ── */}
          {reportTab === "audit" && (() => {
            const sorted = sortRows(filteredAudit);
            const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
            return (
              <div>
                <div className="table-summary-strip">
                  <span>
                    <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                    Immutable Audit Trail — Historical records cannot be deleted or tampered with.
                  </span>
                  <span><b>{sorted.length}</b> events</span>
                </div>
                {sorted.length === 0 ? (
                  <Empty text="No audit trail events match your search in this date range." />
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => toggleSort("timestamp")} className="sortable">
                              Timestamp {renderSortIcon("timestamp")}
                            </th>
                            <th onClick={() => toggleSort("actor")} className="sortable">
                              Actor {renderSortIcon("actor")}
                            </th>
                            <th onClick={() => toggleSort("action")} className="sortable">
                              Action {renderSortIcon("action")}
                            </th>
                            <th onClick={() => toggleSort("entity_type")} className="sortable">
                              Module {renderSortIcon("entity_type")}
                            </th>
                            <th>Summary Description</th>
                            <th className="actions-col no-print">Inspect</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((a) => (
                            <tr key={a.id}>
                              <td><b>{a.timestamp}</b></td>
                              <td>
                                {a.actor}{" "}
                                <span className="muted" style={{ fontSize: 11 }}>({a.role})</span>
                              </td>
                              <td>
                                <StatusBadge
                                  tone={
                                    a.action === "VOID" || a.action === "DELETE" || a.action === "RESET"
                                      ? "bad"
                                      : a.action === "CREATE" || a.action === "SALE" || a.action === "RESTOCK"
                                      ? "ok"
                                      : a.action === "UPDATE"
                                      ? "warn"
                                      : "info"
                                  }
                                  label={a.action}
                                />
                              </td>
                              <td><StatusBadge tone="neutral" label={a.entity_type} /></td>
                              <td>{a.summary}</td>
                              <td className="actions-col no-print">
                                <button
                                  type="button"
                                  className="icon-btn sm"
                                  title="Inspect Payload Details"
                                  onClick={() => setViewingAuditItem(a)}
                                >
                                  <Eye size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      totalItems={sorted.length}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                    />
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ══════════════ CRUD & DETAIL MODALS ══════════════ */}

      {/* 1. Product Create / Edit Modal */}
      {editingProduct && (
        <Modal
          title={editingProduct.id ? `Edit Product — ${editingProduct.name}` : "Add New Product to Catalog"}
          onClose={() => setEditingProduct(null)}
        >
          <form className="form" onSubmit={handleSaveProduct}>
            <Field label="Product Name *">
              <input
                required
                autoFocus
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                placeholder="e.g. San Miguel Pale Pilsen"
              />
            </Field>
            <div className="row">
              <Field label="Category">
                <input
                  list="admin-cat-list"
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  placeholder="General"
                />
                <datalist id="admin-cat-list">
                  {allProductCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Low-Stock Alert Threshold">
                <input
                  type="number"
                  min="0"
                  value={editingProduct.low_stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, low_stock: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Selling Price (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                />
              </Field>
              <Field label="Unit Cost / COGS (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingProduct.cost}
                  onChange={(e) => setEditingProduct({ ...editingProduct, cost: e.target.value })}
                />
              </Field>
              <Field label="Current Stock">
                <input
                  type="number"
                  value={editingProduct.stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })}
                />
              </Field>
            </div>

            {/* Variants Editor */}
            <Field label="Price Variants (Optional)">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(editingProduct.variants || []).map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      style={{ flex: 2 }}
                      placeholder="Variant name (e.g. Bucket, Grande)"
                      value={v.name}
                      onChange={(e) => {
                        const next = [...editingProduct.variants];
                        next[i] = { ...next[i], name: e.target.value };
                        setEditingProduct({ ...editingProduct, variants: next });
                      }}
                    />
                    <input
                      style={{ flex: 1 }}
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={v.price}
                      onChange={(e) => {
                        const next = [...editingProduct.variants];
                        next[i] = { ...next[i], price: e.target.value };
                        setEditingProduct({ ...editingProduct, variants: next });
                      }}
                    />
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() =>
                        setEditingProduct({
                          ...editingProduct,
                          variants: editingProduct.variants.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() =>
                    setEditingProduct({
                      ...editingProduct,
                      variants: [...(editingProduct.variants || []), { name: "", price: editingProduct.price || 0 }],
                    })
                  }
                >
                  <Plus size={14} /> Add Variant
                </button>
              </div>
            </Field>

            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingProduct(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Product
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Quick Restock Modal */}
      {restockModal && (
        <Modal
          title={`Restock Inventory — ${restockModal.product.name}`}
          onClose={() => setRestockModal(null)}
        >
          <form className="form" onSubmit={handleRestockSubmit}>
            <div className="alert-banner info">
              <Boxes size={18} />
              <div>
                Current Stock: <b>{restockModal.product.stock}</b> units • Current Unit Cost:{" "}
                <b>{peso(restockModal.product.cost)}</b>
              </div>
            </div>
            <div className="row">
              <Field label="Quantity to Add (+)*">
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={restockModal.qty}
                  onChange={(e) => setRestockModal({ ...restockModal, qty: e.target.value })}
                />
              </Field>
              <Field label="Supplier Unit Cost (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={restockModal.unitCost}
                  onChange={(e) => setRestockModal({ ...restockModal, unitCost: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Delivery / Restock Note">
              <input
                value={restockModal.note}
                onChange={(e) => setRestockModal({ ...restockModal, note: e.target.value })}
                placeholder="e.g. Supplier delivery invoice #104"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setRestockModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Confirm Restock (+{restockModal.qty || 0})
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Expense Create / Edit Modal */}
      {editingExpense && (
        <Modal
          title={editingExpense.id ? "Edit Store Expense" : "Record Store Expense"}
          onClose={() => setEditingExpense(null)}
        >
          <form className="form" onSubmit={handleSaveExpense}>
            <div className="row">
              <Field label="Expense Category *">
                <select
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date Incurred *">
                <input
                  type="date"
                  required
                  value={editingExpense.incurred_on}
                  onChange={(e) => setEditingExpense({ ...editingExpense, incurred_on: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Amount (₱) *">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                value={editingExpense.amount}
                onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Description / Payee / Reference">
              <input
                value={editingExpense.description}
                onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                placeholder="e.g. Meralco electric bill, Ice delivery"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingExpense(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Expense
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Salary Create / Edit Modal */}
      {editingSalary && (
        <Modal
          title={editingSalary.id ? "Edit Salary Record" : "Record Staff Salary"}
          onClose={() => setEditingSalary(null)}
        >
          <form className="form" onSubmit={handleSaveSalary}>
            <div className="row">
              <Field label="Staff Member *">
                <input
                  list="admin-staff-list"
                  required
                  autoFocus
                  value={editingSalary.staff_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const emp = employeesList.find((x) => x.name.toLowerCase() === name.toLowerCase());
                    setEditingSalary({
                      ...editingSalary,
                      staff_name: name,
                      role: emp?.role || editingSalary.role,
                      amount: !editingSalary.id && emp?.daily_rate ? emp.daily_rate : editingSalary.amount,
                    });
                  }}
                  placeholder="Select or type staff name"
                />
                <datalist id="admin-staff-list">
                  {employeesList.map((e) => (
                    <option key={e.id} value={e.name}>{e.role}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Role">
                <input
                  value={editingSalary.role}
                  onChange={(e) => setEditingSalary({ ...editingSalary, role: e.target.value })}
                  placeholder="e.g. Cashier, Server, Cook"
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Salary Amount (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingSalary.amount}
                  onChange={(e) => setEditingSalary({ ...editingSalary, amount: e.target.value })}
                />
              </Field>
              <Field label="Date Paid *">
                <input
                  type="date"
                  required
                  value={editingSalary.paid_on}
                  onChange={(e) => setEditingSalary({ ...editingSalary, paid_on: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Payroll Notes">
              <input
                value={editingSalary.note}
                onChange={(e) => setEditingSalary({ ...editingSalary, note: e.target.value })}
                placeholder="e.g. Full shift payout + overtime"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingSalary(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Salary Record
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Regular Commission Create / Edit Modal */}
      {editingCommission && (
        <Modal
          title={editingCommission.id ? "Edit Commission Record" : "Record Staff Commission"}
          onClose={() => setEditingCommission(null)}
        >
          <form className="form" onSubmit={handleSaveCommission}>
            <div className="row">
              <Field label="Staff Member *">
                <input
                  list="admin-staff-list"
                  required
                  autoFocus
                  value={editingCommission.staff_name}
                  onChange={(e) => setEditingCommission({ ...editingCommission, staff_name: e.target.value })}
                />
              </Field>
              <Field label="Commission Type *">
                <select
                  value={editingCommission.commission_type}
                  onChange={(e) => setEditingCommission({ ...editingCommission, commission_type: e.target.value })}
                >
                  {commissionTypes.map((ct) => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="row">
              <Field label="Commission Amount (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingCommission.amount}
                  onChange={(e) => setEditingCommission({ ...editingCommission, amount: e.target.value })}
                />
              </Field>
              <Field label="Date Earned *">
                <input
                  type="date"
                  required
                  value={editingCommission.earned_on}
                  onChange={(e) => setEditingCommission({ ...editingCommission, earned_on: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Sales / Table Reference">
                <input
                  value={editingCommission.sales_ref}
                  onChange={(e) => setEditingCommission({ ...editingCommission, sales_ref: e.target.value })}
                  placeholder="Optional receipt or VIP table ref"
                />
              </Field>
              <Field label="Rate (%)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editingCommission.rate_pct}
                  onChange={(e) => setEditingCommission({ ...editingCommission, rate_pct: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <input
                value={editingCommission.note}
                onChange={(e) => setEditingCommission({ ...editingCommission, note: e.target.value })}
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingCommission(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Commission
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. LD Commission Create / Edit Modal */}
      {editingLdCommission && (
        <Modal
          title={editingLdCommission.id ? "Edit LD Commission" : "Record Ladies Drink (LD) Commission"}
          onClose={() => setEditingLdCommission(null)}
        >
          <form className="form" onSubmit={handleSaveLdCommission}>
            <div className="row">
              <Field label="Staff / Server Name *">
                <input
                  list="admin-staff-list"
                  required
                  autoFocus
                  value={editingLdCommission.staff_name}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, staff_name: e.target.value })}
                />
              </Field>
              <Field label="Date Earned *">
                <input
                  type="date"
                  required
                  value={editingLdCommission.earned_on}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, earned_on: e.target.value })}
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Customer / Table">
                <input
                  value={editingLdCommission.customer_table}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, customer_table: e.target.value })}
                  placeholder="e.g. VIP 2, Table 5"
                />
              </Field>
              <Field label="Drink Name">
                <input
                  value={editingLdCommission.drink_name}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, drink_name: e.target.value })}
                  placeholder="Ladies Drink"
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Number of Drinks (Qty) *">
                <input
                  type="number"
                  min="1"
                  required
                  value={editingLdCommission.quantity}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, quantity: e.target.value })}
                />
              </Field>
              <Field label="Commission per Drink (₱) *">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={editingLdCommission.unit_comm}
                  onChange={(e) => setEditingLdCommission({ ...editingLdCommission, unit_comm: e.target.value })}
                />
              </Field>
              <Field label="Auto-Calculated Total">
                <input
                  disabled
                  value={peso(Number(editingLdCommission.quantity || 0) * Number(editingLdCommission.unit_comm || 0))}
                />
              </Field>
            </div>
            <Field label="Notes">
              <input
                value={editingLdCommission.note}
                onChange={(e) => setEditingLdCommission({ ...editingLdCommission, note: e.target.value })}
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingLdCommission(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save LD Commission
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Employee Create / Edit Modal */}
      {editingEmployee && (
        <Modal
          title={editingEmployee.id ? `Edit Employee — ${editingEmployee.name}` : "Add New Employee"}
          onClose={() => setEditingEmployee(null)}
        >
          <form className="form" onSubmit={handleSaveEmployee}>
            <Field label="Full Name *">
              <input
                required
                autoFocus
                value={editingEmployee.name}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                placeholder="e.g. Maria Santos"
              />
            </Field>
            <div className="row">
              <Field label="Role / Designation">
                <input
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  placeholder="e.g. Cashier, Server, Manager"
                />
              </Field>
              <Field label="Contact Number">
                <input
                  value={editingEmployee.contact}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, contact: e.target.value })}
                  placeholder="09XX-XXX-XXXX"
                />
              </Field>
            </div>
            <div className="row">
              <Field label="Default Daily Rate (₱)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingEmployee.daily_rate}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, daily_rate: e.target.value })}
                />
              </Field>
              <Field label="Date Hired">
                <input
                  type="date"
                  value={editingEmployee.hired_on}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, hired_on: e.target.value })}
                />
              </Field>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditingEmployee(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save Employee
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 8. View Receipt Modal */}
      {viewingSale && (
        <Modal title={`Receipt ${viewingSale.receipt_no}`} onClose={() => setViewingSale(null)}>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
            <Receipt sale={viewingSale} settings={settings} />
          </div>
          <div className="modal-foot">
            {viewingSale.status !== "voided" && (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  const sale = viewingSale;
                  setViewingSale(null);
                  setVoidingSale(sale);
                  setVoidReason("");
                }}
              >
                <XCircle size={15} /> Void Receipt
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Browser Print
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                api
                  .printReceipt(viewingSale.id)
                  .then(() => toast("Printed receipt"))
                  .catch((e) => toast(errText(e), "bad"))
              }
            >
              <Printer size={15} /> Thermal Print
            </button>
          </div>
        </Modal>
      )}

      {/* 9. Void Sale Confirmation Modal */}
      {voidingSale && (
        <Modal title={`Void Receipt ${voidingSale.receipt_no}`} onClose={() => setVoidingSale(null)}>
          <form className="form" onSubmit={handleVoidSaleSubmit}>
            <div className="alert-banner bad">
              <AlertTriangle size={18} />
              <div>
                Voiding <b>{voidingSale.receipt_no}</b> ({peso(voidingSale.total)}) will return all sold items back to stock and record a permanent audit entry.
              </div>
            </div>
            <Field label="Reason for Voiding *">
              <input
                required
                autoFocus
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer changed order, wrong item punched"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setVoidingSale(null)}>
                Cancel
              </button>
              <button type="submit" className="btn danger">
                Confirm Void & Restore Stock
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 10. Shift Z-Reading & Audit Notes Modal */}
      {viewingShift && (
        <Modal
          title={`Shift Z-Reading & Audit — ${viewingShift.business_date}`}
          onClose={() => setViewingShift(null)}
        >
          <form className="form" onSubmit={handleSaveShiftNotes}>
            <div className="pnl-table" style={{ marginBottom: 12 }}>
              <div className="pnl-row">
                <span>Business Date</span>
                <b>{viewingShift.business_date}</b>
              </div>
              <div className="pnl-row">
                <span>Opened By</span>
                <span>{viewingShift.opened_by} ({viewingShift.opened_at})</span>
              </div>
              <div className="pnl-row">
                <span>Closed By</span>
                <span>{viewingShift.closed_by || "Open Shift"} ({viewingShift.closed_at || "—"})</span>
              </div>
              <div className="pnl-row">
                <span>Opening Drawer Float</span>
                <b>{peso(viewingShift.opening_cash)}</b>
              </div>
              <div className="pnl-row">
                <span>Expected Drawer Cash</span>
                <b>{peso(viewingShift.expected_cash)}</b>
              </div>
              <div className="pnl-row">
                <span>Counted Closing Cash</span>
                <b>{viewingShift.closing_cash !== null && viewingShift.closing_cash !== undefined ? peso(viewingShift.closing_cash) : "—"}</b>
              </div>
              <div className="pnl-row highlight">
                <b>Drawer Variance</b>
                <b
                  style={{
                    color:
                      Number(viewingShift.variance || 0) < 0
                        ? "var(--bad)"
                        : "var(--ok)",
                  }}
                >
                  {viewingShift.variance !== null && viewingShift.variance !== undefined
                    ? peso(viewingShift.variance)
                    : "—"}
                </b>
              </div>
            </div>

            <Field label="Shift Audit Notes">
              <input
                value={shiftNotesDraft}
                onChange={(e) => setShiftNotesDraft(e.target.value)}
                placeholder="Add administrative audit notes for this shift"
              />
            </Field>

            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => window.print()}>
                <Printer size={15} /> Print Z-Reading
              </button>
              <button type="submit" className="btn primary">
                Save Audit Notes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 11. Audit Log Detail Modal */}
      {viewingAuditItem && (
        <Modal
          title={`Audit Event #${viewingAuditItem.id} — ${viewingAuditItem.action}`}
          onClose={() => setViewingAuditItem(null)}
        >
          <div className="form">
            <div className="pnl-table">
              <div className="pnl-row">
                <span>Timestamp</span>
                <b>{viewingAuditItem.timestamp}</b>
              </div>
              <div className="pnl-row">
                <span>Actor & Role</span>
                <b>{viewingAuditItem.actor} ({viewingAuditItem.role})</b>
              </div>
              <div className="pnl-row">
                <span>Action & Module</span>
                <span>
                  <StatusBadge tone="info" label={viewingAuditItem.action} />{" "}
                  <StatusBadge tone="neutral" label={viewingAuditItem.entity_type} />
                </span>
              </div>
              <div className="pnl-row">
                <span>Record ID</span>
                <b>{viewingAuditItem.entity_id || "—"}</b>
              </div>
              <div className="pnl-row">
                <span>Summary</span>
                <b>{viewingAuditItem.summary}</b>
              </div>
            </div>
            <Field label="JSON Snapshot / Before & After Payload">
              <pre className="audit-json-pre">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(viewingAuditItem.details_json || "{}"), null, 2);
                  } catch {
                    return viewingAuditItem.details_json || "{}";
                  }
                })()}
              </pre>
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn primary" onClick={() => setViewingAuditItem(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 12. Add Commission Type Modal */}
      {showAddCommType && (
        <Modal title="Add New Commission Category" onClose={() => setShowAddCommType(false)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCommTypeName.trim()) return;
              try {
                const list = await api.addCommissionType(newCommTypeName.trim());
                setCommissionTypes(list || []);
                setNewCommTypeName("");
                setShowAddCommType(false);
                toast("Commission category added");
              } catch (err) {
                toast(errText(err), "bad");
              }
            }}
          >
            <Field label="Commission Type Name *">
              <input
                required
                autoFocus
                value={newCommTypeName}
                onChange={(e) => setNewCommTypeName(e.target.value)}
                placeholder="e.g. VIP Bottle Service, Acoustic Tip"
              />
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setShowAddCommType(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Add Category
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 13. Destructive Action Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          detail={confirmAction.detail}
          confirmLabel={confirmAction.confirmLabel}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
