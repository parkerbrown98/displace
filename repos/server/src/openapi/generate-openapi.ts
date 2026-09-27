import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../app.module.js';
import { configureApp } from '../configure-app.js';
import { validateEnvironment } from '../config/environment.js';
import { createFastifyAdapter } from '../platform/http/create-fastify-adapter.js';

const sharedRoot = resolve(process.cwd(), '../shared');
const baselinePath = resolve(sharedRoot, 'openapi.baseline.json');
const documentPath = resolve(sharedRoot, 'openapi.json');
const reportPath = resolve(sharedRoot, 'compatibility-report.json');
const methods = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'] as const;

async function generate(): Promise<void> {
  const environment = validateEnvironment({ ...process.env, NODE_ENV: 'test' });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(environment),
    { bufferLogs: true, rawBody: true },
  );
  const document = await configureApp(app);
  validateOperations(document.paths);
  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  const baseline = await readDocument(baselinePath);
  await mkdir(dirname(documentPath), { recursive: true });
  await writeFile(documentPath, serialized);
  const checksum = createHash('sha256').update(serialized).digest('hex');
  await writeFile(reportPath, `${JSON.stringify({
    baselineChecksum: baseline ? checksumFor(baseline) : checksum,
    currentChecksum: checksum,
    openapiVersion: document.openapi,
    breakingChanges: baseline ? findBreakingChanges(baseline, document) : [],
  }, null, 2)}\n`);
}

function validateOperations(paths: OpenAPIObject['paths']): void {
  const missing: string[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, value] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!methods.includes(method as (typeof methods)[number])) continue;
      const operation = value as { responses?: unknown; tags?: unknown };
      if (!Array.isArray(operation.tags) || operation.tags.length === 0 || !operation.responses) {
        missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  if (missing.length > 0) throw new Error(`Undocumented API operations: ${missing.join(', ')}`);
}

function findBreakingChanges(baseline: OpenAPIObject, current: OpenAPIObject): string[] {
  const changes: string[] = [];
  for (const [path, baselinePathItem] of Object.entries(baseline.paths)) {
    const currentPathItem = current.paths[path];
    for (const method of methods) {
      const baselineOperation = baselinePathItem[method];
      if (!baselineOperation) continue;
      const currentOperation = currentPathItem?.[method];
      if (!currentOperation) {
        changes.push(`Removed operation ${method.toUpperCase()} ${path}`);
        continue;
      }
      for (const status of Object.keys(baselineOperation.responses ?? {})) {
        if (!(status in (currentOperation.responses ?? {}))) {
          changes.push(`Removed response ${status} from ${method.toUpperCase()} ${path}`);
        }
      }
    }
  }

  const baselineSchemas = baseline.components?.schemas ?? {};
  const currentSchemas = current.components?.schemas ?? {};
  for (const [name, baselineSchema] of Object.entries(baselineSchemas)) {
    const currentSchema = currentSchemas[name];
    if (!currentSchema) {
      changes.push(`Removed schema ${name}`);
      continue;
    }
    if ('$ref' in baselineSchema || '$ref' in currentSchema) continue;
    for (const property of Object.keys(baselineSchema.properties ?? {})) {
      if (!(property in (currentSchema.properties ?? {}))) {
        changes.push(`Removed property ${name}.${property}`);
      }
    }
    const baselineRequired = new Set(baselineSchema.required ?? []);
    for (const property of currentSchema.required ?? []) {
      if (!baselineRequired.has(property)) {
        changes.push(`Added required property ${name}.${property}`);
      }
    }
    const currentEnum = new Set(currentSchema.enum ?? []);
    for (const value of baselineSchema.enum ?? []) {
      if (!currentEnum.has(value)) changes.push(`Removed enum value ${name}.${String(value)}`);
    }
  }
  return changes;
}

function checksumFor(document: OpenAPIObject): string {
  return createHash('sha256')
    .update(`${JSON.stringify(document, null, 2)}\n`)
    .digest('hex');
}

async function readDocument(path: string): Promise<OpenAPIObject | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as OpenAPIObject;
  } catch {
    return undefined;
  }
}

try {
  await generate();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
