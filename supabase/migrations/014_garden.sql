-- Khu vườn Ủn (bản đầu): mỗi bé một vườn, trồng cây, tưới bằng giọt nước kiếm từ việc được gật đầu, thu hoạch, mua hạt giống, chậu, ô đất
-- Giá ghi thẳng bằng Ủn. Mọi thao tác chạy ở máy chủ và ghi vào sổ Ủn (loại 'garden').

alter table public.families add column if not exists garden_enabled boolean not null default true;
alter table public.families add column if not exists garden_weekly_cap int not null default 300 check (garden_weekly_cap between 0 and 5000);
grant select (garden_enabled, garden_weekly_cap) on public.families to authenticated;
grant update (garden_enabled, garden_weekly_cap) on public.families to authenticated;

alter table public.coin_ledger drop constraint if exists coin_ledger_kind_check;
alter table public.coin_ledger add constraint coin_ledger_kind_check check (kind in ('task', 'judge', 'redeem', 'jar', 'adjust', 'challenge', 'garden'));

-- member_stats (004) đã chỉ tính Ủn kiếm từ việc, giám khảo và kèo, nên quả thu hoạch (loại garden) không đội bảng xếp hạng

-- ============ BẢNG ============
create table if not exists public.gardens (
  member_id uuid primary key references public.members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  started_at timestamptz not null default now(),
  slots int not null default 2 check (slots between 1 and 6)
);
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  species text not null,
  slot int not null check (slot between 1 and 6),
  watered int not null default 0,       -- tiến độ hiện tại của vòng này
  poured int not null default 0,        -- tổng số giọt đã tưới từ lúc trồng (để tính nước còn lại trong bình)
  harvests int not null default 0,
  pot text not null default 'dat',
  planted_at timestamptz not null default now(),
  last_watered_at timestamptz,
  unique (member_id, slot)
);
create table if not exists public.garden_items (
  member_id uuid not null references public.members(id) on delete cascade,
  item text not null,
  family_id uuid not null references public.families(id) on delete cascade,
  primary key (member_id, item)
);
create index if not exists plants_family on public.plants (family_id);

do $$
declare t text;
begin
  foreach t in array array['gardens', 'plants', 'garden_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner đọc" on public.%I', t);
    execute format('create policy "owner đọc" on public.%I for select to authenticated using (public.is_family_owner(family_id))', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
alter publication supabase_realtime add table public.gardens, public.plants, public.garden_items;

-- ============ DANH MỤC (nguồn sự thật; bản sao trong lib/garden.ts có bài test đối chiếu) ============
create or replace function public.garden_species() returns table (id text, price int, need int, fruit int)
language sql immutable set search_path = public as $$
  select * from (values
    ('hy_vong', 0, 40, 20),
    ('cham_chi', 50, 70, 40),
    ('ngoan', 50, 40, 30),
    ('ky_luat', 80, 70, 50),
    ('dung_cam', 80, 70, 50),
    ('kien_nhan', 120, 120, 120)
  ) as t(id, price, need, fruit)
$$;
create or replace function public.garden_pots() returns table (id text, price int)
language sql immutable set search_path = public as $$
  select * from (values ('dat', 0), ('xanh', 30), ('hong', 30), ('sao', 60), ('cau_vong', 100)) as t(id, price)
$$;
-- Giá mở ô thứ n (ô 1 và 2 có sẵn); null = không bán
create or replace function public.garden_slot_price(n int) returns int
language sql immutable as $$ select case n when 3 then 100 when 4 then 200 else null end $$;

-- ============ SỐ LIỆU ============
-- Số giọt nước đã kiếm: mỗi việc được gật đầu 1 giọt, việc làm cùng bố mẹ 2 giọt, tính từ ngày bắt đầu chơi
create or replace function public._garden_earned(p_member uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when t.audience = 'together' then 2 else 1 end), 0)::int
    from public.gardens g
    join public.submissions s on s.member_id = g.member_id and s.status = 'approved'
         and s.day >= (g.started_at at time zone 'Asia/Ho_Chi_Minh')::date
    join public.tasks t on t.id = s.task_id
   where g.member_id = p_member and public.is_family_owner(g.family_id)
