"use client";

import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useStore } from "@/lib/store";
import { ChartConfig, ChartType, Widget } from "@/lib/types";
import ChartRenderer from "@/components/charts/ChartRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { genId, CHART_COLORS } from "@/lib/utils";
import {
  BarChart2,
  LineChart,
  PieChart,
  Table,
  TrendingUp,
  Hash,
  Search,
  LayoutGrid,
  AlignLeft,
  Image,
  Minus,
} from "lucide-react";

const CHART_TYPE_ICONS: Record<ChartType | string, React.ReactNode> = {
  bar: <BarChart2 size={12} />,
  horizontalBar: <BarChart2 size={12} className="rotate-90" />,
  line: <LineChart size={12} />,
  area: <TrendingUp size={12} />,
  pie: <PieChart size={12} />,
  donut: <PieChart size={12} />,
  scatter: <LayoutGrid size={12} />,
  stat: <Hash size={12} />,
  table: <Table size={12} />,
};

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: "Bar",
  horizontalBar: "H-Bar",
  line: "Line",
  area: "Area",
  pie: "Pie",
  donut: "Donut",
  scatter: "Scatter",
  stat: "Stat",
  table: "Table",
};

function DraggableChartCard({
  config,
  dataSource,
}: {
  config: ChartConfig;
  dataSource: any;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chart:${config.id}`,
    data: { type: "chart", config },
  });

  const addWidget = useStore((s) => s.addWidget);
  const activeSlideId = useStore((s) => s.activeSlideId);

  const handleClick = () => {
    if (!activeSlideId) return;
    const widget: Widget = {
      id: genId("w"),
      type: "chart",
      chartConfig: config,
      x: 0,
      y: 0,
      w: 8,
      h: 280,
    } as any;
    addWidget(activeSlideId, widget);
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group cursor-grab active:cursor-grabbing rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden ${isDragging ? "opacity-50 shadow-lg" : ""}`}
      onClick={handleClick}
      title={`Click or drag to add: ${config.title}`}
    >
      <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-slate-700 truncate">{config.title}</span>
        <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
          {CHART_TYPE_ICONS[config.type]}
          {CHART_TYPE_LABELS[config.type]}
        </span>
      </div>
      <div className="p-1.5 h-[110px]">
        <ChartRenderer config={config} dataSource={dataSource} height={100} compact />
      </div>
    </div>
  );
}

const BLOCK_TYPES = [
  { id: "text-heading", icon: <AlignLeft size={13} />, label: "Heading" },
  { id: "text-body", icon: <AlignLeft size={13} />, label: "Body Text" },
  { id: "image", icon: <Image size={13} />, label: "Image" },
  { id: "divider", icon: <Minus size={13} />, label: "Divider" },
];

function DraggableBlock({ blockType }: { blockType: (typeof BLOCK_TYPES)[0] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${blockType.id}`,
    data: { type: "block", blockType: blockType.id },
  });

  const addWidget = useStore((s) => s.addWidget);
  const activeSlideId = useStore((s) => s.activeSlideId);

  const handleClick = () => {
    if (!activeSlideId) return;
    let widget: Widget;

    if (blockType.id === "text-heading") {
      widget = {
        id: genId("w"),
        type: "text",
        content: "Add your heading here",
        fontSize: 24,
        fontWeight: "bold",
        align: "left",
        color: "#0f172a",
        isHeading: true,
        x: 0,
        y: 0,
        w: 12,
        h: 60,
      } as any;
    } else if (blockType.id === "text-body") {
      widget = {
        id: genId("w"),
        type: "text",
        content: "Add your narrative text here. Click to edit.",
        fontSize: 14,
        fontWeight: "normal",
        align: "left",
        color: "#334155",
        x: 0,
        y: 0,
        w: 12,
        h: 80,
      } as any;
    } else if (blockType.id === "image") {
      widget = {
        id: genId("w"),
        type: "image",
        src: "",
        alt: "Image",
        objectFit: "cover",
        x: 0,
        y: 0,
        w: 6,
        h: 200,
      } as any;
    } else {
      widget = {
        id: genId("w"),
        type: "divider",
        color: "#e2e8f0",
        x: 0,
        y: 0,
        w: 12,
        h: 20,
      } as any;
    }

    addWidget(activeSlideId, widget);
  };

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-xs text-slate-700 transition-all cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <span className="text-indigo-500">{blockType.icon}</span>
      {blockType.label}
    </button>
  );
}

type TabType = "charts" | "blocks";

export default function ChartGallery() {
  const suggestions = useStore((s) => s.chartSuggestions);
  const dataSources = useStore((s) => s.dataSources);
  const activeDataSourceId = useStore((s) => s.activeDataSourceId);
  const activeSource = dataSources.find((d) => d.id === activeDataSourceId);

  const [tab, setTab] = useState<TabType>("charts");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ChartType | "all">("all");

  const filtered = suggestions.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const uniqueTypes = Array.from(new Set(suggestions.map((c) => c.type)));

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setTab("charts")}
          className={`flex-1 text-xs font-medium py-2.5 transition-colors ${tab === "charts" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Charts ({suggestions.length})
        </button>
        <button
          onClick={() => setTab("blocks")}
          className={`flex-1 text-xs font-medium py-2.5 transition-colors ${tab === "blocks" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Blocks
        </button>
      </div>

      {tab === "charts" && (
        <>
          {/* Search */}
          <div className="p-2 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search charts…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Type filter */}
          <div className="flex gap-1 p-2 overflow-x-auto flex-nowrap border-b border-slate-200 bg-white">
            <button
              onClick={() => setTypeFilter("all")}
              className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors ${typeFilter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300"}`}
            >
              All
            </button>
            {uniqueTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${typeFilter === t ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-600 hover:border-indigo-300"}`}
              >
                {CHART_TYPE_ICONS[t]}
                {CHART_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Chart grid */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {!activeSource ? (
              <div className="text-center text-xs text-slate-400 py-8">
                Import data first to see chart suggestions
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-8">
                No charts match your filters
              </div>
            ) : (
              filtered.map((config) => (
                <DraggableChartCard
                  key={config.id}
                  config={config}
                  dataSource={activeSource}
                />
              ))
            )}
          </div>
        </>
      )}

      {tab === "blocks" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-xs text-slate-500 font-medium mb-2">Content blocks</p>
          {BLOCK_TYPES.map((b) => (
            <DraggableBlock key={b.id} blockType={b} />
          ))}
        </div>
      )}
    </div>
  );
}
