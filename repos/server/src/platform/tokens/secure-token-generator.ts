import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TokenGenerator } from './token-generator.js';

@Injectable()
export class SecureTokenGenerator implements TokenGenerator {
  generate(byteLength = 32): string {
    return randomBytes(byteLength).toString('base64url');
  }
}
