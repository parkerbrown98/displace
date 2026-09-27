import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import { TOKEN_GENERATOR, type TokenGenerator } from '../platform/tokens/token-generator.js';
import { TokenHashService } from '../auth/token-hash.service.js';
import {
  type ApiTokenDto,
  type ApiTokenScope,
  type CreateApiTokenDto,
  type IssuedApiTokenDto,
} from './developer-api.dto.js';
import { DeveloperApiRepository, type ApiTokenRecord } from './developer-api.repository.js';

const TOKEN_PREFIX = 'dsp_';
const MAX_TOKEN_LIFETIME_MS = 366 * 24 * 60 * 60 * 1_000;

export interface ApiTokenAuthentication {
  id: string;
  scopes: ReadonlySet<ApiTokenScope>;
  userId: string;
}

@Injectable()
export class DeveloperApiService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TOKEN_GENERATOR) private readonly tokens: TokenGenerator,
    private readonly hashes: TokenHashService,
    private readonly repository: DeveloperApiRepository,
  ) {}

  async create(userId: string, input: CreateApiTokenDto): Promise<IssuedApiTokenDto> {
    return this.issue(userId, input.name, [...new Set(input.scopes)], new Date(input.expiresAt));
  }

  async list(userId: string): Promise<ApiTokenDto[]> {
    return (await this.repository.list(userId)).map((record) => this.toDto(record));
  }

  async revoke(userId: string, tokenId: string): Promise<void> {
    if (!(await this.repository.revoke(userId, tokenId, this.clock.now()))) {
      throw new NotFoundException('The API token was not found.');
    }
  }

  async rotate(userId: string, tokenId: string, expiresAt?: string): Promise<IssuedApiTokenDto> {
    const now = this.clock.now();
    const expiration = expiresAt ? new Date(expiresAt) : undefined;
    if (expiration) this.validateExpiration(expiration, now);
    const token = `${TOKEN_PREFIX}${this.tokens.generate(32)}`;
    const record = await this.repository.rotate(
      userId,
      tokenId,
      {
        expiresAt: expiration,
        prefix: token.slice(0, 12),
        tokenHash: this.hashes.hash(token),
      },
      now,
    );
    if (!record) throw new NotFoundException('The API token was not found.');
    return this.toIssuedDto(record, token);
  }

  async authenticate(token: string): Promise<ApiTokenAuthentication> {
    if (!token.startsWith(TOKEN_PREFIX)) throw new UnauthorizedException('The API token is invalid or expired.');
    const record = await this.repository.findActiveByHash(this.hashes.hash(token), this.clock.now());
    if (!record) throw new UnauthorizedException('The API token is invalid or expired.');
    await this.repository.touch(record.id, this.clock.now());
    return { id: record.id, scopes: new Set(record.scopes), userId: record.userId };
  }

  private async issue(
    userId: string,
    name: string,
    scopes: ApiTokenScope[],
    expiresAt: Date,
  ): Promise<IssuedApiTokenDto> {
    const now = this.clock.now();
    this.validateExpiration(expiresAt, now);
    const token = `${TOKEN_PREFIX}${this.tokens.generate(32)}`;
    const record = await this.repository.create({
      expiresAt,
      name: name.trim(),
      prefix: token.slice(0, 12),
      scopes,
      tokenHash: this.hashes.hash(token),
      userId,
    });
    return this.toIssuedDto(record, token);
  }

  private validateExpiration(expiresAt: Date, now: Date): void {
    if (
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt <= now ||
      expiresAt.getTime() - now.getTime() > MAX_TOKEN_LIFETIME_MS
    ) {
      throw new BadRequestException('API tokens must expire within the next 366 days.');
    }
  }

  private toDto(record: ApiTokenRecord): ApiTokenDto {
    return {
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      id: record.id,
      lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
      name: record.name,
      prefix: record.prefix,
      revokedAt: record.revokedAt?.toISOString() ?? null,
      scopes: record.scopes,
    };
  }

  private toIssuedDto(record: ApiTokenRecord, token: string): IssuedApiTokenDto {
    const dto = this.toDto(record);
    return {
      createdAt: dto.createdAt,
      expiresAt: dto.expiresAt,
      id: dto.id,
      lastUsedAt: dto.lastUsedAt,
      name: dto.name,
      prefix: dto.prefix,
      revokedAt: dto.revokedAt,
      scopes: dto.scopes,
      token,
    };
  }
}
