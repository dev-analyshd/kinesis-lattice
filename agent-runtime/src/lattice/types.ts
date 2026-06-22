export interface CoherencePlane {
  protocol: number;    // Π — A2A protocol adherence (weight: 0.30)
  fidelity: number;    // Φ — action-outcome alignment (weight: 0.25)
  synergy: number;     // Σ — cross-agent cooperation (weight: 0.20)
  knowledge: number;   // Κ — domain expertise (weight: 0.15)
  adaptivity: number;  // Α — environmental response (weight: 0.10)
}

export interface CoherenceSnapshot {
  agentId: string;
  timestamp: number;
  planes: CoherencePlane;
  composite: number;      // Ξ(a,t) — composite coherence field
  threshold: number;      // Δ(t) — dynamic delegation threshold
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
  vcJwt?: string; // BBS+ verifiable credential for this delegation
}

export interface LatticeTopology {
  agents: AgentProfile[];
  edges: DelegationEdge[];
  moat: number;       // Λ_lattice(t) — compounding lattice moat
  volatility: number; // V(t) — lattice volatility index
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
