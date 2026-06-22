'use client';

import { motion } from 'framer-motion';

interface Props {
  topology: {
    agents: any[];
    edges: any[];
    moat: number;
    volatility: number;
    activeSilences: number;
  } | null;
}

function Metric({ label, value, color, unit }: {
  label: string;
  value: string;
  color: string;
  unit?: string;
}) {
  return (
    <motion.div
      className="flex flex-col items-center px-6 py-3 border-r border-[#1e2d3d] last:border-r-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
        {unit && <span className="text-sm ml-1 text-[#6b7280]">{unit}</span>}
      </div>
    </motion.div>
  );
}

export function MetricsStrip({ topology }: Props) {
  const agents = topology?.agents ?? [];
  const edges = topology?.edges ?? [];
  const silences = topology?.activeSilences ?? 0;
  const moat = topology?.moat ?? 0;
  const volatility = topology?.volatility ?? 0;

  const avgCoherence = agents.length > 0
    ? agents.reduce((sum, a) => sum + (a.coherence?.composite ?? 0.5), 0) / agents.length
    : 0;

  const activeAgents = agents.filter(a => !a.isSilent).length;

  return (
    <div className="border-b border-[#1e2d3d] flex overflow-x-auto bg-[#0f1928]">
      <Metric label="Agents" value={String(agents.length)} color="#00f5c4" />
      <Metric label="Active" value={String(activeAgents)} color="#38bdf8" />
      <Metric label="Delegations" value={String(edges.length)} color="#a78bfa" />
      <Metric label="Silences" value={String(silences)} color={silences > 0 ? '#ff4d4d' : '#6b7280'} />
      <Metric label="Avg Ξ(a,t)" value={avgCoherence.toFixed(3)} color="#00f5c4" />
      <Metric label="Moat Λ(t)" value={moat.toFixed(3)} color="#fbbf24" />
      <Metric label="Volatility V(t)" value={(volatility * 100).toFixed(1)} color="#f97316" unit="%" />
      <Metric
        label="Lattice Health"
        value={silences === 0 ? 'OPTIMAL' : silences <= 1 ? 'DEGRADED' : 'CRITICAL'}
        color={silences === 0 ? '#00f5c4' : silences <= 1 ? '#ffbb28' : '#ff4d4d'}
      />
    </div>
  );
}
