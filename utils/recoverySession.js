const STORAGE_KEY = 'mental-math-recovery';
const RECOVERY_LIFETIME_MS = 30 * 60 * 1000;

function sessionIdentity(session) {
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).session_id || null;
  } catch (_error) {
    return null;
  }
}

export function createRecoverySession(session, now = Date.now()) {
  const sessionId = sessionIdentity(session);
  return session?.user?.id && sessionId
    ? { userId: session.user.id, sessionId, expiresAt: now + RECOVERY_LIFETIME_MS }
    : null;
}

export function matchesRecoverySession(recovery, session, now = Date.now()) {
  return Boolean(recovery && recovery.expiresAt > now &&
    recovery.userId === session?.user?.id && recovery.sessionId === sessionIdentity(session));
}

export function recoveryAfterAuthEvent(previous, event, session) {
  if (event === 'PASSWORD_RECOVERY') return createRecoverySession(session);
  return matchesRecoverySession(previous, session) ? previous : null;
}

export function readRecoverySession() {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));
  } catch (_error) {
    return null;
  }
}

export function storeRecoverySession(recovery) {
  try {
    if (recovery) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(recovery));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // The authenticated recovery can continue in memory when storage is unavailable.
  }
}
