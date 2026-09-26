import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const commands = ['check', 'eval:ai'];
const results = [];
for (const name of commands) {
  const run = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', name], {
    stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true,
  });
  results.push({ command: `npm run ${name}`, passed: run.status === 0 });
  if (run.status !== 0) break;
}
const report = {
  checkedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTreeChanged: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  results,
  automatedGate: results.length === commands.length && results.every(r => r.passed) ? 'PASS' : 'FAIL',
  finalGo: 'PENDING: remote browser smoke, persistence after restart, failure/recovery and submitted SHA must be verified.',
};
writeFileSync('docs/release-gate-results.json', JSON.stringify(report, null, 2) + '\n');
if (report.automatedGate !== 'PASS') process.exitCode = 1;
