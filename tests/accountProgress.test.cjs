const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadProgress(t, storage) {
  const filename = path.resolve(__dirname, '../utils/accountProgress.js');
  let source = fs.readFileSync(filename, 'utf8').replace(/^import \{([\s\S]*?)\} from '\.\/progressStorage.js';/,
    (_match, names) => `const {${names}} = globalThis.accountProgressTestStorage;`);
  source = source.replace(/from '(\.\/[^']+)'/g, (_match, name) =>
    `from '${new URL(name, pathToFileURL(filename)).href}'`);
  globalThis.accountProgressTestStorage = storage;
  t.after(() => { delete globalThis.accountProgressTestStorage; });
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#' + Math.random());
}

test('a pending-queue failure leaves readable cloud history available with a sync warning', async t => {
  const progress = await loadProgress(t, { getPendingAccountProgressRows: async () => { throw new Error('Queue unavailable'); } });
  const client = { rpc: async () => ({ data: { overview: { totalAttempts: 9 } }, error: null }) };
  const snapshot = await progress.loadProgressSnapshot(client, 'readable-history', () => true);
  assert.equal(snapshot.dashboard.overview.totalAttempts, 9);
  assert.equal(snapshot.syncError.message, 'Queue unavailable');
});

test('replay retires stale reset rows and saves the current generation from the same batch', async t => {
  const pending = [{ user_id: 'replay-generation', reset_generation: '0', question_index: 1 },
    { user_id: 'replay-generation', reset_generation: '1', question_index: 2 }];
  let acknowledged;
  const writes = [];
  const progress = await loadProgress(t, {
    getPendingAccountProgressRows: async () => pending,
    acknowledgeAccountProgressRows: async rows => { acknowledged = rows; }
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'replay-generation' } }, error: null }) },
    rpc: async () => ({ data: '1', error: null }),
    from: () => ({ upsert: async rows => {
      if (rows.some(row => row.reset_generation === '0')) return { error: { code: 'MM001' } };
      writes.push(...rows); return { error: null };
    } })
  };
  await progress.replayAccountProgress(client, 'replay-generation', () => true);
  assert.deepEqual(writes, [pending[1]]);
  assert.deepEqual(acknowledged, pending);
});

test('an account change stops import before claiming or uploading a guest session', async t => {
  const progress = await loadProgress(t, { getGuestHistory: async () => ({ sessions: [{ id: 'guest' }] }) });
  const client = {
    rpc: async () => ({ data: '0', error: null }),
    auth: { getUser: async () => ({ data: { user: { id: 'import-original' } }, error: null }) }
  };
  await assert.rejects(progress.importGuestProgress({ client, userId: 'import-original',
    history: { sessions: [{ id: 'guest' }] }, isCurrent: () => false }), /account changed/);
});
