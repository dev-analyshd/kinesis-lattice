import WebSocket from 'ws';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:8080';
const WS_URL = process.env.WS_URL || 'ws://localhost:8080';

/**
 * E2E Integration Tests — KINESIS Lattice Lifecycle
 *
 * These tests require the KINESIS API server to be running:
 *   MOCK_DATA_FOR_DEMO=true DEMO_AGENT_COUNT=5 node agent-runtime/dist/index.js
 *
 * Run with: npm run test:integration
 */

function connectWS(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('WS connection timeout')), 10000);
  });
}

describe('KINESIS Lattice E2E Lifecycle', () => {
  let ws: WebSocket;

  beforeAll(async () => {
    // Verify API is up
    try {
      await axios.get(`${API_URL}/health`);
    } catch {
      throw new Error(
        `API server not running at ${API_URL}\n` +
        'Start with: MOCK_DATA_FOR_DEMO=true node agent-runtime/dist/index.js'
      );
    }

    ws = await connectWS(WS_URL);
  });

  afterAll(() => {
    ws?.close();
  });

  // ── E2E-01: Health check ─────────────────────────────────────────────────
  test('E2E-01: Health endpoint returns healthy status', async () => {
    const res = await axios.get(`${API_URL}/health`);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status', 'healthy');
    expect(res.data).toHaveProperty('agents');
    expect(res.data).toHaveProperty('edges');
    expect(res.data).toHaveProperty('timestamp');
  });

  // ── E2E-02: Spawn agent via API ──────────────────────────────────────────
  test('E2E-02: Agent spawned via API has valid DID', async () => {
    const res = await axios.post(`${API_URL}/api/v1/agents/spawn`, {
      name: 'e2e-test-agent',
      mockData: true,
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.agent).toHaveProperty('id');
    expect(res.data.agent.did).toContain('did:t3n:mock:');
  });

  // ── E2E-03: Lattice topology structure ───────────────────────────────────
  test('E2E-03: Lattice topology has correct schema', async () => {
    const res = await axios.get(`${API_URL}/api/v1/lattice/topology`);
    expect(res.status).toBe(200);
    const topo = res.data;
    expect(topo).toHaveProperty('agents');
    expect(topo).toHaveProperty('edges');
    expect(topo).toHaveProperty('moat');
    expect(topo).toHaveProperty('volatility');
    expect(topo).toHaveProperty('activeSilences');
    expect(Array.isArray(topo.agents)).toBe(true);
    expect(Array.isArray(topo.edges)).toBe(true);
    expect(typeof topo.moat).toBe('number');
  });

  // ── E2E-04: Moat endpoint ────────────────────────────────────────────────
  test('E2E-04: Moat endpoint returns numeric values', async () => {
    const res = await axios.get(`${API_URL}/api/v1/lattice/moat`);
    expect(res.status).toBe(200);
    expect(typeof res.data.moat).toBe('number');
    expect(res.data.moat).toBeGreaterThanOrEqual(0);
  });

  // ── E2E-05: Agent list ───────────────────────────────────────────────────
  test('E2E-05: Agent list returns array of agents', async () => {
    const res = await axios.get(`${API_URL}/api/v1/agents`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    if (res.data.length > 0) {
      const agent = res.data[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('did');
      expect(agent).toHaveProperty('name');
    }
  });

  // ── E2E-06: WebSocket topology stream ────────────────────────────────────
  test('E2E-06: WebSocket streams topology updates', (done) => {
    ws.once('message', (rawData) => {
      const msg = JSON.parse(rawData.toString());
      expect(msg).toHaveProperty('type', 'topology');
      expect(msg).toHaveProperty('data');
      expect(msg.data).toHaveProperty('agents');
      expect(msg.data).toHaveProperty('moat');
      done();
    });

    // Trigger a topology update by spawning an agent
    axios.post(`${API_URL}/api/v1/agents/spawn`, { name: 'ws-test-agent', mockData: true });
  });

  // ── E2E-07: Delegation evaluation ────────────────────────────────────────
  test('E2E-07: Delegation API returns boolean success', async () => {
    // Get existing agents
    const topologyRes = await axios.get(`${API_URL}/api/v1/lattice/topology`);
    const agents = topologyRes.data.agents;

    if (agents.length >= 2) {
      const res = await axios.post(`${API_URL}/api/v1/delegations`, {
        from: agents[0].id,
        to: agents[1].id,
      });
      expect(res.status).toBe(200);
      expect(typeof res.data.success).toBe('boolean');
    } else {
      console.log('Skipping delegation test — need >= 2 agents');
    }
  });

  // ── E2E-08: A2A Agent Card ───────────────────────────────────────────────
  test('E2E-08: Agent card endpoint returns capabilities', async () => {
    const topologyRes = await axios.get(`${API_URL}/api/v1/lattice/topology`);
    const agents = topologyRes.data.agents;

    if (agents.length > 0) {
      const res = await axios.get(`${API_URL}/api/v1/agents/${agents[0].id}/agent-card`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('did');
      expect(res.data).toHaveProperty('capabilities');
      expect(res.data.capabilities).toContain('behavioral-coherence');
    }
  });
});
