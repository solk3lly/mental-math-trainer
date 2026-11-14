export function changedPreferenceFields(previous, next) {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) =>
    key !== 'user_id' && key !== 'updated_at' && value !== previous[key]));
}

export function mergePreferenceChanges(pending, changes) {
  const merged = { ...pending, ...changes };
  return Object.keys(merged).length ? merged : null;
}

export async function insertInitialPreferences(client, table, row, columns) {
  const created = await client.from(table).upsert(row, {
    onConflict: 'user_id', ignoreDuplicates: true
  }).select(columns).maybeSingle();
  if (created.error || created.data) return created;
  return client.from(table).select(columns).eq('user_id', row.user_id).maybeSingle();
}

export async function persistPreferencePatch(client, { table, columns, userId, patch, initialRow }) {
  const update = () => client.from(table).update(patch).eq('user_id', userId)
    .select(columns).maybeSingle();
  const result = await update();
  if (result.error || result.data) return result;
  const inserted = await client.from(table).upsert(initialRow, {
    onConflict: 'user_id', ignoreDuplicates: true
  });
  if (inserted.error) return inserted;
  return update();
}
