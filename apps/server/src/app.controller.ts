import { Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { CreateSessionSchema, PatchSessionSchema, RegisterProjectSchema, ToolDecisionSchema, TOOL_METADATA, UpsertConfigSchema, UpsertProviderSchema } from '@openwork/contracts';
import { AppService } from './app.service.js';
import { MemoryStore } from './store.js';
import { WorkspaceService } from './workspace.js';
import { ToolExecutor } from './tool-executor.js';

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => { const result = schema.safeParse(value); if (!result.success) throw new HttpException({ error: { code: 'VALIDATION_ERROR', message: result.error.message } }, HttpStatus.BAD_REQUEST); return result.data; };

@Controller('api/v1')
export class AppController {
  constructor(@Inject(AppService) private readonly app: AppService, @Inject(MemoryStore) private readonly store: MemoryStore, @Inject(WorkspaceService) private readonly workspace: WorkspaceService, @Inject(ToolExecutor) private readonly toolExecutor: ToolExecutor) {}
  @Get('health') health() { return this.app.health(); }
  @Get('projects') projects() { return [...this.store.projects.values()]; }
  @Post('projects') createProject(@Body() body: unknown) { const input = parse(RegisterProjectSchema, body); const rootPath = this.workspace.registerRoot(input.rootPath); return this.store.createProject({ name: input.name, rootPath, ...(input.description ? { description: input.description } : {}) }); }
  @Get('projects/:id') project(@Param('id') id: string) { const p = this.store.projects.get(id); if (!p) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404); return p; }
  @Patch('projects/:id') patchProject(@Param('id') id: string, @Body() body: { name?: string; description?: string; status?: 'active'|'archived' }) { const p = this.store.projects.get(id); if (!p) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404); const updated = { ...p, ...body, updatedAt: new Date().toISOString() }; this.store.projects.set(id, updated); return updated; }
  @Delete('projects/:id') deleteProject(@Param('id') id: string) { if (!this.store.projects.delete(id)) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404); return { ok: true }; }
  @Get('projects/:projectId/sessions') sessions(@Param('projectId') projectId: string) { return [...this.store.sessions.values()].filter((s) => s.projectId === projectId); }
  @Post('projects/:projectId/sessions') createSession(@Param('projectId') projectId: string, @Body() body: unknown) { if (!this.store.projects.has(projectId)) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404); const input = parse(CreateSessionSchema, body); return this.store.createSession(projectId, { ...(input.title ? { title: input.title } : {}), ...(input.providerId ? { providerId: input.providerId } : {}), ...(input.modelLabel ? { modelLabel: input.modelLabel } : {}), ...(input.maxSteps ? { maxSteps: input.maxSteps } : {}), ...(input.tokenBudget ? { tokenBudget: input.tokenBudget } : {}) }); }
  @Get('sessions/:id') session(@Param('id') id: string) { const s = this.store.sessions.get(id); if (!s) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404); return s; }
  @Patch('sessions/:id') patchSession(@Param('id') id: string, @Body() body: unknown) { const input = parse(PatchSessionSchema, body); return this.store.setSession(id, { status: input.status, ...(input.title ? { title: input.title } : {}) }) ?? (() => { throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404); })(); }
  @Delete('sessions/:id') deleteSession(@Param('id') id: string) { if (!this.store.sessions.delete(id)) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404); for (const [mid, m] of this.store.messages) if (m.sessionId === id) this.store.messages.delete(mid); return { ok: true }; }
  @Get('sessions/:id/messages') messages(@Param('id') id: string) { return this.store.listMessages(id); }
  @Get('sessions/:id/messages/tree') messageTree(@Param('id') id: string) { return this.store.listMessages(id); }
  @Post('sessions/:id/messages/:messageId/rerun') rerun(@Param('id') id: string, @Param('messageId') messageId: string, @Body() body: { content: string }) { const old = this.store.messages.get(messageId); if (!old || old.sessionId !== id) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404); return this.store.addMessage(id, 'user', body.content, old.parentMessageId, old.id); }
  @Get('tools') tools() { return Object.entries(TOOL_METADATA).map(([name, meta]) => ({ name, ...meta })); }
  @Get('tool-calls/:id') toolCall(@Param('id') id: string) { const call = this.store.toolCalls.get(id); if (!call) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Tool call not found' } }, 404); return call; }
  @Post('tool-calls/:id/decision') async toolDecision(@Param('id') id: string, @Body() body: unknown) { const input = parse(ToolDecisionSchema, body); const call = this.store.toolCalls.get(id); if (!call) throw new HttpException({ error: { code: 'NOT_FOUND', message: 'Tool call not found' } }, 404); return input.action === 'approve' ? this.toolExecutor.approve(id, true, input.scope) : this.toolExecutor.approve(id, false, input.scope); }
  @Get('providers') providers() { return [...this.store.providers.values()]; }
  @Post('providers') provider(@Body() body: unknown) { const input = parse(UpsertProviderSchema, body); const id = globalThis.crypto.randomUUID(); const now = new Date().toISOString(); const pricing = { ...(input.pricing?.inputPerMtok !== undefined ? { inputPerMtok: input.pricing.inputPerMtok } : {}), ...(input.pricing?.outputPerMtok !== undefined ? { outputPerMtok: input.pricing.outputPerMtok } : {}) }; const p = { id, name: input.name, kind: input.kind, ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}), hasKey: Boolean(input.apiKey), ...(input.defaultModel ? { defaultModel: input.defaultModel } : {}), ...(input.fallbackProviderId ? { fallbackProviderId: input.fallbackProviderId } : {}), pricing, isEnabled: true, createdAt: now, updatedAt: now }; this.store.providers.set(id, p); return p; }
  @Get('configs/resolved') configs(@Query('scope') scope?: 'global'|'project'|'session', @Query('refId') refId?: string) { return this.store.resolvedConfig(scope, refId); }
  @Put('configs/:scope/:key') upsertConfig(@Param('scope') scope: 'global'|'project'|'session', @Param('key') key: string, @Body() body: unknown) { const input = parse(UpsertConfigSchema, body); return this.store.upsertConfig(scope, key, input.value, input.refId); }
  @Get('configs/history') configHistory(@Query('key') key?: string) { return this.store.configHistory.filter((h) => !key || h.key === key); }
  @Get('sessions/:id/stats') stats(@Param('id') id: string) { const s = this.store.sessions.get(id); return { promptTokens: s?.totalPromptTokens ?? 0, completionTokens: s?.totalCompletionTokens ?? 0, costUsd: s?.totalCostUsd ?? 0, steps: this.store.listMessages(id).length, toolCalls: [...this.store.toolCalls.values()].filter((t) => t.sessionId === id).length }; }
}
