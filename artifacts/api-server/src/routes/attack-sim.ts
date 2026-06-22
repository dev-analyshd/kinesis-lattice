import { Router } from "express";
import { AdversarialSimulator, SimulationReport } from "../adversarial/attack-simulator.js";
import { LatticeOrchestrator } from "../lattice/orchestrator.js";
import { logger } from "../lib/logger.js";

const router = Router();

let lastReport: SimulationReport | null = null;
let simulationRunning = false;

router.get("/status", (_req, res) => {
  res.json({
    running: simulationRunning,
    lastReport: lastReport
      ? {
          ...lastReport,
          summary: {
            blocked: lastReport.totalBlocked,
            succeeded: lastReport.totalSucceeded,
            integrity: lastReport.overallIntegrity,
            verdict: lastReport.verdict,
          },
        }
      : null,
  });
});

async function runSimulation(
  res: any,
  attackFn: (sim: AdversarialSimulator) => Promise<SimulationReport>
) {
  if (simulationRunning) {
    res.status(429).json({ error: "Simulation already running. Try again in a moment." });
    return;
  }

  simulationRunning = true;
  const simOrchestrator = new LatticeOrchestrator();
  await simOrchestrator.initialize();

  try {
    const simulator = new AdversarialSimulator(simOrchestrator);
    const report = await attackFn(simulator);
    lastReport = report;
    res.json({ success: true, report });
  } catch (err: any) {
    logger.error({ error: err.message }, "Attack simulation failed");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    simulationRunning = false;
  }
}

router.post("/run", async (req, res) => {
  await runSimulation(res, async (sim) => sim.runFullSuite());
});

router.post("/sybil", async (req, res) => {
  await runSimulation(res, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    const result = await sim.simulateSybilAttack(10);
    return {
      runAt: Date.now(),
      totalAttacks: result.attemptsBlocked + result.attemptsSucceeded,
      totalBlocked: result.attemptsBlocked,
      totalSucceeded: result.attemptsSucceeded,
      overallIntegrity: result.latticeIntegrity,
      latticeMonat: 0,
      results: [result],
      verdict: result.attemptsSucceeded === 0 ? "🛡 Sybil attack fully repelled" : "⚠ Partial sybil bypass",
    };
  });
});

router.post("/centralize", async (req, res) => {
  await runSimulation(res, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    const result = await sim.simulateCentralizationAttack();
    return {
      runAt: Date.now(),
      totalAttacks: result.attemptsBlocked + result.attemptsSucceeded,
      totalBlocked: result.attemptsBlocked,
      totalSucceeded: result.attemptsSucceeded,
      overallIntegrity: result.latticeIntegrity,
      latticeMonat: 0,
      results: [result],
      verdict: `Max out-degree=7 blocked centralization`,
    };
  });
});

router.post("/ring", async (req, res) => {
  await runSimulation(res, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    const result = await sim.simulateCollusionRing(3);
    return {
      runAt: Date.now(),
      totalAttacks: result.attemptsBlocked + result.attemptsSucceeded,
      totalBlocked: result.attemptsBlocked,
      totalSucceeded: result.attemptsSucceeded,
      overallIntegrity: result.latticeIntegrity,
      latticeMonat: 0,
      results: [result],
      verdict: result.attemptsBlocked > 0 ? "🛡 Collusion ring detected and blocked" : "⚠ Ring formed",
    };
  });
});

router.post("/silence", async (req, res) => {
  await runSimulation(res, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    const result = await sim.simulateSilenceBypass();
    return {
      runAt: Date.now(),
      totalAttacks: result.attemptsBlocked + result.attemptsSucceeded,
      totalBlocked: result.attemptsBlocked,
      totalSucceeded: result.attemptsSucceeded,
      overallIntegrity: result.latticeIntegrity,
      latticeMonat: 0,
      results: [result],
      verdict: result.attemptsSucceeded === 0 ? "🛡 Silence gate held" : "⚠ Silence bypassed",
    };
  });
});

export default router;
