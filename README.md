# ⬡ KINESIS — The Living Delegation Lattice

> **Trust is not given. It is earned. The lattice remembers.**

[![CI](https://github.com/dev-analyshd/kinesis-lattice/actions/workflows/ci.yml/badge.svg)](https://github.com/dev-analyshd/kinesis-lattice/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Terminal 3](https://img.shields.io/badge/Terminal%203-TEE%20Powered-00f5c4)](https://www.terminal3.io)

KINESIS is a self-organizing agent federation built on Terminal 3's TEE-verified infrastructure, powered by TRION-derived behavioral coherence mathematics, and designed for the agentic economy.

**Hackathon:** Terminal 3 Agent Dev Kit Bounty Challenge (June 22, 2026)

---

## 🎬 Demo Video

> **[▶ Watch the KINESIS Demo](https://youtu.be/kinesis-lattice-demo)**

The demo video shows:
1. **Lattice startup** — 5 TEE-verified agents spawn with `did:t3n` identities
2. **Coherence computation** — live five-plane behavioral scoring (Π·Φ·Σ·Κ·Α)
3. **Delegation graph** — force-directed visualization of trust relationships forming
4. **Structured Silence** — an agent drops below threshold Δ(t) and enters silence
5. **Lattice recovery** — silent agent's remediation path and delegation revocation
6. **Moat growth** — Λ(t) compounding curve demonstrating unforgeable trust history

**Run the demo yourself in 2 commands:**
```bash
cd agent-runtime && npm install && npm run build
MOCK_DATA_FOR_DEMO=true DEMO_AGENT_COUNT=5 node dist/index.js
# Dashboard at http://localhost:8080
```

---

## What We Built

KINESIS inverts the traditional agent delegation paradigm: instead of humans issuing static credentials to agents, **agents earn trust through demonstrated behavioral coherence** across five TEE-verified dimensions. The lattice itself becomes the authority — self-healing, self-governing, and exponentially harder to manipulate as it grows.

### The Core Insight

> Every interaction, every fulfilled commitment, every successful collaboration is permanently recorded inside Terminal 3's hardware enclave. The lattice moat Λ(t) compounds over time — a new entrant cannot fake 10,000 verified behavioral data points.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  KINESIS DELEGATION LATTICE                     │
│                                                                 │
│  Agent A ──→ [TEE: coherence Ξ=0.87] ──→ BBS+ VC ──→ Agent B  │
│     │                                                     │     │
│     └──→ [Graph invariants: HHI<2500, out-degree≤7] ←───┘     │
│                         │                                       │
│              [STRUCTURED SILENCE if Ξ < Δ(t)]                  │
│                         │                                       │
│         [Lattice moat Λ(t) compounds with every action]        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Five Cognitive Planes (TRION-Derived)

| Plane | Symbol | Weight | Measures | Hard-Zero Condition |
|-------|--------|--------|----------|---------------------|
| **Protocol** | Π | 0.30 | A2A adherence, signature validity, credential chain integrity | Invalid signature or revoked VC |
| **Fidelity** | Φ | 0.25 | Action-outcome alignment, commitment fulfillment | >3σ mismatch between commit and fulfill |
| **Synergy** | Σ | 0.20 | Cross-agent cooperation quality, interaction ratio | Negative interaction ratio |
| **Knowledge** | Κ | 0.15 | Domain expertise depth, learning milestones | Stagnation > 30 days |
| **Adaptivity** | Α | 0.10 | Environmental response, behavioral z-score | Behavioral z-score > 3σ |

## Core Equation

```
Ξ(a,t) = 0.30·Π(a,t) + 0.25·Φ(a,t) + 0.20·Σ(a,t) + 0.15·Κ(a,t) + 0.10·Α(a,t)

Δ(t)   = Δ_min + (Δ_max − Δ_min) · V(t)      — dynamic threshold adapts to volatility
Λ(t)   = f(D, Q, R, N, F)                     — compounding lattice moat (unforgeable)

Delegation approved iff: Ξ(delegator) ≥ Δ(t) AND Ξ(delegatee) ≥ Δ(t)
                         AND graph-invariants(lattice + new_edge) = true
```

---

## Terminal 3 SDK Integration (100% Coverage)

| T3N Feature | How KINESIS Uses It | File |
|-------------|---------------------|------|
| `T3nClient.handshake()` | Every agent opens encrypted TEE session on spawn | `src/auth/t3n-identity.ts` |
| `client.authenticate()` | DID establishment with `did:t3n` | `src/auth/t3n-identity.ts` |
| `client.getUsage()` | Credit monitoring across lattice | `src/auth/t3n-identity.ts` |
| `TenantClient.contracts.execute()` | TEE coherence computation | `src/tee-bridge/contract-client.ts` |
| `@terminal3/bbs_vc` | Delegation VC with selective disclosure | `src/federation/a2a-protocol.ts` |
| `@terminal3/vc_core` | Peer credential verification | `src/federation/a2a-protocol.ts` |
| `setEnvironment("testnet")` | Network targeting | `src/auth/t3n-identity.ts` |
| `loadWasmComponent()` | Crypto WASM for all TEE operations | `src/auth/t3n-identity.ts` |
| `createEthAuthInput()` | Agent identity derivation | `src/auth/t3n-identity.ts` |
| TEE KV store | Lattice state persistence | `contracts/src/lib.rs` |
| TEE HTTP host | External data for adaptivity plane | `contracts/wit/kinesis-lattice.wit` |
| TEE logging | Immutable audit trail | `src/utils/logger.ts` |
| Revocation registry | Pre-delegation VC status check | `src/federation/a2a-protocol.ts` |
| A2A protocol | Agent discovery and handshake | `src/federation/a2a-protocol.ts` |
| Web Bot Auth (RFC 9421) | Outbound action signatures | `src/federation/a2a-protocol.ts` |
| ERC-8004 | On-chain agent identity NFT | `docs/ERC8004.md` |

---

## Project Structure

```
kinesis-lattice/
├── contracts/               # Rust TEE Contract (WASM32-WASIP2)
│   ├── src/lib.rs           # Full 5-plane coherence + graph invariants
│   └── wit/kinesis-lattice.wit  # WIT interface definitions
├── agent-runtime/           # TypeScript Agent Runtime (Express + WS)
│   └── src/
│       ├── api/server.ts    # REST API + WebSocket server
│       ├── auth/t3n-identity.ts    # T3N SDK integration
│       ├── federation/a2a-protocol.ts  # A2A + Web Bot Auth
│       ├── lattice/         # CoherenceEngine + Orchestrator + Agent
│       └── tee-bridge/      # TEE contract client
│   └── public/index.html    # ← Standalone demo UI (no framework needed)
├── sdk/                     # @kinesis/lattice-sdk
│   └── src/                 # KinesisAgent, LatticeClient, CoherenceEngine
├── scripts/demo/            # Demo runner scripts
├── tests/integration/       # E2E lifecycle tests
└── docs/                    # Architecture + submission docs
```

---

## Quick Start

### Prerequisites
- Node.js v20+
- Rust v1.79+ (for TEE contract compilation)
- Terminal 3 API key: [https://www.terminal3.io/claim-page](https://www.terminal3.io/claim-page)

### Demo Mode (no API key needed)

```bash
# Clone
git clone https://github.com/dev-analyshd/kinesis-lattice.git
cd kinesis-lattice

# Install runtime dependencies
cd agent-runtime && npm install

# Build
npm run build

# Run with 5 mock agents
MOCK_DATA_FOR_DEMO=true DEMO_AGENT_COUNT=5 node dist/index.js

# Or use the root convenience script:
cd .. && npm run demo
```

**Then open:** `http://localhost:8080` — interactive lattice dashboard

Endpoints:
- `GET  /health`                          — system health + agent count
- `GET  /.well-known/agent.json`          — A2A Agent Card
- `GET  /api/v1/lattice/topology`         — full lattice state
- `GET  /api/v1/agents`                   — all agent profiles
- `POST /api/v1/agents/spawn`             — spawn a new agent
- `POST /api/v1/delegations`              — create delegation
- `GET  /api/v1/lattice/silences`         — silence registry
- `WS   ws://localhost:8080`              — real-time topology stream

### Live Mode (Terminal 3 TEE)

```bash
# Set your T3N credentials
export T3N_API_KEY=0x...your-api-key...
export T3N_DID=did:t3n:your-did
export MOCK_DATA_FOR_DEMO=false

node agent-runtime/dist/index.js
```

### SDK Usage

```typescript
import { KinesisAgent, LatticeClient, CoherenceEngine } from '@kinesis/lattice-sdk';

// Create and spawn an agent
const agent = new KinesisAgent({
  name: 'my-trading-agent',
  apiKey: process.env.T3N_API_KEY,
});
await agent.spawn(); // establishes did:t3n identity

// Build coherence through actions
await agent.performAction('place-order', true);
await agent.performAction('fulfill-trade', true);
await agent.interactWith('peer-agent-did', true);

// Compute coherence
const coherence = agent.computeCoherence();
console.log(`Ξ(a,t) = ${coherence.composite}`);
console.log(`Silent: ${coherence.isSilent}`);

// Connect to live lattice
const client = new LatticeClient();
await client.connect('ws://localhost:8080');
client.onTopology(topology => {
  console.log(`Agents: ${topology.agents.length}, Moat: ${topology.moat}`);
});
```

---

## Testing

```bash
# All tests
npm run test:all

# Contract unit tests (Rust)
cd contracts && cargo test

# Runtime unit tests (TypeScript)
cd agent-runtime && npm test

# Integration E2E tests (requires running server)
MOCK_DATA_FOR_DEMO=true node agent-runtime/dist/index.js &
cd tests/integration && npm test
```

---

## Bonus Track: Documentation Gaps

See [docs/T3N_GAPS.md](docs/T3N_GAPS.md) for 3 additional T3N SDK documentation gaps discovered during integration, extending the work done by Gideon145.

---

## License

MIT — see [LICENSE](LICENSE)

---

> *The lattice remembers. Every action, every betrayal, every collaboration — permanently encoded in the TEE. You cannot fake 10,000 coherent interactions.*
