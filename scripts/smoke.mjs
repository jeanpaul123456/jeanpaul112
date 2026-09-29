const origin = process.argv[2];
if (!origin || !/^https?:\/\//.test(origin)) throw new Error('Usage: npm run smoke -- https://YOUR-SERVICE.onrender.com');
const results = [];
for (const path of ['/app/', '/health', '/health/ready', '/directory']) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(90000) });
  const expected = path === '/directory' ? 401 : 200;
  if (response.status !== expected) throw new Error(`${path}: expected HTTP ${expected}, got ${response.status}`);
  const content = await response.text();
  if (path === '/app/' && !content.includes('<html')) throw new Error('Frontend HTML missing');
  if (path === '/health/ready') {
    const ready = JSON.parse(content);
    if (ready.database !== 'ok' || ready.reviewMode !== 'gemini') throw new Error('Database or live Gemini configuration is not ready');
  }
  results.push({ path, status: response.status });
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), origin, results, scope: 'Read-only HTTP checks. Complete the documented browser journey and restart/persistence checks separately.' }, null, 2));
