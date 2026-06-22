import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import latticeRouter from "./lattice.js";
import delegationsRouter from "./delegations.js";
import attackSimRouter from "./attack-sim.js";
import demoRouter from "./demo.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/v1/agents", agentsRouter);
router.use("/v1/lattice", latticeRouter);
router.use("/v1/delegations", delegationsRouter);
router.use("/v1/attack-sim", attackSimRouter);
router.use("/v1/demo", demoRouter);

export default router;
