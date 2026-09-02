'use client';

import { useMemo } from 'react';
import {
  ThumbsUp, AlertTriangle, XCircle, Brain,
} from 'lucide-react';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import type { DetailedCompatibilityResult } from '@/lib/compatibilityEngine';
import { cn } from '@/lib/utils';

type Rating = 'good' | 'suboptimal' | 'incompatible' | 'missing';

type Evaluation = {
  category: string;
  componentName: string | null;
  rating: Rating;
  message: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  frame: 'Frame',
  motor: 'Motors',
  esc: 'ESC',
  flight_controller: 'Flight Controller',
  propeller: 'Propellers',
  battery: 'Battery',
  camera: 'Camera',
  vtx: 'VTX',
  receiver: 'Receiver',
};

const CATEGORY_ORDER = [
  'frame', 'motor', 'esc', 'flight_controller', 'propeller',
  'battery', 'camera', 'vtx', 'receiver',
];

function evaluateSelections(
  selectedParts: SelectedParts,
  components: ComponentWithSpecs[],
  compatibility: DetailedCompatibilityResult
): Evaluation[] {
  const evaluations: Evaluation[] = [];
  const errorMessages = new Map<string, string[]>();
  const warningMessages = new Map<string, string[]>();

  for (const issue of compatibility.issues) {
    if (issue.level === 'error' || issue.level === 'warning') {
      const msg = issue.message;
      const lower = msg.toLowerCase();
      for (const cat of CATEGORY_ORDER) {
        const label = CATEGORY_LABELS[cat].toLowerCase();
        if (lower.includes(label) || lower.includes(cat.replace('_', ' '))) {
          const map = issue.level === 'error' ? errorMessages : warningMessages;
          if (!map.has(cat)) map.set(cat, []);
          map.get(cat)!.push(msg);
        }
      }
    }
  }

  for (const cat of CATEGORY_ORDER) {
    const compId = selectedParts[cat];
    const comp = compId ? components.find((c) => c.id === compId) : null;

    if (!comp) {
      evaluations.push({
        category: cat,
        componentName: null,
        rating: 'missing',
        message: `No ${CATEGORY_LABELS[cat]} selected. Pick one to complete your build.`,
      });
      continue;
    }

    const errors = errorMessages.get(cat) || [];
    const warnings = warningMessages.get(cat) || [];

    let rating: Rating = 'good';
    let message = '';

    if (errors.length > 0) {
      rating = 'incompatible';
      message = errors[0];
    } else if (warnings.length > 0) {
      rating = 'suboptimal';
      message = warnings[0];
    } else {
      message = generatePositiveEvaluation(cat, comp);
    }

    evaluations.push({
      category: cat,
      componentName: comp.name,
      rating,
      message,
    });
  }

  return evaluations;
}

