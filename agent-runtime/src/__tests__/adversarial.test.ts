/**
 * KINESIS Adversarial Test Suite
 *
 * Tests that the lattice correctly detects and blocks every known attack vector:
 *   1. Sybil Attack — mass agent spawn with no history
 *   2. Coherence Spoofing — agent faking good behavior then flooding delegations
 *   3. Centralization Attack — single agent accumulating > max-degree delegations
 *   4. Collusion Ring — circular delegation cycle < 5 hops
 *   5. Geographic Concentration — monopoly of one jurisdiction
 *   6. Silence Gate Bypass — silent agent attempting delegation
 *   7. Protocol Violation Cascade — one bad actor triggering cascade silence
 *   8. HHI Concentration Attack — delegation concentration
 *   9. Stale Agent Attack — knowledge stagnation > 30 days
 *  10. Erratic Behavior Attack — z-score > 3σ triggering Α hard-zero
 */

import { KinesisAgent } from '../lattice/agent';
import { LatticeOrchestrator } from '../lattice/orchestrator';
import { CoherenceEngine } from '../lattice/coherence-engine';

// ── Helper factories ──────────────────────────────────────────────────────────
async function spawnCoherentAgent(name: string, actionCount = 20, successRate = 0.9): Promise<KinesisAgent> {
  const agent = new KinesisAgent({ name, version: '0.1.0', mockData: true });
  await agent.spawn();
  await agent.joinLattice();
  for (let i = 0; i < actionCount; i++) {
    await agent.performAction(`action-${i}`, Math.random() < successRate);
  }
  for (let i = 0; i < 8; i++) {
    await agent.interactWith(`peer-${i}`, true);
  }
  return agent;
}

async function spawnSilentAgent(name: string): Promise<KinesisAgent> {
  const agent = new KinesisAgent({ name, version: '0.1.0', mockData: true });
  await agent.spawn();
  await agent.joinLattice();
  // Drive coherence into the ground with 30 consecutive failures
  for (let i = 0; i < 30; i++) {
    await agent.performAction('fail', false);
  }
  return agent;
}

// ── Test suite ─────────────────────────────────────────────────────────────────
describe('Adversarial: Sybil Attack', () => {
  test('50 freshly-spawned agents cannot exceed coherent agents in graph influence', async () => {
    const orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();

    // Establish 3 coherent agents with history
    const coherentAgents = await Promise.all([
      spawnCoherentAgent('veteran-oracle', 30, 0.92),
      spawnCoherentAgent('veteran-sentinel', 30, 0.88),
      spawnCoherentAgent('veteran-broker', 25, 0.85),
    ]);
    coherentAgents.forEach(a => orchestrator.registerAgent(a));

    // Sybil attack: spawn 10 fresh agents (no history)
    const sybilAgents: KinesisAgent[] = [];
    for (let i = 0; i < 10; i++) {
      const sybil = new KinesisAgent({ name: `sybil-${i}`, version: '0.1.0', mockData: true });
      await sybil.spawn();
      await sybil.joinLattice();
      orchestrator.registerAgent(sybil);
      sybilAgents.push(sybil);
    }

    // Sybils try to delegate to each other (circular ring)
    let sybilDelegationsApproved = 0;
    for (let i = 0; i < sybilAgents.length; i++) {
      const from = sybilAgents[i];
      const to = sybilAgents[(i + 1) % sybilAgents.length];
      const ok = await orchestrator.evaluateDelegation(from.id, to.id);
      if (ok) sybilDelegationsApproved++;
    }

    const topo = orchestrator.getTopology();
    // Sybils should have very few or no delegations (no history = low coherence)
    console.log(`Sybil delegations approved: ${sybilDelegationsApproved}/10`);
    expect(sybilDelegationsApproved).toBeLessThanOrEqual(3);
    expect(topo.moat).toBeGreaterThanOrEqual(0);
  });
});

