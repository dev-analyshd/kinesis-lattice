import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { orchestrator, initializeKinesisRuntime } from "./kinesis-runtime.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  logger.info("WebSocket client connected to KINESIS lattice");
  orchestrator.subscribe(ws as any);

  ws.on("message", (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());
      logger.debug({ type: msg.type }, "WS message received");
    } catch {
      // ignore malformed
    }
  });

  ws.on("close", () => {
    logger.info("WebSocket client disconnected");
  });
});

server.listen(port, async () => {
  logger.info({ port }, "KINESIS API Server listening");

  try {
    await initializeKinesisRuntime();
    logger.info(
      {
        health: `/api/healthz`,
        topology: `/api/v1/lattice/topology`,
        agentCard: `/.well-known/agent.json`,
        websocket: `/ws`,
        narrative: `/api/v1/demo/narrative`,
        t3nDid: process.env.T3N_DID ? "configured ✓" : "not set",
      },
      "KINESIS Runtime ready",
    );
  } catch (err: any) {
    logger.error({ error: err.message, stack: err.stack }, "Failed to initialize KINESIS runtime");
  }
});
