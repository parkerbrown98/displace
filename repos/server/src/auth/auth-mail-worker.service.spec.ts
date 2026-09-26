import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '../config/environment.js';
import { validateEnvironment } from '../config/environment.js';
import { AuthMailWorkerService } from './auth-mail-worker.service.js';
import type { AuthMailJob } from './auth-mail.types.js';

const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    readonly emails = { send: resendSend };
  },
}));

type ProcessableWorker = {
  process(job: Pick<Job<AuthMailJob>, 'data' | 'id'>): Promise<void>;
};

function createWorker(environment: Record<string, string>): ProcessableWorker {
  const config = new ConfigService<AppEnvironment, true>(
    validateEnvironment({
      CORS_ORIGINS: 'https://app.displace.example',
      EMAIL_FROM: 'mail@displace.example',
      ...environment,
    }),
  );
  return new AuthMailWorkerService(config) as unknown as ProcessableWorker;
}

describe('AuthMailWorkerService', () => {
  afterEach(() => {
    resendSend.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends verification mail with the published Resend template', async () => {
    resendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const worker = createWorker({ RESEND_API_KEY: 're_test' });

    await worker.process({
      data: {
        kind: 'verify-email',
        recipient: 'member@example.com',
        token: 'verification-token',
      },
      id: 'verify-email-token-hash',
    });

    expect(resendSend).toHaveBeenCalledWith(
      {
        from: 'Displace <mail@displace.example>',
        template: {
          id: 'displace-verify-email',
          variables: {
            ACTION_URL:
              'https://app.displace.example/verify-email?token=verification-token',
          },
        },
        to: ['member@example.com'],
      },
      { idempotencyKey: 'verify-email/verify-email-token-hash' },
    );
  });

  it('sends reset mail with the published Resend template', async () => {
    resendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const worker = createWorker({ RESEND_API_KEY: 're_test' });

    await worker.process({
      data: {
        kind: 'reset-password',
        recipient: 'member@example.com',
        token: 'reset-token',
      },
      id: 'reset-password-token-hash',
    });

    expect(resendSend).toHaveBeenCalledWith(
      {
        from: 'Displace <mail@displace.example>',
        template: {
          id: 'displace-reset-password',
          variables: {
            ACTION_URL:
              'https://app.displace.example/reset-password?token=reset-token',
          },
        },
        to: ['member@example.com'],
      },
      { idempotencyKey: 'reset-password/reset-password-token-hash' },
    );
  });

  it('throws returned Resend API errors so BullMQ can retry', async () => {
    resendSend.mockResolvedValue({
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
    });
    const worker = createWorker({ RESEND_API_KEY: 're_test' });

    await expect(
      worker.process({
        data: {
          kind: 'reset-password',
          recipient: 'member@example.com',
          token: 'reset-token',
        },
        id: 'reset-password-token-hash',
      }),
    ).rejects.toThrow('Resend could not send authentication email: Rate limited');
  });

  it('posts development mail to the Mailpit capture API', async () => {
    const captureFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', captureFetch);
    const worker = createWorker({
      MAIL_CAPTURE_URL: 'http://mailpit:8025',
    });

    await worker.process({
      data: {
        kind: 'reset-password',
        recipient: 'member@example.com',
        token: 'reset-token',
      },
      id: 'reset-password-token-hash',
    });

    expect(captureFetch).toHaveBeenCalledOnce();
    const [url, request] = captureFetch.mock.calls[0]!;
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toBe('http://mailpit:8025/api/v1/send');
    expect(JSON.parse(request?.body as string)).toMatchObject({
      From: { Email: 'mail@displace.example', Name: 'Displace' },
      Subject: 'Reset password for Displace',
      Text: expect.stringContaining(
        'https://app.displace.example/reset-password?token=reset-token',
      ),
      To: [{ Email: 'member@example.com' }],
    });
    expect(resendSend).not.toHaveBeenCalled();
  });
});