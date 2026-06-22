# Terminal 3 SDK — Additional Documentation Gaps Discovered

> Submitted for the **Documentation Gaps bonus track** — Terminal 3 Agent Dev Kit Bounty Challenge
>
> Reporter: KINESIS Team
> Date: June 22, 2026
> SDK Version: `@terminal3/t3n-sdk` v3.4.4

---

## Summary

During integration of `@terminal3/t3n-sdk` into KINESIS (a multi-agent coherence lattice), we discovered **3 additional gaps** beyond those reported by Gideon145. These affect production multi-agent deployments specifically.

---

## Gap 11: Missing `Did` Interface Export in Type Definitions

**Severity:** 🔴 Critical
**Location:** `@terminal3/t3n-sdk` v3.4.4 — TypeScript definitions

**Issue:** The `Did` interface returned by `authenticate()` is not exported from the main package index. Developers must either use `any` or import from undocumented deep paths:

```typescript
// This fails — Did is not in the public API surface:
import { Did } from '@terminal3/t3n-sdk';

// This "works" but is undocumented and fragile:
import { Did } from '@terminal3/t3n-sdk/dist/types/auth';

// Workaround we used in KINESIS:
const authResult: any = await client.authenticate(createEthAuthInput(address));
const did = authResult?.did ?? String(authResult);
```

**Impact:**
- Forces developers to use `any` casts, losing type safety for the most critical operation
- Type mismatch between `did:t3n` strings and the `Did` object — return type is inconsistent depending on SDK version
- Breaks TypeScript strict mode compilation

**Proposed Fix:**
```typescript
// In @terminal3/t3n-sdk/src/index.ts, add:
export type { Did, AuthResult, HandshakeResult } from './types/auth';
```

---

## Gap 12: `TenantClient.contracts` is Undocumented for Agent Use Cases

**Severity:** 🟠 High
**Location:** `@terminal3/t3n-sdk` — TenantClient API

**Issue:** The `TenantClient.contracts.execute()` method (critical for running WASM contracts in the TEE) has no documentation for agent-to-contract interaction patterns. The docs only show tenant admin usage.

**Questions unanswered by current docs:**
1. How does an agent (not an admin) call `contracts.execute()`?
2. What authentication context is required — `T3nClient` or `TenantClient`?
3. What is the maximum payload size for contract inputs?
4. Are contract results synchronous or async/callback?
5. How do you handle contract execution errors vs. TEE attestation failures?

**Code we had to write with no documentation guidance:**

```typescript
// We had to reverse-engineer this pattern:
async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
  // Production: ??? — no docs for agent-facing contract calls
  // Had to fall back to mock mode for demo
  return { success: true, data: params };
}
```

**Impact:** We could not implement true live TEE contract calls for the KINESIS lattice. All contract interactions in the demo use simulated responses because the agent→contract API is undocumented.

**Proposed Fix:** Add a dedicated "Agent Contract Interaction" section to the SDK docs with:
- `TenantClient` vs `T3nClient` context for contract calls
- Complete example of `contracts.execute()` from an agent context
- Error handling patterns for TEE attestation failures

---

## Gap 13: `setEnvironment()` Persistence and Thread Safety in Multi-Agent Systems

**Severity:** 🟡 Medium
**Location:** `@terminal3/t3n-sdk` — `setEnvironment()` function

**Issue:** `setEnvironment()` appears to set a module-level singleton. In multi-agent systems where multiple agents are spawned in the same Node.js process, the behavior is undefined if:

1. Agent A calls `setEnvironment('testnet')`
2. Agent B calls `setEnvironment('production')` (hypothetically)
3. Agent A then calls `client.handshake()` — which environment is used?

**Observed behavior in KINESIS:** We spawn 5 agents per process. All call `setEnvironment('testnet')` but there is no documentation confirming this is safe in concurrent context.

**Code that might be broken (undocumented):**

```typescript
// Agent 1 spawning:
setEnvironment('testnet');
const wasm1 = await loadWasmComponent();
const client1 = new T3nClient({ wasmComponent: wasm1, ... });

// Agent 2 spawning concurrently:
setEnvironment('testnet'); // Race condition? Shared singleton?
const wasm2 = await loadWasmComponent();
const client2 = new T3nClient({ wasmComponent: wasm2, ... });
```

**Questions:**
1. Is `setEnvironment()` global state (module singleton) or per-client state?
2. Is `loadWasmComponent()` safe to call multiple times concurrently?
3. Should each agent create its own WASM instance, or share one?
4. Is there a `T3nClientConfig.environment` option that avoids the singleton issue?

**Impact:** Developers building multi-agent systems (the primary use case for TEE-based delegation) have no guidance on safe concurrent identity initialization.

**Proposed Fix:**
```typescript
// Option A: Document that setEnvironment is global and safe for same-env multi-agent
setEnvironment('testnet'); // safe to call once per process

// Option B: Add per-client environment config
const client = new T3nClient({
  wasmComponent: wasm,
  environment: 'testnet', // ← per-client, no global state
  handlers: { EthSign: metamask_sign(address, undefined, apiKey) },
});
```

---

## Comparison with Gideon145 Gaps

| Gap | Reporter | Severity | Status |
|-----|----------|----------|--------|
| 1-10 | Gideon145 | Various | Reported |
| 11: Did interface missing | KINESIS | Critical | New |
| 12: TenantClient.contracts undocumented | KINESIS | High | New |
| 13: setEnvironment() thread safety | KINESIS | Medium | New |

---

## Discovery Context

All three gaps were discovered during implementation of `agent-runtime/src/auth/t3n-identity.ts` and `agent-runtime/src/tee-bridge/contract-client.ts`. We spent approximately 4 hours working around Gap 11 and 12 alone — time that would have been better spent building features.
