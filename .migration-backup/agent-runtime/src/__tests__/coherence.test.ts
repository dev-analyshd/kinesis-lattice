import { CoherenceEngine } from '../lattice/coherence-engine';

describe('CoherenceEngine', () => {
  let engine: CoherenceEngine;

  beforeEach(() => {
    engine = new CoherenceEngine();
  });

  test('perfect behavior yields high coherence', () => {
    const result = engine.computeCoherence(100, 0, 100, 100, 100, 100, 10, 0, 5, 0.5);
    expect(result.composite).toBeGreaterThan(0.8);
    expect(result.isSilent).toBe(false);
  });

  test('all violations yield low coherence', () => {
    const result = engine.computeCoherence(100, 100, 100, 0, 100, 0, 0, 31, 0, 4.0);
    expect(result.composite).toBeLessThan(0.3);
    expect(result.isSilent).toBe(true);
  });

  test('stagnation kills knowledge plane (hard-zero)', () => {
    const result = engine.computeCoherence(10, 0, 10, 10, 10, 10, 0, 31, 1, 0.5);
    expect(result.planes.knowledge).toBe(0);
  });

  test('high z-score kills adaptivity plane (hard-zero)', () => {
    const result = engine.computeCoherence(10, 0, 10, 10, 10, 10, 5, 0, 1, 4.0);
    expect(result.planes.adaptivity).toBe(0);
  });

  test('limiting plane detected correctly when protocol low', () => {
    const result = engine.computeCoherence(10, 9, 10, 10, 10, 10, 5, 0, 1, 0.5);
    expect(result.limitingPlane).toBe('protocol');
  });

  test('silence record generated with correct remediation', () => {
    const snapshot = engine.computeCoherence(10, 9, 10, 10, 10, 10, 5, 0, 1, 0.5);
    snapshot.agentId = 'test-agent';
    const silence = engine.generateSilenceRecord(snapshot);
    expect(silence.limitingPlane).toBeDefined();
    expect(silence.remediationActions.length).toBeGreaterThan(0);
    expect(silence.estimatedRecovery).toBeGreaterThan(snapshot.timestamp);
  });

  test('all planes in range [0, 1]', () => {
    const result = engine.computeCoherence(50, 25, 50, 40, 50, 30, 3, 10, 5, 1.5);
    const { planes } = result;
    expect(planes.protocol).toBeGreaterThanOrEqual(0);
    expect(planes.protocol).toBeLessThanOrEqual(1);
    expect(planes.fidelity).toBeGreaterThanOrEqual(0);
    expect(planes.fidelity).toBeLessThanOrEqual(1);
    expect(planes.synergy).toBeGreaterThanOrEqual(0);
    expect(planes.synergy).toBeLessThanOrEqual(1);
    expect(planes.knowledge).toBeGreaterThanOrEqual(0);
    expect(planes.knowledge).toBeLessThanOrEqual(1);
    expect(planes.adaptivity).toBeGreaterThanOrEqual(0);
    expect(planes.adaptivity).toBeLessThanOrEqual(1);
  });

  test('composite is weighted sum of planes', () => {
    const result = engine.computeCoherence(100, 0, 100, 100, 100, 100, 10, 0, 10, 0.5);
    const expected = 0.30 * result.planes.protocol
      + 0.25 * result.planes.fidelity
      + 0.20 * result.planes.synergy
      + 0.15 * result.planes.knowledge
      + 0.10 * result.planes.adaptivity;
    expect(Math.abs(result.composite - expected)).toBeLessThan(0.001);
  });

  test('no data returns neutral 0.5 composite', () => {
    const result = engine.computeCoherence(0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0);
    expect(result.composite).toBeCloseTo(0.5, 1);
  });

  test('dynamic threshold increases with higher volatility', () => {
    const low = engine.computeCoherence(10, 0, 10, 10, 10, 10, 5, 0, 1, 0.5, 0.0);
    const high = engine.computeCoherence(10, 0, 10, 10, 10, 10, 5, 0, 1, 0.5, 1.0);
    expect(high.threshold).toBeGreaterThan(low.threshold);
  });
});
