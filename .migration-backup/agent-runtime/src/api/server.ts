import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { LatticeOrchestrator } from '../lattice/orchestrator';
import { KinesisAgent } from '../lattice/agent';
import { A2AProtocol } from '../federation/a2a-protocol';
import { attackSimRouter } from './routes/attack-sim';
import { logger } from '../utils/logger';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

export const orchestrator = new LatticeOrchestrator();
const a2aProtocol = new A2AProtocol();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));

// Serve the interactive demo UI at root
app.use(express.static('public'));

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    agents: orchestrator.getAgentCount(),
    edges: orchestrator.getEdgeCount(),
    timestamp: Date.now(),
    teeMode: process.env.MOCK_DATA_FOR_DEMO !== 'true' ? 'live' : 'mock',
  });
});

// ── A2A Agent Card (RFC: /.well-known/agent.json) ───────────────────────────
app.get('/.well-known/agent.json', (req: Request, res: Response) => {
  const host = req.headers.host || `localhost:${process.env.API_PORT || 8080}`;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const card = a2aProtocol.buildAgentCard(
    'kinesis-core',
    '0.1.0',
    process.env.T3N_DID || 'did:t3n:testnet:kinesis-core',
    `${proto}://${host}/api/v1`,
  );
  res.json(card);
});

