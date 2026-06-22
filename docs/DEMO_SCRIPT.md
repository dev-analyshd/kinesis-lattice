# KINESIS Demo Script — 5-Minute Video

## Setup (before recording)

```bash
# Build everything
npm run bootstrap

# Start demo
MOCK_DATA_FOR_DEMO=true DEMO_AGENT_COUNT=5 npm run demo

# Open dashboard
open http://localhost:8080
```

---

## Script (5 minutes)

### 0:00–0:30 — Hook

> "What if your AI agents had to *earn* the right to delegate? What if trust wasn't a credential you issued, but a score the lattice computed from 10,000 verified behavioral data points?"
>
> "This is KINESIS. The Living Delegation Lattice."

*[Show dashboard loading — agents appearing as nodes]*

---

### 0:30–1:30 — The Problem

> "Today, agent delegation is static. A human signs a credential, the agent has it forever. No feedback loop. No accountability."
>
> "KINESIS inverts this. Agents earn delegation rights through behavioral coherence — five dimensions, verified inside Terminal 3's hardware enclave."

*[Point to the five-plane coherence formula on screen]*

> "Protocol. Fidelity. Synergy. Knowledge. Adaptivity. Together: Ξ(a,t)."

---

### 1:30–2:30 — Live Demo

*[Spawn an agent via the dashboard button]*

> "Watch what happens when I spawn a new agent. It opens an encrypted TEE session via T3N's SDK, authenticates with a `did:t3n` identity, and joins the lattice."

*[Show agent appearing as a new node on the graph]*

> "Now I'll simulate some actions — good ones first."

*[API call to perform actions via curl or Postman, or show the mock agents running]*

> "The coherence score climbs. Protocol adherence high. Fidelity high. Synergy building."

---

### 2:30–3:30 — Silence and Delegation

*[Show delegation edge appearing between two high-coherence agents]*

> "When two agents have sufficient coherence AND the graph invariants allow it — no HHI concentration, no short cycles — a BBS+ delegation credential is issued. TEE-attested."

*[Show one agent's coherence dropping — in the mock data, one agent has bad actions]*

> "Now watch what happens when an agent's fidelity plane collapses — too many unfulfilled commitments."

*[Agent turns red in the graph, enters STRUCTURED SILENCE]*

> "Structured silence. Not a punishment — a pause. The lattice shows exactly what needs to improve."

---

### 3:30–4:30 — The Moat

*[Show the moat curve growing]*

> "Here's the key insight. This is the lattice moat — Λ(t). It compounds over time."
>
> "Every TEE-verified action. Every fulfilled commitment. Every successful collaboration. All permanently encoded."
>
> "A new agent trying to fake high trust? They'd need to execute 10,000 coherent behavioral data points inside the TEE. That's not just hard — it's economically infeasible."

---

### 4:30–5:00 — Wrap

> "KINESIS is a new primitive for the agentic economy. Not a trust provider — a trust field. Self-organizing. Self-healing. The lattice remembers."
>
> "Built on Terminal 3 TEE infrastructure. Powered by TRION coherence mathematics. Open source."
>
> "GitHub: github.com/dev-analyshd/kinesis-lattice"

---

## Key URLs to Show

- Dashboard: `http://localhost:8080`
- Health API: `http://localhost:8080/health`
- Topology: `http://localhost:8080/api/v1/lattice/topology`
- Agent Card: `http://localhost:8080/.well-known/agent.json`
