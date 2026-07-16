do $$
begin
  if to_regclass('public.employees') is not null then
    alter table public.employees add column if not exists "hourlyWorkDays" jsonb default '[]'::jsonb;
    alter table public.employees add column if not exists "hourlyDaysOff" jsonb default '[]'::jsonb;
    alter table public.employees add column if not exists "vacationAccrualStart" text;
    alter table public.employees add column if not exists "vacationDeadline" text;
  end if;

  if to_regclass('public.funcionarios') is not null then
    alter table public.funcionarios add column if not exists "hourlyWorkDays" jsonb default '[]'::jsonb;
    alter table public.funcionarios add column if not exists "hourlyDaysOff" jsonb default '[]'::jsonb;
    alter table public.funcionarios add column if not exists "vacationAccrualStart" text;
    alter table public.funcionarios add column if not exists "vacationDeadline" text;
  end if;
end $$;
