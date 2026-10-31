// npm test: builds the pages, then runs each tests/*.test.js in Chromium, Firefox and WebKit
// (Safari's engine), one after another. Words after `npm test --` narrow it down: a browser
// name picks that browser, anything else picks the test files whose names include it
// (npm test -- webkit progress).
const { spawn, spawnSync } = require('child_process'); const crypto = require('crypto'); const fs = require('fs'); const http = require('http'); const path = require('path');
const playwright = require('playwright');
const ROOT = path.join(__dirname, '..'); const INDEX = path.join(ROOT, 'index.html');
const ENGINES = ['chromium', 'firefox', 'webkit'];
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(INDEX)).digest('hex');

// Firefox and WebKit get the pages over HTTP, as from the website. Only the two pages are
// served, and anything else a page asks the server for is a failure: they load nothing.
const PAGES = { '/index.html': INDEX, '/test-results/test.html': path.join(ROOT, 'test-results', 'test.html') };
function serve(strays, who) {
  const server = http.createServer((req, res) => {
    const file = req.method === 'GET' && PAGES[req.url.split('?')[0]];
    if (!file) { strays.push(`${who()}: ${req.method} ${req.url}`); res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(fs.readFileSync(file));
  });
  return new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(server)));
}

// Whether the browser starts, and its version. Not installed is a failure, never a skip.
async function launch(name) {
  try { const b = await playwright[name].launch(); const version = b.version(); await b.close(); return { version }; } catch (e) {
    return { error: e.message.replace(/[║╔╗╚╝═]/g, '').split('\n').map(l => l.trim()).filter(l => l && !/Playwright Team/.test(l)).slice(0, 6).join('\n  ') };
  }
}

function runFile(file, env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], { cwd: ROOT, stdio: 'inherit', env });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 5 * 60 * 1000);
    child.on('error', e => { clearTimeout(timer); resolve(String(e)); });
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve(code === 0 ? null : timedOut ? 'timed out' : signal || ''); });
  });
}

(async () => {
  fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
  const before = digest();
  const build = spawnSync(python, ['-I', '-X', 'utf8', 'tools/build.py', '--test', 'test-results/test.html'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status !== 0) { console.log('FAIL the build', build.error ? String(build.error) : ''); process.exit(1); }
  if (digest() !== before) { console.log('FAIL index.html was out of date with src/. It has been rebuilt now: commit it.'); process.exit(1); }

  const words = process.argv.slice(2);
  const only = words.filter(w => !ENGINES.includes(w));
  const browsers = ENGINES.filter(b => words.includes(b));
  if (!browsers.length) browsers.push(...ENGINES);
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only.length || only.some(n => f.includes(n)))).sort();
  if (!files.length) { console.log('FAIL no tests match', only.join(' ')); process.exit(1); }

  const strays = []; let current = '';
  const server = browsers.some(b => b !== 'chromium') ? await serve(strays, () => current) : null;
  const bad = []; let runs = 0;
  for (const b of browsers) {
    const { version, error } = await launch(b);
    console.log(`\n==== ${b} ${version || ''}`);
    if (error) { console.log(`FAIL ${b} does not start:\n  ${error}`); bad.push(`${b} (does not start)`); continue; }
    const env = { ...process.env, TEST_BROWSER: b };
    if (b === 'chromium') delete env.TEST_BASE; else env.TEST_BASE = `http://127.0.0.1:${server.address().port}/`;
    for (const f of files) {
      console.log(`\n== ${b} ${f}`); const t0 = Date.now(); current = `${b} ${f}`; runs++;
      const why = await runFile(f, env);
      if (why !== null) bad.push(`${b} ${f}${why ? ` (${why})` : ''}`);
      console.log(`== ${b} ${f}: ${why === null ? 'passed' : 'FAILED'} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  if (server) { server.closeAllConnections(); server.close(); }
  if (strays.length) { console.log('\nFAIL the pages asked the server for more than themselves:\n  ' + [...new Set(strays)].join('\n  ')); bad.push('requests to the server'); }
  console.log(bad.length ? `\n${bad.length} failed: ${bad.join(', ')}` : `\nall ${runs} pass: ${files.length} test files in ${browsers.join(', ')}`);
  process.exitCode = bad.length ? 1 : 0;
})();
