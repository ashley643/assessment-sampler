"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  AppState,
  DataSource,
  Report,
  Slide,
  Widget,
  ChartConfig,
  ReportTheme,
  SlideTemplate,
} from "./types";
import { genId } from "./utils";
import { REPORT_THEMES } from "./utils";
import { generateChartSuggestions } from "./chartSuggestions";

// Default empty report
function createDefaultReport(): Report {
  const slideId = genId("slide");
  return {
    id: genId("report"),
    title: "Impact Report",
    subtitle: "Powered by Impacter Pathway",
    organization: "My Organization",
    theme: REPORT_THEMES[0],
    slides: [
      {
        id: slideId,
        title: "Cover",
        template: "title",
        background: "#ffffff",
        widgets: [],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface Actions {
  // Data sources
  addDataSource: (source: DataSource) => void;
  removeDataSource: (id: string) => void;
  setActiveDataSource: (id: string) => void;

  // Suggestions
  refreshSuggestions: (sourceId: string) => void;

  // Report
  setReportTitle: (title: string) => void;
  setReportTheme: (theme: ReportTheme) => void;

  // Slides
  addSlide: (template?: SlideTemplate) => void;
  removeSlide: (id: string) => void;
  setActiveSlide: (id: string) => void;
  reorderSlides: (from: number, to: number) => void;
  updateSlideTitle: (id: string, title: string) => void;
  updateSlideBackground: (id: string, bg: string) => void;

  // Widgets
  addWidget: (slideId: string, widget: Widget) => void;
  removeWidget: (slideId: string, widgetId: string) => void;
  updateWidget: (slideId: string, widgetId: string, patch: Partial<Widget>) => void;
  selectWidget: (id: string | null) => void;
  reorderWidgets: (slideId: string, from: number, to: number) => void;

  // UI
  setAiPanelOpen: (open: boolean) => void;
  setIsDragging: (v: boolean) => void;
}

export const useStore = create<AppState & Actions>()(
  immer((set, get) => ({
    // ── State ──────────────────────────────────────────────────────────────────
    dataSources: [],
    activeDataSourceId: null,
    chartSuggestions: [],
    report: createDefaultReport(),
    activeSlideId: null,
    selectedWidgetId: null,
    isDragging: false,
    isAiPanelOpen: false,
    isSaving: false,

    // ── Data sources ───────────────────────────────────────────────────────────
    addDataSource: (source) =>
      set((state) => {
        state.dataSources.push(source);
        state.activeDataSourceId = source.id;
        state.chartSuggestions = generateChartSuggestions(source);
      }),

    removeDataSource: (id) =>
      set((state) => {
        state.dataSources = state.dataSources.filter((d) => d.id !== id);
        if (state.activeDataSourceId === id) {
          state.activeDataSourceId = state.dataSources[0]?.id ?? null;
        }
      }),

    setActiveDataSource: (id) =>
      set((state) => {
        state.activeDataSourceId = id;
        const source = state.dataSources.find((d) => d.id === id);
        if (source) {
          state.chartSuggestions = generateChartSuggestions(source);
        }
      }),

    refreshSuggestions: (sourceId) =>
      set((state) => {
        const source = state.dataSources.find((d) => d.id === sourceId);
        if (source) {
          state.chartSuggestions = generateChartSuggestions(source);
        }
      }),

    // ── Report ─────────────────────────────────────────────────────────────────
    setReportTitle: (title) =>
      set((state) => {
        state.report.title = title;
        state.report.updatedAt = new Date();
      }),

    setReportTheme: (theme) =>
      set((state) => {
        state.report.theme = theme;
      }),

    // ── Slides ─────────────────────────────────────────────────────────────────
    addSlide: (template = "blank") =>
      set((state) => {
        const id = genId("slide");
        state.report.slides.push({
          id,
          title: `Slide ${state.report.slides.length + 1}`,
          template,
          background: "#ffffff",
          widgets: [],
        });
        state.activeSlideId = id;
      }),

    removeSlide: (id) =>
      set((state) => {
        const idx = state.report.slides.findIndex((s) => s.id === id);
        state.report.slides = state.report.slides.filter((s) => s.id !== id);
        if (state.activeSlideId === id) {
          state.activeSlideId = state.report.slides[Math.max(0, idx - 1)]?.id ?? null;
        }
      }),

    setActiveSlide: (id) =>
      set((state) => {
        state.activeSlideId = id;
        state.selectedWidgetId = null;
      }),

    reorderSlides: (from, to) =>
      set((state) => {
        const slides = state.report.slides;
        const [moved] = slides.splice(from, 1);
        slides.splice(to, 0, moved);
      }),

    updateSlideTitle: (id, title) =>
      set((state) => {
        const slide = state.report.slides.find((s) => s.id === id);
        if (slide) slide.title = title;
      }),

    updateSlideBackground: (id, bg) =>
      set((state) => {
        const slide = state.report.slides.find((s) => s.id === id);
        if (slide) slide.background = bg;
      }),

    // ── Widgets ────────────────────────────────────────────────────────────────
    addWidget: (slideId, widget) =>
      set((state) => {
        const slide = state.report.slides.find((s) => s.id === slideId);
        if (slide) {
          slide.widgets.push(widget);
          state.selectedWidgetId = widget.id;
        }
      }),

    removeWidget: (slideId, widgetId) =>
      set((state) => {
        const slide = state.report.slides.find((s) => s.id === slideId);
        if (slide) {
          slide.widgets = slide.widgets.filter((w) => w.id !== widgetId);
          if (state.selectedWidgetId === widgetId) state.selectedWidgetId = null;
        }
      }),

    updateWidget: (slideId, widgetId, patch) =>
      set((state) => {
        const slide = state.report.slides.find((s) => s.id === slideId);
        if (!slide) return;
        const idx = slide.widgets.findIndex((w) => w.id === widgetId);
        if (idx === -1) return;
        Object.assign(slide.widgets[idx], patch);
      }),

    selectWidget: (id) =>
      set((state) => {
        state.selectedWidgetId = id;
      }),

    reorderWidgets: (slideId, from, to) =>
      set((state) => {
        const slide = state.report.slides.find((s) => s.id === slideId);
        if (!slide) return;
        const [moved] = slide.widgets.splice(from, 1);
        slide.widgets.splice(to, 0, moved);
      }),

    // ── UI ─────────────────────────────────────────────────────────────────────
    setAiPanelOpen: (open) =>
      set((state) => {
        state.isAiPanelOpen = open;
      }),

    setIsDragging: (v) =>
      set((state) => {
        state.isDragging = v;
      }),
  }))
);
