import { CoherencePlane, CoherenceSnapshot, SilenceRecord } from './types';
import { logger } from '../utils/logger';

/**
 * KINESIS CoherenceEngine — TypeScript implementation of TRION-derived
 * behavioral coherence mathematics.
 *
 * The five-plane coherence field Ξ(a,t):
 *   Ξ(a,t) = 0.30·Π(a,t) + 0.25·Φ(a,t) + 0.20·Σ(a,t) + 0.15·Κ(a,t) + 0.10·Α(a,t)
 *
 * Dynamic threshold Δ(t) adapts to lattice volatility V(t):
 *   Δ(t) = Δ_min + (Δ_max − Δ_min) · V(t)
 *
 * Hard-zero conditions (from SOVEREIGN-Ω):
 *   - Protocol violation → Π = 0
 *   - Fidelity deficit >3σ → Φ driven toward 0
 *   - Knowledge stagnation >30d → Κ = 0
 *   - Adaptivity z-score >3σ → Α = 0
 */

// TRION-derived plane weights
const W_PROTOCOL = 0.30;
const W_FIDELITY = 0.25;
const W_SYNERGY = 0.20;
const W_KNOWLEDGE = 0.15;
const W_ADAPTIVITY = 0.10;

// Dynamic threshold bounds
const THRESHOLD_MIN = 0.55;
const THRESHOLD_MAX = 0.92;

export class CoherenceEngine {
  /**
   * Compute a full coherence snapshot for an agent given behavioral metrics.
   * All computation is deterministic and TEE-reproducible.
   */
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

    logger.debug('Coherence computed', {
      planes: { protocol, fidelity, synergy, knowledge, adaptivity },
      composite: composite.toFixed(4),
      threshold: threshold.toFixed(4),
      isSilent,
      limitingPlane,
    });

    return {
      agentId: '',
      timestamp: Date.now(),
      planes: { protocol, fidelity, synergy, knowledge, adaptivity },
      composite,
      threshold,
      isSilent,
      limitingPlane: limitingPlane || undefined,
      deficit,
    };
  }

  // Alias for SDK compatibility
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

  /**
   * Π(a,t) — Protocol plane: A2A adherence, signature validity, credential chain integrity.
   * Hard-zero when 100% violations (complete protocol breakdown).
   */
  private computeProtocolScore(actions: number, violations: number): number {
    if (actions === 0) return 0.5; // No data → neutral
    return Math.max(0, Math.min(1, (actions - violations) / actions));
  }

  /**
   * Φ(a,t) — Fidelity plane: action-outcome alignment.
   * Measures whether the agent does what it commits to.
   */
  private computeFidelityScore(commits: number, fulfilled: number): number {
    if (commits === 0) return 0.5;
    return Math.max(0, Math.min(1, fulfilled / commits));
  }

  /**
   * Σ(a,t) — Synergy plane: cross-agent cooperation quality.
   * Positive interactions build trust; negative ones indicate parasitic behavior.
   */
  private computeSynergyScore(interactions: number, positive: number): number {
    if (interactions === 0) return 0.5;
    return Math.max(0, Math.min(1, positive / interactions));
  }

  /**
   * Κ(a,t) — Knowledge plane: domain expertise depth.
   * Hard-zero condition: stagnation > 30 days.
   * No data (0 milestones, 0 stagnation) → neutral 0.5.
   */
  private computeKnowledgeScore(milestones: number, stagnationDays: number): number {
    if (stagnationDays > 30) return 0; // Hard-zero: stagnation
    if (milestones === 0 && stagnationDays === 0) return 0.5; // No data → neutral
    const base = Math.min(1, milestones * 0.1);
    const decay = Math.min(1, stagnationDays / 30);
    return Math.max(0, base * (1 - decay * 0.5));
  }

  /**
   * Α(a,t) — Adaptivity plane: environmental response quality.
   * Hard-zero condition: behavioral z-score > 3σ (erratic).
   * No data (0 shifts, 0 z-score) → neutral 0.5.
   */
  private computeAdaptivityScore(shifts: number, zScore: number): number {
    if (Math.abs(zScore) > 3) return 0; // Hard-zero: erratic
    if (shifts === 0 && zScore === 0) return 0.5; // No data → neutral
    const base = Math.min(1, shifts * 0.05);
    const penalty = Math.min(1, Math.abs(zScore) / 3);
    return Math.max(0, base * (1 - penalty * 0.3));
  }

  /** Weighted composite: Ξ(a,t) = 0.30·Π + 0.25·Φ + 0.20·Σ + 0.15·Κ + 0.10·Α */
  private computeComposite(p: number, f: number, s: number, k: number, a: number): number {
    return Math.max(0, Math.min(1,
      W_PROTOCOL * p +
      W_FIDELITY * f +
      W_SYNERGY * s +
      W_KNOWLEDGE * k +
      W_ADAPTIVITY * a
    ));
  }

  /** Δ(t) = Δ_min + (Δ_max − Δ_min) · V(t) */
  private computeDynamicThreshold(volatility: number): number {
    const v = Math.max(0, Math.min(1, volatility));
    return THRESHOLD_MIN + (THRESHOLD_MAX - THRESHOLD_MIN) * v;
  }

  /**
   * Identify which plane is most limiting — the one with the highest
   * weight-adjusted deficit (weight × (1 − score)).
   * This tells the agent where to invest remediation effort for maximum gain.
   */
  private detectLimitingPlane(
    p: number, f: number, s: number, k: number, a: number
  ): string | null {
    const planes = [
      { name: 'protocol',   score: p, weight: W_PROTOCOL   },
      { name: 'fidelity',   score: f, weight: W_FIDELITY   },
      { name: 'synergy',    score: s, weight: W_SYNERGY     },
      { name: 'knowledge',  score: k, weight: W_KNOWLEDGE   },
      { name: 'adaptivity', score: a, weight: W_ADAPTIVITY  },
    ];
    // Weighted deficit = weight × (1 − score). Higher = more impactful to fix.
    const worst = planes.reduce((best, cur) => {
      const curDeficit = cur.weight * (1 - cur.score);
      const bestDeficit = best.weight * (1 - best.score);
      return curDeficit > bestDeficit ? cur : best;
    });
    // Only report limiting plane when below 0.5 (meaningfully dragging composite)
    return worst.score < 0.5 ? worst.name : null;
  }

  /** Generate a structured silence record with remediation guidance. */
  generateSilenceRecord(snapshot: CoherenceSnapshot): SilenceRecord {
    const planeActions: Record<string, string[]> = {
      protocol: ['Review A2A protocol compliance', 'Rebuild signature validity chain'],
      fidelity: ['Fulfill all pending commitments', 'Improve action-outcome alignment'],
      synergy: ['Engage in cooperative interactions', 'Resolve conflicts with lattice peers'],
      knowledge: ['Complete domain learning milestones', 'Update expertise registry'],
      adaptivity: ['Stabilize behavioral patterns', 'Reduce behavioral z-score'],
    };

    return {
      agentId: snapshot.agentId,
      silencedAt: snapshot.timestamp,
      reason: 'Behavioral coherence below dynamic threshold Δ(t)',
      limitingPlane: snapshot.limitingPlane || 'composite',
      deficit: snapshot.deficit || 0,
      estimatedRecovery: snapshot.timestamp + 86400000, // 24h
      remediationActions: planeActions[snapshot.limitingPlane || 'protocol'] || [
        'General behavioral improvement required',
      ],
    };
  }
}
