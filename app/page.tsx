'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Plane, Github, Sparkles, Check, ArrowRight, Rocket, ArrowLeft, Box,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ComponentWithSpecs, Builder, SelectedParts, FulfillmentType } from '@/lib/supabase';
import { runCompatibilityEngine } from '@/lib/compatibilityEngine';
import type { DetailedCompatibilityResult } from '@/lib/compatibilityEngine';
import BuildSummary from '@/components/build-summary';
import CategoryModal from '@/components/category-modal';
import ConfigAudit from '@/components/config-audit';
import { cn } from '@/lib/utils';

const Drone3DCanvas = dynamic(() => import('@/components/drone-3d-canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full">
      <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  ),
});

const CATEGORIES = [
  { key: 'goggles', label: 'Goggles' },
  { key: 'remote', label: 'Remote' },
  { key: 'frame', label: 'Frame' },
  { key: 'motor', label: 'Motors' },
  { key: 'esc', label: 'ESCs' },
  { key: 'propeller', label: 'Propellers' },
  { key: 'flight_controller', label: 'Flight Controller' },
  { key: 'battery', label: 'Battery' },
  { key: 'camera', label: 'Camera / VTX' },
  { key: 'receiver', label: 'Accessories' },
  { key: 'audit', label: 'AI Audit' },
] as const;

const SELECTION_CATEGORIES = CATEGORIES.filter((c) => c.key !== 'audit');

