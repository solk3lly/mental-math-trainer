const test = require('node:test');
const assert = require('node:assert/strict');

test('independent device edits preserve both fields and insert races preserve the winning defaults', async () => {
  const { changedPreferenceFields, persistPreferencePatch } = await import('../utils/preferenceWrites.js');
  let row = { user_id: 'account', theme_key: 'first', display_mode: 'light' };
  const original = { ...row };
  const client = { from: () => ({
    update: patch => ({ eq: () => ({ select: () => ({ maybeSingle: async () => {
      if (row) row = { ...row, ...patch };
      return { data: row, error: null };
    } }) }) }),
    upsert: async () => {
      row = { user_id: 'account', theme_key: 'another-device', display_mode: 'light' };
      return { error: null };
    }
  }) };
  await persistPreferencePatch(client, { table: 'preferences', columns: '*', userId: 'account',
    patch: changedPreferenceFields(original, { ...original, theme_key: 'second' }), initialRow: original });
  await persistPreferencePatch(client, { table: 'preferences', columns: '*', userId: 'account',
    patch: changedPreferenceFields(original, { ...original, display_mode: 'dark' }), initialRow: original });
  assert.deepEqual(row, { user_id: 'account', theme_key: 'second', display_mode: 'dark' });
  row = null;
  await persistPreferencePatch(client, { table: 'preferences', columns: '*', userId: 'account',
    patch: { display_mode: 'dark' }, initialRow: original });
  assert.deepEqual(row, { user_id: 'account', theme_key: 'another-device', display_mode: 'dark' });
});
