import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  moat: number;
  volatility: number;
  activeSilences: number;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Dashboard() {
  const [topology, setTopology] = useState<LatticeTopology | null>(null);
  const [moatHistory, setMoatHistory] = useState<{ time: number; moat: number }[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [silenceEvents, setSilenceEvents] = useState<string[]>([]);

  const connectWebSocket = useCallback(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'topology') {
            const topo: LatticeTopology = msg.data;
            setTopology(topo);
            setLastUpdate(new Date());

            setMoatHistory(prev => [
              ...prev.slice(-59),
              { time: Date.now(), moat: topo.moat },
            ]);

            const silentAgents = topo.agents.filter(a => a.isSilent);
            if (silentAgents.length > 0) {
              const eventStr = `${new Date().toLocaleTimeString()}: ${silentAgents.map(a => a.name).join(', ')} entered silence`;
              setSilenceEvents(prev => [eventStr, ...prev.slice(0, 19)]);
            }
          }
        } catch (err) {
          console.error('Failed to parse WS message', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    } catch (err) {
      setTimeout(connectWebSocket, 3000);
    }

    return () => ws?.close();
  }, []);

  useEffect(() => {
    const cleanup = connectWebSocket();
    return cleanup;
  }, [connectWebSocket]);

  const spawnAgent = async () => {
    try {
      await fetch(`${API_URL}/api/v1/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `agent-${Date.now()}`, mockData: true }),
      });
    } catch (err) {
      console.error('Failed to spawn agent', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e2e8f0] font-mono">
      <header className="border-b border-[#1e2d3d] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[#00f5c4] text-xl font-bold tracking-wider">
            ⬡ KINESIS
          </div>
          <div className="text-[#6b7280] text-xs">
            The Living Delegation Lattice
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#00f5c4] lattice-pulse' : 'bg-[#ff4d4d]'}`} />
            <span className={connected ? 'text-[#00f5c4]' : 'text-[#ff4d4d]'}>
              {connected ? 'LATTICE LIVE' : 'RECONNECTING...'}
            </span>
          </div>

          {lastUpdate && (
            <div className="text-[#6b7280]">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}

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
            Lattice Topology — Delegation Graph
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
        KINESIS v0.1.0 · Terminal 3 TEE Infrastructure · Trust is earned, not given.
        The lattice remembers.
      </footer>
    </div>
  );
}
