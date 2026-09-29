import 'dotenv/config';
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { applyBaseline, applyForwardMigration } from './baseline.mjs';

// Only the remote deployment path uses this baseline migration. Local setup is unchanged.
if (!process.env.DATABASE_URL?.startsWith('libsql://') || !process.env.DATABASE_AUTH_TOKEN) {
  throw new Error('Remote deployment requires a libsql DATABASE_URL and DATABASE_AUTH_TOKEN.');
}
const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
try {
  await applyBaseline(client, sql);
  const idempotencySql = readFileSync(new URL('./migrations/002-idempotency.sql', import.meta.url), 'utf8');
  await applyForwardMigration(client, '002-idempotency', idempotencySql);
  const loginSql = readFileSync(new URL('./migrations/003-employee-login.sql', import.meta.url), 'utf8');
  await applyForwardMigration(client, '003-employee-login', loginSql);
  const usernameSql = readFileSync(new URL('./migrations/004-employee-username.sql', import.meta.url), 'utf8');
  await applyForwardMigration(client, '004-employee-username', usernameSql);
  console.log('Remote schema is ready. Existing records were preserved.');
} finally {
  client.close();
}
