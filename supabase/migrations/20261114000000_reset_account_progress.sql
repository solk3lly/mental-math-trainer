create table if not exists public.account_progress_resets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reset_at timestamptz not null,
  generation bigint not null default 0 check (generation >= 0)
);

alter table public.account_progress_resets enable row level security;
revoke all on table public.account_progress_resets from public, anon, authenticated;

create or replace function public.get_account_progress_generation(expected_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from expected_user_id then
    raise exception 'The account changed.' using errcode = '42501';
  end if;
  return coalesce((select generation::text from public.account_progress_resets where user_id = expected_user_id), '0');
end;
$$;

revoke all on function public.get_account_progress_generation(uuid) from public, anon, authenticated;
grant execute on function public.get_account_progress_generation(uuid) to authenticated;

create or replace function public.reset_account_progress(expected_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  next_generation bigint;
begin
  if owner_id is null or owner_id is distinct from expected_user_id then
    raise exception 'The account changed before progress could be reset.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mental-math-progress:' || owner_id::text, 0));
  delete from public.progress_logs where user_id = owner_id;
  delete from public.ai_mode_logs where user_id = owner_id;

  insert into public.account_progress_resets (user_id, reset_at, generation)
  values (owner_id, clock_timestamp(), 1)
  on conflict (user_id) do update set reset_at = excluded.reset_at,
    generation = account_progress_resets.generation + 1
  returning generation into next_generation;
  return next_generation::text;
end;
$$;

revoke all on function public.reset_account_progress(uuid) from public, anon, authenticated;
grant execute on function public.reset_account_progress(uuid) to authenticated;

alter table public.progress_logs add column if not exists reset_generation bigint not null default 0;
alter table public.ai_mode_logs add column if not exists reset_generation bigint not null default 0;

create or replace function public.reject_progress_before_reset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_generation bigint;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('mental-math-progress:' || new.user_id::text, 0));
  select generation into current_generation from public.account_progress_resets where user_id = new.user_id;
  if new.reset_generation <> coalesce(current_generation, 0) then
    raise exception 'Progress was reset after this answer.' using errcode = 'MM001';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_progress_before_reset() from public, anon, authenticated;

drop trigger if exists reject_progress_before_reset on public.progress_logs;
create trigger reject_progress_before_reset before insert on public.progress_logs
  for each row execute function public.reject_progress_before_reset();

drop trigger if exists reject_progress_before_reset on public.ai_mode_logs;
create trigger reject_progress_before_reset before insert on public.ai_mode_logs
  for each row execute function public.reject_progress_before_reset();
