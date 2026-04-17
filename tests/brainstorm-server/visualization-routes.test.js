/**
 * Route tests for the visualization resource extensions.
 *
 * Starts the brainstorm server with a --project-dir-style SESSION_DIR so
 * PROJECT_ROOT is populated, then hits each new route.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SERVER_PATH = path.join(__dirname, '../../skills/brainstorming/scripts/server.cjs');
const TEST_PORT = 3335;
const PROJECT_DIR = '/tmp/brainstorm-viz-test';
const SESSION_DIR = path.join(PROJECT_DIR, '.hey-d/brainstorm/test-session');

function cleanup() {
  if (fs.existsSync(PROJECT_DIR)) {
    fs.rmSync(PROJECT_DIR, { recursive: true });
  }
}

async function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data,
      }));
    }).on('error', reject);
  });
}

function startServer() {
  return spawn('node', [SERVER_PATH], {
    env: { ...process.env, BRAINSTORM_PORT: TEST_PORT, BRAINSTORM_DIR: SESSION_DIR },
  });
}

async function waitForServer(server) {
  let stdout = '';
  let stderr = '';
  return new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.includes('server-started')) resolve({ stdout, stderr });
    });
    server.stderr.on('data', (data) => { stderr += data.toString(); });
    server.on('error', reject);
    setTimeout(() => reject(new Error(`Server didn't start. stderr: ${stderr}`)), 5000);
  });
}

async function runTests() {
  cleanup();

  const server = startServer();
  await waitForServer(server);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  await test('serves plugin components.js', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/resources/visualization/components.js`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes("customElements.define('card'"), 'Expected card registration in body');
  });

  await test('serves plugin theme.css', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/resources/visualization/theme.css`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('--accent'), 'Expected CSS variable --accent in body');
  });

  await test('serves plugin tailwind.css', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/resources/visualization/tailwind.css`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.length > 100, 'Expected non-trivial body');
  });

  await test('returns 404 for missing project override', async () => {
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/.agents/config/visualization/nonexistent.js`);
    assert.strictEqual(res.status, 404);
  });

  await test('rejects path traversal', async () => {
    // Node's http.get normalizes `..` segments before sending, so the request
    // arrives with the path collapsed — no longer matching our route prefix,
    // so it falls through to the default 404 handler. Either 403 (our explicit
    // guard) or 404 (route-prefix mismatch after normalization) is acceptable.
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/resources/visualization/../../../etc/passwd`);
    assert.ok([403, 404].includes(res.status), `Expected 403 or 404, got ${res.status}`);
  });

  await test('serves project override when present', async () => {
    const overrideDir = path.join(PROJECT_DIR, '.agents/config/visualization');
    fs.mkdirSync(overrideDir, { recursive: true });
    fs.writeFileSync(path.join(overrideDir, 'theme.css'), ':root { --brand: #ff0000; }');
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/.agents/config/visualization/theme.css`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('--brand'), 'Expected override content');
  });

  server.kill();
  cleanup();

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
