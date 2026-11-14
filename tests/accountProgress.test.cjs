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
  globalThis.accountProgressTestStorage = { countRejectedAccountProgressRows: async () => 0, ...storage };
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
  const acknowledged = [];
  const writes = [];
  const progress = await loadProgress(t, {
    getPendingAccountProgressRows: async () => pending,
    acknowledgeAccountProgressRows: async rows => { acknowledged.push(...rows); }
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
  assert.deepEqual(acknowledged.sort((a, b) => a.question_index - b.question_index), pending);
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

test('replay acknowledges valid answers around a permanently rejected answer', async t => {
  const userId = 'queue-with-invalid-row';
  const rows = [1, 2, 3].map(question_index => ({ user_id: userId, question_index }));
  const saved = [];
  const acknowledged = [];
  const rejected = [];
  const progress = await loadProgress(t, {
    getPendingAccountProgressRows: async () => rows,
    acknowledgeAccountProgressRows: async batch => { acknowledged.push(...batch); },
    rejectAccountProgressRow: async row => { rejected.push(row); },
    countRejectedAccountProgressRows: async () => rejected.length
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => ({ upsert: async batch => {
      if (batch.includes(rows[1])) return { error: { code: '23514' } };
      saved.push(...batch);
      return { error: null };
    } }),
    rpc: async () => ({ data: {}, error: null })
  };
  const snapshot = await progress.loadProgressSnapshot(client, userId, () => true);
  assert.deepEqual(saved, [rows[0], rows[2]]);
  assert.deepEqual(acknowledged, saved);
  assert.deepEqual(rejected, [rows[1]]);
  assert.equal(snapshot.rejectedCount, 1);
});

test('a temporary database failure preserves queued answers without isolating rows', async t => {
  const userId = 'queue-when-offline';
  const progress = await loadProgress(t, {
    getPendingAccountProgressRows: async () => [{ user_id: userId, question_index: 1 }],
    acknowledgeAccountProgressRows: async () => assert.fail('Temporary failure must not acknowledge data'),
    rejectAccountProgressRow: async () => assert.fail('Temporary failure must not reject a row')
  });
  const error = { code: '57014', message: 'Cancelled' };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from: () => ({ upsert: async () => ({ error }) })
  };
  await assert.rejects(progress.replayAccountProgress(client, userId, () => true), failure => failure === error);
});
