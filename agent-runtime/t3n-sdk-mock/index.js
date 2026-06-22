'use strict';
/**
 * @terminal3/t3n-sdk — Local Mock Implementation
 *
 * Mirrors the exact API surface of the real Terminal 3 SDK.
 * In production, replace this with the real @terminal3/t3n-sdk package
 * from Terminal 3's registry once your API key is approved.
 *
 * Real SDK docs: https://docs.terminal3.io/sdk
 * API key claim: https://www.terminal3.io/claim-page
 */

const crypto = require('crypto');

// ── Environment config ───────────────────────────────────────────────────────
let currentEnvironment = 'testnet';

function setEnvironment(env) {
  if (!['testnet', 'production'].includes(env)) {
    throw new Error(`Unknown environment: ${env}. Use 'testnet' or 'production'.`);
  }
  currentEnvironment = env;
  console.log(`[t3n-sdk-mock] Environment set to: ${env}`);
}

// ── WASM component (cryptographic enclave simulation) ────────────────────────
async function loadWasmComponent() {
  // Simulates loading the WASM enclave binary
  return {
    _type: 'WasmComponent',
    _env: currentEnvironment,
    _loadedAt: Date.now(),
    _mock: true,
  };
}

// ── Ethereum address derivation ──────────────────────────────────────────────
function eth_get_address(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('eth_get_address: apiKey is required');
  }
  // Derive a deterministic Ethereum address from the API key
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  return '0x' + hash.slice(0, 40);
}

// ── EthSign handler factory ──────────────────────────────────────────────────
function metamask_sign(address, _provider, apiKey) {
  return async function EthSign(message) {
    const sig = crypto
      .createHmac('sha256', apiKey || 'mock-key')
      .update(message)
      .digest('hex');
    return `0x${sig}${sig.slice(0, 64)}`; // 65-byte signature simulation
  };
}

// ── Auth input factory ───────────────────────────────────────────────────────
function createEthAuthInput(address) {
  return {
    type: 'EthAuth',
    address,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
}

// ── T3nClient ────────────────────────────────────────────────────────────────
class T3nClient {
  constructor({ wasmComponent, handlers } = {}) {
    this._wasmComponent = wasmComponent;
    this._handlers = handlers || {};
    this._sessionId = null;
    this._did = null;
    this._authenticated = false;
    this._mock = true;
  }

  /**
   * Open an encrypted TEE session.
   * Real: performs TLS + TEE attestation handshake.
   */
  async handshake() {
    this._sessionId = 'tee-session-' + crypto.randomBytes(8).toString('hex');
    console.log(`[t3n-sdk-mock] TEE session established: ${this._sessionId}`);
    return { sessionId: this._sessionId, environment: currentEnvironment };
  }

  /**
   * Authenticate with an Ethereum signature, establishing did:t3n identity.
   * Real: submits EthAuth to T3N testnet; returns TEE-attested DID.
   *
   * If T3N_DID env var is set, returns the canonical DID for that account
   * (matches what the real SDK returns for the same API key).
   */
  async authenticate(authInput) {
    if (!this._sessionId) throw new Error('Call handshake() before authenticate()');

    const { address, nonce } = authInput;

    // Use canonical DID from env if available (matches real SDK output)
    if (process.env.T3N_DID) {
      this._did = process.env.T3N_DID;
    } else {
      const didHash = crypto
        .createHash('sha256')
        .update(address + nonce + currentEnvironment)
        .digest('hex')
        .slice(0, 40);
      this._did = `did:t3n:${currentEnvironment}:${didHash}`;
    }

    this._authenticated = true;
    console.log(`[t3n-sdk-mock] Authenticated: ${this._did}`);
    return { did: this._did, sessionId: this._sessionId };
  }

  /**
   * Fetch credit usage from T3N testnet.
   */
  async getUsage() {
    this._requireAuth();
    return {
      balance: {
        available: 9750,
        total: 10000,
        used: 250,
      },
      plan: 'hackathon',
      resetAt: Date.now() + 86400000,
    };
  }

  /**
   * Verify a credential JWT against the T3N revocation registry.
   */
  async verifyCredential(credentialJwt) {
    this._requireAuth();
    // Simulate 5% revocation rate for testing
    const isRevoked = credentialJwt.includes('revoked');
    return { valid: !isRevoked, revoked: isRevoked, checkedAt: Date.now() };
  }

  /**
   * Access TEE-managed sub-clients.
   */
  get tenant() {
    this._requireAuth();
    return {
      contracts: {
        /** Register a WASM contract with the TEE infrastructure. */
        register: async ({ name, wasm }) => ({
          contractId: `contract-${crypto.createHash('md5').update(name).digest('hex').slice(0, 12)}`,
          name,
          registeredAt: Date.now(),
        }),
        /** Execute a method inside the TEE contract. */
        execute: async ({ contractId, method, params }) => ({
          success: true,
          data: params,
          method,
          contractId,
          teeAttestation: crypto.randomBytes(32).toString('hex'),
          executedAt: Date.now(),
        }),
      },
    };
  }

  _requireAuth() {
    if (!this._authenticated) {
      throw new Error('T3nClient: must call authenticate() before accessing protected resources');
    }
  }
}

module.exports = {
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  T3nClient,
};
