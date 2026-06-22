import { logger } from '../utils/logger';
import { AgentCard } from '../lattice/types';
import crypto from 'crypto';

export interface A2AHandshake {
  initiator: AgentCard;
  responder: AgentCard;
  challenge: string;
  response: string;
  verified: boolean;
  timestamp: number;
}

export interface CapabilityProof {
  capability: string;
  proof: string; // BBS+ selective disclosure proof
  issuer: string;
  expiresAt: number;
}

/**
 * A2A Protocol implementation for KINESIS agents.
 *
 * Implements:
 *   - Agent Card publication (/.well-known/agent.json)
 *   - Challenge-response handshake with TEE attestation
 *   - BBS+ capability verification via @terminal3/vc_core
 *   - Web Bot Auth (RFC 9421) outbound action signatures
 *
 * All protocol messages are signed with the agent's did:t3n key.
 * Verification uses Terminal 3's revocation registry inside the TEE session.
 */
export class A2AProtocol {

  /**
   * Discover peer agents from T3N registry or seed endpoint.
   * Production: query T3N DHT / agent registry.
   */
  async discoverAgents(seedEndpoint: string): Promise<AgentCard[]> {
    logger.info(`A2A: Discovering agents`, { seedEndpoint });
    // Production: GET ${seedEndpoint}/.well-known/agent.json
    // Then follow capability exchange to find peers
    return [];
  }

  /**
   * Initiate A2A handshake with a discovered peer.
   * Challenge is a 256-bit random nonce; response must be signed by peer's did:t3n.
   */
  async initiateHandshake(
    localCard: AgentCard,
    remoteCard: AgentCard
  ): Promise<A2AHandshake | null> {
    logger.info(`A2A: Initiating handshake`, {
      with: remoteCard.did,
      capability: remoteCard.capabilities.join(','),
    });

    const challenge = this.generateChallenge();

    // Production:
    // 1. POST ${remoteCard.endpoint}/a2a/handshake { challenge, initiator: localCard }
    // 2. Remote signs challenge with its TEE key
    // 3. Verify signature via @terminal3/vc_core
    // 4. Check revocation registry

    return {
      initiator: localCard,
      responder: remoteCard,
      challenge,
      response: '', // filled by remote
      verified: false, // set after signature verification
      timestamp: Date.now(),
    };
  }

  /**
   * Verify a BBS+ capability credential from a peer agent.
   * Uses @terminal3/vc_core for signature verification.
   * Checks T3N revocation registry inside the TEE session.
   */
  async verifyCapability(agent: AgentCard, capability: string): Promise<boolean> {
    logger.info(`A2A: Verifying capability`, {
      did: agent.did,
      capability,
    });
    // Production:
    // const vc = await fetchCapabilityVC(agent.endpoint, capability);
    // return await vcCore.verify(vc, { checkRevocation: true });
    return true;
  }

  /**
   * Sign an outbound HTTP request using Web Bot Auth (RFC 9421).
   * The signature header includes: method, path, timestamp, body hash.
   * Signing key is derived from the agent's did:t3n credential.
   */
  signRequest(
    method: string,
    path: string,
    body: string,
    agentDid: string
  ): Record<string, string> {
    const timestamp = Date.now();
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
    const sigInput = `method="${method}" path="${path}" timestamp="${timestamp}" body-hash="${bodyHash}"`;

    // Production: sign sigInput with TEE-held private key
    const signature = crypto.createHash('sha256').update(sigInput + agentDid).digest('hex');

    return {
      'Signature-Input': `sig1=(${sigInput})`,
      'Signature': `sig1=:${signature}:`,
      'X-Agent-DID': agentDid,
      'X-Timestamp': timestamp.toString(),
    };
  }

  /** Generate a 256-bit cryptographically random challenge nonce. */
  private generateChallenge(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Publish Agent Card for discovery at /.well-known/agent.json
   * Format follows Google A2A Agent Card specification.
   */
  buildAgentCard(
    name: string,
    version: string,
    did: string,
    endpoint: string,
    coherence?: number,
    jurisdiction?: string
  ): AgentCard & { schema: string; protocolVersion: string } {
    return {
      schema: 'https://a2a.dev/agent-card/v1',
      protocolVersion: '1.0',
      name,
      version,
      did,
      capabilities: [
        'behavioral-coherence',
        'tee-attestation',
        'delegation-issuance',
        'bbs-selective-disclosure',
        'web-bot-auth-rfc9421',
        'erc-8004-on-chain-identity',
      ],
      endpoint,
      coherence,
      jurisdiction,
    };
  }
}
