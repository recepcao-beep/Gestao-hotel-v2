-- Execute este script uma única vez no SQL Editor do Supabase antes de publicar
-- a versão com o módulo Controle de Enxoval.
-- O backend usa a service role no servidor; o RLS bloqueia acesso direto anônimo.

create table if not exists public.linenitems (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists linenitems_hotel_name_idx
  on public.linenitems (hotel_name);

create table if not exists public.linenhistory (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists linenhistory_hotel_name_idx
  on public.linenhistory (hotel_name);

alter table public.linenitems enable row level security;
alter table public.linenhistory enable row level security;

-- Histórico das contagens físicas mensais do enxoval.
create table if not exists public.linenmonthlyinventories (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists linenmonthlyinventories_hotel_name_idx
  on public.linenmonthlyinventories (hotel_name);

alter table public.linenmonthlyinventories enable row level security;