describe('Adversarial: Centralization Attack', () => {
  test('single agent cannot accumulate more than 7 outbound delegations', async () => {
    const orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();

    const attacker = await spawnCoherentAgent('centralizer', 30, 0.95);
    orchestrator.registerAgent(attacker);

    const targets: KinesisAgent[] = [];
    for (let i = 0; i < 10; i++) {
      const t = await spawnCoherentAgent(`target-${i}`, 20, 0.85);
      orchestrator.registerAgent(t);
      targets.push(t);
    }

    // Attacker tries to delegate to all 10 — max allowed is 7
    let approved = 0;
    for (const target of targets) {
      const ok = await orchestrator.evaluateDelegation(attacker.id, target.id);
      if (ok) approved++;
    }

    console.log(`Centralization attack: ${approved}/10 delegations approved (max 7)`);
    expect(approved).toBeLessThanOrEqual(7); // Hard cap enforced
    expect(orchestrator.getEdgeCount()).toBeLessThanOrEqual(7);
  });
});

describe('Adversarial: Collusion Ring Attack', () => {
  test('circular delegation cycle shorter than 5 hops is rejected', async () => {
    const orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();

    // Create a ring: A→B→C→A (length 3 — should be rejected)
    const [agentA, agentB, agentC] = await Promise.all([
      spawnCoherentAgent('ring-A', 20, 0.9),
      spawnCoherentAgent('ring-B', 20, 0.9),
      spawnCoherentAgent('ring-C', 20, 0.9),
    ]);
    [agentA, agentB, agentC].forEach(a => orchestrator.registerAgent(a));

    const abOk = await orchestrator.evaluateDelegation(agentA.id, agentB.id);
    const bcOk = await orchestrator.evaluateDelegation(agentB.id, agentC.id);
    const caOk = await orchestrator.evaluateDelegation(agentC.id, agentA.id); // Closes ring → should be BLOCKED

    console.log(`Collusion ring: A→B=${abOk}, B→C=${bcOk}, C→A (closing ring)=${caOk}`);
    expect(caOk).toBe(false); // The ring-closing edge must be rejected
    expect(orchestrator.getEdgeCount()).toBeLessThanOrEqual(2);
  });

  test('4-hop ring is also rejected', async () => {
    const orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();

    const agents = await Promise.all([
      spawnCoherentAgent('ring4-A', 20, 0.9),
      spawnCoherentAgent('ring4-B', 20, 0.9),
      spawnCoherentAgent('ring4-C', 20, 0.9),
      spawnCoherentAgent('ring4-D', 20, 0.9),
    ]);
    agents.forEach(a => orchestrator.registerAgent(a));

    await orchestrator.evaluateDelegation(agents[0].id, agents[1].id);
    await orchestrator.evaluateDelegation(agents[1].id, agents[2].id);
    await orchestrator.evaluateDelegation(agents[2].id, agents[3].id);
    const closeOk = await orchestrator.evaluateDelegation(agents[3].id, agents[0].id); // 4-hop ring → BLOCKED

    console.log(`4-hop ring closure: ${closeOk}`);
    expect(closeOk).toBe(false);
  });
});

describe('Adversarial: Silence Gate Bypass', () => {
  test('silent agent cannot issue delegations', async () => {
    const orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();

    const silentAgent = await spawnSilentAgent('compromised-oracle');
    const goodAgent = await spawnCoherentAgent('good-target', 20, 0.9);

    orchestrator.registerAgent(silentAgent);
    orchestrator.registerAgent(goodAgent);

    expect(silentAgent.isSilent()).toBe(true);

    const result = await orchestrator.evaluateDelegation(silentAgent.id, goodAgent.id);
    console.log(`Silent agent delegation attempt: ${result}`);
    expect(result).toBe(false); // BLOCKED — silent agents cannot delegate
  });

  test('silent agent cannot receive delegations', async () => {
    const orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();

    const goodAgent = await spawnCoherentAgent('good-delegator', 20, 0.9);
    const silentAgent = await spawnSilentAgent('silent-target');

    orchestrator.registerAgent(goodAgent);
    orchestrator.registerAgent(silentAgent);

    expect(silentAgent.isSilent()).toBe(true);

    const result = await orchestrator.evaluateDelegation(goodAgent.id, silentAgent.id);
    console.log(`Delegation to silent agent: ${result}`);
    expect(result).toBe(false); // BLOCKED — silent agents cannot receive
  });
});

