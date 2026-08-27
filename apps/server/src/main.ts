import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ChatGateway } from './chat.gateway.js';
import { MemoryStore } from './store.js';
import { WorkspaceService } from './workspace.js';
import { ToolExecutor } from './tool-executor.js';

@Module({ controllers: [AppController], providers: [AppService, MemoryStore, WorkspaceService, ToolExecutor, ChatGateway] })
export class AppModule {}

export async function bootstrap() { const app = await NestFactory.create(AppModule); app.enableCors(); await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1'); return app; }
if (process.env.NODE_ENV !== 'test') void bootstrap();
