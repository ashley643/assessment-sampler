"use client";

import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartConfig, Column, DataSource } from "@/lib/types";
import { parseNumber, formatValue } from "@/lib/utils";

interface ChartRendererProps {
  config: ChartConfig;
  dataSource: DataSource;
  height?: number;
  compact?: boolean;
}

export default function ChartRenderer({
  config,
  dataSource,
  height = 220,
  compact = false,
}: ChartRendererProps) {
  const { type, xKey, yKeys, colors, showLegend, showGrid } = config;

  // Prepare chart data
  const data = dataSource.rows.map((row) => {
    const entry: Record<string, string | number | null> = {};
    if (xKey) entry[xKey] = row[xKey] ?? "";
    for (const y of yKeys) {
      entry[y] = parseNumber(row[y]);
    }
    return entry;
  });

  const xLabel = xKey
    ? dataSource.columns.find((c) => c.key === xKey)?.label ?? xKey
    : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any, name: any) => {
    const col = dataSource.columns.find((c: Column) => c.key === name);
    return [formatValue(value, col?.type), col?.label ?? name];
  };

  const commonProps = {
    data,
    margin: compact
      ? { top: 4, right: 8, bottom: 4, left: 0 }
      : { top: 8, right: 16, bottom: 8, left: 0 },
  };

  const axisStyle = { fontSize: compact ? 9 : 11, fill: "#64748b" };
  const gridProps = showGrid
    ? { strokeDasharray: "3 3", stroke: "#e2e8f0" }
    : { strokeDasharray: "3 3", stroke: "transparent" };

  if (type === "stat") {
    // Compute aggregate stats
    const colKey = yKeys[0];
    const col = dataSource.columns.find((c) => c.key === colKey);
    const values = dataSource.rows
      .map((r) => parseNumber(r[colKey]))
      .filter((v) => !isNaN(v));
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;
    const max = values.length ? Math.max(...values) : 0;

    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-2">
        <div className="text-center">
          <div
            className="text-3xl font-bold"
            style={{ color: colors[0] }}
          >
            {formatValue(total, col?.type)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total {col?.label ?? colKey}</div>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <div className="text-sm font-semibold text-slate-700">
              {formatValue(avg, col?.type)}
            </div>
            <div className="text-xs text-slate-400">Avg</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-700">
              {formatValue(max, col?.type)}
            </div>
            <div className="text-xs text-slate-400">Max</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-700">{values.length}</div>
            <div className="text-xs text-slate-400">Count</div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "table") {
    const visibleCols = yKeys.slice(0, 5);
    const visibleRows = data.slice(0, compact ? 5 : 10);
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {visibleCols.map((k) => (
                <th
                  key={k}
                  className="text-left p-1.5 border-b border-slate-200 font-semibold text-slate-600 bg-slate-50"
                >
                  {dataSource.columns.find((c) => c.key === k)?.label ?? k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {visibleCols.map((k) => (
                  <td key={k} className="p-1.5 border-b border-slate-100 text-slate-700">
                    {String(row[k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "pie" || type === "donut") {
    const pieData = data
      .map((d) => ({
        name: String(d[xKey!] ?? ""),
        value: parseNumber(d[yKeys[0]]),
      }))
      .filter((d) => d.value > 0)
      .slice(0, 8);

    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={type === "donut" ? "55%" : "0%"}
            outerRadius="70%"
            paddingAngle={2}
            dataKey="value"
          >
            {pieData.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip formatter={tooltipFormatter} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: compact ? 9 : 11 }}
              iconType="circle"
              iconSize={8}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey={xKey}
            type="number"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill={colors[0]} fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line" || type === "area") {
    const ChartComponent = type === "area" ? AreaChart : LineChart;
    const SeriesComponent = type === "area" ? Area : Line;

    return (
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey={xKey}
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip formatter={tooltipFormatter} />
          {showLegend && (
            <Legend wrapperStyle={{ fontSize: compact ? 9 : 11 }} iconType="circle" iconSize={8} />
          )}
          {yKeys.map((k, i) => (
            <SeriesComponent
              key={k}
              type="monotone"
              dataKey={k}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={type === "area" ? 0.15 : 1}
              strokeWidth={2}
              dot={false}
              name={dataSource.columns.find((c) => c.key === k)?.label ?? k}
            />
          ))}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }

  // bar / horizontalBar
  const isHorizontal = type === "horizontalBar";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        {...commonProps}
        layout={isHorizontal ? "vertical" : "horizontal"}
      >
        <CartesianGrid {...gridProps} horizontal={!isHorizontal} vertical={isHorizontal} />
        {isHorizontal ? (
          <>
            <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis
              dataKey={xKey}
              type="category"
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              width={90}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          </>
        )}
        <Tooltip formatter={tooltipFormatter} />
        {showLegend && (
          <Legend wrapperStyle={{ fontSize: compact ? 9 : 11 }} iconType="circle" iconSize={8} />
        )}
        {yKeys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            fill={colors[i % colors.length]}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
            name={dataSource.columns.find((c) => c.key === k)?.label ?? k}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
