import { createHash } from 'node:crypto';

export async function applyBaseline(client, sql) {
  const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
  await client.execute('CREATE TABLE IF NOT EXISTS HubMigration (id TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
  const previous = await client.execute("SELECT checksum FROM HubMigration WHERE id = '001-baseline'");
  if (previous.rows.length) {
    if (previous.rows[0].checksum !== checksum) throw new Error('Baseline schema changed. Write a new migration; do not overwrite the deployed baseline.');
    return;
  }
  await client.batch([
    ...sql.split(';').map((statement) => statement.trim()).filter(Boolean),
    { sql: 'INSERT INTO HubMigration (id, checksum) VALUES (?, ?)', args: ['001-baseline', checksum] },
  ], 'write');
}
