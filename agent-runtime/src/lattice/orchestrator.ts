import { KinesisAgent } from './agent';
import { LatticeTopology, DelegationEdge, SilenceRecord, AgentProfile } from './types';
import { logger } from '../utils/logger';
import WebSocket from 'ws';

/**
 * LatticeOrchestrator — manages the complete delegation graph topology.
 *
 * Enforces graph invariants:
 *   - Max out-degree: 7 (prevents single-agent control)
 *   - HHI < 2500 (prevents concentration)
 *   - No cycles < length 5 (prevents collusion rings)
 *   - Geographic diversity >= 3 jurisdictions
 *
 * Broadcasts real-time topology updates via WebSocket to the dashboard.
 */
export class LatticeOrchestrator {
  private agents: Map<string, KinesisAgent> = new Map();
  private edges: DelegationEdge[] = [];
  private subscribers: Set<WebSocket> = new Set();
  private moatHistory: number[] = [];
  private silenceLog: SilenceRecord[] = [];

  async initialize(): Promise<void> {
    logger.info('Lattice Orchestrator initializing...');
    // Production: call TEE contract init_lattice(admin_did)
    // via TenantClient.contracts.execute()
    logger.info('Lattice Orchestrator ready');
  }

  registerAgent(agent: KinesisAgent): void {
    this.agents.set(agent.id, agent);
    logger.info(`Agent registered in lattice`, {
      id: agent.id,
      did: agent.did,
      jurisdiction: agent.profile?.jurisdiction,
    });
    this.broadcastTopology();
  }

  async evaluateDelegation(fromId: string, toId: string): Promise<boolean> {
    const from = this.agents.get(fromId);
    const to = this.agents.get(toId);

    if (!from || !to) {
      logger.error('Delegation failed: agent not found', { fromId, toId });
      return false;
    }

    if (from.isSilent()) {
      logger.warn('Delegation rejected: delegator is in structured silence', { fromId });
      return false;
    }
    if (to.isSilent()) {
      logger.warn('Delegation rejected: delegatee is in structured silence', { toId });
      return false;
    }

    const fromCoherence = from.getCoherence();
    const toCoherence = to.getCoherence();

    if (!fromCoherence || fromCoherence.composite < fromCoherence.threshold) {
      logger.warn('Delegation rejected: delegator coherence too low', {
        fromId,
        composite: fromCoherence?.composite,
        threshold: fromCoherence?.threshold,
      });
      return false;
    }
    if (!toCoherence || toCoherence.composite < toCoherence.threshold) {
      logger.warn('Delegation rejected: delegatee coherence too low', {
        toId,
        composite: toCoherence?.composite,
        threshold: toCoherence?.threshold,
      });
      return false;
    }

    // Check graph invariants
    const fromOutDegree = this.edges.filter(e => e.from === fromId).length;
    if (fromOutDegree >= 7) {
      logger.warn('Delegation rejected: max out-degree exceeded', { fromId, fromOutDegree });
      return false;
    }

    const hhi = this.computeHHI();
    if (hhi > 2500) {
      logger.warn('Delegation rejected: HHI limit exceeded', { hhi });
      return false;
    }

    // Check geographic diversity (3+ jurisdictions required)
    const jurisdictions = new Set(
      Array.from(this.agents.values()).map(a => a.profile?.jurisdiction).filter(Boolean)
    );
    if (this.agents.size >= 5 && jurisdictions.size < 3) {
      logger.warn('Delegation rejected: insufficient geographic diversity', {
        jurisdictions: jurisdictions.size,
      });
      return false;
    }

    // Check for short cycles (< 5)
    if (this.wouldCreateShortCycle(fromId, toId)) {
      logger.warn('Delegation rejected: would create collusion cycle', { fromId, toId });
      return false;
    }

    const edge: DelegationEdge = {
      from: fromId,
      to: toId,
      weight: toCoherence.composite,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 604800000, // 7 days
      // Production: vcJwt = BBS+ delegation VC from TEE contract
    };

    this.edges.push(edge);
    from.profile!.delegationOut.push(toId);
    to.profile!.delegationIn.push(fromId);

    logger.info(`Delegation created`, {
      from: fromId,
      to: toId,
      weight: edge.weight.toFixed(4),
      expires: new Date(edge.expiresAt).toISOString(),
    });

    this.broadcastTopology();
    return true;
  }

  async revokeDelegation(fromId: string, toId: string): Promise<void> {
    this.edges = this.edges.filter(e => !(e.from === fromId && e.to === toId));

    const from = this.agents.get(fromId);
    const to = this.agents.get(toId);
    if (from) from.profile!.delegationOut = from.profile!.delegationOut.filter(id => id !== toId);
    if (to) to.profile!.delegationIn = to.profile!.delegationIn.filter(id => id !== fromId);

    logger.info(`Delegation revoked`, { from: fromId, to: toId });
    this.broadcastTopology();
  }

