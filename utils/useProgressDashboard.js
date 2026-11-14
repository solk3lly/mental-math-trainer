import { useCallback, useEffect, useRef, useState } from 'react';
import { importGuestProgress, loadProgressSnapshot, resetProgressForAccount } from './accountProgress.js';
import { createEmptyProgressDashboard } from './progressDashboard.js';
import { clearGuestHistory, getGuestHistoryForImport } from './progressStorage.js';

function failureMessage(error, fallback) {
  return error?.message || fallback;
}

function observeImportOffer(userId, setOffer) {
  let cancelled = false;
  getGuestHistoryForImport(userId).then(history => {
    if (!cancelled) setOffer(history);
  }).catch(() => { if (!cancelled) setOffer(null); });
  return () => { cancelled = true; };
}

async function runProgressAction(work, onError, onFinished) {
  try { await work(); }
  catch (error) { onError(error); }
  finally { onFinished(); }
}

export default function useProgressDashboard(auth) {
  const { client, user, isLoading: isCheckingAccount } = auth;
  const userId = user?.id ?? null;
  const [dashboardData, setDashboardData] = useState(createEmptyProgressDashboard);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [importOffer, setImportOffer] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importDismissed, setImportDismissed] = useState(false);
  const loadSequenceRef = useRef(0);
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;

  useEffect(() => {
    currentUserIdRef.current = userId;
    return () => { currentUserIdRef.current = undefined; };
  }, [userId]);

  const isCurrent = () => currentUserIdRef.current === userId;
  function applyIfCurrent(action) { if (isCurrent()) action(); }

  const loadLogs = useCallback(async function loadProgressLogs() {
    if (currentUserIdRef.current !== userId) return;
    const sequence = ++loadSequenceRef.current;
    setIsLoading(true);
    setErrorMessage('');
    setSyncError('');

    try {
      const snapshot = await loadProgressSnapshot(client, userId, () => currentUserIdRef.current === userId);
      if (sequence !== loadSequenceRef.current || !snapshot) return;
      setDashboardData(snapshot.dashboard);
      setSyncError(snapshot.syncError ? failureMessage(snapshot.syncError, 'Some pending answers could not sync. Refresh to retry.') : '');
      setIsLoading(false);
    } catch (error) {
      if (sequence !== loadSequenceRef.current) return;
      setDashboardData(createEmptyProgressDashboard());
      setErrorMessage(failureMessage(error, 'Could not load progress data.'));
      setIsLoading(false);
    }
  }, [client, userId]);

  useEffect(() => {
    if (isCheckingAccount) return undefined;
    void loadLogs();
    return () => { loadSequenceRef.current += 1; };
  }, [isCheckingAccount, loadLogs]);

  useEffect(() => {
    if (!userId) {
      setImportOffer(null);
      setImportDismissed(false);
      return undefined;
    }
    return observeImportOffer(userId, setImportOffer);
  }, [userId]);

  const handleClearGuestHistory = async () => {
    if (!window.confirm('Clear saved device history? This does not change your theme or trainer settings.')) return;
    setIsResetting(true);
    return runProgressAction(async () => {
      await clearGuestHistory();
      await loadLogs();
    }, error => setErrorMessage(failureMessage(error, 'Could not clear device history.')),
    () => applyIfCurrent(() => setIsResetting(false)));
  };

  const handleImport = async () => {
    if (!client || !userId) return;
    if (!importOffer || isImporting) return;
    const owner = userId;
    setIsImporting(true);
    setErrorMessage('');
    return runProgressAction(async () => {
      await importGuestProgress({ client, userId: owner, history: importOffer,
        isCurrent: () => currentUserIdRef.current === owner });
      if (currentUserIdRef.current !== owner) return;
      setImportOffer(null);
      await loadLogs();
    }, error => applyIfCurrent(() => setSyncError(failureMessage(error, 'Import failed. Device history is still available to retry.'))),
    () => applyIfCurrent(() => setIsImporting(false)));
  };

  const handleReset = async () => {
    if (!client || !userId) return;
    if (isResetting || isImporting) return;
    if (isLoading) return;

    const shouldReset = window.confirm(
      'Delete all stored progress logs for your account? This cannot be undone.'
    );
    if (!shouldReset) {
      return;
    }

    setIsResetting(true);
    setErrorMessage('');

    return runProgressAction(async () => {
      await resetProgressForAccount(client, userId, isCurrent);
      applyIfCurrent(() => {
        loadSequenceRef.current += 1;
        setDashboardData(createEmptyProgressDashboard());
      });
    }, error => applyIfCurrent(() => setErrorMessage(failureMessage(error, 'Could not reset account progress.'))),
    () => applyIfCurrent(() => setIsResetting(false)));
  };

  return { dashboardData, isLoading, isResetting, errorMessage, syncError, importOffer,
    isImporting, importDismissed, setImportDismissed, loadLogs, handleClearGuestHistory,
    handleImport, handleReset };
}
