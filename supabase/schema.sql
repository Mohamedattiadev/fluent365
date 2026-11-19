-- Fluent365: optional cloud backup for Pocket (Sign in with Google).
-- Run once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- One row per learner. Row Level Security: each signed-in learner can read and change only
-- their own row; the public anon key alone can read nothing. Safe to run again.

create table if not exists public.backups (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

drop policy if exists "own backup: select" on public.backups;
drop policy if exists "own backup: insert" on public.backups;
drop policy if exists "own backup: update" on public.backups;
drop policy if exists "own backup: delete" on public.backups;

create policy "own backup: select" on public.backups for select to authenticated using (user_id = auth.uid());
create policy "own backup: insert" on public.backups for insert to authenticated with check (user_id = auth.uid());
create policy "own backup: update" on public.backups for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own backup: delete" on public.backups for delete to authenticated using (user_id = auth.uid());

-- Only signed-in users get table rights; anonymous visitors get none.
revoke all on public.backups from anon;
grant select, insert, update, delete on public.backups to authenticated;

-- Keep-alive: a free Supabase project is paused after ~1 week without activity. The workflow
-- .github/workflows/supabase-keepalive.yml calls this every 2 days with the public anon key.
-- It runs a real database query but returns only the server time: no table, no learner data.
create or replace function public.keepalive() returns timestamptz
  language sql stable security invoker set search_path = ''
  as $$ select now() $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
