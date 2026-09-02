'use client';

import { useState } from 'react';
import { FileText, Download, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import type { DetailLevel, GeneratedManual } from '@/lib/generateManual';

type Props = {
  selectedParts: SelectedParts;
  components: ComponentWithSpecs[];
  compatible: boolean;
};

export default function ManualGenerator({ selectedParts, components, compatible }: Props) {
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('beginner');
  const [generating, setGenerating] = useState(false);
  const [manual, setManual] = useState<GeneratedManual | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const selectedCount = Object.values(selectedParts).filter(Boolean).length;

  const handleGenerate = async () => {
    if (selectedCount === 0) return;
    setGenerating(true);
    setError(null);
    setManual(null);
    try {
      const res = await fetch('/api/generate-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedParts, components, detailLevel }),
      });
      if (!res.ok) throw new Error('Failed to generate manual');
      const data = await res.json();
      setManual(data.manual as GeneratedManual);
      setExpanded(true);
    } catch (err) {
      setError('Could not generate manual. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!manual) return;
    try {
      const res = await fetch('/api/download-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual }),
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drone-assembly-manual.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Could not download PDF. Please try again.');
    }
  };

  return (
    <div className="p-4 border-b border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> AI Assembly Manual
        </h2>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Detail level selector */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => setDetailLevel('beginner')}
          className={cn(
            'p-2 rounded-lg border text-xs font-medium transition-all text-center',
            detailLevel === 'beginner'
              ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70'
          )}
        >
          Beginner
          <span className="block text-[9px] text-slate-500 mt-0.5">Detailed soldering</span>
        </button>
        <button
          onClick={() => setDetailLevel('expert')}
          className={cn(
            'p-2 rounded-lg border text-xs font-medium transition-all text-center',
            detailLevel === 'expert'
              ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
              : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800/70'
          )}
        >
          Expert
          <span className="block text-[9px] text-slate-500 mt-0.5">Fast-track guide</span>
        </button>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || selectedCount === 0}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all',
          selectedCount > 0 && !generating
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/20'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        )}
      >
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {generating ? 'Generating...' : 'Generate Manual'}
      </button>

      {error && (
        <p className="text-[10px] text-red-400 text-center mt-2">{error}</p>
      )}

      {/* Manual preview */}
      {manual && expanded && (
        <div className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-200">{manual.title}</p>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
            >
              <Download className="w-3 h-3" /> PDF
            </button>
          </div>

          {/* Warnings */}
          <div className="space-y-1">
            {manual.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] p-1.5 rounded bg-amber-500/10 text-amber-300">
                <span className="font-bold">!</span>
                <span>{w}</span>
              </div>
            ))}
          </div>

          {/* Sections */}
          {manual.sections.map((section, idx) => (
            <div key={idx} className="rounded-lg bg-slate-800/40 p-2.5">
              <p className="text-xs font-semibold text-cyan-300 mb-1.5">{section.title}</p>
              <div className="space-y-1">
                {section.steps.map((step, stepIdx) => (
                  <div key={stepIdx} className="flex items-start gap-1.5 text-[10px] text-slate-300">
                    <span className="font-bold text-cyan-400 min-w-[14px]">{stepIdx + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
