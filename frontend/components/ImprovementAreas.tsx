'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Flag } from 'lucide-react';
import type { ImprovementArea } from '@/lib/db';

export function ImprovementAreas() {
  const [areas, setAreas] = useState<ImprovementArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/areas')
      .then(res => res.json())
      .then(data => {
        setAreas(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl h-full flex flex-col">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-rose-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-rose-400" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-wide">Immediate Actions</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white/5 rounded-2xl h-24 border border-white/5"></div>
          ))
        ) : (
          areas.map(area => (
            <div 
              key={area.id} 
              className="group relative bg-white/5 hover:bg-white/10 transition-colors duration-300 rounded-2xl p-4 border border-white/5 hover:border-white/20"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{area.theme}</span>
                  <span className="text-xs text-gray-500 bg-black/50 px-2 py-0.5 rounded-full">
                    {area.count} mentions
                  </span>
                </div>
                <PriorityBadge priority={area.priority} />
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                {area.description}
              </p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles = {
    High: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }[priority] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border text-xs font-medium ${styles}`}>
      <Flag className="w-3 h-3" />
      <span>{priority}</span>
    </div>
  );
}
