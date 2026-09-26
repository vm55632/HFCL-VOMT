import * as net from 'node:net';
import type { AppConfig } from '@vop/config';
import type { ScanProvider, ScanResult } from './contracts';

// The EICAR test string — used so the mock scanner can exercise the "infected" path.
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR';

/**
 * ClamAV scanner over the clamd INSTREAM protocol (raw TCP, no dependency). Uploads are scanned
 * before they leave quarantine (Phase 3). Chunks the stream and parses the daemon's verdict.
 */
export class ClamAvScanProvider implements ScanProvider {
  private readonly host: string;
  private readonly port: number;

  constructor(config: AppConfig) {
    this.host = config.scan.host;
    this.port = config.scan.port;
  }

  scan(data: Buffer): Promise<ScanResult> {
    return new Promise<ScanResult>((resolve, reject) => {
      const socket = net.createConnection(this.port, this.host);
      const chunks: Buffer[] = [];
      socket.setTimeout(15000);

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        const size = 64 * 1024;
        for (let i = 0; i < data.length; i += size) {
          const slice = data.subarray(i, Math.min(i + size, data.length));
          const header = Buffer.alloc(4);
          header.writeUInt32BE(slice.length, 0);
          socket.write(header);
          socket.write(slice);
        }
        socket.write(Buffer.from([0, 0, 0, 0])); // zero-length terminator
      });

      socket.on('data', (d) => chunks.push(d));
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('ClamAV scan timed out.'));
      });
      socket.on('error', reject);
      socket.on('end', () => {
        const reply = Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim();
        if (reply.includes('FOUND')) {
          const signature = reply.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '');
          resolve({ clean: false, signature });
        } else if (reply.includes('OK')) {
          resolve({ clean: true });
        } else {
          reject(new Error(`Unexpected ClamAV reply: ${reply}`));
        }
      });
    });
  }
}

/**
 * Mock scanner for dev/test: everything is clean except a payload containing the EICAR test
 * string, so the infected-file path can be tested deterministically without a live daemon.
 */
export class MockScanProvider implements ScanProvider {
  scan(data: Buffer): Promise<ScanResult> {
    const infected = data.toString('latin1').includes(EICAR);
    return Promise.resolve(
      infected ? { clean: false, signature: 'Eicar-Test-Signature' } : { clean: true },
    );
  }
}

/** Cloud-native scanners (e.g. bucket-triggered) — stubbed until the cloud is chosen. */
export class NotImplementedScan implements ScanProvider {
  constructor(private readonly name: string) {}
  scan(): Promise<ScanResult> {
    return Promise.reject(new Error(`${this.name} ScanProvider is not implemented yet (stub).`));
  }
}
