'use client';

import { useMemo } from 'react';
import {
  Clock, Gauge, Zap, Wind, Shield, Video, TrendingUp, Activity,
} from 'lucide-react';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';
import { calculatePerformance } from '@/lib/performance';
import { cn } from '@/lib/utils';

type Props = {
  selectedParts: SelectedParts;
  components: ComponentWithSpecs[];
};

export default function PerformanceDashboard({ selectedParts, components }: Props) {
  const perf = useMemo(
    () => calculatePerformance(selectedParts, components),
    [selectedParts, components]
  );

  const selectedCount = Object.values(selectedParts).filter((id) => id && id !== 'skip').length;

  if (selectedCount === 0) {
    return (
      <div className="border-b border-slate-800 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Performance Predictions</h2>
        </div>
        <p className="text-[10px] text-slate-600">Select parts to see flight predictions.</p>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-800 p-3">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-cyan-400" />
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Performance Predictions</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Flight Time */}
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">Flight Time</span>
          </div>
          <p className="text-sm font-bold text-cyan-300">
            {perf.flightTimeHover > 0 ? `${perf.flightTimeHover}m` : '--'}
          </p>
          <p className="text-[9px] text-slate-600">
            Hover · {perf.flightTimeAggressive > 0 ? `${perf.flightTimeAggressive}m` : '--'} aggressive
          </p>
        </div>

        {/* Thrust-to-Weight */}
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">Thrust:Weight</span>
          </div>
          <p className="text-sm font-bold text-amber-300">
            {perf.thrustToWeightRatio > 0 ? `${perf.thrustToWeightRatio}:1` : '--'}
          </p>
          <p className="text-[9px] text-slate-600">
            {perf.thrustToWeightRatio >= 8 ? 'Excellent power' : perf.thrustToWeightRatio >= 4 ? 'Good power' : 'Add parts'}
          </p>
        </div>

        {/* Max Speed */}
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Gauge className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">Est. Top Speed</span>
          </div>
          <p className="text-sm font-bold text-emerald-300">
            {perf.estimatedMaxSpeed > 0 ? `${perf.estimatedMaxSpeed} mph` : '--'}
          </p>
        </div>

        {/* Weight */}
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Wind className="w-3 h-3 text-slate-400" />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">Total Weight</span>
          </div>
          <p className="text-sm font-bold text-slate-200">
            {perf.totalWeightG > 0 ? `${perf.totalWeightG}g` : '--'}
          </p>
          <p className="text-[9px] text-slate-600">
            {perf.totalWeightG > 0 && perf.totalWeightG < 250 ? 'Sub-250g' : ''}
          </p>
        </div>
      </div>

      {/* Rating bars */}
      <div className="mt-3 space-y-1.5">
        <RatingBar label="Agility" value={perf.agilityRating} icon={TrendingUp} color="cyan" />
        <RatingBar label="Stability" value={perf.stabilityRating} icon={Shield} color="emerald" />
        <RatingBar label="Speed" value={perf.speedRating} icon={Gauge} color="amber" />
      </div>

      {/* Video quality */}
      <div className="mt-2 flex items-center gap-1.5 p-2 rounded-lg bg-slate-800/30 border border-slate-700/20">
        <Video className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] text-slate-500">Video System:</span>
        <span className={cn(
          'text-[10px] font-medium',
          perf.videoQuality === 'Digital HD' ? 'text-cyan-300' : perf.videoQuality === 'Analog' ? 'text-amber-300' : 'text-slate-600'
        )}>
          {perf.videoQuality}
        </span>
      </div>
    </div>
  );
}

function RatingBar({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'cyan' | 'emerald' | 'amber';
}) {
  const colorMap = {
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  };
  const textMap = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
  };

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('w-3 h-3', textMap[color])} />
      <span className="text-[10px] text-slate-400 w-16">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorMap[color])}
          style={{ width: `${Math.min(value * 10, 100)}%` }}
        />
      </div>
      <span className={cn('text-[10px] font-medium', textMap[color])}>{value}/10</span>
    </div>
  );
}
