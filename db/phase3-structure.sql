-- Phase 3 — Campus / Class / Arm structure (iVintage College)
-- Safe to run more than once.

-- 1. Campuses -------------------------------------------------------------
create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  address text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.campuses to authenticated;
grant select on public.campuses to anon;
grant all on public.campuses to service_role;
alter table public.campuses enable row level security;

drop policy if exists "campuses readable" on public.campuses;
create policy "campuses readable" on public.campuses for select using (true);
drop policy if exists "campuses managed by admins" on public.campuses;
create policy "campuses managed by admins" on public.campuses
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 2. Class arms (a class stream inside a campus) ---------------------------
create table if not exists public.class_arms (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  capacity integer,
  teacher_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campus_id, class_id, name)
);

grant select, insert, update, delete on public.class_arms to authenticated;
grant select on public.class_arms to anon;
grant all on public.class_arms to service_role;
alter table public.class_arms enable row level security;

drop policy if exists "arms readable" on public.class_arms;
create policy "arms readable" on public.class_arms for select using (true);
drop policy if exists "arms managed by admins" on public.class_arms;
create policy "arms managed by admins" on public.class_arms
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 3. Student placement -----------------------------------------------------
alter table public.students add column if not exists campus_id uuid references public.campuses(id);
alter table public.students add column if not exists arm_id uuid references public.class_arms(id);

create index if not exists students_campus_idx on public.students(campus_id);
create index if not exists students_arm_idx on public.students(arm_id);

-- 4. Movement log ----------------------------------------------------------
create table if not exists public.student_movement_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  from_campus_id uuid,
  to_campus_id uuid,
  from_arm_id uuid,
  to_arm_id uuid,
  moved_by uuid,
  reason text,
  created_at timestamptz not null default now()
);

grant select, insert on public.student_movement_log to authenticated;
grant all on public.student_movement_log to service_role;
alter table public.student_movement_log enable row level security;

drop policy if exists "movement readable by staff" on public.student_movement_log;
create policy "movement readable by staff" on public.student_movement_log
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher'));
drop policy if exists "movement written by admins" on public.student_movement_log;
create policy "movement written by admins" on public.student_movement_log
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.log_student_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (coalesce(new.campus_id::text,'') is distinct from coalesce(old.campus_id::text,''))
     or (coalesce(new.arm_id::text,'') is distinct from coalesce(old.arm_id::text,'')) then
    insert into public.student_movement_log(student_id, from_campus_id, to_campus_id, from_arm_id, to_arm_id, moved_by)
    values (new.id, old.campus_id, new.campus_id, old.arm_id, new.arm_id, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_student_movement on public.students;
create trigger trg_log_student_movement
  after update on public.students
  for each row execute function public.log_student_movement();

-- 5. Seed the two iVintage campuses ----------------------------------------
insert into public.campuses (name, code, address)
values
  ('Ebutte Campus', 'EBT', 'Ebutte, Ikorodu, Lagos'),
  ('Akinsanya Campus', 'AKN', 'Akinsanya Estate, Owode-Ibeshe Road, Ikorodu, Lagos')
on conflict (name) do nothing;
