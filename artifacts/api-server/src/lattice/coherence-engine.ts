import { CoherencePlane, CoherenceSnapshot, SilenceRecord } from "./types.js";

const W_PROTOCOL = 0.30;
const W_FIDELITY = 0.25;
const W_SYNERGY = 0.20;
const W_KNOWLEDGE = 0.15;
const W_ADAPTIVITY = 0.10;

const THRESHOLD_MIN = 0.55;
const THRESHOLD_MAX = 0.92;

export class CoherenceEngine {
  computeCoherence(
    protocolActions: number,
    protocolViolations: number,
    fidelityCommits: number,
    fidelityFulfilled: number,
    synergyInteractions: number,
    synergyPositive: number,
    knowledgeMilestones: number,
    knowledgeStagnationDays: number,
    adaptivityShifts: number,
    adaptivityZScore: number,
    volatility: number = 0.5
  ): CoherenceSnapshot {
    const protocol = this.computeProtocolScore(protocolActions, protocolViolations);
    const fidelity = this.computeFidelityScore(fidelityCommits, fidelityFulfilled);
    const synergy = this.computeSynergyScore(synergyInteractions, synergyPositive);
    const knowledge = this.computeKnowledgeScore(knowledgeMilestones, knowledgeStagnationDays);
    const adaptivity = this.computeAdaptivityScore(adaptivityShifts, adaptivityZScore);

    const composite = this.computeComposite(protocol, fidelity, synergy, knowledge, adaptivity);
    const threshold = this.computeDynamicThreshold(volatility);
    const isSilent = composite < threshold;
    const limitingPlane = this.detectLimitingPlane(protocol, fidelity, synergy, knowledge, adaptivity);
    const deficit = isSilent ? threshold - composite : undefined;

    return {
      agentId: "",
      timestamp: Date.now(),
      planes: { protocol, fidelity, synergy, knowledge, adaptivity },
      composite,
      threshold,
      isSilent,
      limitingPlane: limitingPlane || undefined,
      deficit,
    };
  }

  compute(
    protocolActions: number,
    protocolViolations: number,
    fidelityCommits: number,
    fidelityFulfilled: number,
    synergyInteractions: number,
    synergyPositive: number,
    knowledgeMilestones: number,
    knowledgeStagnationDays: number,
    adaptivityShifts: number,
    adaptivityZScore: number,
    volatility: number = 0.5
  ): CoherenceSnapshot {
    return this.computeCoherence(
      protocolActions, protocolViolations,
      fidelityCommits, fidelityFulfilled,
      synergyInteractions, synergyPositive,
      knowledgeMilestones, knowledgeStagnationDays,
      adaptivityShifts, adaptivityZScore,
      volatility
    );
  }

  private computeProtocolScore(actions: number, violations: number): number {
    if (actions === 0) return 0.5;
    return Math.max(0, Math.min(1, (actions - violations) / actions));
  }

  private computeFidelityScore(commits: number, fulfilled: number): number {
    if (commits === 0) return 0.5;
    return Math.max(0, Math.min(1, fulfilled / commits));
  }

  private computeSynergyScore(interactions: number, positive: number): number {
    if (interactions === 0) return 0.5;
    return Math.max(0, Math.min(1, positive / interactions));
  }

  private computeKnowledgeScore(milestones: number, stagnationDays: number): number {
    if (stagnationDays > 30) return 0;
    if (milestones === 0 && stagnationDays === 0) return 0.5;
    const base = Math.min(1, milestones * 0.1);
    const decay = Math.min(1, stagnationDays / 30);
    return Math.max(0, base * (1 - decay * 0.5));
  }

  private computeAdaptivityScore(shifts: number, zScore: number): number {
    if (Math.abs(zScore) > 3) return 0;
    if (shifts === 0 && zScore === 0) return 0.5;
    const base = Math.min(1, shifts * 0.05);
    const penalty = Math.min(1, Math.abs(zScore) / 3);
    return Math.max(0, base * (1 - penalty * 0.3));
  }

  private computeComposite(p: number, f: number, s: number, k: number, a: number): number {
    return Math.max(0, Math.min(1,
      W_PROTOCOL * p +
      W_FIDELITY * f +
      W_SYNERGY * s +
      W_KNOWLEDGE * k +
      W_ADAPTIVITY * a
    ));
  }

  private computeDynamicThreshold(volatility: number): number {
    const v = Math.max(0, Math.min(1, volatility));
    return THRESHOLD_MIN + (THRESHOLD_MAX - THRESHOLD_MIN) * v;
  }

  private detectLimitingPlane(p: number, f: number, s: number, k: number, a: number): string | null {
    const planes = [
      { name: "protocol",   score: p, weight: W_PROTOCOL   },
      { name: "fidelity",   score: f, weight: W_FIDELITY   },
      { name: "synergy",    score: s, weight: W_SYNERGY     },
      { name: "knowledge",  score: k, weight: W_KNOWLEDGE   },
      { name: "adaptivity", score: a, weight: W_ADAPTIVITY  },
    ];
    const worst = planes.reduce((best, cur) => {
      return (cur.weight * (1 - cur.score)) > (best.weight * (1 - best.score)) ? cur : best;
    });
    return worst.score < 0.5 ? worst.name : null;
  }

  generateSilenceRecord(snapshot: CoherenceSnapshot): SilenceRecord {
    const planeActions: Record<string, string[]> = {
      protocol: ["Review A2A protocol compliance", "Rebuild signature validity chain"],
      fidelity: ["Fulfill all pending commitments", "Improve action-outcome alignment"],
      synergy: ["Engage in cooperative interactions", "Resolve conflicts with lattice peers"],
      knowledge: ["Complete domain learning milestones", "Update expertise registry"],
      adaptivity: ["Stabilize behavioral patterns", "Reduce behavioral z-score"],
    };
    return {
      agentId: snapshot.agentId,
      silencedAt: snapshot.timestamp,
      reason: "Behavioral coherence below dynamic threshold Δ(t)",
      limitingPlane: snapshot.limitingPlane || "composite",
      deficit: snapshot.deficit || 0,
      estimatedRecovery: snapshot.timestamp + 86400000,
      remediationActions: planeActions[snapshot.limitingPlane || "protocol"] || [
        "General behavioral improvement required",
      ],
    };
  }
}
