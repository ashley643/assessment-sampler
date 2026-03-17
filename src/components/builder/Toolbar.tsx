"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Download,
  FileText,
  Settings,
  Loader2,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  Palette,
} from "lucide-react";
import { REPORT_THEMES } from "@/lib/utils";
import { ReportTheme } from "@/lib/types";

interface ToolbarProps {
  onAiOpen: () => void;
  isAiOpen: boolean;
}

export default function Toolbar({ onAiOpen, isAiOpen }: ToolbarProps) {
  const report = useStore((s) => s.report);
  const setReportTitle = useStore((s) => s.setReportTitle);
  const setReportTheme = useStore((s) => s.setReportTheme);

  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportUrl(null);

    try {
      const res = await fetch("/api/export/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExportUrl(data.url);
    } catch (e: any) {
      setExportError(e.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-12 flex items-center px-4 gap-3 border-b border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
          <FileText size={12} className="text-white" />
        </div>
        <span className="text-xs font-bold text-slate-800">Impacter</span>
        <span className="text-xs text-slate-400">Report Builder</span>
      </div>

      <div className="h-4 w-px bg-slate-200" />

      {/* Report title */}
      <input
        value={report.title}
        onChange={(e) => setReportTitle(e.target.value)}
        className="text-sm font-medium text-slate-800 bg-transparent border-none outline-none hover:bg-slate-100 rounded px-1.5 py-0.5 min-w-0 w-48"
        placeholder="Report title…"
      />

      <div className="flex-1" />

      {/* Theme picker */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowThemes(!showThemes)}
          className="text-xs gap-1"
        >
          <Palette size={13} />
          Theme
          <ChevronDown size={11} />
        </Button>
        {showThemes && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg p-2 z-50 min-w-[160px]">
            {REPORT_THEMES.map((theme) => (
              <button
                key={theme.name}
                onClick={() => {
                  setReportTheme(theme as ReportTheme);
                  setShowThemes(false);
                }}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-50"
              >
                <div className="flex gap-0.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: theme.primaryColor }}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: theme.secondaryColor }}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: theme.accentColor }}
                  />
                </div>
                {theme.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI button */}
      <Button
        variant={isAiOpen ? "default" : "outline"}
        size="sm"
        onClick={onAiOpen}
        className="text-xs gap-1"
      >
        <Sparkles size={13} />
        AI Writer
      </Button>

      {/* Export */}
      <div className="relative">
        <Button size="sm" onClick={handleExport} disabled={exporting} className="text-xs gap-1">
          {exporting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : exportUrl ? (
            <CheckCircle size={13} />
          ) : (
            <Download size={13} />
          )}
          {exportUrl ? "Exported!" : "Export to Slides"}
        </Button>

        {exportUrl && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-emerald-200 shadow-lg p-3 z-50 w-64">
            <div className="text-xs font-semibold text-emerald-700 mb-1">
              Presentation created!
            </div>
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              <ExternalLink size={11} />
              Open in Google Slides
            </a>
          </div>
        )}

        {exportError && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-red-200 shadow-lg p-3 z-50 w-64">
            <div className="text-xs text-red-600">{exportError}</div>
            <div className="text-xs text-slate-500 mt-1">
              Set GOOGLE_SERVICE_ACCOUNT_KEY or connect Google account to export.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
