import WebSocket from 'ws';
import { LatticeTopology } from './types';

/**
 * LatticeClient — connects to a running KINESIS lattice node
 * and subscribes to real-time topology updates.
 *
 * ```typescript
 * const client = new LatticeClient();
 * await client.connect('ws://localhost:8080');
 * client.onTopology(topology => {
 *   console.log(`Active agents: ${topology.agents.length}`);
 *   console.log(`Lattice moat: ${topology.moat}`);
 * });
 * ```
 */
export class LatticeClient {
  private ws: WebSocket | null = null;
  private topology: LatticeTopology | null = null;
  private callbacks: Array<(topology: LatticeTopology) => void> = [];

  connect(url: string = 'ws://localhost:8080'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('Connected to KINESIS lattice');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'topology') {
            this.topology = message.data as LatticeTopology;
            this.callbacks.forEach(cb => cb(this.topology!));
          }
        } catch (err) {
          console.error('Failed to parse lattice message:', err);
        }
      });

      this.ws.on('error', reject);
      this.ws.on('close', () => {
        console.log('Disconnected from KINESIS lattice');
      });
    });
  }

  onTopology(callback: (topology: LatticeTopology) => void): void {
    this.callbacks.push(callback);
    if (this.topology) callback(this.topology);
  }

  disconnect(): void {
    this.ws?.close();
  }

  getCurrentTopology(): LatticeTopology | null {
    return this.topology;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
