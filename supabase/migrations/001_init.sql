-- Ủn Ỉn Cả Nhà – schema khởi tạo
-- Cách chạy: Supabase Dashboard → SQL Editor → New query → dán toàn bộ file này → Run.

create extension if not exists pgcrypto with schema extensions;

-- ============ BẢNG ============
create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade, -- 1 tài khoản = 1 gia đình
  name text not null default 'Nhà mình',
  parent_pin_hash text not null,                       -- bcrypt, KHÔNG lưu PIN thô
  golden_start time not null default '19:30',
  golden_end   time not null default '19:45',
  daily_minutes int not null default 10 check (daily_minutes between 1 and 60),
  enforce_golden boolean not null default true,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  role text not null check (role in ('parent','kid')),
  color text not null,
  initial text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  icon text not null,
  coins int not null check (coins between 1 and 200),
  slot text not null check (slot in ('sang','chieu','toi')),
  audience text not null check (audience in ('kid','parent','together')),
  partner text,
  assignee_id uuid references public.members(id),
  active boolean default true,
  created_at timestamptz default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  day date not null,
  status text not null check (status in ('pending','approved','redo')),
  reviewer_id uuid references public.members(id),
  sticker text,
  seen_by_member boolean default false,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  unique (member_id, task_id, day)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  icon text not null,
  cost int not null check (cost > 0),
  tier text not null check (tier in ('nho','vua','lon')),
  active boolean default true
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  status text not null default 'promised' check (status in ('promised','done','cancelled')),
  scheduled_note text,
  created_at timestamptz default now(),
  done_at timestamptz
);

create table public.jar_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  target int not null check (target >= 50),
  status text not null default 'active' check (status in ('active','reached','archived')),
  created_at timestamptz default now()
);

-- Sổ cái Ủn: MỌI biến động đều nằm ở đây, số dư = tổng ledger
create table public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  amount int not null,
  kind text not null check (kind in ('task','judge','redeem','jar','adjust','challenge')),
  ref_id uuid,
  created_at timestamptz default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  member_a uuid not null references public.members(id) on delete cascade,
  member_b uuid not null references public.members(id) on delete cascade,
  target int not null default 5,
  progress_a int not null default 0,
  progress_b int not null default 0,
  linked_task_id uuid references public.tasks(id) on delete set null,
  prize text,
  ends_on date not null,
  status text not null default 'active' check (status in ('active','done')),
  check (member_a <> member_b)
);

create table public.play_sessions (
  member_id uuid not null references public.members(id) on delete cascade,
  day date not null,
  seconds_used int not null default 0,
  primary key (member_id, day)
);

-- Đếm số lần nhập sai PIN (khoá 5 phút nếu sai 5 lần)
create table public.pin_attempts (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  ok boolean not null,
  at timestamptz not null default now()
);

create index on public.members (family_id);
create index on public.submissions (family_id, day);
create index on public.coin_ledger (family_id, member_id, created_at);
create index on public.pin_attempts (family_id, at);

-- ============ BẢO MẬT (RLS) ============
create or replace function public.is_family_owner(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.families f where f.id = fid and f.owner_user_id = auth.uid());
$$;

alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.jar_goals enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.challenges enable row level security;
alter table public.play_sessions enable row level security;
alter table public.pin_attempts enable row level security;

create policy "owner đọc/sửa gia đình" on public.families
  for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner" on public.members       for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "owner" on public.tasks         for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "owner" on public.submissions   for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "owner" on public.rewards       for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "owner" on public.redemptions   for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "owner" on public.jar_goals     for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "owner" on public.challenges    for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "owner đọc sổ cái" on public.coin_ledger for select to authenticated using (public.is_family_owner(family_id));
create policy "owner" on public.play_sessions for all to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and public.is_family_owner(m.family_id)))
  with check (exists (select 1 from public.members m where m.id = member_id and public.is_family_owner(m.family_id)));
-- pin_attempts: không có policy nào => client không đọc/ghi được, chỉ hàm server dùng

-- Client KHÔNG được tự ghi sổ cái, và không đọc/ghi được mã băm PIN
revoke insert, update, delete on public.coin_ledger from authenticated;
revoke select, insert, update on public.families from authenticated;
grant select (id, owner_user_id, name, golden_start, golden_end, daily_minutes, enforce_golden, timezone, created_at)
  on public.families to authenticated;
grant update (name, golden_start, golden_end, daily_minutes, enforce_golden)
  on public.families to authenticated;

-- ============ HÀM SERVER ============

-- Tạo gia đình + thành viên trong 1 lần. p_members: [{"name":"Bố","role":"parent","color":"#FFB27A","initial":"Bố"}, ...]
create or replace function public.create_family(p_name text, p_pin text, p_members jsonb)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  fid uuid;
  m jsonb;
  i int := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) < 1 or jsonb_array_length(p_members) > 12 then
    raise exception 'invalid_members';
  end if;
  if exists (select 1 from public.families where owner_user_id = auth.uid()) then
    raise exception 'family_exists';
  end if;

  insert into public.families (owner_user_id, name, parent_pin_hash)
  values (auth.uid(), left(coalesce(nullif(trim(p_name), ''), 'Nhà mình'), 40), crypt(p_pin, gen_salt('bf')))
  returning id into fid;

  for m in select * from jsonb_array_elements(p_members) loop
    if m->>'role' not in ('parent','kid') then raise exception 'invalid_role'; end if;
    insert into public.members (family_id, name, role, color, initial, sort_order)
    values (fid, left(trim(m->>'name'), 20), m->>'role', m->>'color', left(m->>'initial', 3), i);
    i := i + 1;
  end loop;

  return fid;
end $$;

-- Kiểm tra PIN bố mẹ ở server. Sai 5 lần trong 5 phút thì khoá.
create or replace function public.verify_parent_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  fid uuid;
  h text;
  fails int;
  good boolean;
begin
  select id, parent_pin_hash into fid, h from public.families where owner_user_id = auth.uid();
  if fid is null then raise exception 'no_family'; end if;

  select count(*) into fails from public.pin_attempts
   where family_id = fid and ok = false and at > now() - interval '5 minutes';
  if fails >= 5 then raise exception 'pin_locked'; end if;

  good := (crypt(p_pin, h) = h);
  insert into public.pin_attempts (family_id, ok) values (fid, good);
  if good then
    delete from public.pin_attempts where family_id = fid and ok = false;
  end if;
  return good;
end $$;

-- Đổi PIN (cần PIN cũ)
create or replace function public.set_parent_pin(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_new !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  if not public.verify_parent_pin(p_old) then raise exception 'wrong_pin'; end if;
  update public.families set parent_pin_hash = crypt(p_new, gen_salt('bf')) where owner_user_id = auth.uid();
end $$;

revoke all on function public.create_family(text, text, jsonb) from public, anon;
revoke all on function public.verify_parent_pin(text) from public, anon;
revoke all on function public.set_parent_pin(text, text) from public, anon;
grant execute on function public.create_family(text, text, jsonb) to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;
grant execute on function public.set_parent_pin(text, text) to authenticated;
