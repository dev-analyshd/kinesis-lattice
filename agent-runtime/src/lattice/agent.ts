import { v4 as uuidv4 } from 'uuid';
import { KinesisConfig, AgentProfile, CoherenceSnapshot, AgentCard } from './types';
import { CoherenceEngine } from './coherence-engine';
import { initializeT3NIdentity, getUsage } from '../auth/t3n-identity';
import { logger } from '../utils/logger';
import { T3nClient } from '@terminal3/t3n-sdk';

/**
 * KINESIS Agent — a self-governing node in the Living Delegation Lattice.
 *
 * Each agent:
 *   1. Spawns with a TEE-verified did:t3n identity (or mock for demo)
 *   2. Joins the lattice by registering its jurisdiction and initial claims
 *   3. Performs actions that are recorded and used to compute coherence
 *   4. Interacts with peers, building or degrading synergy
 *   5. Enters STRUCTURED SILENCE when coherence drops below threshold Δ(t)
 *   6. Recovers through remediation and exits silence when coherence rises
 */
export class KinesisAgent {
  public id: string;
  public did: string = '';
  public profile: AgentProfile | null = null;
  private config: KinesisConfig;
  private coherenceEngine: CoherenceEngine;
  private t3nClient: T3nClient | null = null;
  private actionLog: Array<{ action: string; outcome: boolean; timestamp: number }> = [];
  private interactionLog: Array<{ peer: string; positive: boolean; timestamp: number }> = [];
  private milestones: number = 0;
  private lastMilestone: number = Date.now();
  private behavioralShifts: number = 0;

  constructor(config: KinesisConfig) {
    this.id = uuidv4();
    this.config = config;
    this.coherenceEngine = new CoherenceEngine();
  }

  /**
   * Spawn the agent:
   *   - Real mode: T3N handshake → authenticate → getUsage → did:t3n established
   *   - Mock mode: synthetic did:t3n:mock:<uuid> for demo/testing
   */
  async spawn(): Promise<void> {
    logger.info(`Spawning KINESIS Agent: ${this.config.name} v${this.config.version}`);

    if (!this.config.mockData) {
      const apiKey = process.env.T3N_API_KEY;
      if (!apiKey) throw new Error('T3N_API_KEY not set — claim at https://www.terminal3.io/claim-page');

      const identity = await initializeT3NIdentity(apiKey);
      this.did = identity.did;
      this.t3nClient = identity.client;

      const usage = await getUsage(identity.client);
      logger.info(`T3N Credits: ${usage.available}/${usage.total}`, { agentId: this.id });
    } else {
      this.did = `did:t3n:mock:${this.id}`;
      logger.info(`Mock mode: DID = ${this.did}`, { agentId: this.id });
    }

    this.profile = {
      id: this.id,
      did: this.did,
      name: this.config.name,
      jurisdiction: 'unknown',
      coherence: null,
      isSilent: false,
      delegationOut: [],
      delegationIn: [],
      totalActions: 0,
      registeredAt: Date.now(),
    };

    logger.info(`Agent spawned`, { id: this.id, did: this.did });
  }

  /** Join the lattice by registering with the TEE contract. */
  async joinLattice(): Promise<void> {
    logger.info(`Agent ${this.id} joining lattice...`);
    this.profile!.jurisdiction = this.selectJurisdiction();

    if (this.t3nClient) {
      // Production: call TEE contract register_agent(did, jurisdiction)
      // via TenantClient.contracts.execute()
      logger.info('Registering with TEE contract register_agent()', { agentId: this.id });
    }

    logger.info(`Agent joined lattice`, {
      id: this.id,
      jurisdiction: this.profile!.jurisdiction,
    });
  }

  /** Publish Agent Card at /.well-known/agent.json (A2A protocol). */
  getAgentCard(): AgentCard {
    return {
      name: this.config.name,
      version: this.config.version,
      did: this.did,
      capabilities: [
        'behavioral-coherence',
        'a2a-federation',
        'tee-attestation',
        'delegation-issuance',
        'web-bot-auth',
      ],
      endpoint: `http://localhost:${process.env.API_PORT || 8080}/api/v1/agents/${this.id}`,
      coherence: this.profile?.coherence?.composite,
      jurisdiction: this.profile?.jurisdiction,
    };
  }

