import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { Resend } from 'resend';
import type { AppEnvironment } from '../config/environment.js';
import { getRedisConnection } from './auth-mail-queue.service.js';
import { AUTH_MAIL_QUEUE, type AuthMailJob } from './auth-mail.types.js';

const templateAliases = {
  'reset-password': 'displace-reset-password',
  'verify-email': 'displace-verify-email',
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Injectable()
export class AuthMailWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AuthMailWorkerService.name);
  private readonly applicationUrl: string;
  private readonly captureUrl?: string;
  private readonly from: string;
  private readonly redisUrl: string;
  private readonly resend?: Resend;
  private worker?: Worker<AuthMailJob>;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.applicationUrl = config.get('CORS_ORIGINS', { infer: true })[0]!;
    this.captureUrl = config.get('MAIL_CAPTURE_URL', { infer: true });
    this.from = config.get('EMAIL_FROM', { infer: true });
    this.redisUrl = config.get('REDIS_URL', { infer: true });
    const apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.resend = apiKey ? new Resend(apiKey) : undefined;
  }

  onApplicationBootstrap(): void {
    this.worker = new Worker<AuthMailJob>(
      AUTH_MAIL_QUEUE,
      (job) => this.process(job),
      {
        connection: getRedisConnection(this.redisUrl),
        concurrency: 5,
        prefix: 'displace',
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { error: error.message, jobId: job?.id, name: job?.name },
        'Authentication mail job failed',
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(
        { error: error.message },
        'Authentication mail worker error',
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<AuthMailJob>): Promise<void> {
    if (
      job.data.kind === 'registration-attempt' ||
      job.data.kind === 'password-reset-attempt'
    ) {
      return;
    }
    const isVerification = job.data.kind === 'verify-email';
    const path = isVerification ? 'verify-email' : 'reset-password';
    const action = isVerification ? 'Verify email' : 'Reset password';
    const url = `${this.applicationUrl}/${path}?token=${encodeURIComponent(job.data.token)}`;
    const subject = `${action} for Displace`;
    const text = `${action}: ${url}\n\nThis link expires automatically. If you did not request it, ignore this message.`;

    if (this.captureUrl) {
      const response = await fetch(
        new URL('/api/v1/send', this.captureUrl),
        {
          body: JSON.stringify({
            From: { Email: this.from, Name: 'Displace' },
            HTML: `<p>${action}:</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>This link expires automatically. If you did not request it, ignore this message.</p>`,
            Subject: subject,
            Text: text,
            To: [{ Email: job.data.recipient }],
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      if (!response.ok) {
        throw new Error(
          `Mail capture failed with status ${response.status}: ${await response.text()}`,
        );
      }
      this.logger.debug(
        { kind: job.data.kind, recipient: job.data.recipient },
        'Captured development authentication email',
      );
      return;
    }

    if (!this.resend) {
      this.logger.warn(
        { kind: job.data.kind, recipient: job.data.recipient },
        'Authentication email was not sent because delivery is not configured',
      );
      return;
    }

    if (!job.id) {
      throw new Error('Authentication mail job is missing its idempotency ID.');
    }
    const { error } = await this.resend.emails.send(
      {
        from: `Displace <${this.from}>`,
        template: {
          id: templateAliases[job.data.kind],
          variables: { ACTION_URL: url },
        },
        to: [job.data.recipient],
      },
      { idempotencyKey: `${job.data.kind}/${job.id}` },
    );
    if (error) {
      throw new Error(`Resend could not send authentication email: ${error.message}`);
    }
  }
}
