import { KinesisAgent } from './lattice/agent';
import { logger } from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  ⬡  KINESIS — The Living Delegation Lattice');
  logger.info('     Trust is earned, not given. The lattice remembers.');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Start API server first (imports orchestrator and WebSocket server)
  const { orchestrator: serverOrchestrator } = await import('./api/server');

  // Initialize the orchestrator
  await serverOrchestrator.initialize();

  const mockMode = process.env.MOCK_DATA_FOR_DEMO === 'true';

  if (mockMode) {
    const demoCount = parseInt(process.env.DEMO_AGENT_COUNT || '5', 10);
    logger.info(`Demo mode: spawning ${demoCount} mock agents...`);

    const agents: KinesisAgent[] = [];

    for (let i = 0; i < demoCount; i++) {
      const names = [
        'trading-oracle', 'risk-sentinel', 'compliance-warden',
        'data-curator', 'settlement-broker', 'id-verifier',
        'audit-witness', 'bridge-relay', 'policy-enforcer', 'market-maker'
      ];
      const agent = new KinesisAgent({
        name: names[i % names.length],
        version: '0.1.0',
        mockData: true,
      });

      await agent.spawn();
      await agent.joinLattice();
      serverOrchestrator.registerAgent(agent);
      agents.push(agent);

      // Varied behavioral history — some agents start coherent, some need work
      const successRate = i === 1 ? 0.25 : 0.65 + Math.random() * 0.30; // agent[1] starts rough
      const actionCount = 8 + Math.floor(Math.random() * 12);

      for (let j = 0; j < actionCount; j++) {
        await agent.performAction(`init-${j}`, Math.random() < successRate);
      }

      // Peer interactions
      if (i > 0) {
        for (let k = 0; k < Math.min(i, 3); k++) {
          const peerIdx = Math.floor(Math.random() * i);
          await agent.interactWith(agents[peerIdx].id, Math.random() > 0.25);
        }
      }
    }

    // Establish delegation chains between coherent agents
    logger.info('Evaluating initial delegation opportunities...');
    let delegationsCreated = 0;
    for (let i = 0; i < agents.length - 1; i++) {
      if (!agents[i].isSilent() && !agents[i + 1].isSilent()) {
        const ok = await serverOrchestrator.evaluateDelegation(agents[i].id, agents[i + 1].id);
        if (ok) {
          delegationsCreated++;
          logger.info(`Delegation: ${agents[i].profile?.name} → ${agents[i + 1].profile?.name}`);
        }
      }
    }

    const topo = serverOrchestrator.getTopology();
    logger.info('─────────────────────────────────────────────────────────');
    logger.info('  Lattice initialized:');
    logger.info(`    Agents     : ${topo.agents.length}`);
    logger.info(`    Delegations: ${topo.edges.length}`);
    logger.info(`    Silences   : ${topo.activeSilences}`);
    logger.info(`    Moat Λ(t)  : ${topo.moat.toFixed(4)}`);
    logger.info(`    Volatility : ${topo.volatility.toFixed(4)}`);
    logger.info('─────────────────────────────────────────────────────────');

    // ── Continuous simulation loop ─────────────────────────────────────
    // Keeps the lattice alive — agents act, interact, degrade, recover
    startSimulationLoop(agents, serverOrchestrator);

  } else {
    // Production mode — real T3N identity
    logger.info('Production mode — initializing T3N identity...');

    const coreAgent = new KinesisAgent({
      name: process.env.AGENT_NAME || 'kinesis-core',
      version: process.env.AGENT_VERSION || '0.1.0',
      mockData: false,
    });

    await coreAgent.spawn();
    await coreAgent.joinLattice();
    serverOrchestrator.registerAgent(coreAgent);

    logger.info(`Core agent online: ${coreAgent.did}`);
  }

  logger.info('KINESIS Agent Runtime Ready. Dashboard: http://localhost:' +
    (process.env.API_PORT || 8080));
}

function startSimulationLoop(agents: KinesisAgent[], orchestrator: any) {
  const PORT = process.env.API_PORT || 8080;
  logger.info(`Simulation loop running. Dashboard → http://localhost:${PORT}`);

  let tick = 0;

  setInterval(async () => {
    tick++;

    for (const agent of agents) {
      // Each agent occasionally takes an action
      if (Math.random() < 0.4) {
        const successProb = agent.isSilent() ? 0.4 : 0.7 + Math.random() * 0.25;
        await agent.performAction(`action-${tick}`, Math.random() < successProb);
      }

      // Occasionally interact with a random peer
      if (Math.random() < 0.15 && agents.length > 1) {
        const peer = agents[Math.floor(Math.random() * agents.length)];
        if (peer.id !== agent.id) {
          await agent.interactWith(peer.id, Math.random() > 0.3);
        }
      }
    }

    // Occasionally try to create new delegations
    if (tick % 5 === 0 && agents.length >= 2) {
      const from = agents[Math.floor(Math.random() * agents.length)];
      const to = agents[Math.floor(Math.random() * agents.length)];
      if (from.id !== to.id && !from.isSilent() && !to.isSilent()) {
        await orchestrator.evaluateDelegation(from.id, to.id);
      }
    }

    // Broadcast updated topology
    orchestrator.broadcastTopologyPublic?.();

  }, 2000); // Every 2 seconds
}

main().catch(err => {
  logger.error('Fatal error in KINESIS runtime', { error: err.message, stack: err.stack });
  process.exit(1);
});
