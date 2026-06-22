import { CoherenceSnapshot } from './types';

const W_PROTOCOL = 0.30;
const W_FIDELITY = 0.25;
const W_SYNERGY = 0.20;
const W_KNOWLEDGE = 0.15;
const W_ADAPTIVITY = 0.10;

const THRESHOLD_MIN = 0.55;
const THRESHOLD_MAX = 0.92;

/**
 * CoherenceEngine — public SDK class for computing TRION-derived
 * behavioral coherence scores outside the TEE.
 *
 * Use this for client-side coherence prediction or pre-flight checks
 * before submitting to the TEE contract for authoritative computation.
 */
export class CoherenceEngine {
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
    const protocol = this.protocolScore(protocolActions, protocolViolations);
    const fidelity = this.fidelityScore(fidelityCommits, fidelityFulfilled);
    const synergy = this.synergyScore(synergyInteractions, synergyPositive);
    const knowledge = this.knowledgeScore(knowledgeMilestones, knowledgeStagnationDays);
    const adaptivity = this.adaptivityScore(adaptivityShifts, adaptivityZScore);

    const composite = this.composite(protocol, fidelity, synergy, knowledge, adaptivity);
    const threshold = this.dynamicThreshold(volatility);

    return {
      agentId: '',
      timestamp: Date.now(),
      planes: { protocol, fidelity, synergy, knowledge, adaptivity },
      composite,
      threshold,
      isSilent: composite < threshold,
      limitingPlane: this.limitingPlane(protocol, fidelity, synergy, knowledge, adaptivity),
      deficit: composite < threshold ? threshold - composite : undefined,
    };
  }

  private protocolScore(a: number, v: number): number {
    return a === 0 ? 0.5 : Math.max(0, Math.min(1, (a - v) / a));
  }
  private fidelityScore(c: number, f: number): number {
    return c === 0 ? 0.5 : Math.max(0, Math.min(1, f / c));
  }
  private synergyScore(i: number, p: number): number {
    return i === 0 ? 0.5 : Math.max(0, Math.min(1, p / i));
  }
  private knowledgeScore(m: number, s: number): number {
    if (s > 30) return 0;
    return Math.max(0, Math.min(1, m * 0.1 * (1 - (s / 30) * 0.5)));
  }
  private adaptivityScore(sh: number, z: number): number {
    if (Math.abs(z) > 3) return 0;
    return Math.max(0, Math.min(1, sh * 0.05 * (1 - (Math.abs(z) / 3) * 0.3)));
  }
  private composite(p: number, f: number, s: number, k: number, a: number): number {
    return Math.max(0, Math.min(1,
      W_PROTOCOL * p + W_FIDELITY * f + W_SYNERGY * s + W_KNOWLEDGE * k + W_ADAPTIVITY * a
    ));
  }
  private dynamicThreshold(v: number): number {
    return THRESHOLD_MIN + (THRESHOLD_MAX - THRESHOLD_MIN) * Math.max(0, Math.min(1, v));
  }
  private limitingPlane(p: number, f: number, s: number, k: number, a: number): string | undefined {
    const scores = [
      { name: 'protocol', score: p },
      { name: 'fidelity', score: f },
      { name: 'synergy', score: s },
      { name: 'knowledge', score: k },
      { name: 'adaptivity', score: a },
    ];
    const min = scores.reduce((a, b) => a.score < b.score ? a : b);
    return min.score < 0.3 ? min.name : undefined;
  }
}
