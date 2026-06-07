-- Execute este script uma única vez no SQL Editor do Supabase antes de publicar
-- a versão com inventário mensal do Controle de Enxoval.
-- As tabelas linenitems e linenhistory já foram criadas pela migração anterior.

create table if not exists public.linenmonthlyinventories (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists linenmonthlyinventories_hotel_name_idx
  on public.linenmonthlyinventories (hotel_name);

alter table public.linenmonthlyinventories enable row level security;
