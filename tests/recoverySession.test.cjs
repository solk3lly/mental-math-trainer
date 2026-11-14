const test = require('node:test');
const assert = require('node:assert/strict');

test('recovery expires and follows the originating login through token refresh', async () => {
  const { createRecoverySession, matchesRecoverySession } = await import('../utils/recoverySession.js');
  const session = (owner, sessionId, extra = {}) => ({ user: { id: owner },
    access_token: `header.${Buffer.from(JSON.stringify({ session_id: sessionId, ...extra })).toString('base64url')}.sig` });
  const original = session('account-a', 'login-a');
  const marker = createRecoverySession(original, 1000);
  assert.equal(matchesRecoverySession(marker, session('account-a', 'login-a', { exp: 6000 }), 2000), true);
  assert.equal(matchesRecoverySession(marker, session('account-b', 'login-b'), 2000), false);
  assert.equal(matchesRecoverySession(marker, session('account-a', 'later-login'), 2000), false);
  assert.equal(matchesRecoverySession(marker, original, marker.expiresAt), false);
  assert.equal(matchesRecoverySession('1', original, 2000), false);
  assert.equal(createRecoverySession(null), null);
});
