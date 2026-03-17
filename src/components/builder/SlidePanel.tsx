"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { Slide } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableSlide({
  slide,
  index,
  isActive,
}: {
  slide: Slide;
  index: number;
  isActive: boolean;
}) {
  const setActiveSlide = useStore((s) => s.setActiveSlide);
  const removeSlide = useStore((s) => s.removeSlide);
  const totalSlides = useStore((s) => s.report.slides.length);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border-2 transition-all cursor-pointer select-none ${
        isActive ? "border-indigo-500 shadow-md" : "border-transparent hover:border-slate-300"
      }`}
      onClick={() => setActiveSlide(slide.id)}
    >
      {/* Thumbnail */}
      <div
        className="w-full rounded aspect-video bg-white border border-slate-200 flex items-center justify-center overflow-hidden"
        style={{ background: slide.background }}
      >
        {slide.widgets.length === 0 ? (
          <span className="text-xs text-slate-300">Empty</span>
        ) : (
          <span className="text-xs text-slate-400">{slide.widgets.length} elements</span>
        )}
      </div>

      {/* Label */}
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-xs text-slate-400 font-medium tabular-nums">{index + 1}</span>
        <span className="text-xs text-slate-600 truncate">{slide.title}</span>
      </div>

      {/* Drag handle + delete */}
      <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5">
        <button
          {...listeners}
          {...attributes}
          className="p-0.5 rounded text-slate-400 hover:text-slate-600 cursor-grab"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </button>
        {totalSlides > 1 && (
          <button
            className="p-0.5 rounded text-slate-400 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              removeSlide(slide.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SlidePanel() {
  const slides = useStore((s) => s.report.slides);
  const activeSlideId = useStore((s) => s.activeSlideId);
  const addSlide = useStore((s) => s.addSlide);
  const reorderSlides = useStore((s) => s.reorderSlides);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSlides(oldIndex, newIndex);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-white">
        <span className="text-xs font-semibold text-slate-600">Slides</span>
        <Button size="icon" variant="ghost" onClick={() => addSlide("blank")} title="Add slide">
          <Plus size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {slides.map((slide, i) => (
              <SortableSlide
                key={slide.id}
                slide={slide}
                index={i}
                isActive={slide.id === activeSlideId}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="p-2 border-t border-slate-200">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => addSlide("blank")}
        >
          <Plus size={12} />
          Add slide
        </Button>
      </div>
    </div>
  );
}
