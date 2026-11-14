-- BEFORE INSERT triggers run before INSERT policies check the proposed row.
create or replace function public.reject_progress_before_reset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_generation bigint;
begin
  if (current_setting('role', true) in ('anon', 'authenticated') or session_user in ('anon', 'authenticated'))
    and (auth.uid() is null or auth.uid() is distinct from new.user_id) then
    raise exception 'Progress does not belong to the signed-in account.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('mental-math-progress:' || new.user_id::text, 0));
  select generation into current_generation from public.account_progress_resets where user_id = new.user_id;
  if new.reset_generation <> coalesce(current_generation, 0) then
    raise exception 'Progress was reset after this answer.' using errcode = 'MM001';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_progress_before_reset() from public, anon, authenticated;

-- Data API privileges and row-level policies are both required.
grant select, insert, update on table public.user_preferences, public.mixed_trainer_preferences
  to authenticated;

grant select, insert on table public.progress_logs, public.ai_mode_logs
  to authenticated;
