do $$
begin
  if to_regclass('public.employees') is not null then
    alter table public.employees add column if not exists "hourlyWorkDays" jsonb default '[]'::jsonb;
    alter table public.employees add column if not exists "hourlyDaysOff" jsonb default '[]'::jsonb;
    alter table public.employees add column if not exists "vacationAccrualStart" text;
    alter table public.employees add column if not exists "vacationDeadline" text;
    alter table public.employees add column if not exists "vacationDays" numeric default 0;
    alter table public.employees add column if not exists "history" jsonb default '[]'::jsonb;
    alter table public.employees add column if not exists "tagText" text;
    alter table public.employees add column if not exists "tagColor" text default '#64748b';
  end if;

  if to_regclass('public.funcionarios') is not null then
    alter table public.funcionarios add column if not exists "hourlyWorkDays" jsonb default '[]'::jsonb;
    alter table public.funcionarios add column if not exists "hourlyDaysOff" jsonb default '[]'::jsonb;
    alter table public.funcionarios add column if not exists "vacationAccrualStart" text;
    alter table public.funcionarios add column if not exists "vacationDeadline" text;
    alter table public.funcionarios add column if not exists "vacationDays" numeric default 0;
    alter table public.funcionarios add column if not exists "history" jsonb default '[]'::jsonb;
    alter table public.funcionarios add column if not exists "tagText" text;
    alter table public.funcionarios add column if not exists "tagColor" text default '#64748b';
  end if;

  if to_regclass('public.sectors') is not null then
    alter table public.sectors add column if not exists "roleSalaries" jsonb default '{}'::jsonb;
    alter table public.sectors add column if not exists "employeeTags" jsonb default '[]'::jsonb;
  end if;

  if to_regclass('public.setores') is not null then
    alter table public.setores add column if not exists "roleSalaries" jsonb default '{}'::jsonb;
    alter table public.setores add column if not exists "employeeTags" jsonb default '[]'::jsonb;
  end if;
end $$;
