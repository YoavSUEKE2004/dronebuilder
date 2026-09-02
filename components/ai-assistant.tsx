'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, Send, X, Wand2 } from 'lucide-react';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Props = {
  components: ComponentWithSpecs[];
  onBuildGenerated: (parts: SelectedParts) => void;
};

type ParseResult = {
  intent: string;
  sizeInches?: number;
  maxBudget?: number;
  minKv?: number;
  maxKv?: number;
  batteryS?: number;
  useCase?: string;
};

const EXAMPLE_PROMPTS = [
  'Build me a sub-250g 5-inch freestyle drone under $350',
  'Recommend a long-range 7-inch camera rig for cinematic video',
  'I want a budget 3-inch cinewhoop under $200',
  'Build me a racing 5-inch drone with 6S battery',
];

function parsePrompt(prompt: string): ParseResult {
  const lower = prompt.toLowerCase();
  let sizeInches: number | undefined;
  let maxBudget: number | undefined;
  let batteryS: number | undefined;
  let useCase: string | undefined;

  const sizeMatch = lower.match(/(\d+(?:\.\d+)?)\s*inch/) || lower.match(/(\d+(?:\.\d+)?)"/);
  if (sizeMatch) sizeInches = parseFloat(sizeMatch[1]);

  const budgetMatch = lower.match(/\$?\s*(\d+)\s*(?:dollars|bucks)?/) || lower.match(/under\s*\$?\s*(\d+)/) || lower.match(/below\s*\$?\s*(\d+)/);
  if (budgetMatch) maxBudget = parseInt(budgetMatch[1]);

  const sMatch = lower.match(/(\d)s\b/);
  if (sMatch) batteryS = parseInt(sMatch[1]);

  if (lower.includes('freestyle')) useCase = 'freestyle';
  else if (lower.includes('cinematic') || lower.includes('camera rig') || lower.includes('video')) useCase = 'cinematic';
  else if (lower.includes('race') || lower.includes('racing')) useCase = 'racing';
  else if (lower.includes('cinewhoop') || lower.includes('cine')) useCase = 'cinewhoop';
  else if (lower.includes('long-range') || lower.includes('long range')) useCase = 'long-range';
  else if (lower.includes('budget')) useCase = 'budget';

  const sub250 = lower.includes('sub-250') || lower.includes('under 250g') || lower.includes('sub250');

  return { intent: prompt, sizeInches, maxBudget, batteryS, useCase, sub250 } as ParseResult & { sub250?: boolean };
}

function scoreComponent(comp: ComponentWithSpecs, parse: ParseResult, category: string): number {
  let score = comp.quality_score * 10;

  if (parse.maxBudget && Number(comp.price) > parse.maxBudget * 0.3) {
    score -= (Number(comp.price) - parse.maxBudget * 0.15) * 0.5;
  }

  if (parse.sizeInches) {
    if (category === 'frame') {
      const frameMatch = comp.name.match(/(\d+(?:\.\d+)?)"\s*(?:Frame|frame)/);
      if (frameMatch) {
        const frameSize = parseFloat(frameMatch[1]);
        if (Math.abs(frameSize - parse.sizeInches) < 0.6) score += 100;
        else score -= 50;
      }
    }
    if (category === 'propeller') {
      const propMatch = comp.name.match(/(\d+(?:\.\d+)?)"\s*Props/);
      if (propMatch) {
        const propSize = parseFloat(propMatch[1]);
        const expectedSize = parse.sizeInches === 3 ? 3 : parse.sizeInches === 3.5 ? 3.5 : parse.sizeInches === 5 ? 5 : parse.sizeInches === 7 ? 7 : parse.sizeInches === 10 ? 10 : parse.sizeInches;
        if (Math.abs(propSize - expectedSize) < 0.6) score += 100;
        else score -= 50;
      }
    }
    if (category === 'motor') {
      const kvMatch = comp.name.match(/(\d+)KV/);
      if (kvMatch) {
        const kv = parseInt(kvMatch[1]);
        if (parse.sizeInches <= 3.5 && kv >= 3000) score += 50;
        else if (parse.sizeInches === 5 && kv >= 2000 && kv <= 2800) score += 50;
        else if (parse.sizeInches === 7 && kv >= 1000 && kv <= 1800) score += 50;
        else if (parse.sizeInches === 10 && kv <= 800) score += 50;
      }
    }
  }

  if (parse.batteryS) {
    if (category === 'battery') {
      const bS = comp.electrical_specs?.max_voltage_s;
      if (bS === parse.batteryS) score += 100;
      else score -= 50;
    }
    if (category === 'esc' || category === 'motor' || category === 'flight_controller') {
      const maxV = comp.electrical_specs?.max_voltage_s;
      if (maxV && maxV >= parse.batteryS) score += 30;
      else if (maxV && maxV < parse.batteryS) score -= 80;
    }
  }

  if (parse.useCase === 'budget') {
    score -= Number(comp.price) * 0.3;
  }

  if (parse.useCase === 'cinematic' || parse.useCase === 'long-range') {
    if (category === 'camera' && comp.electrical_specs?.protocol === 'Digital') score += 50;
    if (category === 'vtx' && comp.name.includes('800mW')) score += 30;
  }

  if (parse.useCase === 'racing') {
    if (category === 'motor') {
      const kvMatch = comp.name.match(/(\d+)KV/);
      if (kvMatch && parseInt(kvMatch[1]) >= 2400) score += 30;
    }
  }

  return score;
}

function generateBuild(components: ComponentWithSpecs[], parse: ParseResult): SelectedParts {
  const categories = ['frame', 'motor', 'esc', 'flight_controller', 'propeller', 'battery', 'camera', 'vtx', 'receiver'];
  const parts: SelectedParts = {};

  for (const cat of categories) {
    const catComponents = components.filter((c) => c.category === cat);
    if (catComponents.length === 0) continue;

    const scored = catComponents
      .map((c) => ({ comp: c, score: scoreComponent(c, parse, cat) }))
      .sort((a, b) => b.score - a.score);

    parts[cat] = scored[0].comp.id;
  }

  if (parse.maxBudget) {
    let total = 0;
    const orderedCats = [...categories];
    for (const cat of orderedCats) {
      if (parts[cat]) {
        const comp = components.find((c) => c.id === parts[cat]);
        if (comp) total += Number(comp.price);
      }
    }
    if (total > parse.maxBudget) {
      for (const cat of orderedCats) {
        if (!parts[cat]) continue;
        const catComponents = components.filter((c) => c.category === cat);
        const cheaper = catComponents
          .filter((c) => c.id !== parts[cat])
          .sort((a, b) => Number(a.price) - Number(b.price));
        if (cheaper.length > 0) {
          const currentComp = components.find((c) => c.id === parts[cat]);
          if (currentComp && Number(cheaper[0].price) < Number(currentComp.price)) {
            parts[cat] = cheaper[0].id;
            total -= Number(currentComp.price) - Number(cheaper[0].price);
          }
        }
        if (total <= parse.maxBudget) break;
      }
    }
  }

  return parts;
}

export default function AIAssistant({ components, onBuildGenerated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; parts: SelectedParts } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const parse = parsePrompt(prompt);
      const parts = generateBuild(components, parse);

      const total = Object.values(parts).filter(Boolean).reduce((sum, id) => {
        const comp = components.find((c) => c.id === id);
        return sum + (comp ? Number(comp.price) : 0);
      }, 0);

      const summaryParts: string[] = [];
      if (parse.sizeInches) summaryParts.push(`${parse.sizeInches}"`);
      if (parse.batteryS) summaryParts.push(`${parse.batteryS}S`);
      if (parse.useCase) summaryParts.push(parse.useCase);
      summaryParts.push(`$${total.toFixed(2)}`);

      setResult({ summary: summaryParts.join(' · '), parts });
      onBuildGenerated(parts);
    } catch (err) {
      setError('Could not generate a build. Try rephrasing your request.');
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, components, onBuildGenerated]);

  return (
    <div className="border-b border-slate-800">
      <div className="p-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
        >
          <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
          AI Build Assistant
          <Sparkles className="w-3 h-3 text-cyan-400 ml-auto" />
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                placeholder="Describe your dream drone..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                disabled={loading}
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-lg transition-all flex-shrink-0',
                  loading || !prompt.trim()
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30'
                )}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            {/* Example prompts */}
            {!result && !loading && (
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 uppercase tracking-wider">Try:</p>
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="block w-full text-left text-[10px] text-slate-500 hover:text-cyan-300 transition-colors truncate"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="text-[10px] text-red-400">{error}</p>
            )}

            {result && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-cyan-300">Build generated: {result.summary}</p>
                  <p className="text-[9px] text-slate-500">All parts selected and 3D model updated</p>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
