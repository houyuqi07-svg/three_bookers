create table if not exists public.app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, state)
values ('main', '{"people":[]}'::jsonb)
on conflict (id) do nothing;
