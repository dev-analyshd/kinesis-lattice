#!/usr/bin/env node
/**
 * KINESIS Demo Launcher
 * Starts the API server with mock agents for demonstration.
 *
 * Usage:
 *   node scripts/demo/run-demo.js
 *   node scripts/demo/run-demo.js --agents 10
 *   node scripts/demo/run-demo.js --live  (requires T3N_API_KEY)
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);
const liveModeIdx = args.indexOf('--live');
const agentsIdx = args.indexOf('--agents');
const agentCount = agentsIdx !== -1 ? parseInt(args[agentsIdx + 1]) || 5 : 5;
const liveMode = liveModeIdx !== -1;

console.log('');
console.log('⬡  KINESIS — The Living Delegation Lattice');
console.log('==========================================');
console.log(`Mode: ${liveMode ? '🔴 LIVE (Terminal 3 TEE)' : '🟡 MOCK (Demo)'}`);
console.log(`Agents: ${agentCount}`);
console.log('');

const env = {
  ...process.env,
  MOCK_DATA_FOR_DEMO: liveMode ? 'false' : 'true',
  DEMO_AGENT_COUNT: String(agentCount),
  API_PORT: '8080',
  LOG_LEVEL: 'info',
};

const runtimePath = path.join(__dirname, '../../agent-runtime/dist/index.js');

if (!require('fs').existsSync(runtimePath)) {
  console.error('❌ Agent runtime not built. Run: cd agent-runtime && npm run build');
  process.exit(1);
}

const apiServer = spawn('node', [runtimePath], { env, stdio: 'inherit' });

let shutdown = false;

apiServer.on('error', (err) => {
  console.error('❌ Failed to start API server:', err.message);
  process.exit(1);
});

apiServer.on('exit', (code) => {
  if (!shutdown) {
    console.log(`\nAPI server exited with code ${code}`);
  }
});

// Print dashboard URL after server starts
setTimeout(() => {
  console.log('');
  console.log('🌐 Dashboard: http://localhost:8080');
  console.log('📊 API:       http://localhost:8080/health');
  console.log('🔌 WebSocket: ws://localhost:8080');
  console.log('');
  console.log('Press Ctrl+C to stop KINESIS');
}, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
  shutdown = true;
  console.log('\n\nShutting down KINESIS...');
  apiServer.kill('SIGTERM');
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  shutdown = true;
  apiServer.kill('SIGTERM');
  process.exit(0);
});
