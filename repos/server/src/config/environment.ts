import { z } from 'zod';

const developmentSecrets = {
  ACCESS_TOKEN_SECRET: 'development-access-token-secret-change-me',
  COOKIE_SECRET: 'development-cookie-signing-secret-change-me',
  CURSOR_SECRET: 'development-cursor-signing-secret-change-me',
  REFRESH_TOKEN_PEPPER: 'development-refresh-token-pepper-change-me',
} as const;

const booleanValue = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return value;
}, z.boolean());

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.url().optional(),
);

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

function serviceUrl(protocols: string[]) {
  return z
    .url()
    .refine((value) => protocols.includes(new URL(value).protocol), {
      message: `URL must use one of these protocols: ${protocols.join(', ')}`,
    });
}

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    PUBLIC_URL: serviceUrl(['http:', 'https:']).default(
      'http://localhost:3000',
    ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    BODY_LIMIT_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(10 * 1_024 * 1_024)
      .default(1_048_576),
    UPLOAD_LIMIT_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(100 * 1_024 * 1_024)
      .default(26_214_400),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value, context) => {
        const origins = value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

        for (const origin of origins) {
          const parsedOrigin = z.url().safeParse(origin);
          if (!parsedOrigin.success) {
            context.addIssue({
              code: 'custom',
              message: `Invalid CORS origin: ${origin}`,
            });
            continue;
          }

          const url = new URL(origin);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.pathname !== '/' ||
            url.search ||
            url.hash
          ) {
            context.addIssue({
              code: 'custom',
              message: `CORS origin must contain only an HTTP(S) origin: ${origin}`,
            });
          }
        }

        return origins;
      }),
    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((value): boolean | string[] => {
        if (value === 'true') {
          return true;
        }

        if (value === 'false') {
          return false;
        }

        return value
          .split(',')
          .map((proxy) => proxy.trim())
          .filter(Boolean);
      }),
    DATABASE_URL: serviceUrl(['postgres:', 'postgresql:']).default(
      'postgresql://displace_app:displace_app_dev@localhost:5432/displace',
    ),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(30_000)
      .default(2_000),
    DATABASE_IDLE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(10_000),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000)
      .default(5_000),
    REDIS_URL: serviceUrl(['redis:', 'rediss:']).default(
      'redis://localhost:6379',
    ),
    S3_ENDPOINT: serviceUrl(['http:', 'https:']).default(
      'http://localhost:9000',
    ),
    S3_ACCESS_KEY: z.string().min(1).default('displace'),
    S3_SECRET_KEY: z.string().min(1).default('displace_dev_secret'),
    S3_BUCKET: z.string().min(1).default('displace'),
    MEILISEARCH_HOST: serviceUrl(['http:', 'https:']).default(
      'http://localhost:7700',
    ),
    MEILISEARCH_MASTER_KEY: z
      .string()
      .min(1)
      .default('displace-dev-search-key'),
    LIVEKIT_URL: serviceUrl(['http:', 'https:', 'ws:', 'wss:']).default(
      'http://localhost:7880',
    ),
    LIVEKIT_API_KEY: z.string().min(1).default('devkey'),
    LIVEKIT_API_SECRET: z.string().min(1).default('secret'),
    ACCESS_TOKEN_SECRET: z
      .string()
      .min(32)
      .default(developmentSecrets.ACCESS_TOKEN_SECRET),
    REFRESH_TOKEN_PEPPER: z
      .string()
      .min(32)
      .default(developmentSecrets.REFRESH_TOKEN_PEPPER),
    COOKIE_SECRET: z.string().min(32).default(developmentSecrets.COOKIE_SECRET),
    CURSOR_SECRET: z.string().min(32).default(developmentSecrets.CURSOR_SECRET),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    SMTP_SECURE: booleanValue.default(false),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    SMTP_FROM: z.email().default('no-reply@localhost.invalid'),
    OIDC_ISSUER_URL: optionalUrl,
    OIDC_CLIENT_ID: optionalString,
    OIDC_CLIENT_SECRET: optionalString,
    OIDC_REDIRECT_URL: optionalUrl,
    SINGLE_PLACE_MODE: booleanValue.default(false),
    SINGLE_PLACE_SLUG: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    ),
  })
  .superRefine((environment, context) => {
    if (environment.CORS_ORIGINS.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'At least one CORS origin is required.',
      });
    }

    if (environment.SINGLE_PLACE_MODE && !environment.SINGLE_PLACE_SLUG) {
      context.addIssue({
        code: 'custom',
        path: ['SINGLE_PLACE_SLUG'],
        message: 'SINGLE_PLACE_SLUG is required in single-place mode.',
      });
    }

    const oidcValues = [
      environment.OIDC_ISSUER_URL,
      environment.OIDC_CLIENT_ID,
      environment.OIDC_CLIENT_SECRET,
      environment.OIDC_REDIRECT_URL,
    ];
    const configuredOidcValues = oidcValues.filter(Boolean).length;
    if (configuredOidcValues > 0 && configuredOidcValues < oidcValues.length) {
      context.addIssue({
        code: 'custom',
        path: ['OIDC_ISSUER_URL'],
        message: 'All OIDC settings are required when OIDC is enabled.',
      });
    }

    if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'SMTP_USER and SMTP_PASSWORD must be configured together.',
      });
    }

    if (environment.NODE_ENV !== 'production') {
      return;
    }

    if (!environment.SMTP_HOST) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required in production.',
      });
    }

    if (new URL(environment.PUBLIC_URL).protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['PUBLIC_URL'],
        message: 'PUBLIC_URL must use HTTPS in production.',
      });
    }

    if (environment.TRUST_PROXY === true) {
      context.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message: 'TRUST_PROXY cannot trust every proxy in production.',
      });
    }

    for (const origin of environment.CORS_ORIGINS) {
      if (new URL(origin).protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'All CORS origins must use HTTPS in production.',
        });
      }
    }

    if (
      environment.OIDC_REDIRECT_URL &&
      new URL(environment.OIDC_REDIRECT_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['OIDC_REDIRECT_URL'],
        message: 'OIDC_REDIRECT_URL must use HTTPS in production.',
      });
    }

    for (const [name, developmentValue] of Object.entries(developmentSecrets)) {
      if (
        environment[name as keyof typeof developmentSecrets] ===
        developmentValue
      ) {
        context.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} must be changed in production.`,
        });
      }
    }

    const insecureServiceValues = [
      [
        'DATABASE_URL',
        'postgresql://displace_app:displace_app_dev@localhost:5432/displace',
      ],
      ['S3_SECRET_KEY', 'displace_dev_secret'],
      ['MEILISEARCH_MASTER_KEY', 'displace-dev-search-key'],
      ['LIVEKIT_API_KEY', 'devkey'],
      ['LIVEKIT_API_SECRET', 'secret'],
    ] as const;
    for (const [name, developmentValue] of insecureServiceValues) {
      if (environment[name] === developmentValue) {
        context.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} must be changed in production.`,
        });
      }
    }
  });

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  values: Record<string, unknown>,
): AppEnvironment {
  const result = environmentSchema.safeParse(values);
  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map(
      (issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`,
    )
    .join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}
