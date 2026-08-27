import { describe, expect, it } from 'vitest';
import { devProxy } from './vite-proxy.js';

describe('Vite development proxy', () => {
  it('proxies the Socket.IO handshake path with websocket support', () => {
    expect(devProxy['/socket.io']).toMatchObject({ target: 'http://127.0.0.1:3000', ws: true });
  });
});
