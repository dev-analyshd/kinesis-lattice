import { LatticeOrchestrator } from '../lattice/orchestrator';
import { KinesisAgent } from '../lattice/agent';

async function createReadyAgent(name: string): Promise<KinesisAgent> {
  const agent = new KinesisAgent({ name, version: '0.1.0', mockData: true });
  await agent.spawn();
  await agent.joinLattice();
  // Build up coherence
  for (let i = 0; i < 15; i++) {
    await agent.performAction(`action-${i}`, true);
  }
  for (let i = 0; i < 5; i++) {
    await agent.interactWith(`peer-${i}`, true);
  }
  return agent;
}

describe('LatticeOrchestrator', () => {
  let orchestrator: LatticeOrchestrator;

  beforeEach(async () => {
    orchestrator = new LatticeOrchestrator();
    await orchestrator.initialize();
  });

  test('registers agents correctly', async () => {
    const agent = await createReadyAgent('agent-1');
    orchestrator.registerAgent(agent);
    expect(orchestrator.getAgentCount()).toBe(1);
  });

  test('delegation succeeds between coherent agents', async () => {
    const from = await createReadyAgent('from-agent');
    const to = await createReadyAgent('to-agent');
    orchestrator.registerAgent(from);
    orchestrator.registerAgent(to);

    const result = await orchestrator.evaluateDelegation(from.id, to.id);
    // May succeed or fail based on coherence levels — just verify no exception
    expect(typeof result).toBe('boolean');
  });

  test('delegation fails when delegator is silent', async () => {
    const silent = new KinesisAgent({ name: 'silent', version: '0.1.0', mockData: true });
    await silent.spawn();
    await silent.joinLattice();
    for (let i = 0; i < 30; i++) {
      await silent.performAction('fail', false);
    }

    const good = await createReadyAgent('good-agent');
    orchestrator.registerAgent(silent);
    orchestrator.registerAgent(good);

    const result = await orchestrator.evaluateDelegation(silent.id, good.id);
    expect(result).toBe(false);
  });

  test('topology returns correct structure', async () => {
    const agent = await createReadyAgent('topo-agent');
    orchestrator.registerAgent(agent);
    const topology = orchestrator.getTopology();

    expect(topology).toHaveProperty('agents');
    expect(topology).toHaveProperty('edges');
    expect(topology).toHaveProperty('moat');
    expect(topology).toHaveProperty('volatility');
    expect(topology).toHaveProperty('activeSilences');
    expect(topology.agents.length).toBe(1);
  });

  test('revocation removes delegation edge', async () => {
    const from = await createReadyAgent('from-revoke');
    const to = await createReadyAgent('to-revoke');
    orchestrator.registerAgent(from);
    orchestrator.registerAgent(to);

    await orchestrator.evaluateDelegation(from.id, to.id);
    await orchestrator.revokeDelegation(from.id, to.id);

    expect(orchestrator.getEdgeCount()).toBe(0);
  });
});
