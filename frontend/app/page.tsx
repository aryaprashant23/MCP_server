import { KPICards } from '@/components/KPICards';
import { TrendsChart } from '@/components/TrendsChart';
import { ImprovementAreas } from '@/components/ImprovementAreas';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-sans">
      {/* Background Gradients for Glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-8">
        <header className="flex justify-between items-end border-b border-white/10 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Weekly Review Pulse
            </h1>
            <p className="text-gray-400 mt-2">Actionable insights from your users.</p>
          </div>
          <div className="hidden sm:block text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </header>

        <section>
          <KPICards />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
          <div className="lg:col-span-2 h-full">
            <TrendsChart />
          </div>
          <div className="h-full">
            <ImprovementAreas />
          </div>
        </section>
      </main>
    </div>
  );
}
