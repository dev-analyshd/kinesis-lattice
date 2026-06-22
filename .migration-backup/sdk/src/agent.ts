import { AgentConfig, CoherenceSnapshot } from './types';
import { CoherenceEngine } from './coherence';
import { v4 as uuidv4 } from 'uuid';

/**
 * KinesisAgent — public SDK class for building KINESIS-compatible agents.
 *
 * Quick start:
 * ```typescript
 * import { KinesisAgent } from '@kinesis/lattice-sdk';
 *
 * const agent = new KinesisAgent({
 *   name: 'my-trading-agent',
 *   apiKey: process.env.T3N_API_KEY, // from https://www.terminal3.io/claim-page
 * });
 *
 * await agent.spawn(); // establishes did:t3n identity
 * await agent.performAction('place-order', true);
 * await agent.interactWith('peer-agent-did', true);
 *
 * const coherence = agent.computeCoherence();
 * console.log(coherence.composite); // 0.0–1.0
 * ```
 */
export class KinesisAgent {
  public id: string;
  public did: string = '';
  private config: AgentConfig;
  private engine: CoherenceEngine;
  private actions: Array<{ action: string; outcome: boolean; timestamp: number }> = [];
  private interactions: Array<{ peer: string; positive: boolean; timestamp: number }> = [];
  private milestones: number = 0;
  private lastMilestone: number = Date.now();
  private shifts: number = 0;

  constructor(config: AgentConfig) {
    this.id = uuidv4();
    this.config = config;
    this.engine = new CoherenceEngine();
  }

  /** Spawn the agent. Establishes did:t3n identity via T3N SDK in production mode. */
  async spawn(): Promise<void> {
    if (this.config.apiKey) {
      // Dynamically import T3N bridge to avoid bundling T3N SDK when not needed
      const { initializeT3NIdentity } = await import('./t3n-bridge');
      const identity = await initializeT3NIdentity(this.config.apiKey);
      this.did = identity.did;
    } else {
      // Mock mode for testing/demo
      this.did = `did:t3n:mock:${this.id}`;
    }
  }

  /** Record an action outcome. Affects Protocol (Π) and Fidelity (Φ) planes. */
  async performAction(action: string, expectedOutcome: boolean): Promise<boolean> {
    const outcome = this.config.mockData ? expectedOutcome : true;
    this.actions.push({ action, outcome, timestamp: Date.now() });
    this.shifts++;
    if (outcome) {
      this.milestones++;
      this.lastMilestone = Date.now();
    }
    return outcome;
  }

  /** Record a peer interaction. Affects Synergy (Σ) plane. */
  async interactWith(peerId: string, positive: boolean): Promise<void> {
    this.interactions.push({ peer: peerId, positive, timestamp: Date.now() });
    this.shifts++;
  }

  /** Compute current coherence from behavioral history. */
  computeCoherence(volatility: number = 0.5): CoherenceSnapshot {
    const recent = this.actions.slice(-100);
    const recentInteractions = this.interactions.slice(-100);

    const snapshot = this.engine.compute(
      recent.length,
      recent.filter(a => !a.outcome).length,
      recent.length,
      recent.filter(a => a.outcome).length,
      recentInteractions.length,
      recentInteractions.filter(i => i.positive).length,
      this.milestones,
      Math.floor((Date.now() - this.lastMilestone) / 86400000),
      this.shifts,
      this.computeZScore(),
      volatility
    );

    snapshot.agentId = this.id;
    return snapshot;
  }

  private computeZScore(): number {
    if (this.actions.length < 10) return 0;
    const recent = this.actions.slice(-10).map(a => a.outcome ? 1 : 0);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length;
    const std = Math.sqrt(variance);
    return std > 0 ? (mean - 0.5) / std : 0;
  }

  getDid(): string { return this.did; }
  getId(): string { return this.id; }
}
