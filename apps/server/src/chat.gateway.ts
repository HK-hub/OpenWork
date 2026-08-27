import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { SendMessageSchema, TOOL_NAMES, WS_EVENT_TYPES, type ToolName } from '@openwork/contracts';
import { MemoryStore } from './store.js';
import { ToolExecutor } from './tool-executor.js';

@WebSocketGateway({ namespace: '/ws', cors: { origin: true } })
export class ChatGateway {
  @WebSocketServer() server!: Server;
  constructor(@Inject(MemoryStore) private readonly store: MemoryStore, @Inject(ToolExecutor) private readonly tools: ToolExecutor) {}
  private emit(type: string, sessionId: string, payload: unknown) { this.server.to(`room:${sessionId}`).emit(type, { v: 1, eventId: crypto.randomUUID(), ts: new Date().toISOString(), type, payload }); }
  @SubscribeMessage('session.join') join(@MessageBody() body: { sessionId: string }, @ConnectedSocket() socket: Socket) { socket.join(`room:${body.sessionId}`); return { ok: true, data: { sessionId: body.sessionId } }; }
  @SubscribeMessage('session.leave') leave(@MessageBody() body: { sessionId: string }, @ConnectedSocket() socket: Socket) { socket.leave(`room:${body.sessionId}`); return { ok: true }; }
  @SubscribeMessage('chat.stop') stop(@MessageBody() body: { sessionId: string }) { this.store.setSession(body.sessionId, { status: 'paused' }); this.emit(WS_EVENT_TYPES.SessionPatch, body.sessionId, this.store.sessions.get(body.sessionId)); return { ok: true }; }
  @SubscribeMessage('chat.send') async send(@MessageBody() raw: unknown) {
    const parsed = SendMessageSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }; const body = parsed.data; const session = this.store.sessions.get(body.sessionId);
    if (!session) return { ok: false, error: { code: 'NOT_FOUND', message: 'Session not found' } };
    const toolMatch = body.content.match(/^\/tool\s+([a-z_]+)\s+([\s\S]+)$/);
    const requestedTool = toolMatch?.[1]; const rawInput = toolMatch?.[2];
    let toolInput: unknown;
    if (requestedTool && rawInput && this.isToolName(requestedTool)) {
      try { toolInput = JSON.parse(rawInput); } catch { return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Tool input must be valid JSON' } }; }
    }
    const user = this.store.addMessage(body.sessionId, 'user', body.content); this.emit(WS_EVENT_TYPES.MessageAppended, body.sessionId, user);
    this.emit(WS_EVENT_TYPES.LoopStep, body.sessionId, { stepNo: 1, phase: 'perceive', status: 'running' });
    if (requestedTool && rawInput && this.isToolName(requestedTool)) {
      const result = await this.tools.execute(body.sessionId, requestedTool, toolInput);
      const call = this.store.toolCalls.get(result.id);
      this.emit(WS_EVENT_TYPES.ToolStatus, body.sessionId, { toolCallId: result.id, toolName: requestedTool, status: result.status, output: result.output, errorText: result.errorText });
      if (result.status === 'pending_approval') this.emit(WS_EVENT_TYPES.PermissionRequest, body.sessionId, { toolCallId: result.id, toolName: requestedTool, level: call?.permissionLevel, inputSummary: toolInput });
      if (result.status !== 'pending_approval') { const observation = this.store.addMessage(body.sessionId, 'tool', result.output === undefined ? result.errorText ?? '' : JSON.stringify(result.output)); this.emit(WS_EVENT_TYPES.MessageAppended, body.sessionId, observation); }
      this.emit(WS_EVENT_TYPES.LoopStep, body.sessionId, { stepNo: 1, phase: 'observe', status: result.status });
      return { ok: true, data: { messageId: user.id, toolCallId: result.id, toolStatus: result.status } };
    }
    const assistant = this.store.addMessage(body.sessionId, 'assistant', '', undefined, undefined, 'streaming'); this.emit(WS_EVENT_TYPES.MessageAppended, body.sessionId, assistant); this.emit(WS_EVENT_TYPES.LoopStep, body.sessionId, { stepNo: 1, phase: 'act', status: 'running' });
    for (const delta of [`I received: `, body.content]) { await new Promise((resolve) => setTimeout(resolve, 10)); assistant.content += delta; this.store.messages.set(assistant.id, assistant); this.emit(WS_EVENT_TYPES.StreamDelta, body.sessionId, { messageId: assistant.id, delta }); }
    assistant.status = 'complete'; this.store.messages.set(assistant.id, assistant); this.emit(WS_EVENT_TYPES.MessageAppended, body.sessionId, assistant); this.emit(WS_EVENT_TYPES.LoopStep, body.sessionId, { stepNo: 1, phase: 'observe', status: 'succeeded' }); return { ok: true, data: { messageId: user.id } };
  }
  private isToolName(value: string): value is ToolName { return Object.values(TOOL_NAMES).includes(value as ToolName); }
}