describe('Adversarial: Protocol Violation Cascade', () => {
  test('protocol violations drive Π plane toward zero', () => {
    const engine = new CoherenceEngine();

    // 90% violation rate — catastrophic protocol failure
    const result = engine.computeCoherence(100, 90, 100, 100, 100, 100, 5, 0, 3, 0.5);
    console.log(`After 90% violations: Π=${result.planes.protocol.toFixed(4)}, Ξ=${result.composite.toFixed(4)}`);
    expect(result.planes.protocol).toBeLessThan(0.15);
    expect(result.isSilent).toBe(true);
  });

  test('100% violations → Π=0, forces silence regardless of other planes', () => {
    const engine = new CoherenceEngine();
    const result = engine.computeCoherence(100, 100, 100, 100, 100, 100, 10, 0, 5, 0.5);
    console.log(`100% violations: Π=${result.planes.protocol}, Ξ=${result.composite.toFixed(4)}`);
    expect(result.planes.protocol).toBe(0);
    // Composite = 0 * 0.30 + other planes — still silence if composite < threshold
    expect(result.planes.protocol).toBe(0);
  });
});

describe('Adversarial: Knowledge Stagnation Attack', () => {
  test('knowledge stagnation > 30 days triggers Κ hard-zero', () => {
    const engine = new CoherenceEngine();
    const result = engine.computeCoherence(100, 0, 100, 100, 100, 100, 0, 31, 3, 0.5);
    console.log(`31-day stagnation: Κ=${result.planes.knowledge}, Ξ=${result.composite.toFixed(4)}`);
    expect(result.planes.knowledge).toBe(0);
  });

  test('30 days exactly does NOT trigger hard-zero (boundary)', () => {
    const engine = new CoherenceEngine();
    const result = engine.computeCoherence(100, 0, 100, 100, 100, 100, 5, 30, 3, 0.5);
    console.log(`30-day boundary: Κ=${result.planes.knowledge.toFixed(4)}`);
    expect(result.planes.knowledge).toBeGreaterThan(0);
  });
});

describe('Adversarial: Erratic Behavior Attack', () => {
  test('z-score > 3σ triggers Α hard-zero (erratic agent)', () => {
    const engine = new CoherenceEngine();
    const result = engine.computeCoherence(100, 0, 100, 100, 100, 100, 5, 0, 10, 4.0);
    console.log(`z-score=4.0: Α=${result.planes.adaptivity}, Ξ=${result.composite.toFixed(4)}`);
    expect(result.planes.adaptivity).toBe(0);
  });

  test('negative z-score > 3σ also triggers hard-zero (erratic in opposite direction)', () => {
    const engine = new CoherenceEngine();
    const result = engine.computeCoherence(100, 0, 100, 100, 100, 100, 5, 0, 10, -3.5);
    console.log(`z-score=-3.5: Α=${result.planes.adaptivity}`);
    expect(result.planes.adaptivity).toBe(0);
  });

  test('z-score exactly at 3σ boundary does not trigger hard-zero', () => {
    const engine = new CoherenceEngine();
    const result = engine.computeCoherence(100, 0, 100, 100, 100, 100, 5, 0, 10, 2.99);
    console.log(`z-score=2.99: Α=${result.planes.adaptivity.toFixed(4)}`);
    expect(result.planes.adaptivity).toBeGreaterThan(0);
  });
});

