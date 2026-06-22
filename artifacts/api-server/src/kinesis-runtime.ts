import { LatticeOrchestrator } from "./lattice/orchestrator.js";
import { KinesisAgent } from "./lattice/agent.js";
import { logger } from "./lib/logger.js";

export const orchestrator = new LatticeOrchestrator();

let initialized = false;

export async function initializeKinesisRuntime(): Promise<void> {
  if (initialized) return;
  initialized = true;

  await orchestrator.initialize();

  const agentNames = [
    "trading-oracle",
    "risk-sentinel",
    "compliance-warden",
    "data-curator",
    "settlement-broker",
    "id-verifier",
    "audit-witness",
    "bridge-relay",
  ];

  logger.info("KINESIS Runtime: spawning demo agents with T3N-anchored DIDs...");

  const agents: KinesisAgent[] = [];

  for (let i = 0; i < agentNames.length; i++) {
    const agent = new KinesisAgent({
      name: agentNames[i],
      version: "0.1.0",
      mockData: true,
    });

    await agent.spawn();
    await agent.joinLattice();
    orchestrator.registerAgent(agent);
    agents.push(agent);

    const successRate = i === 2 ? 0.25 : 0.65 + Math.random() * 0.30;
    const actionCount = 8 + Math.floor(Math.random() * 12);
    for (let j = 0; j < actionCount; j++) {
      await agent.performAction(`init-${j}`, Math.random() < successRate);
    }

    if (i > 0) {
      for (let k = 0; k < Math.min(i, 3); k++) {
        const peerIdx = Math.floor(Math.random() * i);
        await agent.interactWith(agents[peerIdx].id, Math.random() > 0.25);
      }
    }
  }

  for (let i = 0; i < agents.length - 1; i++) {
    if (!agents[i].isSilent() && !agents[i + 1].isSilent()) {
      const ok = await orchestrator.evaluateDelegation(agents[i].id, agents[i + 1].id);
      if (ok) {
        logger.info({ from: agents[i].profile?.name, to: agents[i + 1].profile?.name }, "Initial delegation created");
      }
    }
  }

  const topo = orchestrator.getTopology();
  logger.info({
    agents: topo.agents.length,
    delegations: topo.edges.length,
    silences: topo.activeSilences,
    moat: topo.moat.toFixed(4),
    volatility: topo.volatility.toFixed(4),
  }, "KINESIS lattice initialized");

  startSimulationLoop(agents);
}

function startSimulationLoop(agents: KinesisAgent[]): void {
  let tick = 0;

  setInterval(async () => {
    tick++;

    for (const agent of agents) {
      if (Math.random() < 0.4) {
        const successProb = agent.isSilent() ? 0.4 : 0.7 + Math.random() * 0.25;
        await agent.performAction(`action-${tick}`, Math.random() < successProb);
      }

      if (Math.random() < 0.15 && agents.length > 1) {
        const peer = agents[Math.floor(Math.random() * agents.length)];
        if (peer.id !== agent.id) {
          await agent.interactWith(peer.id, Math.random() > 0.3);
        }
      }
    }

    if (tick % 5 === 0 && agents.length >= 2) {
      const from = agents[Math.floor(Math.random() * agents.length)];
      const to = agents[Math.floor(Math.random() * agents.length)];
      if (from.id !== to.id && !from.isSilent() && !to.isSilent()) {
        await orchestrator.evaluateDelegation(from.id, to.id);
      }
    }

    orchestrator.broadcastTopologyPublic();
  }, 2000);
}
