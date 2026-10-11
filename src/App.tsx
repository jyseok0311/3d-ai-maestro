import { useEffect } from 'react';
import { SIM_INTERVAL_MS, useWarehouseStore } from './store/useWarehouseStore';
import { WarehouseScene } from './scene/WarehouseScene';
import { TopBar } from './ui/TopBar';
import { FilterPanel } from './ui/FilterPanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { Legend } from './ui/Legend';

export function App() {
  const running = useWarehouseStore((s) => s.running);
  const tick = useWarehouseStore((s) => s.tick);

  // Live feed: advance the simulation every 2 seconds while running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(tick, SIM_INTERVAL_MS);
    return () => clearInterval(t);
  }, [running, tick]);

  return (
    <div className="app">
      <WarehouseScene />
      <TopBar />
      <FilterPanel />
      <InspectorPanel />
      <Legend />
    </div>
  );
}
