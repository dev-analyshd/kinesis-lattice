import { KinesisAgent } from './lattice/agent';
import { LatticeOrchestrator } from './lattice/orchestrator';
import { logger } from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  logger.info('KINESIS Agent Runtime Starting...');
  logger.info('The Living Delegation Lattice — Trust is earned, not given.');

  // Initialize lattice orchestrator (connects to TEE contract in production)
  const orchestrator = new LatticeOrchestrator();
  await orchestrator.initialize();

  // Start API server (Express + WebSocket)
  const { orchestrator: serverOrchestrator } = await import('./api/server');

  // Spawn demo agents if MOCK_DATA_FOR_DEMO=true
  if (process.env.MOCK_DATA_FOR_DEMO === 'true') {
    const demoCount = parseInt(process.env.DEMO_AGENT_COUNT || '5', 10);
    logger.info(`Spawning ${demoCount} demo agents for demonstration...`);

    const agents: KinesisAgent[] = [];

    for (let i = 0; i < demoCount; i++) {
      const agent = new KinesisAgent({
        name: `kinesis-agent-${i + 1}`,
        version: '0.1.0',
        mockData: true,
      });

      await agent.spawn();
      await agent.joinLattice();
      serverOrchestrator.registerAgent(agent);
      agents.push(agent);

      // Simulate varied behavioral history
      const successRate = 0.6 + Math.random() * 0.35; // 60-95% success
      const actionCount = 5 + Math.floor(Math.random() * 10);

      for (let j = 0; j < actionCount; j++) {
        await agent.performAction(`action-${j}`, Math.random() < successRate);
      }

      // Simulate inter-agent interactions
      if (i > 0) {
        const peerIdx = Math.floor(Math.random() * i);
        const positive = Math.random() > 0.3;
        await agent.interactWith(agents[peerIdx].id, positive);
      }
    }

    // Create delegation chains (only between agents with sufficient coherence)
    logger.info('Evaluating delegation opportunities...');

    for (let i = 0; i < agents.length - 1; i++) {
      const fromAgent = agents[i];
      const toAgent = agents[i + 1];

      if (!fromAgent.isSilent() && !toAgent.isSilent()) {
        const success = await serverOrchestrator.evaluateDelegation(fromAgent.id, toAgent.id);
        if (success) {
          logger.info(`Delegation established: ${fromAgent.profile?.name} → ${toAgent.profile?.name}`);
        }
      }
    }

    // Log final lattice state
    const topology = serverOrchestrator.getTopology();
    logger.info('Demo lattice initialized', {
      agents: topology.agents.length,
      delegations: topology.edges.length,
      silences: topology.activeSilences,
      moat: topology.moat.toFixed(4),
      volatility: topology.volatility.toFixed(4),
    });
  } else {
    // Production mode: spawn real agent with T3N identity
    logger.info('Production mode — initializing real T3N identity...');

    const coreAgent = new KinesisAgent({
      name: process.env.AGENT_NAME || 'kinesis-core',
      version: process.env.AGENT_VERSION || '0.1.0',
      mockData: false,
    });

    await coreAgent.spawn();
    await coreAgent.joinLattice();
    serverOrchestrator.registerAgent(coreAgent);

    logger.info('Core agent online', { did: coreAgent.did });
  }

  logger.info('KINESIS Agent Runtime Ready. The lattice remembers.');
}

main().catch(err => {
  logger.error('Fatal error in KINESIS runtime', { error: err.message, stack: err.stack });
  process.exit(1);
});