  /**
   * Silence propagation: when an agent enters silence, its delegators'
   * Σ (synergy) plane is affected, potentially triggering cascade silence.
   */
  propagateSilence(silence: SilenceRecord): void {
    this.silenceLog.push(silence);
    logger.warn(`Silence propagation initiated`, {
      agentId: silence.agentId,
      limitingPlane: silence.limitingPlane,
      deficit: silence.deficit,
    });

    const agent = this.agents.get(silence.agentId);
    if (!agent) return;

    // Notify delegators — their synergy plane is affected
    for (const delegatorId of agent.profile!.delegationIn) {
      const delegator = this.agents.get(delegatorId);
      if (!delegator) continue;
      logger.info(`Delegator affected by silence cascade`, {
        delegatorId,
        silencedAgent: silence.agentId,
      });
      // Production: trigger coherence re-computation for delegator
      // which may cause cascade silence if Σ drops below threshold
    }

    this.broadcastTopology();
  }

  getTopology(): LatticeTopology {
    const agentProfiles: AgentProfile[] = Array.from(this.agents.values())
      .map(a => a.profile!)
      .filter(Boolean);

    const moat = this.computeLatticeMoat();
    const activeSilences = agentProfiles.filter(a => a.isSilent).length;

    return {
      agents: agentProfiles,
      edges: this.edges,
      moat,
      volatility: this.computeVolatility(),
      activeSilences,
    };
  }

  /** HHI — Herfindahl-Hirschman Index for delegation concentration. */
  private computeHHI(): number {
    const total = this.agents.size;
    if (total === 0) return 0;

    const stakeShares = new Map<string, number>();
    for (const edge of this.edges) {
      stakeShares.set(edge.from, (stakeShares.get(edge.from) || 0) + 1);
      stakeShares.set(edge.to, (stakeShares.get(edge.to) || 0) + 0.5);
    }

    let hhi = 0;
    for (const share of stakeShares.values()) {
      hhi += Math.pow(share / total, 2);
    }
    return hhi * 10000;
  }

  /** Check if adding edge (from→to) would create a cycle shorter than 5 hops. */
  private wouldCreateShortCycle(fromId: string, toId: string): boolean {
    // BFS from toId — if we reach fromId in < 4 hops, adding this edge creates cycle < 5
    const visited = new Set<string>([toId]);
    let frontier = [toId];

    for (let depth = 0; depth < 4; depth++) {
      const next: string[] = [];
      for (const node of frontier) {
        const outEdges = this.edges.filter(e => e.from === node).map(e => e.to);
        for (const neighbor of outEdges) {
          if (neighbor === fromId) return true; // Cycle detected
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            next.push(neighbor);
          }
        }
      }
      frontier = next;
    }
    return false;
  }

  /**
   * Λ_lattice(t) = D(t)·Q(t)·R(t)·N(t)·F(t)
   * The compounding lattice moat — harder to fake as it grows.
   */
  private computeLatticeMoat(): number {
    const depth = Array.from(this.agents.values())
      .reduce((sum, a) => sum + Math.log1p(a.profile!.totalActions), 0);

    const quality = this.moatHistory.length >= 2
      ? Math.min(2,
          (this.moatHistory[this.moatHistory.length - 1] || 1) /
          (this.moatHistory[this.moatHistory.length - 2] || 1)
        )
      : 1;

    const resilience =
      Array.from(this.agents.values()).filter(a => !a.profile!.isSilent).length /
      Math.max(1, this.agents.size);

    const novelty = Math.log1p(this.agents.size) / 10;
    const federation = Math.log1p(this.edges.length) / 5;

    const moat =
      0.25 * depth +
      0.20 * quality +
      0.20 * resilience +
      0.15 * novelty +
      0.20 * federation;

    this.moatHistory.push(moat);
    return Math.max(0, moat);
  }

  /** V(t) — lattice volatility index based on coherence variance. */
  private computeVolatility(): number {
    const coherences = Array.from(this.agents.values())
      .map(a => a.profile?.coherence?.composite)
      .filter((c): c is number => c !== undefined);

    if (coherences.length < 2) return 0.5;

    const mean = coherences.reduce((a, b) => a + b, 0) / coherences.length;
    const median = [...coherences].sort((a, b) => a - b)[Math.floor(coherences.length / 2)];
    const variance = coherences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / coherences.length;
    const std = Math.sqrt(variance);

    return median > 0 ? Math.min(1, std / median) : 0.5;
  }

  subscribe(ws: WebSocket): void {
    this.subscribers.add(ws);
    ws.on('close', () => this.subscribers.delete(ws));
    ws.send(JSON.stringify({ type: 'topology', data: this.getTopology() }));
  }

  private broadcastTopology(): void {
    const topology = this.getTopology();
    const message = JSON.stringify({ type: 'topology', data: topology });
    for (const ws of this.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  getAgentCount(): number { return this.agents.size; }
  getEdgeCount(): number { return this.edges.length; }
  getSilenceLog(): SilenceRecord[] { return this.silenceLog; }
}
