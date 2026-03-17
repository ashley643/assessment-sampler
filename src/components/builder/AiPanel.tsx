"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { Widget, ChartWidget, TextWidget } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Copy, Plus, X, Loader2 } from "lucide-react";
import { genId } from "@/lib/utils";

type DraftType = "slide_narrative" | "headline" | "insight" | "summary";

const DRAFT_TYPES: { value: DraftType; label: string; hint: string }[] = [
  { value: "headline", label: "Headline", hint: "A punchy 1-line headline" },
  { value: "insight", label: "Data insight", hint: "1-2 sentence insight from data" },
  {
    value: "slide_narrative",
    label: "Narrative",
    hint: "2-3 paragraphs of report narrative",
  },
  { value: "summary", label: "Summary", hint: "Executive summary paragraph" },
];

interface AiPanelProps {
  contextWidget?: Widget | null;
  onClose: () => void;
}

export default function AiPanel({ contextWidget, onClose }: AiPanelProps) {
  const [draftType, setDraftType] = useState<DraftType>("slide_narrative");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSlideId = useStore((s) => s.activeSlideId);
  const addWidget = useStore((s) => s.addWidget);
  const dataSources = useStore((s) => s.dataSources);
  const activeDataSourceId = useStore((s) => s.activeDataSourceId);
  const activeSource = dataSources.find((d) => d.id === activeDataSourceId);
  const report = useStore((s) => s.report);

  // Build context string from widget + data
  const buildContext = () => {
    const parts: string[] = [
      `Report: "${report.title}" for ${report.organization}`,
    ];
    if (activeSource) {
      parts.push(
        `Data source: ${activeSource.name} (${activeSource.rows.length} rows, columns: ${activeSource.columns.map((c) => c.label).join(", ")})`
      );
    }
    if (contextWidget?.type === "chart") {
      const cw = contextWidget as ChartWidget;
      parts.push(`Chart: "${cw.chartConfig.title}" (${cw.chartConfig.type})`);
    }
    return parts.join(". ");
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !contextWidget) return;
    setLoading(true);
    setError(null);
    setResult("");

    const effectivePrompt = prompt.trim()
      ? prompt
      : contextWidget?.type === "chart"
      ? `Write about the chart: "${(contextWidget as ChartWidget).chartConfig.title}"`
      : "Write narrative copy for this slide";

    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: effectivePrompt,
          context: buildContext(),
          type: draftType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.text);
    } catch (e: any) {
      setError(e.message ?? "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToSlide = () => {
    if (!result || !activeSlideId) return;
    const widget: TextWidget = {
      id: genId("w"),
      type: "text",
      content: result,
      fontSize: draftType === "headline" ? 22 : 14,
      fontWeight: draftType === "headline" ? "bold" : "normal",
      align: "left",
      color: "#0f172a",
      isHeading: draftType === "headline",
      x: 0,
      y: 0,
      w: 12,
      h: draftType === "headline" ? 60 : 100,
    };
    addWidget(activeSlideId, widget);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-72">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-indigo-50">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-800">AI Writing Assistant</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Context hint */}
        {contextWidget?.type === "chart" && (
          <div className="text-xs bg-indigo-50 text-indigo-700 rounded p-2">
            <span className="font-medium">Context:</span>{" "}
            {(contextWidget as ChartWidget).chartConfig.title}
          </div>
        )}

        {/* Draft type */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">
            What to write
          </label>
          <div className="grid grid-cols-2 gap-1">
            {DRAFT_TYPES.map((dt) => (
              <button
                key={dt.value}
                onClick={() => setDraftType(dt.value)}
                className={`text-xs py-1.5 px-2 rounded border transition-colors text-left ${
                  draftType === dt.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                {dt.label}
                <div
                  className={`text-[10px] mt-0.5 ${draftType === dt.value ? "text-indigo-200" : "text-slate-400"}`}
                >
                  {dt.hint}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">
            Your prompt (optional)
          </label>
          <Textarea
            placeholder="e.g. Highlight the growth in program reach over 2023…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="text-xs min-h-[70px]"
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full"
          size="sm"
        >
          {loading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles size={13} />
              Generate
            </>
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">Generated text</div>
            <div className="text-xs text-slate-700 bg-slate-50 rounded p-2.5 leading-relaxed whitespace-pre-wrap border border-slate-200">
              {result}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={handleCopy}
              >
                <Copy size={11} />
                Copy
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={handleAddToSlide}
                disabled={!activeSlideId}
              >
                <Plus size={11} />
                Add to slide
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      <div className="p-3 border-t border-slate-200">
        <p className="text-xs font-medium text-slate-500 mb-2">Quick prompts</p>
        <div className="space-y-1">
          {[
            "Summarize the key impact metrics",
            "Write an opening paragraph about our mission",
            "Describe the year-over-year growth trend",
            "Highlight 3 key achievements",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setPrompt(q)}
              className="w-full text-left text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded transition-colors"
            >
              &ldquo;{q}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
