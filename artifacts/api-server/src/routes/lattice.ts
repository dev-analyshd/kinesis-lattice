import { Router } from "express";
import { orchestrator } from "../kinesis-runtime.js";

const router = Router();

router.get("/topology", (_req, res) => {
  res.json(orchestrator.getTopology());
});

router.get("/moat", (_req, res) => {
  const topology = orchestrator.getTopology();
  res.json({ moat: topology.moat, volatility: topology.volatility });
});

router.get("/silences", (_req, res) => {
  res.json(orchestrator.getSilenceLog());
});

export default router;
