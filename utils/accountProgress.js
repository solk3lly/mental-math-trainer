import {
  acknowledgeAccountProgressRows, claimGuestSessionImport, clearPendingAccountProgressRows, getGuestHistory,
  getGuestSessionForImport, recoverInterruptedGuestSessions,
  countRejectedAccountProgressRows, getPendingAccountProgressRows, markGuestSessionImported, rejectAccountProgressRow
} from './progressStorage.js';
import { buildGuestProgressDashboard, fetchProgressDashboardData } from './progressDashboard.js';
import { persistAiModeLogBatches } from './aiModeLogs.js';
import { persistProgressLogBatches } from './progressLogs.js';
import { getAccountProgressGeneration, getProgressWriteGeneration, resetAccountProgress, STALE_PROGRESS_WRITE, withAccountProgressWrite } from './progressWriteCoordinator.js';

async function assertAccount(client, userId, isCurrent) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data?.user?.id !== userId || !isCurrent()) {
    throw new Error('Sync stopped because the account changed. Sign in to the original account and retry.');
  }
}

const ROW_REJECTION_CODES = new Set(['22P02', '22001', '22003', '22007', '22008', '23502', '23514']);
const PROGRESS_BATCH_SIZE = 500;

function guestImportRows(attempts, userId, generation, kind) {
  return attempts.map(attempt => ({ ...attempt.row, user_id: userId,
    ...(kind === 'mixed' ? { trainer_kind: 'mixed' } : {}),
    created_at: attempt.createdAt, reset_generation: generation }));
}

function splitBatch(batch) {
  const middle = Math.floor(batch.length / 2);
  return [batch.slice(0, middle), batch.slice(middle)];
}

async function replayBatch({ client, userId, isCurrent }, batch) {
  if (!batch.length) return;
  if (!isCurrent()) throw new Error('Sync stopped because the account changed.');
  const persist = batch[0].source_kind ? persistAiModeLogBatches : persistProgressLogBatches;
  try {
    await persist(client, batch, PROGRESS_BATCH_SIZE);
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
  await acknowledgeAccountProgressRows(batch.filter(row => BigInt(row.reset_generation ?? 0) < BigInt(generation)));
}

export function replayAccountProgress(client, userId, isCurrent, { retryRejected = false } = {}) {
  return withAccountProgressWrite(userId, async () => {
    const pending = await getPendingAccountProgressRows(userId, { includeRejected: retryRejected });
    const scope = { client, userId, isCurrent };
    for (const rows of [pending.filter(row => !row.source_kind), pending.filter(row => row.source_kind)]) {
      for (let offset = 0; offset < rows.length; offset += PROGRESS_BATCH_SIZE) {
        await assertAccount(client, userId, isCurrent);
        await replayBatch(scope, rows.slice(offset, offset + PROGRESS_BATCH_SIZE));
      }
    }
    return pending.length > 0;
  });
}

async function importSession(session, { client, userId, generation, isCurrent }) {
  await assertAccount(client, userId, isCurrent);
  const fresh = await getGuestSessionForImport(session.id);
  if (!fresh?.attempts.length) return;
  const importGeneration = await claimGuestSessionImport(session.id, userId, generation);
  for (let offset = 0; offset < fresh.attempts.length; offset += PROGRESS_BATCH_SIZE) {
    await assertAccount(client, userId, isCurrent);
    const rows = guestImportRows(fresh.attempts.slice(offset, offset + PROGRESS_BATCH_SIZE),
      userId, importGeneration, fresh.kind);
    await persistProgressLogBatches(client, rows, PROGRESS_BATCH_SIZE);
  }
  if (!isCurrent()) throw new Error('Import stopped because the account changed.');
  await markGuestSessionImported(session.id, userId);
}

export async function importGuestProgress({ client, userId, history, isCurrent }) {
  const writeGeneration = getProgressWriteGeneration(userId);
  const work = () => withAccountProgressWrite(userId, async () => {
    const generation = await getAccountProgressGeneration(client, userId);
    for (const session of history.sessions) {
      await importSession(session, { client, userId, generation, isCurrent });
    }
    return true;
  }, writeGeneration);
  const imported = globalThis.navigator?.locks?.request
    ? await navigator.locks.request('mental-math-guest-import', work)
    : await work();
  if (!imported) throw new Error('Account progress was reset before the import. Retry importing device history.');
}

export async function loadProgressSnapshot(client, userId, isCurrent, { onDashboard = () => {}, ...options } = {}) {
  if (!userId) {
    await recoverInterruptedGuestSessions();
    return { dashboard: buildGuestProgressDashboard(await getGuestHistory()), syncError: null };
  }
  const replay = replayAccountProgress(client, userId, isCurrent, options).then(
    changed => ({ changed, syncError: null }),
    syncError => ({ changed: true, syncError })
  );
  const dashboard = await fetchProgressDashboardData(client);
  if (!isCurrent()) return null;
  onDashboard(dashboard);
  const { changed, syncError } = await replay;
  const rejectedCount = await countRejectedAccountProgressRows(userId).catch(() => 0);
  if (!isCurrent()) return null;
  return changed
    ? fetchProgressDashboardData(client).then(
      refreshed => ({ dashboard: refreshed, syncError, rejectedCount }),
      error => ({ dashboard, syncError: syncError || error, rejectedCount })
    )
    : { dashboard, syncError, rejectedCount };
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
