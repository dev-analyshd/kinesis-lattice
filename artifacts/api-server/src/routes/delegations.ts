import { Router } from "express";
import { orchestrator } from "../kinesis-runtime.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { from, to } = req.body as { from?: string; to?: string };
    if (!from || !to) {
      res.status(400).json({ success: false, error: "from and to are required" });
      return;
    }
    const success = await orchestrator.evaluateDelegation(from, to);
    res.json({ success });
  } catch (err: any) {
    logger.error({ error: err.message }, "Delegation failed");
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/", async (req, res) => {
  try {
    const { from, to } = req.body as { from?: string; to?: string };
    if (!from || !to) {
      res.status(400).json({ success: false, error: "from and to are required" });
      return;
    }
    await orchestrator.revokeDelegation(from, to);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
