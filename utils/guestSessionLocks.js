const guestSessionLocks = new Map();
const localGuestSessions = new Set();
const GUEST_LOCK_PREFIX = 'mental-math-guest:';

function getLocks() {
  return typeof navigator === 'undefined' ? null : navigator.locks;
}

export async function holdGuestSession(sessionId) {
  const locks = getLocks();
  if (!locks?.request) {
    localGuestSessions.add(sessionId);
    return;
  }
  if (guestSessionLocks.has(sessionId)) return;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const acquired = new Promise((resolve, reject) => {
    locks.request(GUEST_LOCK_PREFIX + sessionId, { ifAvailable: true }, lock => {
      if (!lock) {
        reject(new Error('This guest session is already open in another tab.'));
        return;
      }
      guestSessionLocks.set(sessionId, release);
      resolve();
      return held;
    }).catch(reject);
  });
  await acquired;
}

export function releaseGuestSession(sessionId) {
  localGuestSessions.delete(sessionId);
  guestSessionLocks.get(sessionId)?.();
  guestSessionLocks.delete(sessionId);
}

export async function liveGuestSessions() {
  const snapshot = await getLocks()?.query?.();
  const held = (snapshot?.held || []).map(lock => lock.name)
    .filter(name => name.startsWith(GUEST_LOCK_PREFIX))
    .map(name => name.slice(GUEST_LOCK_PREFIX.length));
  return new Set([...localGuestSessions, ...guestSessionLocks.keys(), ...held]);
}


export function canCoordinateGuestSessions() {
  const locks = getLocks();
  return Boolean(locks?.request && locks.query);
}
