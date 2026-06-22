import { useEffect, useState, useCallback, useRef } from 'react';
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

const PLANES = ['protocol', 'fidelity', 'synergy', 'knowledge', 'adaptivity'] as const;
const JURISDICTIONS = ['us-east-1', 'eu-west-2', 'ap-south-1', 'us-west-2', 'sa-east-1'];
const AGENT_NAMES = ['nexus-alpha', 'arbiter-7', 'sentinel-3', 'relay-omega', 'cortex-9', 'herald-2', 'praxis-phi', 'axiom-x'];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function generateInitialAgents(count: number): Agent[] {
  return Array.from({ length: count }, (_, i) => {
    const planes = {
      protocol: rand(0.55, 0.98),
      fidelity: rand(0.55, 0.98),
      synergy: rand(0.55, 0.98),
      knowledge: rand(0.55, 0.98),
      adaptivity: rand(0.55, 0.98),
    };
    const composite = 0.30 * planes.protocol + 0.25 * planes.fidelity + 0.20 * planes.synergy + 0.15 * planes.knowledge + 0.10 * planes.adaptivity;
    const threshold = 0.62;
    const isSilent = composite < threshold;
    return {
      id: `agent-${i}`,
      name: AGENT_NAMES[i % AGENT_NAMES.length],
      did: `did:kinesis:${Math.random().toString(36).slice(2, 10)}`,
      coherence: {
        composite,
        threshold,
        isSilent,
        planes,
        limitingPlane: isSilent ? PLANES[Math.floor(Math.random() * PLANES.length)] : undefined,
        deficit: isSilent ? threshold - composite : undefined,
      },
      isSilent,
      jurisdiction: JURISDICTIONS[i % JURISDICTIONS.length],
      totalActions: Math.floor(rand(10, 500)),
    };
  });
}

function generateEdges(agents: Agent[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < agents.length; i++) {
    const targets = Math.floor(rand(1, 3));
    for (let t = 0; t < targets; t++) {
      const j = (i + 1 + Math.floor(rand(0, agents.length - 1))) % agents.length;
      if (i !== j) {
        edges.push({ from: agents[i].id, to: agents[j].id, weight: rand(0.3, 1.0) });
      }
    }
  }
  return edges;
}

function evolveAgents(agents: Agent[]): Agent[] {
  return agents.map(agent => {
    const drift = 0.015;
    const planes = {
      protocol: clamp(agent.coherence!.planes.protocol + rand(-drift, drift)),
      fidelity: clamp(agent.coherence!.planes.fidelity + rand(-drift, drift)),
      synergy: clamp(agent.coherence!.planes.synergy + rand(-drift, drift)),
      knowledge: clamp(agent.coherence!.planes.knowledge + rand(-drift, drift)),
      adaptivity: clamp(agent.coherence!.planes.adaptivity + rand(-drift, drift)),
    };
    const composite = 0.30 * planes.protocol + 0.25 * planes.fidelity + 0.20 * planes.synergy + 0.15 * planes.knowledge + 0.10 * planes.adaptivity;
    const threshold = 0.62;
    const isSilent = composite < threshold;
    const limitingPlane = isSilent
      ? (Object.entries(planes).sort(([, a], [, b]) => a - b)[0][0] as string)
      : undefined;
    return {
      ...agent,
      isSilent,
      coherence: {
        composite,
        threshold,
        isSilent,
        planes,
        limitingPlane,
        deficit: isSilent ? threshold - composite : undefined,
      },
      totalActions: agent.totalActions + Math.floor(rand(0, 3)),
    };
  });
}

export default function Dashboard() {
  const [topology, setTopology] = useState<LatticeTopology | null>(null);
  const [moatHistory, setMoatHistory] = useState<{ time: number; moat: number }[]>([]);
  const [silenceEvents, setSilenceEvents] = useState<string[]>([]);
  const agentsRef = useRef<Agent[]>([]);
  const moatRef = useRef(rand(0.3, 0.5));
  const spawnCountRef = useRef(0);

  const tick = useCallback(() => {
    if (agentsRef.current.length === 0) {
      agentsRef.current = generateInitialAgents(5);
    } else {
      agentsRef.current = evolveAgents(agentsRef.current);
    }

    const agents = agentsRef.current;
    const edges = generateEdges(agents);
    const silentAgents = agents.filter(a => a.isSilent);
    const avgCoherence = agents.reduce((s, a) => s + (a.coherence?.composite ?? 0), 0) / agents.length;

    moatRef.current = clamp(moatRef.current + rand(-0.002, 0.005), 0, 1);

    const volatility = agents.reduce((s, a) => {
      const vals = Object.values(a.coherence?.planes ?? {});
      const mean = vals.reduce((x, v) => x + v, 0) / vals.length;
      return s + vals.reduce((x, v) => x + Math.abs(v - mean), 0) / vals.length;
    }, 0) / agents.length;

    const topo: LatticeTopology = {
      agents,
      edges,
      moat: moatRef.current,
      volatility,
      activeSilences: silentAgents.length,
    };

    setTopology(topo);
    setMoatHistory(prev => [...prev.slice(-59), { time: Date.now(), moat: moatRef.current }]);

    if (silentAgents.length > 0) {
      const eventStr = `${new Date().toLocaleTimeString()}: ${silentAgents.map(a => a.name).join(', ')} entered silence`;
      setSilenceEvents(prev => [eventStr, ...prev.slice(0, 19)]);
    }
  }, []);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [tick]);

  const spawnAgent = () => {
    spawnCountRef.current += 1;
    const idx = AGENT_NAMES.length + spawnCountRef.current;
    const planes = {
      protocol: rand(0.6, 0.95),
      fidelity: rand(0.6, 0.95),
      synergy: rand(0.6, 0.95),
      knowledge: rand(0.6, 0.95),
      adaptivity: rand(0.6, 0.95),
    };
    const composite = 0.30 * planes.protocol + 0.25 * planes.fidelity + 0.20 * planes.synergy + 0.15 * planes.knowledge + 0.10 * planes.adaptivity;
    const threshold = 0.62;
    const newAgent: Agent = {
      id: `agent-spawned-${idx}`,
      name: `agent-${Date.now().toString(36).slice(-4)}`,
      did: `did:kinesis:${Math.random().toString(36).slice(2, 10)}`,
      coherence: { composite, threshold, isSilent: false, planes },
      isSilent: false,
      jurisdiction: JURISDICTIONS[Math.floor(Math.random() * JURISDICTIONS.length)],
      totalActions: 0,
    };
    agentsRef.current = [...agentsRef.current, newAgent];
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e2e8f0] font-mono">
      <header className="border-b border-[#1e2d3d] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[#00f5c4] text-xl font-bold tracking-wider">⬡ KINESIS</div>
          <div className="text-[#6b7280] text-xs">The Living Delegation Lattice</div>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00f5c4] lattice-pulse" />
            <span className="text-[#00f5c4]">LATTICE LIVE</span>
          </div>
          <div className="text-[#6b7280]">Updated: {new Date().toLocaleTimeString()}</div>
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
        KINESIS v0.1.0 · Terminal 3 TEE Infrastructure · Trust is earned, not given. The lattice remembers.
      </footer>
    </div>
  );
}
