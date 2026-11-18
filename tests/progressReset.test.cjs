const test = require('node:test');
const assert = require('node:assert/strict');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function isolatedTab(name) {
  const fs = require('node:fs');
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const url = pathToFileURL(path.resolve('utils/progressWriteCoordinator.js')).href + `?tab=${name}`;
  const source = fs.readFileSync(path.resolve('utils/aiModeLogs.js'), 'utf8')
    .replace("'./progressWriteCoordinator.js'", JSON.stringify(url))
    .replace("'./progressStorage.js'", JSON.stringify(pathToFileURL(path.resolve('utils/progressStorage.js')).href));
  return {
    coordinator: await import(url),
    ai: await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
  };
}

function browserEnvironment(t, locks) {
  const previous = ['window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const values = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

test('reset in another tab invalidates buffered AI rows and permits later answers', async t => {
  browserEnvironment(t, { request: (_key, _options, work) => Promise.resolve().then(work) });
  const a = await isolatedTab('buffered-a');
  const b = await isolatedTab('buffered-b');
  const rows = [];
  const buffer = a.ai.createAiModeLogBuffer({
    getClient: () => ({ from: () => ({ upsert: async batch => { rows.push(...batch); return { error: null }; } }) }),
    setTimeoutImpl: () => 1, clearTimeoutImpl() {},
    getAccessToken: () => 'token', getRestConfig: () => ({ url: 'https://example.invalid', key: 'public' }),
    fetchImpl: async (_url, options) => { rows.push(...JSON.parse(options.body)); return { ok: true }; }
  });
  t.after(() => buffer.dispose());
  buffer.enqueue({ user_id: 'cross-tab-admin', session_id: 'before-reset', question_index: 1 });
  await b.coordinator.resetAccountProgress('cross-tab-admin', async () => { rows.length = 0; });
  buffer.enqueue({ user_id: 'cross-tab-admin', session_id: 'after-reset', question_index: 1 });
  const result = await buffer.flush({ keepalive: true });
  assert.equal(result.flushedCount, 1);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.session_id === 'after-reset'));
});

test('a newly observed cloud generation lets new answers pass an older buffered batch', async t => {
  const { coordinator, ai } = await isolatedTab('remote-reset');
  const userId = 'remote-reset-owner';
  let generation = '0';
  const rows = [];
  const client = { rpc: async () => ({ data: generation, error: null }),
    from: () => ({ upsert: async batch => { rows.push(...batch); return { error: null }; } }) };
  await coordinator.getAccountProgressGeneration(client, userId);
  const buffer = ai.createAiModeLogBuffer({ getClient: () => client,
    setTimeoutImpl: () => 1, clearTimeoutImpl() {} });
  t.after(() => buffer.dispose());
  buffer.enqueue({ user_id: userId, reset_generation: '0', session_id: 'old', question_index: 1 });
  generation = '1';
  await coordinator.getAccountProgressGeneration(client, userId);
  buffer.enqueue({ user_id: userId, reset_generation: '1', session_id: 'new', question_index: 1 });
  assert.equal((await buffer.flush()).flushedCount, 1);
  assert.deepEqual(rows.map(row => row.session_id), ['new']);
});

test('an answer with the new server generation survives a reset response still in flight', async t => {
  const { coordinator, ai } = await isolatedTab('reset-response');
  const started = deferred();
  const gate = deferred();
  const userId = 'reset-response-owner';
  const rows = [];
  const client = { rpc: async () => ({ data: '1', error: null }),
    from: () => ({ upsert: async batch => { rows.push(...batch); return { error: null }; } }) };
  const buffer = ai.createAiModeLogBuffer({ getClient: () => client,
    setTimeoutImpl: () => 1, clearTimeoutImpl() {} });
  t.after(() => buffer.dispose());
  const reset = coordinator.resetAccountProgress(userId, async () => {
    started.resolve(); await gate.promise; return '1';
  });
  await started.promise;
  await coordinator.getAccountProgressGeneration(client, userId);
  const newAnswer = { user_id: userId, reset_generation: '1', session_id: 'new', question_index: 1 };
  buffer.enqueue(newAnswer);
  const saved = buffer.flush();
  gate.resolve();
  await reset;
  assert.equal((await saved).flushedCount, 1);
  assert.deepEqual(rows, [newAnswer]);
});

test('failed reset keeps manual answers available for the next successful save', async t => {
  const { resetAccountProgress } = await import('../utils/progressWriteCoordinator.js');
  const { createProgressLogBuffer } = await import('../utils/progressLogs.js');
  const rows = [];
  const buffer = createProgressLogBuffer({
    getClient: () => ({ from: () => ({ upsert: async batch => {
      rows.push(...batch);
      return { error: null };
    } }) }),
    setTimeoutImpl: () => 1,
    clearTimeoutImpl() {}
  });
  t.after(() => buffer.dispose());
  const answer = { user_id: 'failed-reset', session_id: 'pending', question_index: 1 };
  buffer.enqueue(answer);
  await assert.rejects(resetAccountProgress(answer.user_id, async () => {
    throw new Error('Cloud deletion failed');
  }), /Cloud deletion failed/);
  assert.equal((await buffer.flush()).flushedCount, 1);
  assert.deepEqual(rows, [answer]);
});

test('a writer already waiting for a shared lock rechecks another tab reset before uploading', async t => {
  const gate = deferred();
  const queued = deferred();
  browserEnvironment(t, { request: async (_key, { mode }, work) => {
    if (mode === 'shared') { queued.resolve(); await gate.promise; }
    return work();
  } });
  const a = await isolatedTab('waiting-a');
  const b = await isolatedTab('waiting-b');
  let writes = 0;
  const pending = a.coordinator.withAccountProgressWrite('waiting-admin', () => { writes++; });
  await queued.promise;
  await b.coordinator.resetAccountProgress('waiting-admin', async () => {});
  gate.resolve();
  await pending;
  assert.equal(writes, 0);
});

