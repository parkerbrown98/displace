import { copyFile } from 'node:fs/promises';

await copyFile(
  new URL('../openapi.json', import.meta.url),
  new URL('../openapi.baseline.json', import.meta.url),
);