function generatePositiveEvaluation(cat: string, comp: ComponentWithSpecs): string {
  const specs = comp.electrical_specs;
  const price = Number(comp.price);
  const quality = comp.quality_score;

  switch (cat) {
    case 'frame': {
      const sizeMatch = comp.name.match(/(\d+(?:\.\d+)?)"\s*(?:Frame|frame)/);
      const size = sizeMatch ? sizeMatch[1] : '';
      if (quality >= 9) return `Excellent ${size}" frame — premium carbon fiber construction with great rigidity.`;
      if (quality >= 7) return `Solid ${size}" frame. Good durability for the price.`;
      return `Budget-friendly ${size}" frame. Adequate for casual flying.`;
    }
    case 'motor': {
      const kvMatch = comp.name.match(/(\d+)KV/);
      const kv = kvMatch ? kvMatch[1] : '';
      if (quality >= 9) return `Top-tier ${kv}KV motor — smooth power delivery and excellent thermal management.`;
      if (quality >= 7) return `Good ${kv}KV motor with reliable performance. Great value pick.`;
      return `Affordable ${kv}KV motor. Fine for beginners, may lack punch for aggressive flying.`;
    }
    case 'esc': {
      const amps = specs?.max_current_a;
      if (quality >= 9) return `Premium ${amps}A ESC — excellent thermal headroom and smooth throttle response.`;
      if (quality >= 7) return `Reliable ${amps}A ESC. Sufficient current for most flying styles.`;
      return `Budget ${amps}A ESC. Works but consider upgrading if you push hard.`;
    }
    case 'flight_controller': {
      if (quality >= 9) return `High-end F7 flight controller — fast loop times and plenty of UART ports.`;
      if (quality >= 7) return `Solid flight controller. Handles Betaflight tuning with ease.`;
      return `Basic FC. Functional but limited for advanced features.`;
    }
    case 'propeller': {
      const sizeMatch = comp.name.match(/(\d+(?:\.\d+)?)"\s*Props/);
      const size = sizeMatch ? sizeMatch[1] : '';
      if (quality >= 9) return `Premium ${size}" props — excellent thrust efficiency and durability.`;
      return `Standard ${size}" props. Good all-around performance.`;
    }
    case 'battery': {
      const sCount = specs?.max_voltage_s;
      if (quality >= 9) return `High-quality ${sCount}S pack — excellent discharge rate and cycle life.`;
      if (quality >= 7) return `Reliable ${sCount}S battery. Good punch for freestyle.`;
      return `Budget ${sCount}S pack. Acceptable for casual flying, may sag under load.`;
    }
    case 'camera': {
      const isDigital = specs?.protocol === 'Digital';
      if (quality >= 9) return isDigital ? `Premium digital camera — cinematic quality with low latency.` : `Excellent analog camera — superb dynamic range and low noise.`;
      if (quality >= 7) return `Good camera with clear image. Great for freestyle and racing.`;
      return `Entry-level camera. Gets you in the air but image quality is basic.`;
    }
    case 'vtx': {
      const powerMatch = comp.name.match(/(\d+)mW/);
      const power = powerMatch ? powerMatch[1] : '';
      if (quality >= 9) return `Premium ${power}mW VTX — clean video and great range.`;
      return `Reliable ${power}mW VTX. Sufficient for most flying scenarios.`;
    }
    case 'receiver': {
      if (quality >= 9) return `Top-tier receiver — rock-solid link with excellent range and telemetry.`;
      if (quality >= 7) return `Good receiver with reliable connection. Great for most pilots.`;
      return `Basic receiver. Functional but may lose signal at range.`;
    }
    default:
      return 'Good choice.';
  }
}

const RATING_CONFIG = {
  good: { icon: ThumbsUp, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', label: 'Good Choice' },
  suboptimal: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20', label: 'Room to Improve' },
  incompatible: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Incompatible' },
  missing: { icon: AlertTriangle, color: 'text-slate-500', bg: 'bg-slate-800/30', border: 'border-slate-700/30', label: 'Not Selected' },
};

type Props = {
  selectedParts: SelectedParts;
  components: ComponentWithSpecs[];
  compatibility: DetailedCompatibilityResult;
};

export default function AIAdvisor({ selectedParts, components, compatibility }: Props) {
  const evaluations = useMemo(
    () => evaluateSelections(selectedParts, components, compatibility),
    [selectedParts, components, compatibility]
  );

  const goodCount = evaluations.filter((e) => e.rating === 'good').length;
  const totalCount = evaluations.length;

  return (
    <div className="border-b border-slate-800 h-full flex flex-col min-h-0 overflow-hidden">
      <div className="p-3 flex flex-col min-h-0 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Engineering Advisor</h2>
          <span className="ml-auto text-[10px] text-slate-500">{goodCount}/{totalCount} optimal</span>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'scroll' }} className="space-y-2 pr-1">
          {evaluations.map((ev) => {
            const config = RATING_CONFIG[ev.rating];
            const Icon = config.icon;
            return (
              <div
                key={ev.category}
                className={cn('rounded-lg border p-2 transition-colors', config.bg, config.border)}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-slate-300 uppercase">{CATEGORY_LABELS[ev.category]}</span>
                      <span className={cn('text-[9px] font-medium', config.color)}>
                        {config.label}
                      </span>
                    </div>
                    {ev.componentName && (
                      <p className="text-[10px] text-slate-400 truncate mb-0.5">{ev.componentName}</p>
                    )}
                    <p className="text-[10px] text-slate-500 leading-snug">{ev.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
