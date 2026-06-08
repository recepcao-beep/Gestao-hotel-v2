-- GESTÃO HOTEL V2 — PREPARAÇÃO E REPARO DO CONTROLE DE ENXOVAL
-- Execute este arquivo uma única vez no SQL Editor do MESMO projeto Supabase conectado à Vercel.
-- O script é incremental: não apaga registros existentes.

begin;

-- Configurações do aplicativo por hotel
create table if not exists public.config (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists config_hotel_name_idx on public.config (hotel_name);

-- Cadastro e saldo atual dos itens de enxoval
create table if not exists public.linenitems (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists linenitems_hotel_name_idx on public.linenitems (hotel_name);

-- Histórico de entradas, avarias, recuperações, reciclagens, extravios e baixas
create table if not exists public.linenhistory (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists linenhistory_hotel_name_idx on public.linenhistory (hotel_name);

-- Fechamentos mensais para acompanhar a progressão do inventário
create table if not exists public.linenmonthlyinventories (
  id text primary key,
  hotel_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists linenmonthlyinventories_hotel_name_idx on public.linenmonthlyinventories (hotel_name);

-- O servidor utiliza SUPABASE_SERVICE_ROLE_KEY. A service role acessa as tabelas pelo backend.
alter table public.config enable row level security;
alter table public.linenitems enable row level security;
alter table public.linenhistory enable row level security;
alter table public.linenmonthlyinventories enable row level security;

grant select, insert, update, delete on table public.config to service_role;
grant select, insert, update, delete on table public.linenitems to service_role;
grant select, insert, update, delete on table public.linenhistory to service_role;
grant select, insert, update, delete on table public.linenmonthlyinventories to service_role;

commit;

-- Solicita ao PostgREST a atualização imediata do cache do esquema.
notify pgrst, 'reload schema';

-- DIAGNÓSTICO FINAL: as quatro colunas devem retornar true.
select
  to_regclass('public.config') is not null as config_ok,
  to_regclass('public.linenitems') is not null as linenitems_ok,
  to_regclass('public.linenhistory') is not null as linenhistory_ok,
  to_regclass('public.linenmonthlyinventories') is not null as linenmonthlyinventories_ok;
