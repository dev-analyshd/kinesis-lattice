import { Router } from "express";
import { orchestrator } from "../kinesis-runtime.js";
import { KinesisAgent } from "../lattice/agent.js";
import { A2AProtocol } from "../federation/a2a-protocol.js";
import { logger } from "../lib/logger.js";

const router = Router();
const a2a = new A2AProtocol();

router.post("/spawn", async (req, res) => {
  try {
    const { name, mockData = true } = req.body as { name?: string; mockData?: boolean };
    const agent = new KinesisAgent({
      name: name || `agent-${Date.now()}`,
      version: "0.1.0",
      mockData,
    });
    await agent.spawn();
    await agent.joinLattice();
    orchestrator.registerAgent(agent);

    const successRate = 0.65 + Math.random() * 0.3;
    for (let i = 0; i < 5 + Math.floor(Math.random() * 8); i++) {
      await agent.performAction(`init-action-${i}`, Math.random() < successRate);
    }

    res.json({
      success: true,
      agent: {
        id: agent.id,
        did: agent.did,
        jurisdiction: agent.profile?.jurisdiction,
        agentCard: agent.getAgentCard(),
      },
    });
  } catch (err: any) {
    logger.error({ error: err.message }, "Failed to spawn agent");
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/", (_req, res) => {
  res.json(orchestrator.getTopology().agents);
});

router.get("/:id/coherence", (req, res) => {
  const topology = orchestrator.getTopology();
  const agent = topology.agents.find(a => a.id === req.params.id);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json({ agentId: req.params.id, coherence: agent.coherence });
});

router.get("/:id/agent-card", (req, res) => {
  const topology = orchestrator.getTopology();
  const agent = topology.agents.find(a => a.id === req.params.id);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const card = a2a.buildAgentCard(
    agent.name,
    "0.1.0",
    agent.did,
    `/api/v1/agents/${agent.id}`,
    agent.coherence?.composite,
    agent.jurisdiction,
  );
  res.json(card);
});

export default router;
