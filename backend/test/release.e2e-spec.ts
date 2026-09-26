import { createClient } from '@libsql/client';
import { applyBaseline } from '../prisma/baseline.mjs';
import { readFile } from 'node:fs/promises';

it('repeated release migrations preserve data and reject baseline drift', async () => {
  const client = createClient({ url: 'file::memory:' });
  try {
    const sql = await readFile(new URL('../prisma/schema.sql', import.meta.url), 'utf8');
    await applyBaseline(client, sql);
    await client.execute("INSERT INTO Employee (id, displayName, email) VALUES ('saved', 'Saved employee', 'saved@example.com')");
    await applyBaseline(client, sql);
    await expect(applyBaseline(client, sql + '\n-- changed baseline')).rejects.toThrow('Baseline schema changed');
    expect((await client.execute('SELECT id FROM Employee')).rows[0].id).toBe('saved');
  } finally { client.close(); }
});

it('a failed migration leaves no partial product schema or recorded success', async () => {
  const client = createClient({ url: 'file::memory:' });
  try {
    await expect(applyBaseline(client, 'CREATE TABLE Partial (id TEXT); INVALID SQL;')).rejects.toThrow();
    expect((await client.execute("SELECT name FROM sqlite_master WHERE name = 'Partial'")).rows).toHaveLength(0);
    expect((await client.execute('SELECT * FROM HubMigration')).rows).toHaveLength(0);
  } finally { client.close(); }
});
