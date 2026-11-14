const test = require('node:test');
const assert = require('node:assert/strict');

test('cancelled traversal keeps forward entries and confirmed traversal moves through existing history', async () => {
  const { installRoundNavigation } = await import('../utils/roundNavigation.js');
  const entries = [{ url: '/initial', state: {} }];
  let index = 0;
  let callback;
  let decide;
  const navigated = [];
  const history = {
    get state() { return entries[index].state; },
    pushState(state, _title, url) { entries.splice(index + 1); entries.push({ state, url }); index++; },
    replaceState(state) { entries[index].state = state; },
    go(delta) {
      index += delta;
      queueMicrotask(() => { if (callback()) navigated.push(entries[index].url); });
    }
  };
  let active = false;
  const cleanup = installRoundNavigation({ history, router: { beforePopState: fn => { callback = fn; } },
    isActive: () => active, requestExit: () => new Promise(resolve => { decide = resolve; }) });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  try {
    history.pushState({}, '', '/trainer');
    history.pushState({}, '', '/later');
    history.go(-1);
    await settle();
    active = true;
    history.go(-1);
    await settle();
    assert.equal(index, 1);
    decide(false);
    await settle();
    assert.deepEqual(entries.map(entry => entry.url), ['/initial', '/trainer', '/later']);
    history.go(1);
    await settle();
    assert.equal(index, 1);
    decide(true);
    await settle();
    assert.equal(index, 2);
    assert.deepEqual(navigated, ['/trainer', '/later']);
    assert.equal(entries.length, 3);
  } finally { cleanup(); }
});
