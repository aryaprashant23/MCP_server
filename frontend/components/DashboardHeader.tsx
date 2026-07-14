'use client';

import { useDashboardContext } from './DashboardProvider';

export function DashboardHeader() {
  const { range, setRange } = useDashboardContext();

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-white/10 pb-6 gap-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Weekly Review Pulse
        </h1>
        <p className="text-gray-400 mt-2">Actionable insights from your users.</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex space-x-2 bg-white/5 p-1 rounded-lg border border-white/10">
          {['7d', '15d', '30d'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                range === r 
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="hidden sm:block text-xs text-gray-500">
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>
    </header>
  );
}
