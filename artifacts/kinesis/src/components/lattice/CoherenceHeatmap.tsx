import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Agent {
  id: string;
  name: string;
  coherence: {
    planes: {
      protocol: number;
      fidelity: number;
      synergy: number;
      knowledge: number;
      adaptivity: number;
    };
    composite: number;
    isSilent: boolean;
  } | null;
  isSilent: boolean;
}

interface Props {
  topology: { agents: Agent[] } | null;
}

const PLANE_COLORS = {
  protocol: '#00f5c4',
  fidelity: '#38bdf8',
  synergy: '#a78bfa',
  knowledge: '#fbbf24',
  adaptivity: '#f97316',
};

const PLANE_LABELS: Record<string, string> = {
  protocol: 'Π Protocol',
  fidelity: 'Φ Fidelity',
  synergy: 'Σ Synergy',
  knowledge: 'Κ Knowledge',
  adaptivity: 'Α Adaptivity',
};

// @ts-ignore
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1928] border border-[#1e2d3d] p-3 rounded text-xs font-mono">
      <div className="text-[#e2e8f0] mb-2 font-bold">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
          <span className="text-[#6b7280]">{PLANE_LABELS[entry.name as keyof typeof PLANE_LABELS]}:</span>
          <span style={{ color: entry.fill }}>{(entry.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};

export function CoherenceHeatmap({ topology }: Props) {
  if (!topology || topology.agents.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[#6b7280] text-xs">
        Awaiting agent data...
      </div>
    );
  }

  const data = topology.agents.map(agent => ({
    name: agent.name.length > 10 ? agent.name.slice(0, 10) : agent.name,
    protocol: agent.coherence?.planes.protocol ?? 0,
    fidelity: agent.coherence?.planes.fidelity ?? 0,
    synergy: agent.coherence?.planes.synergy ?? 0,
    knowledge: agent.coherence?.planes.knowledge ?? 0,
    adaptivity: agent.coherence?.planes.adaptivity ?? 0,
    isSilent: agent.isSilent,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 20, bottom: 0, left: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#1e2d3d' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#e2e8f0', fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#1e2d3d' }}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e2d3d44' }} />
        {Object.entries(PLANE_COLORS).map(([plane, color]) => (
          <Bar key={plane} dataKey={plane} stackId="a" fill={color} maxBarSize={14}>
            {data.map((entry, index) => (
              <Cell
                key={`${plane}-${index}`}
                fill={entry.isSilent ? '#ff4d4d44' : color}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
