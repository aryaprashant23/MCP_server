import { KPICards } from '@/components/KPICards';
import { TrendsChart } from '@/components/TrendsChart';
import { ImprovementAreas } from '@/components/ImprovementAreas';
import { DashboardProvider } from '@/components/DashboardProvider';
import { DashboardHeader } from '@/components/DashboardHeader';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden font-sans">
      {/* Background Gradients for Glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />

      <DashboardProvider>
        <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-8">
          <DashboardHeader />

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
      </DashboardProvider>
    </div>
  );
}
