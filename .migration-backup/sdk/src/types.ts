export interface AgentConfig {
  name: string;
  version?: string;
  apiKey?: string;
  mockData?: boolean;
  jurisdiction?: string;
}

export interface CoherencePlane {
  protocol: number;
  fidelity: number;
  synergy: number;
  knowledge: number;
  adaptivity: number;
}

export interface CoherenceSnapshot {
  agentId: string;
  timestamp: number;
  planes: CoherencePlane;
  composite: number;
  threshold: number;
  isSilent: boolean;
  limitingPlane?: string;
  deficit?: number;
}

export interface DelegationResult {
  success: boolean;
  vc?: string;
  error?: string;
}

export interface LatticeTopology {
  agents: Array<{
    id: string;
    name: string;
    did: string;
    coherence: CoherenceSnapshot | null;
    isSilent: boolean;
    jurisdiction: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    weight: number;
  }>;
  moat: number;
  volatility: number;
  activeSilences: number;
}

export interface SilenceRecord {
  agentId: string;
  silencedAt: number;
  reason: string;
  limitingPlane: string;
  deficit: number;
  estimatedRecovery: number;
  remediationActions: string[];
}
