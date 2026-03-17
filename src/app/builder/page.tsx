"use client";

import React, { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useStore } from "@/lib/store";
import { Widget, ChartWidget } from "@/lib/types";
import { genId } from "@/lib/utils";
import ChartGallery from "@/components/builder/ChartGallery";
import SlideCanvas from "@/components/builder/SlideCanvas";
import SlidePanel from "@/components/builder/SlidePanel";
import AiPanel from "@/components/builder/AiPanel";
import Toolbar from "@/components/builder/Toolbar";

export default function BuilderPage() {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiContextWidget, setAiContextWidget] = useState<Widget | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const addWidget = useStore((s) => s.addWidget);
  const activeSlideId = useStore((s) => s.activeSlideId);
  const setIsDragging = useStore((s) => s.setIsDragging);
  const dataSources = useStore((s) => s.dataSources);
  const activeDataSourceId = useStore((s) => s.activeDataSourceId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setIsDragging(false);

    const { active, over } = event;
    if (!over || over.id !== "slide-canvas" || !activeSlideId) return;

    const data = active.data.current;
    if (!data) return;

    if (data.type === "chart") {
      const widget: Widget = {
        id: genId("w"),
        type: "chart",
        chartConfig: data.config,
        x: 0,
        y: 0,
        w: 8,
        h: 300,
      } as ChartWidget;
      addWidget(activeSlideId, widget);
    } else if (data.type === "block") {
      const blockType = data.blockType as string;
      let widget: Widget;

      if (blockType === "text-heading") {
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
      } else if (blockType === "text-body") {
        widget = {
          id: genId("w"),
          type: "text",
          content: "Add your narrative text here.",
          fontSize: 14,
          fontWeight: "normal",
          align: "left",
          color: "#334155",
          x: 0,
          y: 0,
          w: 12,
          h: 80,
        } as any;
      } else if (blockType === "image") {
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
    }
  };

  const handleAiAssist = (widget: Widget) => {
    setAiContextWidget(widget);
    setIsAiOpen(true);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      <Toolbar
        onAiOpen={() => setIsAiOpen(!isAiOpen)}
        isAiOpen={isAiOpen}
      />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 min-h-0">
          {/* Left: Chart gallery */}
          <div className="w-64 flex-shrink-0">
            <ChartGallery />
          </div>

          {/* Middle: Slide panel + canvas */}
          <div className="flex flex-1 min-w-0">
            {/* Slide thumbnails */}
            <div className="w-36 flex-shrink-0">
              <SlidePanel />
            </div>

            {/* Main canvas */}
            <SlideCanvas onAiAssist={handleAiAssist} />
          </div>

          {/* Right: AI panel */}
          {isAiOpen && (
            <AiPanel
              contextWidget={aiContextWidget}
              onClose={() => setIsAiOpen(false)}
            />
          )}
        </div>
      </DndContext>
    </div>
  );
}
