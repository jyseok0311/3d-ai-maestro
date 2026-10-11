import { useEffect } from 'react';
import { SIM_INTERVAL_MS, useMaestroStore } from './store/useMaestroStore';
import { MaestroScene } from './scene/MaestroScene';
import { TopBar } from './ui/TopBar';
import { SidePanel } from './ui/SidePanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { Legend } from './ui/Legend';

export function App() {
  const running = useMaestroStore((s) => s.running);
  const tick = useMaestroStore((s) => s.tick);

  // Live feed: advance the simulation every 2 seconds while running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(tick, SIM_INTERVAL_MS);
    return () => clearInterval(t);
  }, [running, tick]);

  return (
    <div className="app">
      <MaestroScene />
      <TopBar />
      <SidePanel />
      <InspectorPanel />
      <Legend />
    </div>
  );
}
