create extension if not exists pg_cron;

create index if not exists progress_logs_retention_idx on public.progress_logs (created_at);
create index if not exists ai_mode_logs_retention_idx on public.ai_mode_logs (created_at);

create or replace function public.prune_expired_progress()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.progress_logs where created_at < now() - interval '90 days';
  delete from public.ai_mode_logs where created_at < now() - interval '90 days';
$$;

revoke all on function public.prune_expired_progress() from public, anon, authenticated;

select cron.schedule(
  'mental-math-progress-retention',
  '17 * * * *',
  'select public.prune_expired_progress()'
);