test('reset waits for delayed saves and discards buffered retries before deleting', async () => {
  const { createProgressLogBuffer } = await import('../utils/progressLogs.js');
  const { resetAccountProgress } = await import('../utils/progressWriteCoordinator.js');
  const gate = deferred(); const started = deferred();
  const rows = []; let deleted = false;
  const buffer = createProgressLogBuffer({ getClient: () => ({ from: () => ({ upsert: async batch => {
    started.resolve(); await gate.promise; rows.push(...batch); return { error: null };
  } }) }), flushDelayMs: 600000 });
  buffer.enqueue({ user_id: 'reset-owner', session_id: 'old', question_index: 1 });
  const flush = buffer.flush(); await started.promise;
  buffer.enqueue({ user_id: 'reset-owner', session_id: 'old', question_index: 2 });
  const reset = resetAccountProgress('reset-owner', async () => { deleted = true; rows.length = 0; });
  await Promise.resolve(); assert.equal(deleted, false);
  gate.resolve(); await Promise.all([flush, reset]);
  assert.equal(deleted, true); assert.equal(rows.length, 0);
  assert.equal(buffer.getPendingCount(), 0);
  await buffer.flush(); assert.equal(rows.length, 0);
  buffer.dispose();
});

test('reset also waits for keepalive requests after the ordinary save completes', async () => {
  const { createProgressLogBuffer } = await import('../utils/progressLogs.js');
  const { resetAccountProgress } = await import('../utils/progressWriteCoordinator.js');
  const gate = deferred(); const started = deferred();
  let deleted = false; const rows = [];
  const buffer = createProgressLogBuffer({
    getClient: () => ({ from: () => ({ upsert: async () => ({ error: null }) }) }),
    getAccessToken: () => 'token', getRestConfig: () => ({ url: 'https://example.invalid', key: 'public' }),
    fetchImpl: async (_url, options) => { started.resolve(); await gate.promise; rows.push(...JSON.parse(options.body)); return { ok: true }; }
  });
  buffer.enqueue({ user_id: 'keepalive-owner', session_id: 'old', question_index: 1 });
  const flush = buffer.flush({ keepalive: true }); await started.promise;
  const reset = resetAccountProgress('keepalive-owner', async () => { deleted = true; rows.length = 0; });
  await Promise.resolve(); assert.equal(deleted, false);
  gate.resolve(); await Promise.all([flush, reset]);
  assert.equal(deleted, true); assert.equal(rows.length, 0); buffer.dispose();
});

test('reset clears durable retries and permits new progress after deletion', async () => {
  require('fake-indexeddb/auto');
  const { createProgressLogBuffer } = await import('../utils/progressLogs.js');
  const { resetAccountProgress } = await import('../utils/progressWriteCoordinator.js');
  const storage = await import('../utils/progressStorage.js');
  const gate = deferred(); const started = deferred();
  const remote = [];
  const buffer = createProgressLogBuffer({ getClient: () => ({ from: () => ({ upsert: async rows => {
    started.resolve(); await gate.promise; remote.push(...rows); return { error: null };
  } }) }), flushDelayMs: 600000 });
  const row = { user_id: 'durable-reset', session_id: 'before-reset', question_index: 1 };
  buffer.enqueue(row);
  const flush = buffer.flush(); await started.promise;
  buffer.enqueue({ ...row, question_index: 2 });
  const reset = resetAccountProgress('durable-reset', async () => {
    await storage.clearPendingAccountProgressRows('durable-reset'); remote.length = 0;
  });
  gate.resolve(); await Promise.all([flush, reset]);
  assert.deepEqual(await storage.getPendingAccountProgressRows('durable-reset'), []);
  assert.equal(remote.length, 0);
  buffer.enqueue({ ...row, session_id: 'after-reset' }); await buffer.flush();
  assert.deepEqual(remote.map(entry => entry.session_id), ['after-reset']);
  assert.deepEqual(await storage.getPendingAccountProgressRows('durable-reset'), []);
  buffer.dispose();
});

test('an older reset response preserves a newer observed generation and its pending answer', async () => {
  require('fake-indexeddb/auto');
  const { resetProgressForAccount } = await import('../utils/accountProgress.js');
  const { assertProgressRoundCurrent, getAccountProgressGeneration } = await import('../utils/progressWriteCoordinator.js');
  const { getPendingAccountProgressRows, queueAccountProgressRow } = await import('../utils/progressStorage.js');
  const userId = 'late-reset-response';
  const started = deferred();
  const response = deferred();
  const client = { rpc: async name => {
    if (name !== 'reset_account_progress') return { data: '2', error: null };
    started.resolve();
    return response.promise;
  } };
  const reset = resetProgressForAccount(client, userId, () => true);
  await started.promise;
  assert.equal(await getAccountProgressGeneration(client, userId), '2');
  const base = { user_id: userId, session_id: 'round', question_index: 1 };
  const latestAnswer = { ...base, question_index: 2, reset_generation: '2' };
  await queueAccountProgressRow({ ...base, reset_generation: '0' });
  await queueAccountProgressRow(latestAnswer);
  response.resolve({ data: '1', error: null });
  await reset;
  assert.deepEqual(await getPendingAccountProgressRows(userId), [latestAnswer]);
  assert.doesNotThrow(() => assertProgressRoundCurrent({ resetGeneration: '2' }, userId));
});
