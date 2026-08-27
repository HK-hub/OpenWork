import { describe, expect, it } from 'vitest';
import { TOOL_NAMES } from '@openwork/contracts';
describe('web foundation', () => { it('shares tool names from contracts', () => expect(TOOL_NAMES.RunCommand).toBe('run_command')); });
