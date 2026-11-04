-- =====================================================================
--  МИМ Дафтар — database for Supabase (PostgreSQL)
--  How to use: Supabase → SQL Editor → New query → paste this WHOLE
--  file → Run. Safe to run again later: it never deletes data.
-- =====================================================================

-- (gen_random_uuid() is built into PostgreSQL, no extension needed)

-- ---------------------------------------------------------------------
-- 1. MEMBERS — the only people allowed to use the app (your parents).
--    A login account alone is NOT enough; it must also be added here
--    (README step 5). This is the main lock on the data.
-- ---------------------------------------------------------------------
create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text,
  created_at timestamptz not null default now()
);

create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- ---------------------------------------------------------------------
-- 2. SETTINGS — one row: price, stock, napkin size, paper, packaging
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  business      text          not null default 'МИМ',
  currency      text          not null default 'смн',
  default_price numeric(12,2) not null default 0,    -- usual price of 1 pack
  start_stock   numeric(12,2) not null default 0,    -- packs at the start
  min_stock     numeric(12,2) not null default 0,    -- warn when packs below this
  updated_at    timestamptz   not null default now()
);
-- napkin and paper details (used for the calculations)
alter table public.settings add column if not exists napkin_size_cm  numeric(6,2)  not null default 24;  -- unfolded sheet side, cm
alter table public.settings add column if not exists sheets_per_pack int           not null default 100;
alter table public.settings add column if not exists gsm             numeric(6,2)  not null default 17;  -- paper g/m²
alter table public.settings add column if not exists ply             int           not null default 1;
alter table public.settings add column if not exists waste_pct       numeric(5,2)  not null default 3;   -- cutting waste + core
alter table public.settings add column if not exists pack_cost       numeric(12,2) not null default 0;   -- bag/film per pack
alter table public.settings add column if not exists min_paper_kg    numeric(12,2) not null default 0;   -- warn when paper below
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3. JUMBO ROLLS — every big paper roll bought
--    status: 'stock' = not opened yet, 'use' = on the machine, 'done' = finished
-- ---------------------------------------------------------------------
create table if not exists public.rolls (
  id            uuid primary key default gen_random_uuid(),
  label         int           not null,                 -- roll number written on the roll: 1, 2, 3...
  date          date          not null default current_date,
  supplier      text,
  weight_kg     numeric(10,2) not null check (weight_kg > 0),
  cost          numeric(14,2) not null default 0 check (cost >= 0),
  gsm           numeric(6,2),
  status        text          not null default 'stock' check (status in ('stock','use','done')),
  finished_date date,
  leftover_kg   numeric(10,2) not null default 0 check (leftover_kg >= 0),
  note          text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz   not null default now()
);

-- ---------------------------------------------------------------------
-- 4. CLIENTS — restaurants and cafes
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  price      numeric(12,2),        -- this client's own price (empty = usual)
  note       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. PRODUCTION — packs made, and from which roll
-- ---------------------------------------------------------------------
create table if not exists public.production (
  id         uuid primary key default gen_random_uuid(),
  date       date          not null default current_date,
  qty        numeric(12,2) not null check (qty > 0),
  note       text,
  created_by uuid default auth.uid(),
  created_at timestamptz   not null default now()
);
alter table public.production add column if not exists roll_id uuid references public.rolls(id) on delete set null;

-- ---------------------------------------------------------------------
-- 6. SALES — packs sold. total is calculated by the database.
-- ---------------------------------------------------------------------
create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  date        date          not null default current_date,
  customer_id uuid references public.customers(id) on delete set null,
  qty         numeric(12,2) not null check (qty > 0),
  price       numeric(12,2) not null check (price >= 0),
  total       numeric(14,2) generated always as (round(qty * price, 2)) stored,
  paid        numeric(14,2) not null default 0 check (paid >= 0),
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz   not null default now(),
  constraint paid_not_more_than_total check (paid <= round(qty * price, 2))
);

-- ---------------------------------------------------------------------
-- 7. PAYMENTS — money a client paid later for a debt
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  date        date          not null default current_date,
  customer_id uuid references public.customers(id) on delete set null,
  amount      numeric(14,2) not null check (amount > 0),
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz   not null default now()
);

-- ---------------------------------------------------------------------
-- 8. EXPENSES — salary, electricity, rent, transport, bags...
--    (jumbo rolls are NOT here: they are in "rolls" with their price)
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  date       date          not null default current_date,
  category   text          not null default 'other',
  amount     numeric(14,2) not null check (amount > 0),
  note       text,
  created_by uuid default auth.uid(),
  created_at timestamptz   not null default now()
);

-- Faster searches
create index if not exists sales_date_idx      on public.sales (date);
create index if not exists sales_customer_idx  on public.sales (customer_id);
create index if not exists payments_date_idx   on public.payments (date);
create index if not exists expenses_date_idx   on public.expenses (date);
create index if not exists production_date_idx on public.production (date);
create index if not exists production_roll_idx on public.production (roll_id);
create index if not exists rolls_date_idx      on public.rolls (date);

-- ---------------------------------------------------------------------
-- 9. SECURITY (Row Level Security)
--    Nobody can read or change anything unless they are logged in AND
--    listed in "members". Not logged in = sees nothing at all.
-- ---------------------------------------------------------------------
alter table public.members    enable row level security;
alter table public.settings   enable row level security;
alter table public.rolls      enable row level security;
alter table public.customers  enable row level security;
alter table public.production enable row level security;
alter table public.sales      enable row level security;
alter table public.payments   enable row level security;
alter table public.expenses   enable row level security;

-- A member can only see their own membership row. Nobody can add
-- members from the app — only you, in the Supabase dashboard.
drop policy if exists "see own membership" on public.members;
create policy "see own membership" on public.members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "members only" on public.settings;
create policy "members only" on public.settings
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members only" on public.rolls;
create policy "members only" on public.rolls
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members only" on public.customers;
create policy "members only" on public.customers
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members only" on public.production;
create policy "members only" on public.production
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members only" on public.sales;
create policy "members only" on public.sales
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members only" on public.payments;
create policy "members only" on public.payments
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members only" on public.expenses;
create policy "members only" on public.expenses
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- Done. Next: README step 3 (turn off sign-ups), step 4 (create your
-- parents' logins) and step 5 (add them to members).
