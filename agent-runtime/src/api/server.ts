import express, { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { LatticeOrchestrator } from '../lattice/orchestrator';
import { KinesisAgent } from '../lattice/agent';
import { A2AProtocol } from '../federation/a2a-protocol';
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
