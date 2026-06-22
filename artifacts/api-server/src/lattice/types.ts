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

export interface SilenceRecord {
  agentId: string;
  silencedAt: number;
  reason: string;
  limitingPlane: string;
  deficit: number;
  estimatedRecovery: number;
  remediationActions: string[];
}

export interface DelegationEdge {
  from: string;
  to: string;
  weight: number;
  issuedAt: number;
  expiresAt: number;
  vcJwt?: string;
}

export interface LatticeTopology {
  agents: AgentProfile[];
  edges: DelegationEdge[];
  delegations: DelegationEdge[];
  moat: number;
  volatility: number;
  activeSilences: number;
}

export interface AgentProfile {
  id: string;
  did: string;
  name: string;
  jurisdiction: string;
  coherence: CoherenceSnapshot | null;
  isSilent: boolean;
  delegationOut: string[];
  delegationIn: string[];
  totalActions: number;
  registeredAt: number;
}

export interface KinesisConfig {
  name: string;
  version: string;
  minCoherence?: number;
  maxCoherence?: number;
  delegationThreshold?: number;
  mockData?: boolean;
}

export interface AgentCard {
  name: string;
  version: string;
  did: string;
  capabilities: string[];
  endpoint: string;
  coherence?: number;
  jurisdiction?: string;
}
