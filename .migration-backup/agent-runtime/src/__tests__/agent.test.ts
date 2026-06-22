import { KinesisAgent } from '../lattice/agent';

describe('KinesisAgent', () => {
  test('agent spawns with correct mock DID', async () => {
    const agent = new KinesisAgent({ name: 'test-agent', version: '0.1.0', mockData: true });
    await agent.spawn();
    expect(agent.id).toBeDefined();
    expect(agent.did).toContain('did:t3n:mock:');
    expect(agent.profile).not.toBeNull();
    expect(agent.profile!.name).toBe('test-agent');
  });

  test('performing good actions increases coherence above neutral', async () => {
    const agent = new KinesisAgent({ name: 'test-agent', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();

    for (let i = 0; i < 10; i++) {
      await agent.performAction(`good-action-${i}`, true);
    }

    const coherence = agent.getCoherence();
    expect(coherence).not.toBeNull();
    expect(coherence!.planes.fidelity).toBeGreaterThan(0.5);
    expect(coherence!.planes.protocol).toBeGreaterThan(0.5);
  });

  test('performing bad actions decreases coherence', async () => {
    const agent = new KinesisAgent({ name: 'bad-agent', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();

    for (let i = 0; i < 20; i++) {
      await agent.performAction('bad-action', false);
    }

    const coherence = agent.getCoherence();
    expect(coherence!.composite).toBeLessThan(0.7);
  });

  test('agent enters silence when coherence drops below threshold', async () => {
    const agent = new KinesisAgent({ name: 'silent-agent', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();

    for (let i = 0; i < 30; i++) {
      await agent.performAction('fail', false);
    }

    const coherence = agent.getCoherence();
    expect(coherence!.isSilent).toBe(true);
    expect(agent.isSilent()).toBe(true);
    expect(coherence!.deficit).toBeGreaterThan(0);
  });

  test('agent has a jurisdiction after joining lattice', async () => {
    const agent = new KinesisAgent({ name: 'test', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();
    expect(agent.profile!.jurisdiction).not.toBe('unknown');
  });

  test('agent card has correct structure', async () => {
    const agent = new KinesisAgent({ name: 'card-agent', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();
    const card = agent.getAgentCard();
    expect(card.did).toContain('did:t3n:mock:');
    expect(card.capabilities).toContain('behavioral-coherence');
    expect(card.capabilities).toContain('tee-attestation');
  });

  test('interactions affect synergy plane', async () => {
    const agent = new KinesisAgent({ name: 'synergy-agent', version: '0.1.0', mockData: true });
    await agent.spawn();
    await agent.joinLattice();

    for (let i = 0; i < 5; i++) {
      await agent.performAction(`a-${i}`, true);
    }
    for (let i = 0; i < 10; i++) {
      await agent.interactWith(`peer-${i}`, true);
    }

    const coherence = agent.getCoherence();
    expect(coherence!.planes.synergy).toBeGreaterThan(0.5);
  });
});
