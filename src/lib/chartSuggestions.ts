import { Column, ChartConfig, ChartType, DataSource } from "./types";
import { CHART_COLORS, genId } from "./utils";

interface SuggestionRule {
  label: string;
  chartType: ChartType;
  condition: (cols: Column[]) => { xKey?: string; yKeys: string[] } | null;
  priority: number;
}

const rules: SuggestionRule[] = [
  // ── Numeric over categorical / date ─────────────────────────────────────────
  {
    label: "Bar Chart",
    chartType: "bar",
    priority: 10,
    condition: (cols) => {
      const cat = cols.find((c) => c.type === "string" || c.type === "date");
      const nums = cols.filter((c) => c.type === "number" || c.type === "percent");
      if (!cat || nums.length === 0) return null;
      return { xKey: cat.key, yKeys: nums.slice(0, 3).map((c) => c.key) };
    },
  },
  {
    label: "Horizontal Bar",
    chartType: "horizontalBar",
    priority: 9,
    condition: (cols) => {
      const cat = cols.find((c) => c.type === "string");
      const nums = cols.filter((c) => c.type === "number" || c.type === "percent");
      if (!cat || nums.length === 0) return null;
      return { xKey: cat.key, yKeys: [nums[0].key] };
    },
  },
  {
    label: "Line Chart",
    chartType: "line",
    priority: 9,
    condition: (cols) => {
      const datCol = cols.find((c) => c.type === "date");
      const nums = cols.filter((c) => c.type === "number" || c.type === "percent");
      if (!datCol || nums.length === 0) return null;
      return { xKey: datCol.key, yKeys: nums.slice(0, 3).map((c) => c.key) };
    },
  },
  {
    label: "Area Chart",
    chartType: "area",
    priority: 8,
    condition: (cols) => {
      const datCol = cols.find((c) => c.type === "date");
      const nums = cols.filter((c) => c.type === "number" || c.type === "percent");
      if (!datCol || nums.length < 1) return null;
      return { xKey: datCol.key, yKeys: nums.slice(0, 2).map((c) => c.key) };
    },
  },
  {
    label: "Pie Chart",
    chartType: "pie",
    priority: 7,
    condition: (cols) => {
      const cat = cols.find((c) => c.type === "string");
      const num = cols.find((c) => c.type === "number" || c.type === "percent");
      if (!cat || !num) return null;
      return { xKey: cat.key, yKeys: [num.key] };
    },
  },
  {
    label: "Donut Chart",
    chartType: "donut",
    priority: 7,
    condition: (cols) => {
      const cat = cols.find((c) => c.type === "string");
      const num = cols.find((c) => c.type === "number" || c.type === "percent");
      if (!cat || !num) return null;
      return { xKey: cat.key, yKeys: [num.key] };
    },
  },
  {
    label: "Scatter Plot",
    chartType: "scatter",
    priority: 6,
    condition: (cols) => {
      const nums = cols.filter((c) => c.type === "number");
      if (nums.length < 2) return null;
      return { xKey: nums[0].key, yKeys: [nums[1].key] };
    },
  },
  {
    label: "Data Table",
    chartType: "table",
    priority: 5,
    condition: (cols) => {
      if (cols.length < 2) return null;
      return { yKeys: cols.map((c) => c.key) };
    },
  },
];

export function generateChartSuggestions(source: DataSource): ChartConfig[] {
  const suggestions: ChartConfig[] = [];

  // Apply rules
  for (const rule of rules.sort((a, b) => b.priority - a.priority)) {
    const result = rule.condition(source.columns);
    if (!result) continue;

    const numericCols = result.yKeys;
    const colors = numericCols.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    // Generate title from keys
    const yLabels = result.yKeys
      .map((k) => source.columns.find((c) => c.key === k)?.label ?? k)
      .join(" & ");
    const xLabel = result.xKey
      ? source.columns.find((c) => c.key === result.xKey)?.label ?? result.xKey
      : "";

    suggestions.push({
      id: genId("chart"),
      type: rule.chartType,
      title: xLabel ? `${yLabels} by ${xLabel}` : yLabels,
      description: `${rule.label} showing ${yLabels}${xLabel ? ` by ${xLabel}` : ""}`,
      dataSourceId: source.id,
      xKey: result.xKey,
      yKeys: result.yKeys,
      colors,
      showLegend: result.yKeys.length > 1,
      showGrid: true,
    });

    // Also generate per-column variants for bar/line if multiple numeric cols
    if (
      (rule.chartType === "bar" || rule.chartType === "line") &&
      result.yKeys.length > 1
    ) {
      for (let i = 0; i < Math.min(result.yKeys.length, 4); i++) {
        const k = result.yKeys[i];
        const label = source.columns.find((c) => c.key === k)?.label ?? k;
        suggestions.push({
          id: genId("chart"),
          type: rule.chartType,
          title: xLabel ? `${label} by ${xLabel}` : label,
          description: `${rule.label}: ${label}`,
          dataSourceId: source.id,
          xKey: result.xKey,
          yKeys: [k],
          colors: [CHART_COLORS[i % CHART_COLORS.length]],
          showLegend: false,
          showGrid: true,
        });
      }
    }
  }

  // Generate stat cards for each numeric column
  for (const col of source.columns.filter(
    (c) => c.type === "number" || c.type === "percent"
  )) {
    const values = source.rows
      .map((r) => r[col.key])
      .filter((v) => v !== null && !isNaN(Number(v)))
      .map(Number);

    if (values.length === 0) continue;

    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const max = Math.max(...values);

    suggestions.push({
      id: genId("stat"),
      type: "stat",
      title: `Total ${col.label}`,
      dataSourceId: source.id,
      yKeys: [col.key],
      colors: [CHART_COLORS[0]],
      showLegend: false,
      showGrid: false,
    });
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.title)) return false;
    seen.add(s.title);
    return true;
  });
}
