import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() { return { status: 'ok' as const, version: '0.1.0' }; }
}
