import { createClient } from '@libsql/client';
import { applyBaseline, applyForwardMigration } from '../prisma/baseline.mjs';
import { readFile } from 'node:fs/promises';

it('repeated release migrations preserve data and reject baseline drift', async () => {
  const client = createClient({ url: 'file::memory:' });
  try {
    const sql = await readFile(new URL('../prisma/schema.sql', import.meta.url), 'utf8');
    const migration = await readFile(new URL('../prisma/migrations/002-idempotency.sql', import.meta.url), 'utf8');
    await applyBaseline(client, sql);
    await client.execute("INSERT INTO Employee (id, displayName, email) VALUES ('saved', 'Saved employee', 'saved@example.com')");
    await applyBaseline(client, sql);
    await applyForwardMigration(client, '002-idempotency', migration);
    await applyForwardMigration(client, '002-idempotency', migration);
    await client.execute("INSERT INTO Department (id, name, slug) VALUES ('it', 'IT', 'it')");
    await client.execute("INSERT INTO ServiceRequest (id, ticketNumber, title, description, creatorId, departmentId, updatedAt) VALUES ('r1', 'REQ-1', 'Saved', 'Saved', 'saved', 'it', CURRENT_TIMESTAMP)");
    expect((await client.execute('SELECT idempotencyKey FROM ServiceRequest')).rows).toHaveLength(1);
    await expect(applyForwardMigration(client, '002-idempotency', migration + '\n-- changed'))
      .rejects.toThrow('Migration 002-idempotency changed');
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
