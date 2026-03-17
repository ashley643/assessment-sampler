"use client";

import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useStore } from "@/lib/store";
import { DataSource, Column } from "@/lib/types";
import { inferColumns, genId } from "@/lib/utils";
import {
  Table,
  Sheet,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Database,
} from "lucide-react";

export default function DataImport({ onComplete }: { onComplete: () => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ columns: Column[]; rows: any[] } | null>(null);
  const [sourceName, setSourceName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addDataSource = useStore((s) => s.addDataSource);
  const addSlide = useStore((s) => s.addSlide);

  const parseCSV = (text: string) => {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    return result.data as Record<string, string | number | null>[];
  };

  const handleSheetLoad = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const rows = parseCSV(data.csv);
      if (rows.length === 0) throw new Error("Sheet appears to be empty");
      const columns = inferColumns(rows);
      setPreview({ columns, rows });
      // Auto-name from URL
      if (!sourceName) setSourceName(`Sheet (${rows.length} rows)`);
    } catch (e: any) {
      setError(e.message ?? "Failed to load sheet");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      complete: (result: any) => {
        const rows = result.data as Record<string, string | number | null>[];
        if (rows.length === 0) {
          setError("File appears to be empty");
          setLoading(false);
          return;
        }
        const columns = inferColumns(rows);
        setPreview({ columns, rows });
        if (!sourceName) setSourceName(file.name.replace(/\.(csv|xlsx?)$/i, ""));
        setLoading(false);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => {
        setError(err.message);
        setLoading(false);
      },
    });
  };

  const handleConfirm = () => {
    if (!preview) return;
    const source: DataSource = {
      id: genId("ds"),
      name: sourceName || "Data Source",
      sheetUrl: url,
      columns: preview.columns,
      rows: preview.rows,
      loadedAt: new Date(),
    };
    addDataSource(source);
    // Add initial slides
    addSlide("title");
    addSlide("blank");
    onComplete();
  };

  const colTypeColor: Record<string, string> = {
    number: "bg-indigo-100 text-indigo-700",
    string: "bg-slate-100 text-slate-700",
    date: "bg-amber-100 text-amber-700",
    percent: "bg-emerald-100 text-emerald-700",
    boolean: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Import your data</h2>
        <p className="text-sm text-slate-500 mt-1">
          Connect a Google Sheet or upload a CSV to get started
        </p>
      </div>

      {/* Google Sheets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sheet size={15} className="text-emerald-600" />
            Google Sheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSheetLoad()}
              className="flex-1"
            />
            <Button onClick={handleSheetLoad} disabled={loading || !url.trim()}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Load"}
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Sheet must be set to &quot;Anyone with link can view&quot;
          </p>
        </CardContent>
      </Card>

      {/* Or divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">or</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* CSV Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={15} className="text-indigo-600" />
            Upload CSV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
            <Upload size={14} />
            Choose file (CSV or Excel)
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <Card className="border-emerald-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <CheckCircle size={15} />
                Data loaded — {preview.rows.length} rows, {preview.columns.length} columns
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name input */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Data source name
              </label>
              <Input
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Q4 Program Data"
              />
            </div>

            {/* Column types */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Detected columns</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.columns.map((col) => (
                  <span
                    key={col.key}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${colTypeColor[col.type] ?? "bg-slate-100 text-slate-700"}`}
                  >
                    {col.label}
                    <span className="opacity-60">({col.type})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Mini table preview */}
            <div className="overflow-auto rounded border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {preview.columns.slice(0, 5).map((col) => (
                      <th
                        key={col.key}
                        className="text-left p-2 font-semibold text-slate-600 border-b border-slate-200"
                      >
                        {col.label}
                      </th>
                    ))}
                    {preview.columns.length > 5 && (
                      <th className="text-left p-2 font-semibold text-slate-400 border-b border-slate-200">
                        +{preview.columns.length - 5} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 4).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      {preview.columns.slice(0, 5).map((col) => (
                        <td key={col.key} className="p-2 text-slate-700 truncate max-w-[120px]">
                          {String(row[col.key] ?? "—")}
                        </td>
                      ))}
                      {preview.columns.length > 5 && <td className="p-2 text-slate-400">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={handleConfirm} className="w-full">
              <Database size={14} />
              Use this data — build my report
              <ChevronRight size={14} />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
