"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import DataImport from "@/components/DataImport";
import { useStore } from "@/lib/store";
import {
  BarChart2,
  Sparkles,
  Download,
  ArrowRight,
  FileText,
  Layout,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const dataSources = useStore((s) => s.dataSources);
  const [showImport, setShowImport] = useState(false);

  const handleComplete = () => {
    router.push("/builder");
  };

  if (showImport) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-xl mx-auto">
          <button
            onClick={() => setShowImport(false)}
            className="text-sm text-slate-500 hover:text-slate-700 mb-6 flex items-center gap-1"
          >
            ← Back
          </button>
          <DataImport onComplete={handleComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <FileText size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-sm">Impacter</span>
          <span className="text-indigo-300 text-sm">Report Builder</span>
        </div>
        {dataSources.length > 0 && (
          <button
            onClick={() => router.push("/builder")}
            className="text-xs text-indigo-300 hover:text-white transition-colors"
          >
            Continue editing →
          </button>
        )}
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 rounded-full px-3 py-1 text-xs font-medium mb-6 border border-indigo-500/30">
          <Sparkles size={11} />
          Powered by Claude AI
        </div>
        <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
          Turn your data into
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            compelling reports
          </span>
        </h1>
        <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
          Import a Google Sheet, instantly generate dozens of charts and visualizations,
          drag them into a beautiful report, and let AI write the narrative.
          Export directly to Google Slides.
        </p>

        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-indigo-900/50"
        >
          Import data &amp; build report
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Feature grid */}
      <div className="max-w-4xl mx-auto px-8 pb-24 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: <BarChart2 className="text-indigo-400" size={20} />,
            title: "Auto-generate charts",
            desc: "Bar, line, pie, area, scatter, stat cards — all auto-suggested from your data",
          },
          {
            icon: <Layout className="text-cyan-400" size={20} />,
            title: "Drag & drop builder",
            desc: "Drag charts, text, images, and dividers onto slide canvases",
          },
          {
            icon: <Sparkles className="text-amber-400" size={20} />,
            title: "AI narrative writer",
            desc: "Claude drafts headlines, insights, and full narrative copy",
          },
          {
            icon: <Download className="text-emerald-400" size={20} />,
            title: "Export to Slides",
            desc: "One-click export directly to a new Google Slides presentation",
          },
        ].map((f, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:bg-white/10 transition-colors"
          >
            <div className="mb-3">{f.icon}</div>
            <div className="text-white text-sm font-semibold mb-1">{f.title}</div>
            <div className="text-slate-400 text-xs leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