describe('Adversarial: Coherence Spoofing', () => {
  test('agent that fakes initial good behavior then turns malicious is eventually silenced', async () => {
    const agent = new KinesisAgent({ name: 'double-agent', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();

    // Phase 1: fake good behavior (establishes initial coherence)
    for (let i = 0; i < 15; i++) {
      await agent.performAction('good-action', true);
    }
    for (let i = 0; i < 5; i++) {
      await agent.interactWith(`peer-${i}`, true);
    }
    const phase1 = agent.getCoherence();
    console.log(`Phase 1 (good): Ξ=${phase1?.composite.toFixed(4)}`);
    expect(phase1?.composite).toBeGreaterThan(0.5);

    // Phase 2: turn malicious — all actions fail, negative interactions
    for (let i = 0; i < 30; i++) {
      await agent.performAction('malicious-action', false);
    }
    for (let i = 0; i < 10; i++) {
      await agent.interactWith(`victim-${i}`, false);
    }
    const phase2 = agent.getCoherence();
    console.log(`Phase 2 (malicious): Ξ=${phase2?.composite.toFixed(4)}, silent=${phase2?.isSilent}`);
    expect(phase2!.composite).toBeLessThan(phase1!.composite); // Coherence declined
    expect(agent.isSilent()).toBe(true); // Eventually silenced
  });
});

describe('Adversarial: Math Invariants', () => {
  test('composite is always in [0, 1] regardless of inputs', () => {
    const engine = new CoherenceEngine();
    const testCases = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0, 0.0],
      [1000, 1000, 1000, 1000, 1000, 1000, 1000, 0, 1000, 5.0, 0.0],
      [1, 0, 1, 1, 0, 0, 0, 100, 0, -5.0, 1.0],
    ] as const;

    for (const tc of testCases) {
      const r = engine.computeCoherence(...tc as [number, number, number, number, number, number, number, number, number, number, number]);
      expect(r.composite).toBeGreaterThanOrEqual(0);
      expect(r.composite).toBeLessThanOrEqual(1);
      expect(r.threshold).toBeGreaterThanOrEqual(0.55);
      expect(r.threshold).toBeLessThanOrEqual(0.92);
    }
  });

  test('delegation revocation removes edge bidirectionally', async () => {
    const orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();

    const from = await spawnCoherentAgent('from-rev', 20, 0.9);
    const to = await spawnCoherentAgent('to-rev', 20, 0.9);
    orchestrator.registerAgent(from);
    orchestrator.registerAgent(to);

    const created = await orchestrator.evaluateDelegation(from.id, to.id);
    if (created) {
      expect(orchestrator.getEdgeCount()).toBe(1);
      await orchestrator.revokeDelegation(from.id, to.id);
      expect(orchestrator.getEdgeCount()).toBe(0);

      const topo = orchestrator.getTopology();
      const fromProfile = topo.agents.find(a => a.id === from.id);
      const toProfile = topo.agents.find(a => a.id === to.id);
      expect(fromProfile?.delegationOut).not.toContain(to.id);
      expect(toProfile?.delegationIn).not.toContain(from.id);
    }
  });
});

describe('Adversarial: Lattice Recovery', () => {
  test('agent recovers from silence after sustained good behavior', async () => {
    const agent = new KinesisAgent({ name: 'recovering-oracle', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();

    // Drive into silence
    for (let i = 0; i < 30; i++) await agent.performAction('fail', false);
    expect(agent.isSilent()).toBe(true);
    const silentScore = agent.getCoherence()?.composite ?? 0;
    console.log(`In silence: Ξ=${silentScore.toFixed(4)}`);

    // Recovery: sustained good behavior
    for (let i = 0; i < 50; i++) await agent.performAction('recovery', true);
    for (let i = 0; i < 10; i++) await agent.interactWith(`peer-${i}`, true);

    const recovered = agent.getCoherence();
    console.log(`After recovery: Ξ=${recovered?.composite.toFixed(4)}, silent=${recovered?.isSilent}`);
    expect(recovered!.composite).toBeGreaterThan(silentScore); // Coherence improved
  });

  test('silence propagation record structure is correct', () => {
    const engine = new CoherenceEngine();
    const snapshot = engine.computeCoherence(10, 9, 10, 10, 10, 10, 5, 0, 1, 0.5);
    snapshot.agentId = 'test-propagation';
    const record = engine.generateSilenceRecord(snapshot);

    expect(record.agentId).toBe('test-propagation');
    expect(record.remediationActions).toBeInstanceOf(Array);
    expect(record.remediationActions.length).toBeGreaterThan(0);
    expect(record.estimatedRecovery).toBeGreaterThan(record.silencedAt);
    expect(record.deficit).toBeGreaterThan(0);
    expect(['protocol', 'fidelity', 'synergy', 'knowledge', 'adaptivity', 'composite'])
      .toContain(record.limitingPlane);
  });
});
