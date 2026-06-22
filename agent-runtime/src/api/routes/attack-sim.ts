/**
 * KINESIS Adversarial Attack Simulation API Routes
 *
 * These endpoints trigger live attack simulations against the lattice
 * and return structured results. Use for demo recording and security audits.
 *
 * POST /api/v1/attack-sim/run          — full 6-vector simulation
 * POST /api/v1/attack-sim/sybil        — sybil flood only
 * POST /api/v1/attack-sim/centralize   — centralization attack only
 * POST /api/v1/attack-sim/ring         — collusion ring only
 * POST /api/v1/attack-sim/silence      — silence bypass only
 * GET  /api/v1/attack-sim/status       — last simulation result
 */

import { Router, Request, Response } from 'express';
import { AdversarialSimulator, SimulationReport } from '../../adversarial/attack-simulator';
import { LatticeOrchestrator } from '../../lattice/orchestrator';
import { logger } from '../../utils/logger';

const router = Router();

let lastReport: SimulationReport | null = null;
let simulationRunning = false;

router.get('/status', (_req: Request, res: Response) => {
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
  res: Response,
  orchestrator: LatticeOrchestrator,
  attackFn: (sim: AdversarialSimulator) => Promise<any>
) {
  if (simulationRunning) {
    res.status(429).json({ error: 'Simulation already running. Try again in a moment.' });
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
    logger.error('Attack simulation failed', { error: err.message });
    res.status(500).json({ error: err.message });
  } finally {
    simulationRunning = false;
  }
}

// Full suite — runs all 6 attack vectors, returns complete report
router.post('/run', async (req: Request, res: Response) => {
  const { orchestrator } = req as any;
  await runSimulation(res, orchestrator, async (sim) => {
    return sim.runFullSuite();
  });
});

router.post('/sybil', async (req: Request, res: Response) => {
  const count = parseInt(req.body?.count ?? '10', 10);
  const { orchestrator } = req as any;
  await runSimulation(res, orchestrator, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    return sim.simulateSybilAttack(count);
  });
});

router.post('/centralize', async (req: Request, res: Response) => {
  const { orchestrator } = req as any;
  await runSimulation(res, orchestrator, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    return sim.simulateCentralizationAttack();
  });
});

router.post('/ring', async (req: Request, res: Response) => {
  const size = parseInt(req.body?.size ?? '3', 10);
  const { orchestrator } = req as any;
  await runSimulation(res, orchestrator, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    return sim.simulateCollusionRing(size);
  });
});

router.post('/silence', async (req: Request, res: Response) => {
  const { orchestrator } = req as any;
  await runSimulation(res, orchestrator, async (sim) => {
    await sim.bootstrapLegitimateAgents(3);
    return sim.simulateSilenceBypass();
  });
});

export { router as attackSimRouter };
