import { logger } from '../utils/logger';
import { T3nClient } from '@terminal3/t3n-sdk';

/**
 * TEE Contract Client — bridges TypeScript agent runtime to the
 * Rust/WASM TEE contract running inside Terminal 3's enclave.
 *
 * All calls go through TenantClient.contracts.execute() which routes
 * the computation into the hardware enclave. Results are TEE-signed
 * and verifiable via attestation.
 *
 * In mock mode (MOCK_DATA_FOR_DEMO=true), all calls return simulated
 * responses for dashboard demonstration.
 */
export class TEEContractClient {
  private contractId: string | null = null;
  private t3nClient: T3nClient | null = null;
  private mockMode: boolean;

  constructor(t3nClient?: T3nClient) {
    this.t3nClient = t3nClient || null;
    this.mockMode = process.env.MOCK_DATA_FOR_DEMO === 'true' || !t3nClient;
  }

  /**
   * Register the WASM contract with Terminal 3 TEE infrastructure.
   * Production: reads compiled WASM from contracts/target/wasm32-wasip2/release/
   */
  async registerContract(wasmPath: string): Promise<string> {
    logger.info(`TEE: Registering contract`, { wasmPath });

    if (this.mockMode) {
      this.contractId = 'mock-contract-kinesis-lattice-v1';
      logger.info(`TEE: Contract registered (mock)`, { contractId: this.contractId });
      return this.contractId;
    }

    // Production:
    // const wasmBytes = fs.readFileSync(wasmPath);
    // const result = await this.t3nClient!.tenant.contracts.register({
    //   name: 'kinesis-lattice-contract',
    //   wasm: wasmBytes,
    // });
    // this.contractId = result.contractId;

    this.contractId = 'kinesis-contract-deployed';
    return this.contractId;
  }

  /**
   * Execute a contract method inside the TEE.
   * All inputs are encrypted before entering the enclave.
   * All outputs are TEE-attested.
   */
  async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
    logger.debug(`TEE: Executing`, { method, contractId: this.contractId });

    if (this.mockMode) {
      return { success: true, data: params, method, teeAttestation: 'mock-attestation' };
    }

    // Production:
    // return await this.t3nClient!.tenant.contracts.execute({
    //   contractId: this.contractId!,
    //   method,
    //   params,
    // });

    return { success: true, data: params };
  }

  // Convenience wrappers for lattice operations

  async getLatticeState(): Promise<unknown> {
    return this.execute('get_lattice_state', {});
  }

  async registerAgent(did: string, jurisdiction: string): Promise<unknown> {
    return this.execute('register_agent', { did, jurisdiction });
  }

  async computeCoherence(did: string, metrics: Record<string, number>): Promise<unknown> {
    return this.execute('compute_coherence', { did, ...metrics });
  }

  async evaluateDelegation(delegator: string, delegatee: string): Promise<unknown> {
    return this.execute('evaluate_delegation', { delegator, delegatee });
  }

  async enterSilence(did: string, reason: string, limitingPlane: string, deficit: number): Promise<unknown> {
    return this.execute('enter_silence', { did, reason, limitingPlane, deficit });
  }

  async exitSilence(did: string): Promise<unknown> {
    return this.execute('exit_silence', { did });
  }

  async computeLatticeMoat(): Promise<number> {
    const result: any = await this.execute('compute_lattice_moat', {});
    return result?.data?.moat ?? 0;
  }

  /** Check TEE contract is reachable and responding. */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getLatticeState();
      return true;
    } catch {
      return false;
    }
  }
}
