import { readStorageJson, writeStorageJson } from './browserStorage.js';

export const STALE_PROGRESS_WRITE = 'MM001';
const serverGenerations = new Map();

export async function getAccountProgressGeneration(client, userId) {
  const { data, error } = await client.rpc('get_account_progress_generation', { expected_user_id: userId });
  if (error) throw error;
  rememberServerGeneration(userId, data);
  return String(data);
}

// Web Locks order writes and resets across tabs; storage invalidates queued rows.
const accounts = new Map();
const buffers = new Set();

function accountState(userId) {
  if (!accounts.has(userId)) accounts.set(userId, { generation: 0, writes: new Set(), reset: null });
  return accounts.get(userId);
}

function locked(userId, mode, work) {
  const locks = typeof navigator === 'undefined' ? null : navigator.locks;
  return locks?.request
    ? locks.request(`mental-math-progress:${userId}`, { mode }, work)
    : work();
}

export function getProgressWriteGeneration(userId) {
  return JSON.stringify([
    accountState(userId).generation,
    readStorageJson(`mathtrainer:progress-reset:${userId}`)
  ]);
}

export function registerProgressBuffer(discard) {
  buffers.add(discard);
  return () => buffers.delete(discard);
}

export function withAccountProgressWrite(userId, work, generation = getProgressWriteGeneration(userId)) {
  const state = accountState(userId);
  const write = (state.reset?.catch(() => {}) || Promise.resolve()).then(() => {
    return locked(userId, 'shared', () => {
      // A reset in another tab may have completed while this writer waited.
      if (generation !== null && generation !== getProgressWriteGeneration(userId)) return;
      return work();
    });
  });
  state.writes.add(write);
  const finished = () => state.writes.delete(write);
  void write.then(finished, finished);
  return write;
}

export async function writeBufferedProgress(rows, isCurrent, write) {
  const accounts = new Map();
  for (const row of rows) {
    if (!accounts.has(row.user_id)) accounts.set(row.user_id, []);
    accounts.get(row.user_id).push(row);
  }
  for (const [userId, batch] of accounts) {
    await withAccountProgressWrite(userId, () => {
      return write(batch.filter(isCurrent));
    }, null);
  }
}

export function resetAccountProgress(userId, work, afterReset) {
  const state = accountState(userId);
  if (state.reset) return state.reset;
  const precedingWrites = [...state.writes];
  const reset = Promise.allSettled(precedingWrites)
    .then(() => locked(userId, 'exclusive', async () => {
      const result = await work();
      state.generation += 1;
      const resetId = globalThis.crypto?.randomUUID?.() || `${Date.now()}:${Math.random()}`;
      writeStorageJson(`mathtrainer:progress-reset:${userId}`, resetId);
      if (result !== undefined) rememberServerGeneration(userId, result);
      await Promise.allSettled([...buffers].map(discard => discard(userId)));
      await afterReset?.(result);
      return result;
    }))
    .finally(() => { if (state.reset === reset) state.reset = null; });
  state.reset = reset;
  return reset;
}

export function assertProgressRoundCurrent(round, userId) {
  if (!isProgressRowCurrent({ user_id: userId, reset_generation: round.resetGeneration }, round.writeGeneration)) {
    throw Object.assign(new Error('Account progress was reset during this round. Start a new round.'),
      { code: STALE_PROGRESS_WRITE });
  }
}

export async function saveAccountRound(client, summary, { table, flush, keepalive = false }) {
  const { ownerId, resetGeneration, saveGeneration } = summary;
  const round = { resetGeneration, writeGeneration: saveGeneration };
  const assertCurrent = () => assertProgressRoundCurrent(round, ownerId);
  assertCurrent();
  await flush({ keepalive }).catch(async error => {
    if (error?.code !== STALE_PROGRESS_WRITE) throw error;
    await getAccountProgressGeneration(client, ownerId);
    assertCurrent();
  });
  const count = await countSavedAnswers(client, table, summary);
  assertCurrent();
  if (count === summary.total) return;
  await getAccountProgressGeneration(client, ownerId);
  assertCurrent();
  throw new Error('Some answers have not synced. Retry saving this round or check Progress.');
}

async function countSavedAnswers(client, table, { ownerId, resetGeneration, sessionId, total }) {
  const { count, error } = await client.from(table)
    .select('question_index', { count: 'exact', head: true })
    .eq('user_id', ownerId).eq('session_id', sessionId)
    .eq('reset_generation', resetGeneration).lte('question_index', total);
  if (error) throw error;
  return count;
}

function rememberServerGeneration(userId, generation) {
  serverGenerations.set(userId, { generation: String(generation), local: getProgressWriteGeneration(userId) });
}

export function isProgressRowCurrent(row, queuedGeneration) {
  const local = getProgressWriteGeneration(row.user_id);
  const server = serverGenerations.get(row.user_id);
  if (row.reset_generation === undefined || !server) return queuedGeneration === local;
  if (server.local !== local) return false;
  return String(row.reset_generation) === server.generation;
}
