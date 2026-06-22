import { Router, Request } from "express";
import { A2AProtocol } from "../federation/a2a-protocol.js";
import { orchestrator } from "../kinesis-runtime.js";

const router = Router();
const a2a = new A2AProtocol();

router.get("/agent.json", (req: Request, res) => {
  const host = req.headers.host || `localhost:${process.env.PORT || 8080}`;
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const card = a2a.buildAgentCard(
    "kinesis-core",
    "0.1.0",
    process.env.T3N_DID || "did:t3n:testnet:kinesis-core",
    `${proto}://${host}/api/v1`,
    orchestrator.getTopology().moat,
    "SG",
  );
  res.json(card);
});

export default router;
