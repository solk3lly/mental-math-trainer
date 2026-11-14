const test = require('node:test');
const assert = require('node:assert/strict');

test('the review page serves every transitive local module without opening a listener', () => {
  const server = require('../review-storage-server.cjs');
  const pending = ['/'];
  const seen = new Set();
  while (pending.length) {
    const url = pending.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const response = { statusCode: 200, setHeader() {}, end(body) { this.body = body; } };
    server.emit('request', { url }, response);
    assert.equal(response.statusCode, 200, url);
    for (const [, imported] of response.body.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
      if (!imported.startsWith('.') && !imported.startsWith('/')) continue;
      pending.push(new URL(imported, 'http://localhost' + url).pathname);
    }
  }
  assert.equal(seen.has('/utils/guestSessionLocks.js'), true);
  assert.equal(server.listening, false);
});