// ── Agent Management ────────────────────────────────────────────────────────
app.post('/api/v1/agents/spawn', async (req: Request, res: Response) => {
  try {
    const { name, mockData = true } = req.body;
    const agent = new KinesisAgent({
      name: name || `agent-${Date.now()}`,
      version: '0.1.0',
      mockData,
    });
    await agent.spawn();
    await agent.joinLattice();
    orchestrator.registerAgent(agent);

    // Give new agent some initial behavioral history
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
    logger.error('Failed to spawn agent', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/agents', (_req: Request, res: Response) => {
  res.json(orchestrator.getTopology().agents);
});

app.get('/api/v1/agents/:id/coherence', (req: Request, res: Response) => {
  const topology = orchestrator.getTopology();
  const agent = topology.agents.find(a => a.id === req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ agentId: req.params.id, coherence: agent.coherence });
});

app.get('/api/v1/agents/:id/agent-card', (req: Request, res: Response) => {
  const topology = orchestrator.getTopology();
  const agent = topology.agents.find(a => a.id === req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const card = a2aProtocol.buildAgentCard(
    agent.name,
    '0.1.0',
    agent.did,
    `/api/v1/agents/${agent.id}`,
    agent.coherence?.composite,
    agent.jurisdiction,
  );
  res.json(card);
});

// ── Delegation ──────────────────────────────────────────────────────────────
app.post('/api/v1/delegations', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      res.status(400).json({ success: false, error: 'from and to are required' });
      return;
    }
    const success = await orchestrator.evaluateDelegation(from, to);
    res.json({ success });
  } catch (err: any) {
    logger.error('Delegation failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/v1/delegations', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.body;
    await orchestrator.revokeDelegation(from, to);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Adversarial Attack Simulation ───────────────────────────────────────────
// Inject orchestrator into request context for isolated sim orchestrators
app.use('/api/v1/attack-sim', (req: Request, _res, next: NextFunction) => {
  (req as any).orchestrator = orchestrator;
  next();
}, attackSimRouter);

// ── Judge Demo Narrative ─────────────────────────────────────────────────────
app.get('/api/v1/demo/narrative', (_req: Request, res: Response) => {
  const topo = orchestrator.getTopology();
  const agents = topo.agents;
  const coherentCount = agents.filter(a => !a.isSilent).length;
  const silentCount = agents.filter(a => a.isSilent).length;
  const avgCoherence = agents.length
    ? agents.reduce((s, a) => s + (a.coherence?.composite ?? 0), 0) / agents.length
    : 0;

  res.json({
    title: 'KINESIS — The Living Delegation Lattice',
    subtitle: 'Terminal 3 Agent Dev Kit Bounty — June 22, 2026',
    equation: 'Ξ(a,t) = 0.30·Π + 0.25·Φ + 0.20·Σ + 0.15·Κ + 0.10·Α',
    narrative: [
      '1. KINESIS replaces static role assignments with a living coherence lattice.',
      '   Each agent earns delegation rights through 5 behavioral planes:',
      '   Protocol (Π) · Fidelity (Φ) · Synergy (Σ) · Knowledge (Κ) · Adaptivity (Α)',
      '',
      '2. The Lattice Moat (Ξ̄) is a weighted average of all agent coherence scores,',
      '   bounded by Herfindahl–Hirschman Index concentration penalties.',
      '   Current moat: ' + topo.moat.toFixed(4) + ' (target > 0.70)',
      '',
      '3. Structured Silence: agents below their dynamic threshold (Δ ≥ 0.55)',
      '   enter "silence" — they cannot issue or receive delegations until',
      '   they rehabilitate through sustained good behavior.',
      '   Currently silent: ' + silentCount + '/' + agents.length + ' agents',
      '',
      '4. Hard-Zero Planes: three conditions force an entire plane to 0:',
      '   • Knowledge (Κ): stagnation > 30 days',
      '   • Adaptivity (Α): behavioral z-score > 3σ',
      '   • Protocol (Π): 100% violation rate',
      '',
      '5. Graph Invariants enforced by LatticeOrchestrator:',
      '   • Max out-degree = 7 (prevents centralization)',
      '   • Cycle detection (rejects collusion rings < 5 hops)',
      '   • Geographic diversity ≥ 3 jurisdictions when |agents| ≥ 5',
      '   • HHI concentration check (< 0.25 required)',
      '',
      '6. Agent-to-Agent (A2A) Protocol: each agent publishes an agent card',
      '   at /.well-known/agent.json with its DID, coherence score, and',
      '   capabilities — enabling federated multi-lattice discovery.',
      '',
      '7. Terminal 3 TEE Integration: agent identity anchored to did:t3n: DIDs.',
      '   In production, replace t3n-sdk-mock with the real @terminal3/t3n-sdk',
      '   and set T3N_API_KEY + T3N_DID environment variables.',
    ],
    currentState: {
      agentCount: agents.length,
      coherentAgents: coherentCount,
      silentAgents: silentCount,
      averageCoherence: avgCoherence.toFixed(4),
      latticeMonat: topo.moat.toFixed(4),
      edgeCount: topo.delegations.length,
      volatility: topo.volatility?.toFixed(4) ?? '0.0000',
    },
    endpoints: {
      topology: '/api/v1/lattice/topology',
      spawnAgent: 'POST /api/v1/agents/spawn',
      createDelegation: 'POST /api/v1/delegations',
      attackSim: 'POST /api/v1/attack-sim/run',
      agentCard: '/.well-known/agent.json',
    },
    github: 'https://github.com/dev-analyshd/kinesis-lattice',
  });
});

// ── Lattice State ───────────────────────────────────────────────────────────
app.get('/api/v1/lattice/topology', (_req: Request, res: Response) => {
  res.json(orchestrator.getTopology());
});

app.get('/api/v1/lattice/moat', (_req: Request, res: Response) => {
  const topology = orchestrator.getTopology();
  res.json({ moat: topology.moat, volatility: topology.volatility });
});

app.get('/api/v1/lattice/silences', (_req: Request, res: Response) => {
  res.json(orchestrator.getSilenceLog());
});

// ── WebSocket — Real-time Lattice Topology ──────────────────────────────────
wss.on('connection', (ws: WebSocket) => {
  logger.info('WebSocket client connected');
  orchestrator.subscribe(ws);

  ws.on('message', (rawMessage) => {
    try {
      const msg = JSON.parse(rawMessage.toString());
      logger.debug('WS message received', { type: msg.type });
    } catch {
      // ignore malformed messages
    }
  });
});

// ── Start Server ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.API_PORT || '8080', 10);
server.listen(PORT, () => {
  logger.info(`KINESIS API Server running`, {
    port: PORT,
    dashboard: `http://localhost:${PORT}`,
    health: `http://localhost:${PORT}/health`,
    agentCard: `http://localhost:${PORT}/.well-known/agent.json`,
    topology: `http://localhost:${PORT}/api/v1/lattice/topology`,
  });
});

export { app, server };
