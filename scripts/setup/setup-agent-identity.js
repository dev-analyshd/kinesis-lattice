#!/usr/bin/env node
/**
 * Setup KINESIS Agent Identity via Terminal 3 T3N SDK
 *
 * Usage:
 *   T3N_API_KEY=0x... node scripts/setup/setup-agent-identity.js
 */

const apiKey = process.env.T3N_API_KEY;

if (!apiKey) {
  console.error('❌ T3N_API_KEY not set');
  console.log('   Claim at: https://www.terminal3.io/claim-page');
  process.exit(1);
}

async function main() {
  console.log('🔐 Setting up KINESIS agent identity...');

  try {
    // Dynamic import to allow running without building runtime first
    const { initializeT3NIdentity } = require('../../agent-runtime/dist/auth/t3n-identity');
    const identity = await initializeT3NIdentity(apiKey);

    console.log('\n✅ Identity established');
    console.log(`   DID: ${identity.did}`);
    console.log(`   Address: ${identity.address}`);

    const usage = await identity.client.getUsage();
    console.log(`   Credits: ${usage?.balance?.available ?? 'unknown'} available`);

    console.log('\n📝 Add to .env:');
    console.log(`   T3N_DID=${identity.did}`);
    console.log('');
    console.log('🚀 Run KINESIS with live T3N:');
    console.log('   MOCK_DATA_FOR_DEMO=false node agent-runtime/dist/index.js');

  } catch (err) {
    console.error('❌ Identity setup failed:', err.message);
    if (err.message.includes('Cannot find module')) {
      console.log('\nBuild the runtime first:');
      console.log('  cd agent-runtime && npm install && npm run build');
    }
    process.exit(1);
  }
}

main();
