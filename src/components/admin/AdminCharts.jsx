import { useMemo, useState } from "react";
import {
  TrendingUp,
  PieChart as PieChartIcon,
  CheckCircle2,
  BarChart3,
  Clock,
  Calendar,
} from "lucide-react";
import { Empty, StatusBadge } from "../ui";
import { peso, pesoShort } from "../../utils";
import { CHART_COLORS, aggregateDailySeries } from "./adminUtils";

export function InteractiveTrendChart({
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

export function InteractiveDoughnutChart({
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

export function AdminChartsSection({
  data,
  categoryFilter,
  jumpToReport,
}) {
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
  const [doughnutMode, setDoughnutMode] = useState("category");
  const [statusChartMode, setStatusChartMode] = useState("sales");
  const [comparativeMode, setComparativeMode] = useState("products");
  const [comparativeMetric, setComparativeMetric] = useState("value");

  const fin = data?.financials || {};
  const prev = data?.previous_period || {};
  const counts = data?.counts || {};

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
    return [
      { name: "Cost of Goods (COGS)", value: Number(fin.cogs || 0), color: "#38bdf8", target: "products" },
      { name: "Store Expenses", value: Number(fin.expenses || 0), color: "#f5b83d", target: "expenses" },
      { name: "Staff Salaries", value: Number(fin.salaries || 0), color: "#a855f7", target: "salaries" },
      { name: "Regular Commissions", value: Number(fin.commissions || 0), color: "#14b8a6", target: "commissions" },
      { name: "LD Commissions", value: Number(fin.ld_commissions || 0), color: "#ec4899", target: "ld-commissions" },
    ].filter((i) => i.value > 0);
  }, [data, doughnutMode, fin]);

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

  if (!data) return null;

  return (
    <section className="analytics-charts-section no-print" aria-label="Interactive Visualizations">
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
  );
}