  /** Perform an action — records outcome and triggers coherence update. */
  async performAction(action: string, expectedOutcome: boolean): Promise<boolean> {
    const outcome = this.config.mockData
      ? expectedOutcome
      : await this.executeRealAction(action);

    this.actionLog.push({ action, outcome, timestamp: Date.now() });
    this.profile!.totalActions++;

    if (outcome) {
      this.milestones++;
      this.lastMilestone = Date.now();
    }

    await this.updateCoherence();
    return outcome;
  }

  /** Interact with a peer agent — affects Σ (synergy) plane. */
  async interactWith(peerId: string, positive: boolean): Promise<void> {
    this.interactionLog.push({ peer: peerId, positive, timestamp: Date.now() });
    this.behavioralShifts++;
    await this.updateCoherence();
  }

  /** Recompute coherence from the last 100 actions and interactions. */
  async updateCoherence(): Promise<CoherenceSnapshot> {
    const recentActions = this.actionLog.slice(-100);
    const recentInteractions = this.interactionLog.slice(-100);

    const snapshot = this.coherenceEngine.computeCoherence(
      recentActions.length,                                    // protocolActions
      recentActions.filter(a => !a.outcome).length,           // protocolViolations
      recentActions.length,                                    // fidelityCommits
      recentActions.filter(a => a.outcome).length,            // fidelityFulfilled
      recentInteractions.length,                              // synergyInteractions
      recentInteractions.filter(i => i.positive).length,     // synergyPositive
      this.milestones,                                        // knowledgeMilestones
      Math.floor((Date.now() - this.lastMilestone) / 86400000), // knowledgeStagnationDays
      this.behavioralShifts,                                  // adaptivityShifts
      this.computeZScore()                                    // adaptivityZScore
    );

    snapshot.agentId = this.id;
    this.profile!.coherence = snapshot;
    this.profile!.isSilent = snapshot.isSilent;

    if (snapshot.isSilent) {
      logger.warn(`STRUCTURED SILENCE entered`, {
        agentId: this.id,
        limitingPlane: snapshot.limitingPlane,
        deficit: snapshot.deficit?.toFixed(4),
        composite: snapshot.composite.toFixed(4),
        threshold: snapshot.threshold.toFixed(4),
      });
    } else {
      logger.debug(`Coherence updated`, {
        agentId: this.id,
        composite: snapshot.composite.toFixed(4),
        threshold: snapshot.threshold.toFixed(4),
      });
    }

    return snapshot;
  }

  /** Compute behavioral z-score for the adaptivity plane. */
  private computeZScore(): number {
    if (this.actionLog.length < 10) return 0;
    const recent = this.actionLog.slice(-10).map(a => a.outcome ? 1 : 0);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recent.length;
    const std = Math.sqrt(variance);
    return std > 0 ? (mean - 0.5) / std : 0;
  }

  /** Select a jurisdiction for geographic diversity enforcement. */
  private selectJurisdiction(): string {
    const jurisdictions = ['US', 'EU', 'SG', 'JP', 'UK', 'CA', 'AU', 'IN', 'BR', 'AE'];
    return jurisdictions[Math.floor(Math.random() * jurisdictions.length)];
  }

  /** Real action execution — calls TEE contract in production. */
  private async executeRealAction(action: string): Promise<boolean> {
    logger.info(`Executing real action via TEE`, { action, agentId: this.id });
    // Production: call TenantClient.contracts.execute('compute_coherence', {...})
    return true;
  }

  getCoherence(): CoherenceSnapshot | null {
    return this.profile?.coherence || null;
  }

  isSilent(): boolean {
    return this.profile?.isSilent || false;
  }

  getT3nClient(): T3nClient | null {
    return this.t3nClient;
  }
}
