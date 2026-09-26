import 'dotenv/config';
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { applyBaseline } from './baseline.mjs';

// Only the remote deployment path uses this baseline migration. Local setup is unchanged.
if (!process.env.DATABASE_URL?.startsWith('libsql://') || !process.env.DATABASE_AUTH_TOKEN) {
  throw new Error('Remote deployment requires a libsql DATABASE_URL and DATABASE_AUTH_TOKEN.');
}
const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
try {
  await applyBaseline(client, sql);
  console.log('Remote schema is ready. Existing records were preserved.');
} finally {
  client.close();
}
