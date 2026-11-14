const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

test('fresh web tables expose only the required operations and account rows', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  const userId = '00000000-0000-0000-0000-000000000001';
  const otherId = '00000000-0000-0000-0000-000000000002';
  const sessionId = '00000000-0000-0000-0000-000000000003';
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    grant usage on schema auth to authenticated, anon;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select '{}'::jsonb
    $$;
    create publication supabase_realtime;
  `);
  const directory = path.resolve(__dirname, '../supabase/migrations');
  for (const file of (await readdir(directory)).sort()) {
    if (!file.endsWith('.sql') || file.includes('schedule_progress_retention')) continue;
    await db.exec(await readFile(path.join(directory, file), 'utf8'));
  }
  await db.query('insert into auth.users values ($1), ($2)', [userId, otherId]);
  const preferenceSql = `insert into public.user_preferences
    (user_id, trainer_operation, trainer_left_digits, trainer_right_digits, trainer_round_size)
    values ($1, 'ADDITION', 2, 2, 10)`;
  await db.query(preferenceSql, [otherId]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.query(preferenceSql, [userId]);
  await db.query('insert into public.mixed_trainer_preferences (user_id) values ($1)', [userId]);
  const updated = await db.query('update public.user_preferences set trainer_round_size = 21 returning user_id');
  assert.deepEqual(updated.rows, [{ user_id: userId }]);
  await db.query(`insert into public.progress_logs (user_id, session_id, question_index, operation, digits_left,
    digits_right, left_operand, right_operand, correct_answer, submitted_answer, is_correct, response_ms)
    values ($1, $2, 1, 'ADDITION', 1, 1, '2', '3', '5', '5', true, 100)
    on conflict (user_id, session_id, question_index) do nothing`, [userId, sessionId]);
  const result = await db.query('select public.get_progress_dashboard_data() as dashboard');
  assert.equal(result.rows[0].dashboard.overview.totalAttempts, 1);
  assert.deepEqual((await db.query('select user_id from public.ai_mode_logs')).rows, []);
  await assert.rejects(db.query('select * from public.account_progress_resets'), { code: '42501' });
  await assert.rejects(db.query('update public.progress_logs set response_ms = 100'), { code: '42501' });
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.progress_logs'), { code: '42501' });
});
