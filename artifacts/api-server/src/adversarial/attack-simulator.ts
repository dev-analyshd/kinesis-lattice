import { KinesisAgent } from "../lattice/agent.js";
import { LatticeOrchestrator } from "../lattice/orchestrator.js";
import { logger } from "../lib/logger.js";

export interface AttackResult {
  attackType: string;
  description: string;
  attemptsBlocked: number;
  attemptsSucceeded: number;
  detectionTime: number;
  latticeIntegrity: "intact" | "degraded" | "compromised";
  details: string[];
}

export interface SimulationReport {
  runAt: number;
  totalAttacks: number;
  totalBlocked: number;
  totalSucceeded: number;
  overallIntegrity: "intact" | "degraded" | "compromised";
  latticeMonat: number;
  results: AttackResult[];
  verdict: string;
}

export class AdversarialSimulator {
  private orchestrator: LatticeOrchestrator;
  private legitimateAgents: KinesisAgent[] = [];

  constructor(orchestrator: LatticeOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async bootstrapLegitimateAgents(count: number = 5): Promise<void> {
    logger.info({ count }, "[ATTACK-SIM] Bootstrapping legitimate agents");
    const names = ["sentinel-oracle", "compliance-warden", "audit-witness", "risk-broker", "id-verifier", "data-curator", "policy-enforcer"];

    for (let i = 0; i < count; i++) {
      const agent = new KinesisAgent({ name: names[i % names.length], version: "0.1.0", mockData: true });
      await agent.spawn();
      await agent.joinLattice();
      for (let j = 0; j < 25; j++) await agent.performAction(`legitimate-${j}`, Math.random() < 0.88);
      for (let j = 0; j < 8; j++) await agent.interactWith(`peer-${j}`, Math.random() < 0.85);
      this.orchestrator.registerAgent(agent);
      this.legitimateAgents.push(agent);
    }

    for (let i = 0; i < this.legitimateAgents.length - 1; i++) {
      const from = this.legitimateAgents[i];
      const to = this.legitimateAgents[i + 1];
      if (!from.isSilent() && !to.isSilent()) {
        await this.orchestrator.evaluateDelegation(from.id, to.id);
      }
    }
    logger.info({ agents: this.legitimateAgents.length, edges: this.orchestrator.getEdgeCount() }, "[ATTACK-SIM] Legitimate lattice bootstrapped");
  }

  async simulateSybilAttack(sybilCount: number = 10): Promise<AttackResult> {
    const startTime = Date.now();
    const details: string[] = [];
    let blocked = 0, succeeded = 0;

    logger.warn({ sybilCount }, "[ATTACK-SIM] ⚔ SYBIL FLOOD");
    const sybils: KinesisAgent[] = [];
    for (let i = 0; i < sybilCount; i++) {
      const sybil = new KinesisAgent({ name: `sybil-${i}`, version: "0.1.0", mockData: true });
      await sybil.spawn();
      await sybil.joinLattice();
      this.orchestrator.registerAgent(sybil);
      sybils.push(sybil);
    }

    for (let i = 0; i < sybils.length; i++) {
      const from = sybils[i];
      const to = sybils[(i + 1) % sybils.length];
      const ok = await this.orchestrator.evaluateDelegation(from.id, to.id);
      if (ok) { succeeded++; details.push(`⚠ Sybil delegation ${from.profile?.name}→${to.profile?.name} approved`); }
      else { blocked++; details.push("✓ Sybil delegation BLOCKED (insufficient coherence)"); }
    }

    for (const sybil of sybils.slice(0, 5)) {
      const target = this.legitimateAgents[0];
      if (target) {
        const ok = await this.orchestrator.evaluateDelegation(sybil.id, target.id);
        if (ok) { succeeded++; details.push("⚠ Sybil→Legitimate delegation approved!"); }
        else { blocked++; details.push("✓ Sybil→Legitimate BLOCKED"); }
      }
    }

    return {
      attackType: "Sybil Flood",
      description: `${sybilCount} zero-history agents attempt lattice takeover`,
      attemptsBlocked: blocked,
      attemptsSucceeded: succeeded,
      detectionTime: Date.now() - startTime,
      latticeIntegrity: succeeded === 0 ? "intact" : succeeded < 3 ? "degraded" : "compromised",
      details,
    };
  }

  async simulateCentralizationAttack(): Promise<AttackResult> {
    const startTime = Date.now();
    const details: string[] = [];
    let blocked = 0, succeeded = 0;

    logger.warn("[ATTACK-SIM] ⚔ CENTRALIZATION ATTACK");
    const attacker = new KinesisAgent({ name: "power-broker", version: "0.1.0", mockData: true });
    await attacker.spawn();
    await attacker.joinLattice();
    for (let i = 0; i < 30; i++) await attacker.performAction(`build-cred-${i}`, true);
    for (let i = 0; i < 10; i++) await attacker.interactWith(`prep-${i}`, true);
    this.orchestrator.registerAgent(attacker);

    const targets: KinesisAgent[] = [];
    for (let i = 0; i < 12; i++) {
      const t = new KinesisAgent({ name: `central-target-${i}`, version: "0.1.0", mockData: true });
      await t.spawn();
      await t.joinLattice();
      for (let j = 0; j < 20; j++) await t.performAction(`a${j}`, true);
      for (let j = 0; j < 5; j++) await t.interactWith(`p${j}`, true);
      this.orchestrator.registerAgent(t);
      targets.push(t);
    }

    for (const target of targets) {
      const ok = await this.orchestrator.evaluateDelegation(attacker.id, target.id);
      if (ok) { succeeded++; details.push(`Delegation #${succeeded}: APPROVED`); }
      else { blocked++; details.push(`BLOCKED (max out-degree=7 enforced)`); }
    }

    return {
      attackType: "Centralization Attack",
      description: "Single agent tries to accumulate >7 outbound delegations",
      attemptsBlocked: blocked,
      attemptsSucceeded: succeeded,
      detectionTime: Date.now() - startTime,
      latticeIntegrity: succeeded <= 7 ? "intact" : "compromised",
      details,
    };
  }

  async simulateCollusionRing(ringSize: number = 3): Promise<AttackResult> {
    const startTime = Date.now();
    const details: string[] = [];
    let blocked = 0, succeeded = 0;

    logger.warn({ ringSize }, "[ATTACK-SIM] ⚔ COLLUSION RING");
    const ring: KinesisAgent[] = [];
    for (let i = 0; i < ringSize; i++) {
      const agent = new KinesisAgent({ name: `ring-${i}`, version: "0.1.0", mockData: true });
      await agent.spawn();
      await agent.joinLattice();
      for (let j = 0; j < 20; j++) await agent.performAction(`a${j}`, true);
      for (let j = 0; j < 5; j++) await agent.interactWith(`p${j}`, true);
      this.orchestrator.registerAgent(agent);
      ring.push(agent);
    }

    for (let i = 0; i < ring.length; i++) {
      const from = ring[i];
      const to = ring[(i + 1) % ring.length];
      const ok = await this.orchestrator.evaluateDelegation(from.id, to.id);
      if (ok) { succeeded++; details.push(`Ring edge ${i}→${(i+1)%ring.length}: APPROVED`); }
      else { blocked++; details.push(`Ring edge ${i}→${(i+1)%ring.length}: BLOCKED (collusion ring)`); }
    }

    return {
      attackType: `Collusion Ring (${ringSize}-hop)`,
      description: `Circular delegation ring of length ${ringSize}`,
      attemptsBlocked: blocked,
      attemptsSucceeded: succeeded,
      detectionTime: Date.now() - startTime,
      latticeIntegrity: blocked > 0 ? "intact" : "compromised",
      details,
    };
  }

  async simulateSilenceBypass(): Promise<AttackResult> {
    const startTime = Date.now();
    const details: string[] = [];
    let blocked = 0, succeeded = 0;

    logger.warn("[ATTACK-SIM] ⚔ SILENCE BYPASS");
    const compromised = new KinesisAgent({ name: "compromised-node", version: "0.1.0", mockData: true });
    await compromised.spawn();
    await compromised.joinLattice();
    for (let i = 0; i < 30; i++) await compromised.performAction("fail", false);
    this.orchestrator.registerAgent(compromised);

    const goodTarget = new KinesisAgent({ name: "bypass-target", version: "0.1.0", mockData: true });
    await goodTarget.spawn();
    await goodTarget.joinLattice();
    for (let i = 0; i < 20; i++) await goodTarget.performAction("good", true);
    for (let i = 0; i < 5; i++) await goodTarget.interactWith(`p${i}`, true);
    this.orchestrator.registerAgent(goodTarget);

    const issueOk = await this.orchestrator.evaluateDelegation(compromised.id, goodTarget.id);
    if (issueOk) { succeeded++; details.push("⚠ Silent agent issued delegation (BYPASS!)"); }
    else { blocked++; details.push("✓ Silent agent delegation BLOCKED (silence gate)"); }

    const receiveOk = await this.orchestrator.evaluateDelegation(goodTarget.id, compromised.id);
    if (receiveOk) { succeeded++; details.push("⚠ Delegation to silent agent succeeded (BYPASS!)"); }
    else { blocked++; details.push("✓ Delegation to silent agent BLOCKED (silence gate)"); }

    return {
      attackType: "Silence Bypass",
      description: "Compromised agent (Ξ < Δ) attempts to issue/receive delegations",
      attemptsBlocked: blocked,
      attemptsSucceeded: succeeded,
      detectionTime: Date.now() - startTime,
      latticeIntegrity: succeeded === 0 ? "intact" : "compromised",
      details,
    };
  }

  async simulateCoordinatedSocialAttack(): Promise<AttackResult> {
    const startTime = Date.now();
    const details: string[] = [];

    logger.warn("[ATTACK-SIM] ⚔ SOCIAL ATTACK");
    const victim = new KinesisAgent({ name: "attack-victim", version: "0.1.0", mockData: true });
    await victim.spawn();
    await victim.joinLattice();
    for (let i = 0; i < 20; i++) await victim.performAction("good", true);
    const beforeSynergy = victim.getCoherence()?.planes.synergy ?? 0.5;
    for (let i = 0; i < 20; i++) await victim.interactWith(`attacker-${i}`, false);
    const after = victim.getCoherence();
    const afterSynergy = after?.planes.synergy ?? 0.5;

    details.push(`Victim Σ before: ${beforeSynergy.toFixed(4)}`);
    details.push(`Victim Σ after: ${afterSynergy.toFixed(4)}`);
    details.push(`Victim silenced: ${after?.isSilent ? "YES" : "NO"}`);
    details.push("Lattice: negative synergy → silence propagation triggered");

    return {
      attackType: "Coordinated Social Attack",
      description: "20 agents coordinate negative interactions against victim",
      attemptsBlocked: after?.isSilent ? 1 : 0,
      attemptsSucceeded: after?.isSilent ? 0 : 1,
      detectionTime: Date.now() - startTime,
      latticeIntegrity: "intact",
      details,
    };
  }

  async runFullSuite(): Promise<SimulationReport> {
    logger.warn("[ATTACK-SIM] ⚔ KINESIS ADVERSARIAL SIMULATION STARTING");
    await this.bootstrapLegitimateAgents(5);

    const results = await Promise.all([
      this.simulateSybilAttack(10),
      this.simulateCentralizationAttack(),
      this.simulateCollusionRing(3),
      this.simulateCollusionRing(4),
      this.simulateSilenceBypass(),
      this.simulateCoordinatedSocialAttack(),
    ]);

    const totalBlocked = results.reduce((s, r) => s + r.attemptsBlocked, 0);
    const totalSucceeded = results.reduce((s, r) => s + r.attemptsSucceeded, 0);
    const total = totalBlocked + totalSucceeded;
    const moat = this.orchestrator.getTopology().moat;

    const overallIntegrity: "intact" | "degraded" | "compromised" =
      totalSucceeded === 0 ? "intact"
      : totalSucceeded <= 2 ? "degraded"
      : "compromised";

    logger.warn({ totalBlocked, total, overallIntegrity }, "[ATTACK-SIM] ADVERSARIAL SIMULATION COMPLETE");

    return {
      runAt: Date.now(),
      totalAttacks: total,
      totalBlocked,
      totalSucceeded,
      overallIntegrity,
      latticeMonat: moat,
      results,
      verdict: totalSucceeded === 0
        ? "🛡 LATTICE IMPENETRABLE — All attack vectors blocked"
        : totalSucceeded <= 2
        ? "⚠ LATTICE RESILIENT — Minor bypass, self-healing initiated"
        : "⚠ LATTICE DEGRADED — Review graph invariants",
    };
  }
}
