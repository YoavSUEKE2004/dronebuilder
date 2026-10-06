'use client';

import { useState } from 'react';
import ComponentDrawer from '@/components/ui/ComponentDrawer';
import { CanonicalPart } from '@/lib/catalog';

export default function Configurator() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedFC, setSelectedFC] = useState<CanonicalPart | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">FPV Drone Configurator</h1>

      {/* Component Slot: Flight Controller */}
      <div className="max-w-xs space-y-3">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
          Flight Controller Slot
        </label>
        <button 
          onClick={() => setActiveCategory('flight_controller')}
          className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-blue-500 transition text-left block"
        >
          <div className="text-xs text-zinc-400">Category: Flight Controller</div>
          <div className="font-semibold text-zinc-100 mt-1">
            {selectedFC ? selectedFC.name : 'Click to select Flight Controller...'}
          </div>
        </button>
      </div>

      {/* Selection Drawer */}
      <ComponentDrawer
        category={activeCategory || ''}
        isOpen={!!activeCategory}
        onClose={() => setActiveCategory(null)}
        onSelectPart={(part) => {
          if (part.category === 'flight_controller') setSelectedFC(part);
          setActiveCategory(null);
        }}
      />
    </main>
  );
}