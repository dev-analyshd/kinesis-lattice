#!/usr/bin/env node
/**
 * Deploy KINESIS TEE Contracts to Terminal 3 T3N
 *
 * Requirements:
 *   - Rust + wasm32-wasip2 target installed
 *   - T3N_API_KEY set in environment
 *
 * Usage:
 *   T3N_API_KEY=0x... node scripts/deploy/deploy-tee-contracts.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(__dirname, '../../contracts');
const wasmOut = path.join(
  contractPath,
  'target/wasm32-wasip2/release/kinesis_lattice_contract.wasm'
);

console.log('📦 KINESIS TEE Contract Deployment');
console.log('===================================');

// Check API key
const apiKey = process.env.T3N_API_KEY;
if (!apiKey) {
  console.error('❌ T3N_API_KEY not set');
  console.log('   Claim at: https://www.terminal3.io/claim-page');
  process.exit(1);
}

// Build WASM
console.log('\n1. Building TEE contract (Rust → WASM)...');
try {
  process.chdir(contractPath);
  execSync('cargo build --target wasm32-wasip2 --release', { stdio: 'inherit' });
  console.log('✅ WASM built');
} catch (err) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}

// Verify output
if (!fs.existsSync(wasmOut)) {
  console.error('❌ WASM output not found at:', wasmOut);
  process.exit(1);
}

const wasmSize = (fs.statSync(wasmOut).size / 1024).toFixed(2);
console.log(`   📄 WASM: ${wasmSize} KB`);

// Deploy
console.log('\n2. Deploying to Terminal 3 T3N testnet...');
console.log('   (Production: TenantClient.contracts.register(wasmBytes))');
console.log('');
console.log('   To deploy live, implement:');
console.log('   const { T3nClient } = require("@terminal3/t3n-sdk");');
console.log('   const client = new T3nClient({ ... });');
console.log('   await client.handshake();');
console.log('   const result = await client.tenant.contracts.register({');
console.log('     name: "kinesis-lattice-contract",');
console.log('     wasm: fs.readFileSync(wasmOut),');
console.log('   });');
console.log('   console.log("Contract ID:", result.contractId);');
console.log('');
console.log('✅ Contract ready for deployment');
console.log(`   WASM path: ${wasmOut}`);
