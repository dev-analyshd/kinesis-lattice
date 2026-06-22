import {
  loadWasmComponent,
  setEnvironment,
  T3nClient,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
} from "../lib/t3n-sdk.js";
import { logger } from "../lib/logger.js";

export interface T3NIdentity {
  did: string;
  client: T3nClient;
  address: string;
}

export interface UsageInfo {
  available: number;
  total: number;
  used: number;
}

export async function initializeT3NIdentity(apiKey: string): Promise<T3NIdentity> {
  logger.info("Initializing T3N Identity — establishing TEE session...");

  const env = (process.env.T3N_ENVIRONMENT as "testnet" | "production") || "testnet";
  setEnvironment(env);

  const wasm = await loadWasmComponent();
  const address = eth_get_address(apiKey);

  const client = new T3nClient({
    wasmComponent: wasm,
    handlers: {
      EthSign: metamask_sign(address, undefined, apiKey),
    },
  });

  await client.handshake();

  const authResult = await client.authenticate(createEthAuthInput(address));
  const did = authResult?.did ?? String(authResult);

  logger.info({ did, addressPrefix: address.substring(0, 10) + "..." }, "T3N Identity established");
  return { did, client, address };
}

export async function getUsage(client: T3nClient): Promise<UsageInfo> {
  const usage = await client.getUsage();
  return {
    available: usage?.balance?.available ?? 0,
    total: usage?.balance?.total ?? 0,
    used: usage?.balance?.used ?? 0,
  };
}

export async function verifyPeerCredential(
  client: T3nClient,
  credentialJwt: string
): Promise<boolean> {
  try {
    logger.info("Verifying peer credential via T3N revocation registry");
    const result = await client.verifyCredential(credentialJwt);
    return result.valid;
  } catch (err: any) {
    logger.error({ error: err.message }, "Credential verification failed");
    return false;
  }
}
