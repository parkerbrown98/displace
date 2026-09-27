import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const document = await readFile(new URL('../openapi.json', import.meta.url));
const baseline = await readFile(new URL('../openapi.baseline.json', import.meta.url));
const report = JSON.parse(await readFile(new URL('../compatibility-report.json', import.meta.url), 'utf8'));
const checksum = createHash('sha256').update(document).digest('hex');
const baselineChecksum = createHash('sha256').update(baseline).digest('hex');

if (report.currentChecksum !== checksum) {
  throw new Error('The checked-in OpenAPI document changed without regenerating the compatibility report. Run pnpm openapi:generate in repos/server.');
}
if (report.baselineChecksum !== baselineChecksum) {
  throw new Error('The OpenAPI compatibility baseline changed without regenerating the report. Run pnpm openapi:generate in repos/server.');
}
if (report.breakingChanges?.length) {
  throw new Error(`The OpenAPI compatibility report contains breaking changes: ${report.breakingChanges.join(', ')}`);
}
