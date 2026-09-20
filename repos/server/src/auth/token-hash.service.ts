import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/environment.js';

@Injectable()
export class TokenHashService {
  private readonly pepper: string;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.pepper = config.get('REFRESH_TOKEN_PEPPER', { infer: true });
  }

  hash(token: string): string {
    return createHmac('sha256', this.pepper).update(token).digest('base64url');
  }
}
