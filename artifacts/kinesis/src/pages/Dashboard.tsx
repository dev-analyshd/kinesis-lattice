import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { LatticeGraph } from '@/components/lattice/LatticeGraph';
import { CoherenceHeatmap } from '@/components/lattice/CoherenceHeatmap';
import { MetricsStrip } from '@/components/metrics/MetricsStrip';
import { MoatCurve } from '@/components/metrics/MoatCurve';
import { SilenceFeed } from '@/components/metrics/SilenceFeed';

interface Agent {
  id: string;
  name: string;
  did: string;
  coherence: {
    composite: number;
    threshold: number;
    isSilent: boolean;
    planes: {
      protocol: number;
      fidelity: number;
      synergy: number;
      knowledge: number;
      adaptivity: number;
    };
    limitingPlane?: string;
    deficit?: number;
  } | null;
  isSilent: boolean;
  jurisdiction: string;
  totalActions: number;
}

interface Edge {
  from: string;
  to: string;
  weight: number;
}

interface LatticeTopology {
  agents: Agent[];
  edges: Edge[];
  delegations?: Edge[];
  moat: number;
  volatility: number;
  activeSilences: number;
}

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

function getApiUrl(path: string): string {
  return `/api/v1${path}`;
}

export default function Dashboard() {
  const [topology, setTopology] = useState<LatticeTopology | null>(null);
  const [moatHistory, setMoatHistory] = useState<{ time: number; moat: number }[]>([]);
  const [silenceEvents, setSilenceEvents] = useState<string[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus('connecting');
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('live');
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as { type: string; data: LatticeTopology };
        if (msg.type === 'topology' && msg.data) {
          const data = msg.data;
          const edges = data.edges || data.delegations || [];
          const topo: LatticeTopology = { ...data, edges };
          setTopology(topo);
          setMoatHistory(prev => [...prev.slice(-59), { time: Date.now(), moat: data.moat }]);

          const silentAgents = (data.agents || []).filter(a => a.isSilent);
          if (silentAgents.length > 0) {
            const eventStr = `${new Date().toLocaleTimeString()}: ${silentAgents.map(a => a.name).join(', ')} in structured silence`;
            setSilenceEvents(prev => [eventStr, ...prev.slice(0, 19)]);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setWsStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(connectWs, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connectWs]);

  const spawnAgent = async () => {
    try {
      const res = await fetch(getApiUrl('/agents/spawn'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mockData: true }),
      });
      const data = await res.json();
      if (!data.success) console.warn('Spawn failed', data.error);
    } catch (err) {
      console.error('Failed to spawn agent', err);
    }
  };

  const statusColor = wsStatus === 'live' ? '#00f5c4' : wsStatus === 'reconnecting' ? '#f59e0b' : '#6b7280';
  const statusLabel = wsStatus === 'live' ? 'LATTICE LIVE' : wsStatus === 'reconnecting' ? 'RECONNECTING' : 'CONNECTING';

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e2e8f0] font-mono">
      <header className="border-b border-[#1e2d3d] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[#00f5c4] text-xl font-bold tracking-wider">⬡ KINESIS</div>
          <div className="text-[#6b7280] text-xs">The Living Delegation Lattice</div>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
            />
            <span style={{ color: statusColor }}>{statusLabel}</span>
          </div>
          <div className="text-[#4b5563] text-xs">
            {topology ? `${topology.agents.length} agents · ${topology.edges.length} edges` : 'Waiting for data...'}
          </div>
          <div className="text-[#6b7280]">T3N TEE ✓</div>
          <button
            onClick={spawnAgent}
            className="px-3 py-1 border border-[#00f5c4] text-[#00f5c4] text-xs rounded hover:bg-[#00f5c4] hover:text-[#0a0f1e] transition-colors"
          >
            + SPAWN AGENT
          </button>
        </div>
      </header>

      <MetricsStrip topology={topology} />

      <div className="grid grid-cols-12 gap-4 p-4">
        <motion.div
          className="col-span-7 bg-[#0f1928] border border-[#1e2d3d] rounded-lg p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="text-xs text-[#6b7280] mb-3 uppercase tracking-widest">
            Lattice Topology — Delegation Graph · did:t3n: anchored
          </div>
          <LatticeGraph topology={topology} />
        </motion.div>

        <div className="col-span-5 flex flex-col gap-4">
          <motion.div
            className="bg-[#0f1928] border border-[#1e2d3d] rounded-lg p-4"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="text-xs text-[#6b7280] mb-3 uppercase tracking-widest">
              Five-Plane Coherence: Ξ(a,t) = 0.30Π + 0.25Φ + 0.20Σ + 0.15Κ + 0.10Α
            </div>
            <CoherenceHeatmap topology={topology} />
          </motion.div>

          <motion.div
            className="bg-[#0f1928] border border-[#1e2d3d] rounded-lg p-4"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="text-xs text-[#6b7280] mb-3 uppercase tracking-widest">
              Lattice Moat Λ(t) — Compounding Trust Capital
            </div>
            <MoatCurve history={moatHistory} />
          </motion.div>
        </div>

        <motion.div
          className="col-span-12 bg-[#0f1928] border border-[#1e2d3d] rounded-lg p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="text-xs text-[#6b7280] mb-3 uppercase tracking-widest">
            Structured Silence Registry — Agent Recovery Feed
          </div>
          <SilenceFeed topology={topology} events={silenceEvents} />
        </motion.div>
      </div>

      <footer className="border-t border-[#1e2d3d] px-6 py-3 text-center text-xs text-[#6b7280]">
        KINESIS v0.1.0 · Terminal 3 TEE Infrastructure · T3N Agent Auth SDK · Trust is earned, not given. The lattice remembers.
      </footer>
    </div>
  );
}
