import {
  loadWasmComponent,
  setEnvironment,
  T3nClient,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
} from '@terminal3/t3n-sdk';

/**
 * T3N Bridge for SDK users — minimal wrapper for identity initialization.
 * Full TEE session management is in agent-runtime/src/auth/t3n-identity.ts
 */
export async function initializeT3NIdentity(apiKey: string): Promise<{
  did: string;
  client: T3nClient;
}> {
  setEnvironment('testnet');

  const wasm = await loadWasmComponent();
  const address = eth_get_address(apiKey);

  const client = new T3nClient({
    wasmComponent: wasm,
    handlers: {
      EthSign: metamask_sign(address, undefined, apiKey),
    },
  });

  await client.handshake();

  const authResult: any = await client.authenticate(createEthAuthInput(address));
  const did = authResult?.did ?? String(authResult);

  return { did, client };
}