export default function Home() {
  const [components, setComponents] = useState<ComponentWithSpecs[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedParts, setSelectedParts] = useState<SelectedParts>({});
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('kit');
  const [selectedBuilderId, setSelectedBuilderId] = useState<string | null>(null);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [show3DPreview, setShow3DPreview] = useState(false);

  const loadData = useCallback(async () => {
    if (dataLoaded || loadingData) return;
    setLoadingData(true);
    const [compRes, builderRes] = await Promise.all([
      supabase.from('components').select('*, electrical_specs(*)').order('category', { ascending: true }).order('price', { ascending: false }),
      supabase.from('builders').select('*').order('rating', { ascending: false }),
    ]);
    if (compRes.data) setComponents(compRes.data as ComponentWithSpecs[]);
    if (builderRes.data) setBuilders(builderRes.data as Builder[]);
    setDataLoaded(true);
    setLoadingData(false);
  }, [dataLoaded, loadingData]);

  const handleStartModeling = useCallback(() => {
    setStarted(true);
    loadData();
    setModalCategory('frame');
  }, [loadData]);

  const handleSelect = useCallback((category: string, componentId: string) => {
    setSelectedParts((prev) => ({ ...prev, [category]: componentId }));
  }, []);

  const handleSkip = useCallback(() => {
    if (!modalCategory) return;
    setSelectedParts((prev) => ({ ...prev, [modalCategory]: 'skip' }));
  }, [modalCategory]);

  const handleNext = useCallback(() => {
    if (!modalCategory) return;
    const currentIdx = SELECTION_CATEGORIES.findIndex((c) => c.key === modalCategory);
    if (currentIdx === -1) {
      setModalCategory(null);
      return;
    }
    const nextCat = SELECTION_CATEGORIES[currentIdx + 1];
    if (nextCat) {
      setModalCategory(nextCat.key);
    } else {
      setModalCategory(null);
      setShowAuditPanel(true);
    }
  }, [modalCategory]);

  const handleTabClick = useCallback((key: string) => {
    if (key === 'audit') {
      setShowAuditPanel(true);
    } else {
      setModalCategory(key);
    }
  }, []);

  const handleShow3D = useCallback(() => {
    setShow3DPreview(true);
  }, []);

  const handleBackToSelection = useCallback(() => {
    setShow3DPreview(false);
  }, []);

  const compatibility = useMemo<DetailedCompatibilityResult>(
    () => runCompatibilityEngine(selectedParts, components),
    [selectedParts, components]
  );

  const frame = useMemo(
    () => selectedParts.frame ? components.find((c) => c.id === selectedParts.frame) : undefined,
    [selectedParts, components]
  );

  const selectedCount = useMemo(
    () => Object.values(selectedParts).filter((v) => v && v !== 'skip').length,
    [selectedParts]
  );
  const completedCount = useMemo(
    () => Object.values(selectedParts).filter(Boolean).length,
    [selectedParts]
  );

  const errorCount = compatibility.issues.filter((i) => i.level === 'error').length;
  const warningCount = compatibility.issues.filter((i) => i.level === 'warning').length;

  const statusText = completedCount === 0
    ? `Build Status: 0/11 Selected • Start with a Frame`
    : errorCount > 0
    ? `Build Status: ${completedCount}/11 Selected • ${errorCount} Error${errorCount > 1 ? 's' : ''}`
    : warningCount > 0
    ? `Build Status: ${completedCount}/11 Selected • ${warningCount} Warning${warningCount > 1 ? 's' : ''}`
    : completedCount === 11
    ? `Build Status: 11/11 Selected • All Compatible`
    : `Build Status: ${completedCount}/11 Selected • ${frame ? 'Frame OK' : 'Pick a Frame'}`;

  const statusColor = errorCount > 0
    ? 'text-red-300 bg-red-500/15 border-red-500/30'
    : warningCount > 0
    ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : completedCount === 11
    ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : 'text-slate-300 bg-slate-800/60 border-slate-700/50';

  return (
    <div className="relative h-screen w-screen bg-slate-950 overflow-hidden">
      {/* Full-screen 3D Canvas — only after started */}
      {started && (
        <div className="absolute inset-0">
          <Drone3DCanvas
            selectedParts={selectedParts}
            components={components}
          />
        </div>
      )}

      {/* Landing screen — before Start Modeling */}
      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-2xl shadow-cyan-500/30">
              <Plane className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">DroneForge</h1>
              <p className="text-sm text-slate-400 mt-1">Custom Drone Configurator</p>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Design and build your custom FPV drone from the ground up. Select components, verify compatibility, and get a full engineering audit — all in 3D.
            </p>
            <button
              onClick={handleStartModeling}
              disabled={loadingData}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-base shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              {loadingData ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Start Modeling
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Clean Floating Header — logo + status only */}
      {started && (
        <>
          <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5 bg-slate-900/70 backdrop-blur-md border-b border-slate-800/60">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white tracking-tight">DroneForge</h1>
                <p className="text-[9px] text-slate-500 -mt-0.5">Custom Drone Configurator</p>
              </div>
            </div>

            {/* Compact category pills */}
            <div className="flex items-center gap-0.5 overflow-x-auto flex-1 justify-center px-2">
              {CATEGORIES.map((cat) => {
                const isSelected = !!selectedParts[cat.key];
                const isAudit = cat.key === 'audit';
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleTabClick(cat.key)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                      isSelected || isAudit
                        ? 'bg-cyan-500/15 border border-cyan-500/50 text-cyan-300'
                        : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    )}
                  >
                    <span>{cat.label.split(' ')[0]}</span>
                    {isSelected && (
                      <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <a href="/admin" className="flex items-center justify-center px-2.5 h-8 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs font-medium">Admin</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                <Github className="w-3.5 h-3.5" />
              </a>
            </div>
          </header>

          {/* Floating Build Status Widget */}
          <div className={cn(
            'absolute top-14 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-medium transition-all',
            statusColor
          )}>
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{statusText}</span>
          </div>

          {/* Floating Selected Parts Summary (bottom-left) */}
          {selectedCount > 0 && (
            <div className="absolute bottom-4 left-4 z-20 max-w-xs">
              <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800/60 rounded-xl p-3 space-y-1.5">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Selected Parts</h3>
                {SELECTION_CATEGORIES.map((cat) => {
                  const comp = selectedParts[cat.key] ? components.find((c) => c.id === selectedParts[cat.key]) : null;
                  const isSkipped = selectedParts[cat.key] === 'skip';
                  if (!comp && !isSkipped) return null;
                  return (
                    <div key={cat.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 flex-shrink-0">{cat.label.split(' ')[0]}:</span>
                      <span className="text-slate-300 truncate">{comp ? comp.name : 'Owned (skipped)'}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800">
                  <span className="text-[10px] text-slate-500">{completedCount}/11 selected</span>
                  <button
                    onClick={() => handleTabClick('audit')}
                    className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    View Audit →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Panel */}
          {showAuditPanel && (
            <div className="absolute top-14 right-4 bottom-4 z-30 w-[420px] max-w-[calc(100vw-2rem)]">
              <div className="h-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <h2 className="text-sm font-bold text-white">AI Configuration Audit</h2>
                  <button
                    onClick={() => setShowAuditPanel(false)}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ConfigAudit
                    selectedParts={selectedParts}
                    components={components}
                    compatibility={compatibility}
                  />
                </div>
                <div className="border-t border-slate-800 p-3">
                  <BuildSummary
                    components={components}
                    builders={builders}
                    selectedParts={selectedParts}
                    compatibility={compatibility}
                    fulfillmentType={fulfillmentType}
                    onFulfillmentChange={setFulfillmentType}
                    selectedBuilderId={selectedBuilderId}
                    onBuilderChange={setSelectedBuilderId}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3D Preview floating button — visible when modal is hidden for 3D inspection */}
      {show3DPreview && modalCategory !== null && (
        <button
          onClick={handleBackToSelection}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-2xl shadow-cyan-500/40 hover:scale-[1.02] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Selection
        </button>
      )}

      {/* Category Modal — hidden while 3D preview is open */}
      <CategoryModal
        isOpen={modalCategory !== null && !show3DPreview}
        onClose={() => setModalCategory(null)}
        onNext={handleNext}
        onShow3D={handleShow3D}
        onSkip={handleSkip}
        category={modalCategory || ''}
        categoryLabel={CATEGORIES.find((c) => c.key === modalCategory)?.label || modalCategory || ''}
        nextCategoryLabel={
          (() => {
            if (!modalCategory) return '';
            const idx = SELECTION_CATEGORIES.findIndex((c) => c.key === modalCategory);
            const next = SELECTION_CATEGORIES[idx + 1];
            return next ? next.label : 'AI Audit';
          })()
        }
        components={components}
        selectedParts={selectedParts}
        onSelect={handleSelect}
        frame={frame}
      />
    </div>
  );
}
