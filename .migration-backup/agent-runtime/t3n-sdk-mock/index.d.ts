/** @terminal3/t3n-sdk — Type definitions matching real SDK surface */

export type Environment = 'testnet' | 'production';

export interface WasmComponent {
  _type: 'WasmComponent';
  _env: Environment;
  _loadedAt: number;
  _mock?: boolean;
}

export interface AuthInput {
  type: 'EthAuth';
  address: string;
  timestamp: number;
  nonce: string;
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

export type EthSignHandler = (message: string) => Promise<string>;

export interface T3nClientOptions {
  wasmComponent: WasmComponent;
  handlers: {
    EthSign: EthSignHandler;
  };
}

export declare class T3nClient {
  constructor(options: T3nClientOptions);
  handshake(): Promise<{ sessionId: string; environment: Environment }>;
  authenticate(authInput: AuthInput): Promise<AuthResult>;
  getUsage(): Promise<UsageResult>;
  verifyCredential(credentialJwt: string): Promise<{ valid: boolean; revoked: boolean; checkedAt: number }>;
  get tenant(): {
    contracts: {
      register(opts: { name: string; wasm: Buffer | Uint8Array }): Promise<{ contractId: string; name: string; registeredAt: number }>;
      execute(opts: { contractId: string; method: string; params: Record<string, unknown> }): Promise<{ success: boolean; data: unknown; teeAttestation: string }>;
    };
  };
}

export declare function setEnvironment(env: Environment): void;
export declare function loadWasmComponent(): Promise<WasmComponent>;
export declare function eth_get_address(apiKey: string): string;
export declare function metamask_sign(address: string, provider: unknown, apiKey: string): EthSignHandler;
export declare function createEthAuthInput(address: string): AuthInput;
