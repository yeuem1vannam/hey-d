/**
 * Smoke test for the visualization snapshot tool.
 *
 * Runs resources/visualization/snapshot.cjs against a known fragment and
 * asserts the output contains inlined resources + the content under <main>.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const SNAPSHOT = path.join(__dirname, '../../resources/visualization/snapshot.cjs');

function runTests() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heyd-snapshot-test-'));
  const fragment = path.join(tmpDir, 'fragment.html');
  const output = path.join(tmpDir, 'out.html');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  test('produces a self-contained HTML file from a bare fragment', () => {
    fs.writeFileSync(fragment, '<hd-card title="Test"><p>Hello</p></hd-card>');
    execFileSync('node', [SNAPSHOT, fragment, '--out', output]);
    assert.ok(fs.existsSync(output), 'Output file should exist');

    const out = fs.readFileSync(output, 'utf-8');
    assert.match(out, /<!DOCTYPE html>/, 'Should start with DOCTYPE');
    assert.ok(out.includes('--accent'), 'Should have theme.css (CSS var) inlined');
    assert.ok(out.includes("customElements.define('hd-card'"), 'Should have components.js inlined');
    assert.match(out, /<main>[\s\S]*<hd-card title="Test"/, 'Fragment content should be wrapped in <main>');
  });

  test('extracts <main> content when fragment is already wrapped', () => {
    fs.writeFileSync(fragment, '<main><hd-card title="Wrapped"><p>Inner</p></hd-card></main>');
    execFileSync('node', [SNAPSHOT, fragment, '--out', output]);
    const out = fs.readFileSync(output, 'utf-8');
    // Should contain the inner content, not a nested <main>
    assert.ok(out.includes('<hd-card title="Wrapped"'), 'Should have the card element');
    // Only one opening <main> tag in the output
    const mainOpens = (out.match(/<main>/g) || []).length;
    assert.strictEqual(mainOpens, 1, `Expected exactly one <main> tag, got ${mainOpens}`);
  });

  test('accepts --title flag', () => {
    fs.writeFileSync(fragment, '<hd-card><p>Titled</p></hd-card>');
    execFileSync('node', [SNAPSHOT, fragment, '--out', output, '--title', 'My Custom Title']);
    const out = fs.readFileSync(output, 'utf-8');
    assert.match(out, /<title>My Custom Title<\/title>/, 'Should use the provided title');
  });

  test('escapes HTML in title', () => {
    fs.writeFileSync(fragment, '<card/>');
    execFileSync('node', [SNAPSHOT, fragment, '--out', output, '--title', '<script>alert(1)</script>']);
    const out = fs.readFileSync(output, 'utf-8');
    assert.ok(!out.includes('<title><script>'), 'Raw <script> should not appear in <title>');
    assert.ok(out.includes('&lt;script&gt;'), 'Script tag chars should be escaped');
  });

  fs.rmSync(tmpDir, { recursive: true });
  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
