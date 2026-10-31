// npm test [name...]: rebuilds the pages, fails if index.html was out of date with src/,
// then runs every tests/*.test.js (or those whose file names contain a name) one at a
// time, each in its own process. Exits non-zero if anything failed.
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(INDEX)).digest('hex');

fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
const before = digest();
const build = spawnSync(python, ['-I', '-X', 'utf8', 'tools/build.py', '--test', 'test-results/test.html'], { cwd: ROOT, stdio: 'inherit' });
if (build.status !== 0) {
  console.log('FAIL the build', build.error ? String(build.error) : '');
  process.exit(1);
}
// The build is deterministic, so a changed index.html means src/ was changed without it.
if (digest() !== before) {
  console.log('FAIL index.html was out of date with src/. It has been rebuilt now: commit it.');
  process.exit(1);
}

const only = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only.length || only.some(n => f.includes(n)))).sort();
if (!files.length) {
  console.log('FAIL no tests match', only.join(' '));
  process.exit(1);
}
const bad = [];
for (const f of files) {
  console.log(`\n== ${f}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: ROOT, stdio: 'inherit', timeout: 5 * 60 * 1000 });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.status !== 0) bad.push(f + (r.error?.code === 'ETIMEDOUT' ? ' (timed out)' : r.signal ? ` (${r.signal})` : ''));
  console.log(`== ${f}: ${r.status === 0 ? 'passed' : 'FAILED'} in ${secs}s`);
}
console.log(bad.length ? `\n${bad.length} of ${files.length} test files failed: ${bad.join(', ')}` : `\nall ${files.length} test files pass`);
process.exitCode = bad.length ? 1 : 0;
