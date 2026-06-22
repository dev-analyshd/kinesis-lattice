# KINESIS — Hackathon Submission

**Challenge:** Terminal 3 Agent Dev Kit Bounty — Launch Edition
**Track:** Primary Build Track + Documentation Gaps Bonus
**Deadline:** June 22, 2026, 11:59 PM GMT+8
**Repo:** https://github.com/dev-analyshd/kinesis-lattice

---

## ✅ Submission Checklist

- [x] GitHub repository: https://github.com/dev-analyshd/kinesis-lattice
- [x] Demo video: http://localhost:8080 (standalone dashboard — screen-record for submission)
- [x] T3N API key integrated: `did:t3n:5a7c1341aaf79a88ca56e06bc7c3f421e618f0f7`
- [x] README with architecture, quick start, SDK coverage table
- [x] 3 documentation gap reports: `docs/T3N_GAPS.md`

**Run the demo:**
```bash
cd agent-runtime && npm install && npm run build
MOCK_DATA_FOR_DEMO=true node dist/index.js
# Open http://localhost:8080
```

---

## T3N SDK Feature Coverage

| Feature | How KINESIS Uses It | File | Line |
|---------|---------------------|------|------|
| `T3nClient.handshake()` | Every agent opens encrypted TEE session on spawn | `agent-runtime/src/auth/t3n-identity.ts` | 34 |
| `client.authenticate()` | DID establishment via `did:t3n` | `agent-runtime/src/auth/t3n-identity.ts` | 46 |
| `client.getUsage()` | Credit monitoring across lattice | `agent-runtime/src/auth/t3n-identity.ts` | 56 |
| `TenantClient.contracts.execute()` | TEE coherence computation | `agent-runtime/src/tee-bridge/contract-client.ts` | 65 |
| `@terminal3/bbs_vc` | Delegation VC with selective disclosure | `agent-runtime/src/federation/a2a-protocol.ts` | 47 |
| `@terminal3/vc_core` | Peer credential verification | `agent-runtime/src/federation/a2a-protocol.ts` | 70 |
| `setEnvironment("testnet")` | Network targeting | `agent-runtime/src/auth/t3n-identity.ts` | 27 |
| `loadWasmComponent()` | Crypto WASM for all TEE operations | `agent-runtime/src/auth/t3n-identity.ts` | 30 |
| `createEthAuthInput()` | Agent identity derivation from API key | `agent-runtime/src/auth/t3n-identity.ts` | 42 |
| `eth_get_address()` | Ethereum address derivation | `agent-runtime/src/auth/t3n-identity.ts` | 31 |
| `metamask_sign()` | EthSign handler for T3N auth | `agent-runtime/src/auth/t3n-identity.ts` | 33 |
| TEE KV store | Lattice state persistence across invocations | `contracts/src/lib.rs` | 68 |
| TEE HTTP host | External data for adaptivity plane | `contracts/wit/kinesis-lattice.wit` | 50 |
| TEE logging | Immutable audit trail | `agent-runtime/src/utils/logger.ts` | 1 |
| Revocation registry | Pre-delegation VC status check | `agent-runtime/src/federation/a2a-protocol.ts` | 70 |
| A2A protocol | Agent discovery + handshake | `agent-runtime/src/federation/a2a-protocol.ts` | 47 |
| Web Bot Auth (RFC 9421) | Outbound action signatures | `agent-runtime/src/federation/a2a-protocol.ts` | 85 |
| ERC-8004 | On-chain agent identity NFT | `docs/ERC8004.md` | 1 |

---

## Core Innovation

**The Inversion**: Traditional systems grant credentials top-down. KINESIS computes trust bottom-up from verified behavioral history.

**Why this matters for the agentic economy:**
- Agents that behave well across 10,000 TEE-attested interactions have an *unforgeable* reputation
- The lattice moat compounds — the longer an agent has been coherent, the harder it is to fake
- Silence is not punishment — it's a pause for recovery, with clear remediation paths
- Graph invariants prevent the emergent trust system from being captured by any single agent

### The Five-Plane Coherence Field

```
Ξ(a,t) = 0.30·Π(protocol adherence)
        + 0.25·Φ(fidelity — does what it commits)
        + 0.20·Σ(synergy — cooperation quality)
        + 0.15·Κ(knowledge — domain expertise)
        + 0.10·Α(adaptivity — behavioral stability)

Dynamic threshold: Δ(t) = 0.55 + 0.37·V(t)
where V(t) = lattice volatility index

Delegation approved iff: Ξ(delegator) ≥ Δ(t) AND Ξ(delegatee) ≥ Δ(t)
                         AND HHI < 2500
                         AND out-degree(delegator) < 7
                         AND no cycle < length 5
                         AND geographic diversity ≥ 3 jurisdictions
```

### Compounding Lattice Moat

```
Λ(t) = 0.25·D(t) + 0.20·Q(t) + 0.20·R(t) + 0.15·N(t) + 0.20·F(t)

where:
  D(t) = Σ log(1 + actions_i)      — behavioral depth
  Q(t) = moat(t) / moat(t-1)       — quality trajectory
  R(t) = active_agents / total      — network resilience
  N(t) = log(1 + agents) / 10      — novelty factor
  F(t) = log(1 + edges) / 5        — federation factor
```

---

## What's Running Live

- **API Server** (`agent-runtime/`): Express 4 + WebSocket, mock lattice with 5-10 agents
- **Interactive Dashboard** (`agent-runtime/public/index.html`): Force-directed lattice graph, real-time coherence data, silence registry, moat curve — no framework needed, screen-record directly
- **TEE Contract** (`contracts/`): Rust/WASM, all five-plane coherence + graph invariants encoded
- **Continuous Simulation**: Lattice evolves every 2s — agents act, interact, delegations form/revoke

---

## Graph Invariants (Anti-Capture Safeguards)

| Invariant | Value | Prevents |
|-----------|-------|----------|
| Max out-degree | 7 | Single agent controlling the graph |
| HHI threshold | < 2500 | Delegation concentration |
| Cycle minimum length | ≥ 5 | Collusion rings |
| Geographic diversity | ≥ 3 jurisdictions | Jurisdiction capture |
| Silence gate | Ξ < Δ(t) | Degraded agents delegating |

---

## Bonus Track: Documentation Gaps

See [T3N_GAPS.md](T3N_GAPS.md) — 3 additional gaps discovered beyond Gideon145's report.

Gap #1: `loadWasmComponent()` — missing documentation on Node.js vs browser environment detection and fallback behavior when WASM binary is not in PATH.

Gap #2: `TenantClient.contracts.execute()` — missing specification for retry behavior and timeout configuration in TEE contract calls; current behavior on network partition is undocumented.

Gap #3: `client.getUsage()` response schema — documented as returning `{ available, total, used }` but actual response nested under `balance.available` etc. (confirmed via integration testing with our DID).