$$;
create or replace function public._garden_spent_week(p_member uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(-sum(l.amount), 0)::int
    from public.coin_ledger l join public.members m on m.id = l.member_id
   where l.member_id = p_member and l.kind = 'garden' and l.amount < 0 and public.is_family_owner(m.family_id)
     and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh')
$$;
revoke all on function public._garden_earned(uuid), public._garden_spent_week(uuid) from public, anon;
grant execute on function public._garden_earned(uuid), public._garden_spent_week(uuid) to authenticated;

-- Kiểm tra chung: bé thuộc nhà mình, vườn đang bật, đúng giờ chơi. Khoá dòng thành viên để hai thao tác không chạy chồng nhau.
create or replace function public._garden_guard(p_member uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id(); f public.families%rowtype;
begin
  if fid is null then raise exception 'no_family'; end if;
  perform 1 from public.members where id = p_member and family_id = fid and role = 'kid' for update;
  if not found then raise exception 'invalid_member'; end if;
  select * into f from public.families where id = fid;
  if not f.garden_enabled then raise exception 'garden_off'; end if;
  perform public.assert_kid_can_play(fid, p_member);
  return fid;
end $$;
revoke all on function public._garden_guard(uuid) from public, anon, authenticated;

create or replace function public._garden_balance(p_member uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.coin_ledger where member_id = p_member
$$;
revoke all on function public._garden_balance(uuid) from public, anon, authenticated;

-- Chi tiêu cho vườn: đủ Ủn và không vượt trần mỗi tuần
create or replace function public._garden_spend(fid uuid, p_member uuid, p_price int, p_ref uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cap int;
begin
  select garden_weekly_cap into cap from public.families where id = fid;
  if public._garden_balance(p_member) < p_price then raise exception 'insufficient'; end if;
  if public._garden_spent_week(p_member) + p_price > cap then raise exception 'weekly_cap'; end if;
  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, p_member, -p_price, 'garden', p_ref);
end $$;
revoke all on function public._garden_spend(uuid, uuid, int, uuid) from public, anon, authenticated;

-- ============ THAO TÁC ============
-- Bắt đầu chơi: tạo vườn và trồng sẵn Cây Hy vọng (miễn phí) ở ô 1. Gọi lại không gây hại.
create or replace function public.start_garden(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid := public._garden_guard(p_member); n int;
begin
  insert into public.gardens (member_id, family_id) values (p_member, fid) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.plants (family_id, member_id, species, slot) values (fid, p_member, 'hy_vong', 1) on conflict do nothing;
  end if;
end $$;

create or replace function public.buy_seed(p_member uuid, p_species text, p_slot int) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid := public._garden_guard(p_member); g public.gardens%rowtype; sp record; pid uuid;
begin
  select * into g from public.gardens where member_id = p_member;
  if not found then raise exception 'no_garden'; end if;
  select * into sp from public.garden_species() where id = p_species;
  if not found or sp.price <= 0 then raise exception 'invalid_species'; end if;
  if p_slot < 1 or p_slot > g.slots then raise exception 'invalid_slot'; end if;
  if exists (select 1 from public.plants where member_id = p_member and slot = p_slot) then raise exception 'slot_taken'; end if;
  pid := gen_random_uuid();
  insert into public.plants (id, family_id, member_id, species, slot) values (pid, fid, p_member, p_species, p_slot);
  perform public._garden_spend(fid, p_member, sp.price, pid);
  return pid;
end $$;

create or replace function public.buy_slot(p_member uuid) returns int
language plpgsql security definer set search_path = public as $$
declare fid uuid := public._garden_guard(p_member); g public.gardens%rowtype; price int;
begin
  select * into g from public.gardens where member_id = p_member;
  if not found then raise exception 'no_garden'; end if;
  price := public.garden_slot_price(g.slots + 1);
  if price is null then raise exception 'max_slots'; end if;
  perform public._garden_spend(fid, p_member, price, p_member);
  update public.gardens set slots = slots + 1 where member_id = p_member;
  return g.slots + 1;
end $$;

create or replace function public.buy_pot(p_member uuid, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid := public._garden_guard(p_member); price int;
begin
  if not exists (select 1 from public.gardens where member_id = p_member) then raise exception 'no_garden'; end if;
  select p.price into price from public.garden_pots() p where p.id = p_item;
  if price is null or price <= 0 then raise exception 'invalid_item'; end if;
  if exists (select 1 from public.garden_items where member_id = p_member and item = p_item) then raise exception 'already_owned'; end if;
  perform public._garden_spend(fid, p_member, price, p_member);
  insert into public.garden_items (member_id, item, family_id) values (p_member, p_item, fid);
end $$;

create or replace function public.set_pot(p_plant uuid, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare pl public.plants%rowtype;
begin
  select * into pl from public.plants where id = p_plant and family_id = public.my_family_id();
  if not found then raise exception 'invalid_plant'; end if;
  perform public._garden_guard(pl.member_id);
  if not exists (select 1 from public.garden_pots() p where p.id = p_item) then raise exception 'invalid_item'; end if;
  if p_item <> 'dat' and not exists (select 1 from public.garden_items where member_id = pl.member_id and item = p_item) then raise exception 'not_owned'; end if;
  update public.plants set pot = p_item where id = p_plant;
end $$;

-- Tưới cây: trừ vào bình nước (số giọt kiếm được trừ số giọt đã tưới). Trả về số giọt đã tưới thật.
create or replace function public.water_plant(p_plant uuid, p_amount int default 1) returns int
language plpgsql security definer set search_path = public as $$
declare pl public.plants%rowtype; sp record; bank int; amt int;
begin
  select * into pl from public.plants where id = p_plant and family_id = public.my_family_id();
  if not found then raise exception 'invalid_plant'; end if;
  perform public._garden_guard(pl.member_id);
  select * into sp from public.garden_species() where id = pl.species;
  select * into pl from public.plants where id = p_plant for update;
  bank := public._garden_earned(pl.member_id) - coalesce((select sum(poured) from public.plants where member_id = pl.member_id), 0);
  if coalesce(p_amount, 0) < 1 then raise exception 'invalid_amount'; end if;
  if bank < 1 then raise exception 'no_water'; end if;
  if pl.watered >= sp.need then raise exception 'ready_to_harvest'; end if;
  amt := least(p_amount, bank, sp.need - pl.watered);
  update public.plants set watered = watered + amt, poured = poured + amt, last_watered_at = now() where id = p_plant;
  return amt;
end $$;

-- Thu hoạch: cây ra quả thì nhận Ủn; cây quay về giai đoạn cây lớn (50% tiến độ) để ra quả lần nữa
create or replace function public.harvest_plant(p_plant uuid) returns int
language plpgsql security definer set search_path = public as $$
declare pl public.plants%rowtype; sp record; fid uuid;
begin
  select * into pl from public.plants where id = p_plant and family_id = public.my_family_id();
  if not found then raise exception 'invalid_plant'; end if;
  fid := public._garden_guard(pl.member_id);
  select * into pl from public.plants where id = p_plant for update;
  select * into sp from public.garden_species() where id = pl.species;
  if pl.watered < sp.need then raise exception 'not_ready'; end if;
  update public.plants set watered = (sp.need + 1) / 2, harvests = harvests + 1 where id = p_plant;
  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, pl.member_id, sp.fruit, 'garden', p_plant);
  return sp.fruit;
end $$;

do $$
declare f text;
begin
  foreach f in array array['start_garden(uuid)', 'buy_seed(uuid,text,int)', 'buy_slot(uuid)', 'buy_pot(uuid,text)', 'set_pot(uuid,text)',
                           'water_plant(uuid,int)', 'harvest_plant(uuid)', 'garden_species()', 'garden_pots()', 'garden_slot_price(int)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Snapshot: thêm khu vườn của các bé và cài đặt vườn
create or replace function public.family_snapshot(p_days int default 60)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'family', (select jsonb_build_object('id', f.id, 'name', f.name, 'golden_start', f.golden_start, 'golden_end', f.golden_end,
                        'daily_minutes', f.daily_minutes, 'enforce_golden', f.enforce_golden, 'leaderboard_opt_in', f.leaderboard_opt_in,
                        'limit_enabled', f.limit_enabled, 'garden_enabled', f.garden_enabled, 'garden_weekly_cap', f.garden_weekly_cap)
                 from public.families f limit 1),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role, 'color', m.color, 'initial', m.initial, 'avatar', m.avatar)
                                  order by m.sort_order, m.created_at) from public.members m), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'icon', t.icon, 'coins', t.coins, 'slot', t.slot,
                                  'audience', t.audience, 'kid_ids', t.kid_ids, 'parent_ids', t.parent_ids, 'repeat_days', t.repeat_days,
                                  'due_time', to_char(t.due_time, 'HH24:MI'), 'est_minutes', t.est_minutes, 'self_check', t.self_check, 'one_off', t.one_off)
                                  order by t.created_at)
                         from public.tasks t
                        where t.active
                          and (not t.one_off or exists (select 1 from public.task_overrides o where o.task_id = t.id and o.day >= public.vn_today() - 7))), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object('task_id', o.task_id, 'day', o.day, 'enabled', o.enabled))
                             from public.task_overrides o
                            where o.day >= public.vn_today() - 7 and o.day <= public.vn_today() + 60), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'icon', r.icon, 'cost', r.cost, 'tier', r.tier) order by r.cost)
                           from public.rewards r where r.active), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'member_id', s.member_id, 'task_id', s.task_id, 'day', s.day,
                                  'status', s.status, 'reviewer_id', s.reviewer_id, 'sticker', s.sticker, 'seen_by_member', s.seen_by_member,
                                  'submitted_at', s.submitted_at))
                               from public.submissions s where s.day >= public.vn_today() - p_days), '[]'::jsonb),
    'redemptions', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'member_id', d.member_id, 'reward_id', d.reward_id,
                                  'status', d.status, 'scheduled_note', d.scheduled_note) order by d.created_at desc)
                               from public.redemptions d where d.status <> 'cancelled'), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'target', g.target, 'status', g.status,
                                  'contrib', coalesce((select jsonb_object_agg(x.member_id, x.total)
                                                         from (select l.member_id, -sum(l.amount) as total from public.coin_ledger l
                                                                where l.kind = 'jar' and l.ref_id = g.id group by l.member_id) x), '{}'::jsonb))
                                  order by g.created_at desc)
                         from public.jar_goals g where g.status <> 'archived'), '[]'::jsonb),
    'jar_log', coalesce((select jsonb_agg(jsonb_build_object('goal_id', l.ref_id, 'member_id', l.member_id, 'amount', -l.amount, 'at', l.created_at) order by l.created_at desc)
                           from (select * from public.coin_ledger where kind = 'jar' order by created_at desc limit 40) l), '[]'::jsonb),
    'challenges', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'member_a', c.member_a, 'member_b', c.member_b,
                                  'target', c.target, 'progress_a', c.progress_a, 'progress_b', c.progress_b, 'linked_task_id', c.linked_task_id,
                                  'prize', c.prize, 'ends_on', c.ends_on) order by c.ends_on)
                              from public.challenges c where c.status = 'active'), '[]'::jsonb),
    'gardens', coalesce((select jsonb_agg(jsonb_build_object(
                        'member_id', g.member_id, 'started_at', g.started_at, 'slots', g.slots,
                        'earned', public._garden_earned(g.member_id), 'spent_week', public._garden_spent_week(g.member_id),
                        'plants', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'species', p.species, 'slot', p.slot, 'watered', p.watered, 'poured', p.poured,
                                                 'harvests', p.harvests, 'pot', p.pot, 'last_watered_at', p.last_watered_at, 'planted_at', p.planted_at) order by p.slot)
                                              from public.plants p where p.member_id = g.member_id), '[]'::jsonb),
                        'items', coalesce((select jsonb_agg(i.item order by i.item) from public.garden_items i where i.member_id = g.member_id), '[]'::jsonb)))
                           from public.gardens g), '[]'::jsonb),
    'praises', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'from_member', p.from_member, 'to_member', p.to_member, 'body', p.body, 'voice', p.voice,
                                  'created_at', p.created_at, 'heard', p.heard_at is not null) order by p.created_at desc)
                           from (select * from public.praises order by created_at desc limit 20) p), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from public.member_stats() s), '[]'::jsonb)
  )
$$;

grant execute on function public.family_snapshot(int) to authenticated;
