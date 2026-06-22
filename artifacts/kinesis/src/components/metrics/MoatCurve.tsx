import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Props {
  history: { time: number; moat: number }[];
}

// @ts-ignore
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1928] border border-[#1e2d3d] p-2 rounded text-xs font-mono">
      <div className="text-[#fbbf24]">Λ(t) = {payload[0].value.toFixed(4)}</div>
    </div>
  );
};

export function MoatCurve({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-[#6b7280] text-xs">
        Accumulating moat data...
      </div>
    );
  }

  const data = history.map((h, i) => ({
    tick: i,
    moat: h.moat,
    time: new Date(h.time).toLocaleTimeString(),
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="moatGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
        <XAxis
          dataKey="tick"
          tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#1e2d3d' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#1e2d3d' }}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="moat"
          stroke="#fbbf24"
          strokeWidth={2}
          fill="url(#moatGrad)"
          dot={false}
          activeDot={{ r: 3, fill: '#fbbf24' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
