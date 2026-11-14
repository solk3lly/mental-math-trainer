import { useCallback, useEffect, useRef } from 'react';
import { getAccountProgressGeneration, getProgressWriteGeneration } from './progressWriteCoordinator.js';

export default function useAccountProgressRound(userId, clientRef) {
  const scopeRef = useRef(null);
  if (scopeRef.current?.userId !== userId) scopeRef.current = { userId, request: 0 };
  useEffect(() => {
    const scope = scopeRef.current;
    return () => { scope.request += 1; };
  }, [userId]);

  return useCallback((start, onError, beforeStart = async () => {}) =>
    runAccountRoundStart({ scopeRef, userId, clientRef }, { start, onError, beforeStart }),
  [clientRef, userId]);
}

async function runAccountRoundStart({ scopeRef, userId, clientRef }, { start, onError, beforeStart }) {
  const scope = scopeRef.current;
  if (scope.userId !== userId) return;
  const request = ++scope.request;
  const isCurrent = () => scopeRef.current === scope && scope.request === request;
  try {
    await beforeStart();
    if (!isCurrent()) return;
    const resetGeneration = userId
      ? await getAccountProgressGeneration(clientRef.current, userId) : undefined;
    if (!isCurrent()) return;
    return start({ resetGeneration, writeGeneration: getProgressWriteGeneration(userId) });
  } catch (error) {
    if (isCurrent()) onError(error);
  }
}
