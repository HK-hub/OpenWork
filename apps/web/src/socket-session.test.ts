import { describe, expect, it, vi } from 'vitest';
import { joinSessionOrConnect } from './socket-session.js';

describe('joinSessionOrConnect', () => {
  it('joins a new session immediately when the shared socket is already connected', () => {
    const socket = {
      connected: true,
      connect: vi.fn(),
      emit: vi.fn(),
    };
    const onConnected = vi.fn();

    joinSessionOrConnect(socket, 'session-2', onConnected);

    expect(onConnected).toHaveBeenCalledOnce();
    expect(socket.emit).toHaveBeenCalledWith('session.join', { sessionId: 'session-2' });
    expect(socket.connect).not.toHaveBeenCalled();
  });
});
