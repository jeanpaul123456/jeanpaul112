import 'dotenv/config';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
if (url.startsWith('file:')) {
  const path = resolve(url.slice(5));
  mkdirSync(dirname(path), { recursive: true });
  closeSync(openSync(path, 'a'));
}
