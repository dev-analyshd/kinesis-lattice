# KINESIS Architecture — Deep Technical Dive

## System Overview

KINESIS implements a three-layer architecture:

1. **TEE Layer** — Rust/WASM contract running inside Terminal 3's hardware enclave
2. **Agent Runtime Layer** — TypeScript runtime managing agent lifecycle and API
3. **Presentation Layer** — Next.js 14 real-time dashboard with WebSocket topology

---

## Layer 1: TEE Contract (`contracts/src/lib.rs`)

The Rust WASM contract is the authoritative source of truth for all coherence computations. All inputs enter the TEE enclave encrypted; all outputs are TEE-attested.

### WIT Interface

The `kinesis-lattice.wit` interface defines the contract boundary:

```wit
interface lattice-engine {
  init-lattice: func(admin: did) -> result<lattice-state, string>;
  register-agent: func(agent: did, claims: list<string>) -> result<coherence-snapshot, string>;
  compute-coherence: func(agent: did, ...) -> result<coherence-snapshot, string>;
  evaluate-delegation: func(delegator: did, delegatee: did) -> result<delegation-result, string>;
  enter-silence: func(agent: did, ...) -> result<silence-record, string>;
  verify-graph-invariants: func() -> result<bool, string>;
  compute-lattice-moat: func() -> result<f64, string>;
}
```

### TEE Capabilities Used

| Capability | Usage |
|------------|-------|
| KV Store | Persist `LatticeData` (agents, delegations, silences) across invocations |
| HTTP Host | Fetch external market/reputation data for adaptivity plane |
| Logging | Immutable audit trail of all coherence events |

---

## Layer 2: Agent Runtime (`agent-runtime/src/`)

### Sequence: Agent Spawn

```
1. new KinesisAgent({ name, apiKey })
   │
2. agent.spawn()
   ├─ setEnvironment('testnet')
   ├─ loadWasmComponent()
   ├─ eth_get_address(apiKey)
   ├─ new T3nClient({ wasmComponent, handlers: { EthSign } })
   ├─ client.handshake()          ← encrypted TEE session
   ├─ client.authenticate(...)    ← did:t3n:xxx established
   └─ client.getUsage()           ← credit monitoring
   │
3. agent.joinLattice()
   └─ TEE: register_agent(did, jurisdiction)
   │
4. orchestrator.registerAgent(agent)
   └─ WebSocket broadcast → dashboard
```

### Sequence: Coherence-Gated Delegation

```
1. orchestrator.evaluateDelegation(fromId, toId)
   │
2. Check structural preconditions:
   ├─ Both agents registered
   ├─ Neither in structured silence
   └─ Both coherence records fresh
   │
3. Coherence gate:
   ├─ Ξ(delegator) ≥ Δ(t)
   └─ Ξ(delegatee) ≥ Δ(t)
   │
4. Graph invariant checks:
   ├─ Out-degree ≤ 7
   ├─ HHI < 2500
   ├─ Geographic diversity ≥ 3
   └─ No cycle < 5 hops
   │
5. Issue BBS+ delegation VC (via @terminal3/bbs_vc)
   │
6. Update lattice topology
   └─ WebSocket broadcast → dashboard
```

### Silence Propagation

```
Agent A coherence drops below Δ(t)
   │
A enters STRUCTURED SILENCE
   │
A's delegators notified (synergy plane affected)
   │
Delegator B's Σ (synergy) score drops
   │
If B.Ξ < B.Δ(t): B also enters silence
   │
Cascade continues until stable state
   │
Dashboard shows cascade in red
```

---

## Layer 3: Dashboard (`dashboard/src/`)

### Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| `LatticeGraph` | HTML5 Canvas + requestAnimationFrame | Force-directed agent topology |
| `CoherenceHeatmap` | Recharts BarChart (horizontal, stacked) | Five planes per agent |
| `MetricsStrip` | Framer Motion + Tailwind | Live KPI counters |
| `MoatCurve` | Recharts AreaChart | Moat growth time series |
| `SilenceFeed` | AnimatePresence + Framer Motion | Silence events + remediation |

### WebSocket Protocol

```json
{
  "type": "topology",
  "data": {
    "agents": [
      {
        "id": "uuid",
        "name": "kinesis-agent-1",
        "did": "did:t3n:mock:uuid",
        "coherence": {
          "composite": 0.847,
          "threshold": 0.725,
          "isSilent": false,
          "planes": {
            "protocol": 0.92,
            "fidelity": 0.88,
            "synergy": 0.75,
            "knowledge": 0.65,
            "adaptivity": 0.70
          }
        },
        "isSilent": false,
        "jurisdiction": "US"
      }
    ],
    "edges": [{ "from": "uuid1", "to": "uuid2", "weight": 0.847 }],
    "moat": 12.34,
    "volatility": 0.42,
    "activeSilences": 0
  }
}
```

---

## Graph Invariants

KINESIS enforces four structural invariants to prevent collusion and concentration:

| Invariant | Threshold | Economic Rationale |
|-----------|-----------|-------------------|
| Max out-degree | ≤ 7 per agent | Prevents hub-and-spoke control |
| HHI concentration | < 2500 | Prevents delegation monopoly |
| Cycle length | ≥ 5 hops | Prevents 3-4 agent collusion rings |
| Jurisdictional diversity | ≥ 3 | Prevents single-geography capture |

---

## Lattice Moat Λ(t)

```
Λ(t) = 0.25·D(t) + 0.20·Q(t) + 0.20·R(t) + 0.15·N(t) + 0.20·F(t)

D(t) = Σ ln(1 + actions_i)     — behavioral depth
Q(t) = Λ(t) / Λ(t-1)          — growth quality
R(t) = active/total             — resilience ratio
N(t) = ln(1 + agents) / 10     — network novelty
F(t) = ln(1 + delegations) / 5 — federation depth
```

**Key property**: Λ(t) is monotonically increasing with authentic behavior. An attacker who wants to fake high moat needs to execute thousands of TEE-verified behavioral data points — computationally and economically infeasible.

---

## ERC-8004 On-Chain Identity

Every KINESIS agent anchors its `did:t3n` DID to an ERC-8004 Agent Identity NFT on the T3N base chain. This provides:

- **On-chain provenance**: Agent identity traceable to wallet address
- **Cross-chain portability**: DID resolvable from any EVM chain
- **Delegation proof**: BBS+ VCs reference the on-chain identity

See [ERC8004.md](ERC8004.md) for full specification.
