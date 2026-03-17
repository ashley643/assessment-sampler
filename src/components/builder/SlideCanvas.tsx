"use client";

import React, { useState, useRef, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useStore } from "@/lib/store";
import { Widget, ChartWidget, TextWidget, ImageWidget, StatWidget } from "@/lib/types";
import ChartRenderer from "@/components/charts/ChartRenderer";
import { Button } from "@/components/ui/button";
import { Trash2, Move, Lock, Unlock, GripVertical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Individual widget renderers ─────────────────────────────────────────────

function ChartWidgetView({ widget, dataSource }: { widget: ChartWidget; dataSource: any }) {
  if (!dataSource) return <div className="text-xs text-slate-400 p-4">No data source</div>;
  return (
    <div className="h-full w-full p-2">
      <div className="text-xs font-semibold text-slate-600 mb-1 px-1">{widget.chartConfig.title}</div>
      <ChartRenderer
        config={widget.chartConfig}
        dataSource={dataSource}
        height={widget.h - 40}
      />
    </div>
  );
}

function TextWidgetView({
  widget,
  onUpdate,
}: {
  widget: TextWidget;
  onUpdate: (patch: Partial<TextWidget>) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={widget.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        onBlur={() => setEditing(false)}
        className="w-full h-full p-2 text-sm border-none outline-none resize-none bg-transparent"
        style={{
          fontSize: widget.fontSize,
          fontWeight: widget.fontWeight,
          textAlign: widget.align,
          color: widget.color,
        }}
      />
    );
  }

  return (
    <div
      className="w-full h-full p-2 cursor-text"
      style={{
        fontSize: widget.fontSize,
        fontWeight: widget.fontWeight,
        textAlign: widget.align,
        color: widget.color,
        lineHeight: 1.5,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      {widget.content || <span className="text-slate-300">Double-click to edit…</span>}
    </div>
  );
}

function ImageWidgetView({
  widget,
  onUpdate,
}: {
  widget: ImageWidget;
  onUpdate: (patch: Partial<ImageWidget>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdate({ src: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  if (!widget.src) {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded cursor-pointer hover:border-indigo-300"
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <div className="text-center">
          <div className="text-slate-400 text-xs">Click to upload image</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative group" onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <img
        src={widget.src}
        alt={widget.alt}
        className="w-full h-full rounded"
        style={{ objectFit: widget.objectFit }}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded" />
    </div>
  );
}

function StatWidgetView({ widget, dataSource }: { widget: any; dataSource: any }) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center p-3 rounded"
      style={{ borderLeft: `4px solid ${widget.color}` }}
    >
      <div className="text-xs text-slate-500 mb-1">{widget.label}</div>
      <div className="text-2xl font-bold" style={{ color: widget.color }}>
        {widget.value}
      </div>
      {widget.change && (
        <div
          className={`text-xs mt-1 ${widget.changeDir === "up" ? "text-emerald-600" : widget.changeDir === "down" ? "text-red-500" : "text-slate-500"}`}
        >
          {widget.changeDir === "up" ? "↑" : widget.changeDir === "down" ? "↓" : ""} {widget.change}
        </div>
      )}
    </div>
  );
}

// ─── Widget wrapper (selected state, controls) ────────────────────────────────

function WidgetWrapper({
  widget,
  isSelected,
  onSelect,
  onRemove,
  onUpdate,
  dataSource,
  onAiAssist,
}: {
  widget: Widget;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<Widget>) => void;
  dataSource: any;
  onAiAssist: (widget: Widget) => void;
}) {
  return (
    <div
      className={cn(
        "relative group w-full rounded transition-all",
        isSelected ? "ring-2 ring-indigo-500 ring-offset-1" : "hover:ring-1 hover:ring-slate-300"
      )}
      style={{ minHeight: widget.h }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Content */}
      {widget.type === "chart" && (
        <ChartWidgetView widget={widget as ChartWidget} dataSource={dataSource} />
      )}
      {widget.type === "text" && (
        <TextWidgetView
          widget={widget as TextWidget}
          onUpdate={(p) => onUpdate(p as Partial<Widget>)}
        />
      )}
      {widget.type === "image" && (
        <ImageWidgetView
          widget={widget as ImageWidget}
          onUpdate={(p) => onUpdate(p as Partial<Widget>)}
        />
      )}
      {widget.type === "stat" && (
        <StatWidgetView widget={widget} dataSource={dataSource} />
      )}
      {widget.type === "divider" && (
        <div className="w-full py-2">
          <hr style={{ borderColor: (widget as any).color }} />
        </div>
      )}

      {/* Controls (visible when selected) */}
      {isSelected && (
        <div className="absolute -top-7 right-0 flex items-center gap-1 bg-indigo-600 rounded-t px-1.5 py-0.5">
          {(widget.type === "text" || widget.type === "chart") && (
            <button
              className="text-white/80 hover:text-white p-0.5"
              title="AI assist"
              onClick={(e) => {
                e.stopPropagation();
                onAiAssist(widget);
              }}
            >
              <Sparkles size={11} />
            </button>
          )}
          <button
            className="text-white/80 hover:text-white p-0.5"
            title="Remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main canvas ──────────────────────────────────────────────────────────────

export default function SlideCanvas({ onAiAssist }: { onAiAssist: (widget: Widget) => void }) {
  const slides = useStore((s) => s.report.slides);
  const activeSlideId = useStore((s) => s.activeSlideId);
  const selectedWidgetId = useStore((s) => s.selectedWidgetId);
  const dataSources = useStore((s) => s.dataSources);
  const activeDataSourceId = useStore((s) => s.activeDataSourceId);
  const selectWidget = useStore((s) => s.selectWidget);
  const removeWidget = useStore((s) => s.removeWidget);
  const updateWidget = useStore((s) => s.updateWidget);

  const activeSource = dataSources.find((d) => d.id === activeDataSourceId);
  const slide = slides.find((s) => s.id === activeSlideId);

  const { setNodeRef, isOver } = useDroppable({ id: "slide-canvas" });

  if (!slide) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Select a slide to edit
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
      {/* Slide */}
      <div
        ref={setNodeRef}
        className={cn(
          "slide-canvas relative w-full max-w-4xl min-h-[500px] rounded-lg transition-all",
          isOver && "ring-2 ring-indigo-400 ring-offset-2"
        )}
        style={{ background: slide.background }}
        onClick={() => selectWidget(null)}
      >
        {slide.widgets.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
            <div className="text-4xl mb-2">+</div>
            <div className="text-sm">Drag charts and blocks here</div>
          </div>
        )}

        <div className="p-8 space-y-4">
          {slide.widgets.map((widget) => (
            <WidgetWrapper
              key={widget.id}
              widget={widget}
              isSelected={widget.id === selectedWidgetId}
              onSelect={() => selectWidget(widget.id)}
              onRemove={() => removeWidget(slide.id, widget.id)}
              onUpdate={(patch) => updateWidget(slide.id, widget.id, patch)}
              dataSource={
                widget.type === "chart"
                  ? dataSources.find(
                      (d) => d.id === (widget as ChartWidget).chartConfig.dataSourceId
                    ) ?? activeSource
                  : activeSource
              }
              onAiAssist={onAiAssist}
            />
          ))}
        </div>

        {/* Drop overlay hint */}
        {isOver && (
          <div className="absolute inset-0 bg-indigo-50/70 rounded-lg border-2 border-dashed border-indigo-400 flex items-center justify-center pointer-events-none">
            <span className="text-indigo-600 font-medium text-sm">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}
