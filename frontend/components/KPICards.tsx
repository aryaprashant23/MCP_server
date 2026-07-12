'use client';

import { useEffect, useState } from 'react';
import { Activity, MessageSquare, Star, TrendingUp } from 'lucide-react';
import type { KPIMetrics } from '@/lib/db';

export function KPICards() {
  const [metrics, setMetrics] = useState<KPIMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card 
        title="Total Reviews" 
        value={metrics.totalReviews.toLocaleString()} 
        icon={<MessageSquare className="w-5 h-5 text-blue-400" />}
        trend="+12% from last week"
        trendUp={true}
        color="from-blue-500/20 to-indigo-500/10"
      />
      <Card 
        title="Average Rating" 
        value={metrics.averageRating.toFixed(1)} 
        icon={<Star className="w-5 h-5 text-yellow-400" />}
        trend="+0.2 from last week"
        trendUp={true}
        color="from-yellow-500/20 to-orange-500/10"
      />
      <Card 
        title="Sentiment Score" 
        value={`${metrics.sentimentScore}%`} 
        icon={<Activity className="w-5 h-5 text-emerald-400" />}
        trend="-5% from last week"
        trendUp={false}
        color="from-emerald-500/20 to-teal-500/10"
      />
    </div>
  );
}

function Card({ title, value, icon, trend, trendUp, color }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${color} bg-opacity-20 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-emerald-500/10`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-gray-400 font-medium text-sm tracking-wide">{title}</h3>
        <div className="p-2 bg-black/30 rounded-lg backdrop-blur-md border border-white/5">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <h2 className="text-4xl font-bold text-white tracking-tight">{value}</h2>
      </div>
      <div className="mt-4 flex items-center space-x-2">
        <TrendingUp className={`w-4 h-4 ${trendUp ? 'text-emerald-400' : 'text-red-400 transform rotate-180'}`} />
        <span className={`text-sm ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>{trend}</span>
      </div>
    </div>
  );
}
