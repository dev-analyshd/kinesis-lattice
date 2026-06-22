# KINESIS — Hackathon Submission

**Challenge:** Terminal 3 Agent Dev Kit Bounty — Launch Edition
**Track:** Primary Build Track + Documentation Gaps Bonus
**Deadline:** June 22, 2026, 11:59 PM GMT+8
**Repo:** https://github.com/dev-analyshd/kinesis-lattice

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

---

## What's Running Live

- **API Server**: Express + WebSocket, mock lattice with 5 agents
- **Dashboard**: Next.js 14, real-time topology + coherence heatmap
- **TEE Contract**: Rust/WASM, all invariants encoded

---

## Bonus Track: Documentation Gaps

See [T3N_GAPS.md](T3N_GAPS.md) — 3 additional gaps discovered beyond Gideon145's report.
