import { Router } from "express";
import { orchestrator } from "../kinesis-runtime.js";

const router = Router();

router.get("/narrative", (_req, res) => {
  const topo = orchestrator.getTopology();
  const agents = topo.agents;
  const silentCount = agents.filter(a => a.isSilent).length;
  const avgCoherence = agents.length
    ? agents.reduce((s, a) => s + (a.coherence?.composite ?? 0), 0) / agents.length
    : 0;

  res.json({
    title: "KINESIS — The Living Delegation Lattice",
    subtitle: "Terminal 3 Agent Dev Kit Bounty — June 22, 2026",
    equation: "Ξ(a,t) = 0.30·Π + 0.25·Φ + 0.20·Σ + 0.15·Κ + 0.10·Α",
    t3nIntegration: {
      sdk: "@terminal3/t3n-sdk",
      environment: process.env.T3N_ENVIRONMENT || "testnet",
      did: process.env.T3N_DID || "not configured",
      authenticated: !!(process.env.T3N_API_KEY && process.env.T3N_DID),
      capabilities: [
        "TEE-verified agent identity via did:t3n DIDs",
        "Ethereum-signed authentication (EthAuth pattern)",
        "Challenge-response A2A handshake",
        "BBS+ selective disclosure capability proofs",
        "T3N revocation registry credential checks",
        "Web Bot Auth (RFC 9421) outbound signatures",
        "ERC-8004 on-chain identity anchoring",
      ],
    },
    narrative: [
      "1. KINESIS replaces static role assignments with a living coherence lattice.",
      "   Each agent earns delegation rights through 5 behavioral planes:",
      "   Protocol (Π) · Fidelity (Φ) · Synergy (Σ) · Knowledge (Κ) · Adaptivity (Α)",
      "",
      "2. The Lattice Moat (Ξ̄) is a weighted average of all agent coherence scores,",
      "   bounded by Herfindahl–Hirschman Index concentration penalties.",
      `   Current moat: ${topo.moat.toFixed(4)} (target > 0.70)`,
      "",
      "3. Structured Silence: agents below their dynamic threshold (Δ ≥ 0.55)",
      "   enter 'silence' — they cannot issue or receive delegations until",
      "   they rehabilitate through sustained good behavior.",
      `   Currently silent: ${silentCount}/${agents.length} agents`,
      "",
      "4. Hard-Zero Planes: three conditions force an entire plane to 0:",
      "   • Knowledge (Κ): stagnation > 30 days",
      "   • Adaptivity (Α): behavioral z-score > 3σ",
      "   • Protocol (Π): 100% violation rate",
      "",
      "5. Graph Invariants enforced by LatticeOrchestrator:",
      "   • Max out-degree = 7 (prevents centralization)",
      "   • Cycle detection (rejects collusion rings < 5 hops)",
      "   • Geographic diversity ≥ 3 jurisdictions when |agents| ≥ 5",
      "   • HHI concentration check (< 0.25 required)",
      "",
      "6. Agent-to-Agent (A2A) Protocol: each agent publishes an agent card",
      "   at /.well-known/agent.json with its DID, coherence score, and",
      "   capabilities — enabling federated multi-lattice discovery.",
      "",
      "7. Terminal 3 TEE Integration: agent identity anchored to did:t3n: DIDs.",
      "   T3N_API_KEY and T3N_DID are configured for this deployment.",
      "   All agents carry T3N-anchored DIDs derived from the master identity.",
    ],
    currentState: {
      agentCount: agents.length,
      coherentAgents: agents.filter(a => !a.isSilent).length,
      silentAgents: silentCount,
      averageCoherence: avgCoherence.toFixed(4),
      latticeMoat: topo.moat.toFixed(4),
      edgeCount: topo.edges.length,
      volatility: topo.volatility?.toFixed(4) ?? "0.0000",
    },
    endpoints: {
      topology: "/api/v1/lattice/topology",
      spawnAgent: "POST /api/v1/agents/spawn",
      createDelegation: "POST /api/v1/delegations",
      attackSim: "POST /api/v1/attack-sim/run",
      agentCard: "/.well-known/agent.json",
      narrative: "/api/v1/demo/narrative",
    },
    github: "https://github.com/dev-analyshd/kinesis-lattice",
  });
});

export default router;
