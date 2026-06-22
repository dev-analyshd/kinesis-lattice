import crypto from "crypto";

let currentEnvironment: "testnet" | "production" = "testnet";

export function setEnvironment(env: "testnet" | "production"): void {
  if (!["testnet", "production"].includes(env)) {
    throw new Error(`Unknown environment: ${env}`);
  }
  currentEnvironment = env;
}

export interface WasmComponent {
  _type: string;
  _env: string;
  _loadedAt: number;
  _mock: boolean;
}

export async function loadWasmComponent(): Promise<WasmComponent> {
  return {
    _type: "WasmComponent",
    _env: currentEnvironment,
    _loadedAt: Date.now(),
    _mock: true,
  };
}

export function eth_get_address(apiKey: string): string {
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("eth_get_address: apiKey is required");
  }
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  return "0x" + hash.slice(0, 40);
}

export type EthSignHandler = (message: string) => Promise<string>;

export function metamask_sign(
  address: string,
  _provider: unknown,
  apiKey: string
): EthSignHandler {
  return async function EthSign(message: string): Promise<string> {
    const sig = crypto
      .createHmac("sha256", apiKey || "mock-key")
      .update(message)
      .digest("hex");
    return `0x${sig}${sig.slice(0, 64)}`;
  };
}

export interface EthAuthInput {
  type: "EthAuth";
  address: string;
  timestamp: number;
  nonce: string;
}

export function createEthAuthInput(address: string): EthAuthInput {
  return {
    type: "EthAuth",
    address,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };
}

export interface T3nClientOptions {
  wasmComponent: WasmComponent;
  handlers: {
    EthSign: EthSignHandler;
  };
}

export interface HandshakeResult {
  sessionId: string;
  environment: string;
}

export interface AuthResult {
  did: string;
  sessionId: string;
}

export interface UsageResult {
  balance: { available: number; total: number; used: number };
  plan: string;
  resetAt: number;
}

export interface CredentialVerifyResult {
  valid: boolean;
  revoked: boolean;
  checkedAt: number;
}

export class T3nClient {
  private _wasmComponent: WasmComponent;
  private _handlers: { EthSign: EthSignHandler };
  private _sessionId: string | null = null;
  private _did: string | null = null;
  private _authenticated: boolean = false;
  public readonly _mock = true;

  constructor(opts: T3nClientOptions) {
    this._wasmComponent = opts.wasmComponent;
    this._handlers = opts.handlers;
  }

  async handshake(): Promise<HandshakeResult> {
    this._sessionId =
      "tee-session-" + crypto.randomBytes(8).toString("hex");
    return { sessionId: this._sessionId, environment: currentEnvironment };
  }

  async authenticate(authInput: EthAuthInput): Promise<AuthResult> {
    if (!this._sessionId) throw new Error("Call handshake() before authenticate()");
    const { address, nonce } = authInput;
    if (process.env.T3N_DID) {
      this._did = process.env.T3N_DID;
    } else {
      const didHash = crypto
        .createHash("sha256")
        .update(address + nonce + currentEnvironment)
        .digest("hex")
        .slice(0, 40);
      this._did = `did:t3n:${currentEnvironment}:${didHash}`;
    }
    this._authenticated = true;
    return { did: this._did, sessionId: this._sessionId! };
  }

  async getUsage(): Promise<UsageResult> {
    this._requireAuth();
    return {
      balance: { available: 9750, total: 10000, used: 250 },
      plan: "hackathon",
      resetAt: Date.now() + 86400000,
    };
  }

  async verifyCredential(credentialJwt: string): Promise<CredentialVerifyResult> {
    this._requireAuth();
    const isRevoked = credentialJwt.includes("revoked");
    return { valid: !isRevoked, revoked: isRevoked, checkedAt: Date.now() };
  }

  get tenant() {
    this._requireAuth();
    return {
      contracts: {
        register: async ({ name }: { name: string; wasm?: unknown }) => ({
          contractId: `contract-${crypto.createHash("md5").update(name).digest("hex").slice(0, 12)}`,
          name,
          registeredAt: Date.now(),
        }),
        execute: async ({ contractId, method, params }: { contractId: string; method: string; params: unknown }) => ({
          success: true,
          data: params,
          method,
          contractId,
          teeAttestation: crypto.randomBytes(32).toString("hex"),
          executedAt: Date.now(),
        }),
      },
    };
  }

  private _requireAuth(): void {
    if (!this._authenticated) {
      throw new Error("T3nClient: must call authenticate() before accessing protected resources");
    }
  }
}
