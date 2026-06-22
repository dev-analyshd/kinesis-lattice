import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface CoherencePlanes {
  protocol: number;
  fidelity: number;
  synergy: number;
  knowledge: number;
  adaptivity: number;
}

export interface AgentCoherence {
  composite: number;
  threshold: number;
  isSilent: boolean;
  planes: CoherencePlanes;
  limitingPlane?: string;
  deficit?: number;
}

export interface Agent {
  id: string;
  name: string;
  did: string;
  coherence: AgentCoherence | null;
  isSilent: boolean;
  jurisdiction: string;
  totalActions: number;
}

export interface Edge {
  from: string;
  to: string;
  weight: number;
}

export interface LatticeTopology {
  agents: Agent[];
  edges: Edge[];
  moat: number;
  volatility: number;
  activeSilences: number;
}

interface LatticeContextValue {
  topology: LatticeTopology | null;
  moatHistory: { time: number; moat: number }[];
  connected: boolean;
  lastUpdate: Date | null;
  silenceEvents: string[];
  spawnAgent: () => Promise<void>;
}

const LatticeContext = createContext<LatticeContextValue>({
  topology: null,
  moatHistory: [],
  connected: false,
  lastUpdate: null,
  silenceEvents: [],
  spawnAgent: async () => {},
});

const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ||
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `wss://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "ws://localhost:8080");

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "http://localhost:8080");

export function LatticeProvider({ children }: { children: React.ReactNode }) {
  const [topology, setTopology] = useState<LatticeTopology | null>(null);
  const [moatHistory, setMoatHistory] = useState<
    { time: number; moat: number }[]
  >([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [silenceEvents, setSilenceEvents] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "topology") {
            const topo: LatticeTopology = msg.data;
            setTopology(topo);
            setLastUpdate(new Date());
            setMoatHistory((prev) => [
              ...prev.slice(-59),
              { time: Date.now(), moat: topo.moat },
            ]);
            const silentAgents = topo.agents.filter((a) => a.isSilent);
            if (silentAgents.length > 0) {
              const eventStr = `${new Date().toLocaleTimeString()}: ${silentAgents.map((a) => a.name).join(", ")} entered silence`;
              setSilenceEvents((prev) => [eventStr, ...prev.slice(0, 19)]);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setConnected(false);
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const spawnAgent = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/v1/agents/spawn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `agent-${Date.now()}`,
          mockData: true,
        }),
      });
    } catch {
      // silently fail
    }
  }, []);

  return (
    <LatticeContext.Provider
      value={{
        topology,
        moatHistory,
        connected,
        lastUpdate,
        silenceEvents,
        spawnAgent,
      }}
    >
      {children}
    </LatticeContext.Provider>
  );
}

export function useLattice() {
  return useContext(LatticeContext);
}
