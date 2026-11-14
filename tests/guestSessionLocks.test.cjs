const test = require('node:test');
const assert = require('node:assert/strict');

test('guest liveness follows the held lock through release and detects the safe fallback', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const held = new Set();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    async request(name, _options, work) {
      held.add(name);
      try { await work({ name }); } finally { held.delete(name); }
    },
    query: async () => ({ held: [...held].map(name => ({ name })) })
  } } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  });
  const locks = await import('../utils/guestSessionLocks.js');
  assert.equal(locks.canCoordinateGuestSessions(), true);
  await locks.holdGuestSession('live-round');
  assert.deepEqual([...await locks.liveGuestSessions()], ['live-round']);
  locks.releaseGuestSession('live-round');
  await Promise.resolve();
  assert.deepEqual([...await locks.liveGuestSessions()], []);
  globalThis.navigator.locks = null;
  assert.equal(locks.canCoordinateGuestSessions(), false);
});
