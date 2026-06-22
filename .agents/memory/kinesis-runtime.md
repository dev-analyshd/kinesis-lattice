---
name: KINESIS Agent Runtime Port
description: Full port of agent-runtime backend into artifacts/api-server; WebSocket + lattice routes live
---

## What was built
The complete agent-runtime was ported from `.migration-backup/agent-runtime/src/` into `artifacts/api-server/src/`.

**New files created:**
- `src/lib/t3n-sdk.ts` — TypeScript T3N SDK mock (mirrors real SDK API surface)
- `src/lattice/types.ts`, `coherence-engine.ts`, `agent.ts`, `orchestrator.ts` — core lattice logic
- `src/auth/t3n-identity.ts` — T3N TEE identity initialization
- `src/federation/a2a-protocol.ts` — A2A protocol + agent card builder
- `src/adversarial/attack-simulator.ts` — 6-vector adversarial simulation
- `src/kinesis-runtime.ts` — shared orchestrator singleton + simulation loop
- `src/routes/agents.ts`, `lattice.ts`, `delegations.ts`, `attack-sim.ts`, `demo.ts`, `well-known.ts` — all REST routes
- Updated `src/index.ts` — HTTP server + WebSocket server at `/ws`
- Updated `src/app.ts` — added `/.well-known` route

**Artifact.toml:** api-server paths = ["/api", "/ws", "/.well-known"]

**Dashboard:** Connected to real WebSocket at `wss://{host}/ws` (replaces mock simulation)

**Why:**
The api-server is ESM ("type": "module"), used esbuild to bundle. T3N SDK had to be a local TypeScript file instead of file: dependency (no CJS compat issues).

**How to apply:**
- T3N_API_KEY and T3N_DID env vars must be set (they are)
- `pnpm --filter @workspace/api-server run build` before restarting
- The `uuid` and `ws` packages were added to api-server
