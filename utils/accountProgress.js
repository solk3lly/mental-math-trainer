import {
  acknowledgeAccountProgressRows, claimGuestSessionImport, clearPendingAccountProgressRows, getGuestHistory,
  recoverInterruptedGuestSessions,
  getPendingAccountProgressRows, markGuestSessionImported
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

async function replayCurrentGeneration(client, userId, batch) {
  const generation = await getAccountProgressGeneration(client, userId);
  const current = batch.filter(row => String(row.reset_generation ?? 0) === generation);
  if (current.length === batch.length) throw new Error('Progress could not sync after checking the latest reset. Refresh to retry.');
  await persistProgressLogBatches(client, current, 500);
}

function sessionAttempts(history, sessionId) {
  return history.attempts.filter(attempt => attempt.sessionId === sessionId)
    .sort((a, b) => a.questionIndex - b.questionIndex);
}

function guestImportRows(attempts, userId, generation) {
  return attempts.map(attempt => ({ ...attempt.row, user_id: userId,
    created_at: attempt.createdAt, reset_generation: generation }));
}

async function replayBatch(client, userId, batch) {
  try {
    await persistProgressLogBatches(client, batch, 500);
  } catch (error) {
    if (error.code !== STALE_PROGRESS_WRITE) throw error;
    await replayCurrentGeneration(client, userId, batch);
  }
  await acknowledgeAccountProgressRows(batch);
}

export function replayAccountProgress(client, userId, isCurrent) {
  return withAccountProgressWrite(userId, async () => {
    const pending = await getPendingAccountProgressRows(userId);
    for (let offset = 0; offset < pending.length; offset += 500) {
      await assertAccount(client, userId, isCurrent);
      await replayBatch(client, userId, pending.slice(offset, offset + 500));
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

export async function loadProgressSnapshot(client, userId, isCurrent) {
  if (!userId) {
    await recoverInterruptedGuestSessions();
    return { dashboard: buildGuestProgressDashboard(await getGuestHistory()), syncError: null };
  }
  let syncError = null;
  try { await replayAccountProgress(client, userId, isCurrent); }
  catch (error) { syncError = error; }
  if (!isCurrent()) return null;
  return { dashboard: await fetchProgressDashboardData(client), syncError };
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
