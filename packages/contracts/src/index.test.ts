import { describe, expect, it } from 'vitest';
import { RegisterProjectSchema, SendMessageSchema, TOOL_METADATA, TOOL_NAMES } from './index.js';

describe('contracts', () => {
  it('rejects an empty project path', () => expect(() => RegisterProjectSchema.parse({ name: 'x', rootPath: '' })).toThrow());
  it('validates a websocket message payload', () => expect(SendMessageSchema.parse({ requestId: 'r1', sessionId: '550e8400-e29b-41d4-a716-446655440000', content: 'hi' }).content).toBe('hi'));
  it('exposes all ten built-in tools with permission metadata', () => expect(Object.keys(TOOL_METADATA)).toHaveLength(Object.keys(TOOL_NAMES).length));
});
