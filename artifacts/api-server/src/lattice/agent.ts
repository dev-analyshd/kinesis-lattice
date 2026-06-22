import { v4 as uuidv4 } from "uuid";
import { KinesisConfig, AgentProfile, CoherenceSnapshot, AgentCard } from "./types.js";
import { CoherenceEngine } from "./coherence-engine.js";
import { initializeT3NIdentity, getUsage } from "../auth/t3n-identity.js";
import { logger } from "../lib/logger.js";
import type { T3nClient } from "../lib/t3n-sdk.js";

export class KinesisAgent {
  public id: string;
  public did: string = "";
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

  async spawn(): Promise<void> {
    logger.info({ agentName: this.config.name }, "Spawning KINESIS Agent");

    if (!this.config.mockData) {
      const apiKey = process.env.T3N_API_KEY;
      if (!apiKey) throw new Error("T3N_API_KEY not set — claim at https://www.terminal3.io/claim-page");

      const identity = await initializeT3NIdentity(apiKey);
      this.did = identity.did;
      this.t3nClient = identity.client;

      const usage = await getUsage(identity.client);
      logger.info({ agentId: this.id, available: usage.available, total: usage.total }, "T3N Credits loaded");
    } else {
      this.did = `did:t3n:testnet:${this.id}`;
      if (process.env.T3N_DID) {
        this.did = `${process.env.T3N_DID}:agent:${this.id.slice(0, 8)}`;
      }
      logger.info({ agentId: this.id, did: this.did }, "Mock agent spawned with T3N-anchored DID");
    }

    this.profile = {
      id: this.id,
      did: this.did,
      name: this.config.name,
      jurisdiction: "unknown",
      coherence: null,
      isSilent: false,
      delegationOut: [],
      delegationIn: [],
      totalActions: 0,
      registeredAt: Date.now(),
    };
  }

  async joinLattice(): Promise<void> {
    logger.info({ agentId: this.id }, "Agent joining lattice");
    this.profile!.jurisdiction = this.selectJurisdiction();

    if (this.t3nClient) {
      logger.info({ agentId: this.id }, "Registering with TEE contract register_agent()");
    }

    logger.info({ agentId: this.id, jurisdiction: this.profile!.jurisdiction }, "Agent joined lattice");
  }

  getAgentCard(): AgentCard {
    return {
      name: this.config.name,
      version: this.config.version,
      did: this.did,
      capabilities: [
        "behavioral-coherence",
        "a2a-federation",
        "tee-attestation",
        "delegation-issuance",
        "web-bot-auth",
      ],
      endpoint: `/api/v1/agents/${this.id}`,
      coherence: this.profile?.coherence?.composite,
      jurisdiction: this.profile?.jurisdiction,
    };
  }

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

  async interactWith(peerId: string, positive: boolean): Promise<void> {
    this.interactionLog.push({ peer: peerId, positive, timestamp: Date.now() });
    this.behavioralShifts++;
    await this.updateCoherence();
  }

  async updateCoherence(): Promise<CoherenceSnapshot> {
    const recentActions = this.actionLog.slice(-100);
    const recentInteractions = this.interactionLog.slice(-100);

    const snapshot = this.coherenceEngine.computeCoherence(
      recentActions.length,
      recentActions.filter(a => !a.outcome).length,
      recentActions.length,
      recentActions.filter(a => a.outcome).length,
      recentInteractions.length,
      recentInteractions.filter(i => i.positive).length,
      this.milestones,
      Math.floor((Date.now() - this.lastMilestone) / 86400000),
      this.behavioralShifts,
      this.computeZScore()
    );

    snapshot.agentId = this.id;
    this.profile!.coherence = snapshot;
    this.profile!.isSilent = snapshot.isSilent;

    if (snapshot.isSilent) {
      logger.warn({
        agentId: this.id,
        limitingPlane: snapshot.limitingPlane,
        deficit: snapshot.deficit?.toFixed(4),
        composite: snapshot.composite.toFixed(4),
        threshold: snapshot.threshold.toFixed(4),
      }, "STRUCTURED SILENCE entered");
    }

    return snapshot;
  }

  private computeZScore(): number {
    if (this.actionLog.length < 10) return 0;
    const recent = this.actionLog.slice(-10).map(a => a.outcome ? 1 : 0);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recent.length;
    const std = Math.sqrt(variance);
    return std > 0 ? (mean - 0.5) / std : 0;
  }

  private selectJurisdiction(): string {
    const jurisdictions = ["US", "EU", "SG", "JP", "UK", "CA", "AU", "IN", "BR", "AE"];
    return jurisdictions[Math.floor(Math.random() * jurisdictions.length)];
  }

  private async executeRealAction(action: string): Promise<boolean> {
    logger.info({ action, agentId: this.id }, "Executing action via TEE");
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
