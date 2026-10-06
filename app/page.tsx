'use client';

import { useState } from 'react';
import ComponentDrawer from '@/components/ui/drawer';
import { CanonicalPart } from '@/lib/catalog';
import { validateBuildCompatibility, CompatibilityIssue } from '@/lib/compatibility';

const SLOTS = [
  { id: 'flight_controller', label: 'Flight Controller (FC)' },
  { id: 'esc', label: '4-in-1 ESC' },
  { id: 'motor', label: 'Motors' },
  { id: 'frame', label: 'Frame' },
  { id: 'camera', label: 'FPV Camera' },
];

export default function Configurator() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedParts, setSelectedParts] = useState<Record<string, CanonicalPart>>({});

  const handleSelectPart = (part: CanonicalPart) => {
    setSelectedParts((prev) => ({ ...prev, [part.category]: part }));
    setActiveCategory(null);
  };

  const compatibilityIssues: CompatibilityIssue[] = validateBuildCompatibility({
    flight_controller: selectedParts['flight_controller'],
    esc: selectedParts['esc'],
    motor: selectedParts['motor'],
    battery_cell_count: 6,
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold">FPV Drone Configurator</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Build your quad with real-time physical & electrical validation.
          </p>
        </div>
      </div>

      {/* Real-Time Compatibility Banner */}
      <div className="mb-8 p-4 rounded-xl border bg-zinc-900 border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Compatibility Status:</span>
          {compatibilityIssues.length === 0 ? (
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-medium">
              ✓ All Parts Compatible
            </span>
          ) : (
            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1 rounded-full font-medium">
              {compatibilityIssues.length} Issue(s) Detected
            </span>
          )}
        </div>

        {compatibilityIssues.map((issue) => (
          <div key={issue.id} className="mt-3 p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-xs text-red-200">
            <span className="font-bold uppercase tracking-wider block mb-0.5">{issue.title}</span>
            {issue.message}
          </div>
        ))}
      </div>

      {/* Component Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {SLOTS.map((slot) => {
          const selectedPart = selectedParts[slot.id];
          return (
            <div
              key={slot.id}
              onClick={() => setActiveCategory(slot.id)}
              className="p-5 bg-zinc-900 border border-zinc-800 hover:border-blue-500/60 rounded-xl cursor-pointer transition flex flex-col justify-between h-32"
            >
              <div>
                <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block">
                  {slot.label}
                </span>
                <span className="font-semibold text-zinc-100 text-sm mt-1 block truncate">
                  {selectedPart ? selectedPart.name : `Select ${slot.label}...`}
                </span>
              </div>

              {selectedPart ? (
                <div className="text-xs text-emerald-400 font-medium">
                  {selectedPart.brand} • Configured
                </div>
              ) : (
                <div className="text-xs text-zinc-500">Click to choose part</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selection Drawer */}
      <ComponentDrawer
        category={activeCategory || ''}
        isOpen={!!activeCategory}
        onClose={() => setActiveCategory(null)}
        onSelectPart={handleSelectPart}
      />
    </main>
  );
}