-- Phase 4 — Rules-based billing (iVintage College)
-- Safe to run more than once.

-- 1. Fee catalogue ---------------------------------------------------------
create table if not exists public.fee_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.fee_categories(id) on delete set null,
  name text not null,
  amount numeric(12,2) not null default 0,
  is_optional boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- who a fee applies to: campus / class / arm / boarding status, any of which may be null (= all)
create table if not exists public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references public.fees(id) on delete cascade,
  campus_id uuid,
  class_id uuid,
  arm_id uuid,
  student_type text,            -- 'day' | 'boarding' | null for all
  term text,                    -- 'First Term' etc, null = every term
  academic_year text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Invoices --------------------------------------------------------------
create table if not exists public.student_invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null,
  term text not null,
  total_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'open',   -- open | part_paid | paid | cancelled
  issued_at timestamptz not null default now(),
  due_date date,
  created_by uuid,
  unique (student_id, academic_year, term)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.student_invoices(id) on delete cascade,
  fee_id uuid references public.fees(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null default 0,
  is_optional boolean not null default false,
  selected boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_credits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists invoices_student_idx on public.student_invoices(student_id);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- 3. Grants + RLS ----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fee_categories','fees','fee_rules','student_invoices','invoice_items','student_credits'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s staff read" on public.%I', t, t);
    execute format('create policy "%s staff read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s admin write" on public.%I', t, t);
    execute format($p$create policy "%s admin write" on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'))$p$, t, t);
  end loop;
end $$;

-- 4. Keep invoice totals in step with payments -----------------------------
create or replace function public.refresh_invoice_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare inv record;
begin
  select * into inv from public.student_invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if inv.id is null then return coalesce(new, old); end if;
  update public.student_invoices
     set total_amount = coalesce((select sum(amount) from public.invoice_items
                                   where invoice_id = inv.id and (selected or not is_optional)), 0)
   where id = inv.id;
  update public.student_invoices
     set status = case
       when amount_paid <= 0 then 'open'
       when amount_paid >= total_amount then 'paid'
       else 'part_paid' end
   where id = inv.id and status <> 'cancelled';
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_invoice_status on public.invoice_items;
create trigger trg_refresh_invoice_status
  after insert or update or delete on public.invoice_items
  for each row execute function public.refresh_invoice_status();

-- 5. Seed starter categories ----------------------------------------------
insert into public.fee_categories (name, description)
values
  ('Tuition', 'Core termly tuition'),
  ('Development', 'Development and facility levies'),
  ('Boarding', 'Boarding house charges'),
  ('Optional services', 'Transport, extra lessons, clubs')
on conflict (name) do nothing;
