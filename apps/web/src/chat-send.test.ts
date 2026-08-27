import { describe, expect, it, vi } from 'vitest';
import { sendChat } from './chat-send.js';

describe('sendChat', () => {
  it('returns a structured server rejection to the caller', async () => {
    const rejection = { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid message' } };
    const socket = {
      emit: vi.fn((_event, _payload, callback: (ack: typeof rejection) => void) => callback(rejection)),
    };

    await expect(sendChat(socket, { content: '' })).resolves.toEqual(rejection);
  });
});
