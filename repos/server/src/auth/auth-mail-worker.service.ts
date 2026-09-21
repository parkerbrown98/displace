import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import nodemailer, { type Transporter } from 'nodemailer';
import type { AppEnvironment } from '../config/environment.js';
import { getRedisConnection } from './auth-mail-queue.service.js';
import { AUTH_MAIL_QUEUE, type AuthMailJob } from './auth-mail.types.js';

@Injectable()
export class AuthMailWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AuthMailWorkerService.name);
  private readonly applicationUrl: string;
  private readonly capturesMail: boolean;
  private readonly from: string;
  private readonly redisUrl: string;
  private readonly transporter: Transporter;
  private worker?: Worker<AuthMailJob>;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.applicationUrl = config.get('CORS_ORIGINS', { infer: true })[0]!;
    this.from = config.get('SMTP_FROM', { infer: true });
    this.redisUrl = config.get('REDIS_URL', { infer: true });
    const host = config.get('SMTP_HOST', { infer: true });
    const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
    const secure = config.get('SMTP_SECURE', { infer: true });
    this.capturesMail = !host;
    this.transporter = host
      ? nodemailer.createTransport({
          auth: config.get('SMTP_USER', { infer: true })
            ? {
                pass: config.get('SMTP_PASSWORD', { infer: true })!,
                user: config.get('SMTP_USER', { infer: true })!,
              }
            : undefined,
          host,
          port: config.get('SMTP_PORT', { infer: true }),
          requireTLS: isProduction && !secure,
          secure,
        })
      : nodemailer.createTransport({ jsonTransport: true });
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
    this.transporter.close();
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
    await this.transporter.sendMail({
      from: this.from,
      subject: `${action} for Displace`,
      text: `${action}: ${url}\n\nThis link expires automatically. If you did not request it, ignore this message.`,
      to: job.data.recipient,
    });
    if (this.capturesMail) {
      this.logger.debug(
        { kind: job.data.kind, recipient: job.data.recipient },
        'Captured development authentication email',
      );
    }
  }
}
