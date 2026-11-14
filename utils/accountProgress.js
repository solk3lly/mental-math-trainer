import {
  acknowledgeAccountProgressRows, claimGuestSessionImport, clearPendingAccountProgressRows, getGuestHistory,
  recoverInterruptedGuestSessions,
  countRejectedAccountProgressRows, getPendingAccountProgressRows, markGuestSessionImported, rejectAccountProgressRow
} from './progressStorage.js';
import { buildGuestProgressDashboard, fetchProgressDashboardData } from './progressDashboard.js';
import { persistProgressLogBatches } from './progressLogs.js';
import { getAccountProgressGeneration, resetAccountProgress, STALE_PROGRESS_WRITE, withAccountProgressWrite } from './progressWriteCoordinator.js';

async function assertAccount(client, userId, isCurrent) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data?.user?.id !== userId || !isCurrent()) {
    throw new Error('Sync stopped because the account changed. Sign in to the original account and retry.');
  }
}

const ROW_REJECTION_CODES = new Set(['22P02', '22001', '22003', '22007', '22008', '23502', '23514']);
const PROGRESS_BATCH_SIZE = 500;

function sessionAttempts(history, sessionId) {
  return history.attempts.filter(attempt => attempt.sessionId === sessionId)
    .sort((a, b) => a.questionIndex - b.questionIndex);
}

function guestImportRows(attempts, userId, generation) {
  return attempts.map(attempt => ({ ...attempt.row, user_id: userId,
    created_at: attempt.createdAt, reset_generation: generation }));
}

function splitBatch(batch) {
  const middle = Math.floor(batch.length / 2);
  return [batch.slice(0, middle), batch.slice(middle)];
}

async function replayBatch({ client, userId, isCurrent }, batch) {
  if (!batch.length) return;
  if (!isCurrent()) throw new Error('Sync stopped because the account changed.');
  try {
    await persistProgressLogBatches(client, batch, PROGRESS_BATCH_SIZE);
  } catch (error) {
    return recoverRejectedBatch({ client, userId, isCurrent }, batch, error);
  }
  await acknowledgeAccountProgressRows(batch);
}

async function recoverRejectedBatch(scope, batch, error) {
  if (error.code === STALE_PROGRESS_WRITE) return replayAfterReset(scope, batch, error);
  if (!ROW_REJECTION_CODES.has(error.code)) throw error;
  if (batch.length === 1) return rejectAccountProgressRow(batch[0]);
  for (const part of splitBatch(batch)) await replayBatch(scope, part);
}

async function replayAfterReset(scope, batch, error) {
  const generation = await getAccountProgressGeneration(scope.client, scope.userId);
  const isCurrentRow = row => String(row.reset_generation ?? 0) === generation;
  const current = batch.filter(isCurrentRow);
  if (current.length === batch.length) throw error;
  await replayBatch(scope, current);
  await acknowledgeAccountProgressRows(batch.filter(row => !isCurrentRow(row)));
}

export function replayAccountProgress(client, userId, isCurrent, { retryRejected = false } = {}) {
  return withAccountProgressWrite(userId, async () => {
    const pending = await getPendingAccountProgressRows(userId, { includeRejected: retryRejected });
    const scope = { client, userId, isCurrent };
    for (let offset = 0; offset < pending.length; offset += PROGRESS_BATCH_SIZE) {
      await assertAccount(client, userId, isCurrent);
      await replayBatch(scope, pending.slice(offset, offset + PROGRESS_BATCH_SIZE));
    }
  });
}

async function importSession(session, { client, userId, generation, isCurrent }) {
  const fresh = await getGuestHistory();
  if (!fresh.sessions.some(entry => entry.id === session.id)) return;
  await assertAccount(client, userId, isCurrent);
  const importGeneration = await claimGuestSessionImport(session.id, userId, generation);
  const attempts = sessionAttempts(fresh, session.id);
  for (let offset = 0; offset < attempts.length; offset += 500) {
    await assertAccount(client, userId, isCurrent);
    const rows = guestImportRows(attempts.slice(offset, offset + 500), userId, importGeneration);
    await persistProgressLogBatches(client, rows, 500);
  }
  if (!isCurrent()) throw new Error('Import stopped because the account changed.');
  await markGuestSessionImported(session.id, userId);
}

export async function importGuestProgress({ client, userId, history, isCurrent }) {
  const work = () => withAccountProgressWrite(userId, async () => {
    const generation = await getAccountProgressGeneration(client, userId);
    for (const session of history.sessions) {
      await importSession(session, { client, userId, generation, isCurrent });
    }
  });
  if (globalThis.navigator?.locks?.request) {
    await navigator.locks.request('mental-math-guest-import', work);
  } else await work();
}

export async function loadProgressSnapshot(client, userId, isCurrent, options) {
  if (!userId) {
    await recoverInterruptedGuestSessions();
    return { dashboard: buildGuestProgressDashboard(await getGuestHistory()), syncError: null };
  }
  let syncError = null;
  try { await replayAccountProgress(client, userId, isCurrent, options); }
  catch (error) { syncError = error; }
  const rejectedCount = await countRejectedAccountProgressRows(userId).catch(() => 0);
  if (!isCurrent()) return null;
  return { dashboard: await fetchProgressDashboardData(client), syncError, rejectedCount };
}

export function resetProgressForAccount(client, userId, isCurrent) {
  return resetAccountProgress(userId, async () => {
    if (!isCurrent()) throw new Error('Reset stopped because the account changed.');
    const { data, error } = await client.rpc('reset_account_progress', { expected_user_id: userId });
    if (error) throw error;
    return data;
  }, generation => clearPendingAccountProgressRows(userId, generation).catch(() => {
    // The server also rejects stale rows if local cleanup fails.
  }));
}
