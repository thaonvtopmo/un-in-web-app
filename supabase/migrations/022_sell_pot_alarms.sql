-- Bán lại chậu (hoàn 60%) và Báo thức bằng giọng bố mẹ

-- ============ BÁN CHẬU ============
-- Ủn đã chi cho vườn trong tuần tính ròng: tiền mua trừ đi tiền hoàn khi bán lại (khoản hoàn ghi ref_id = id bé), nên mua nhầm rồi bán không bị mất hạn mức
create or replace function public._garden_spent_week(p_member uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce(-sum(case when l.amount < 0 then l.amount when l.ref_id = l.member_id then l.amount else 0 end), 0))::int
    from public.coin_ledger l join public.members m on m.id = l.member_id
   where l.member_id = p_member and l.kind = 'garden' and public.is_family_owner(m.family_id)
     and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh')
$$;

-- Bán lại chậu đã mua: nhận lại 60% giá (lỗ 40%). Cây đang dùng chậu đó quay về chậu đất.
create or replace function public.sell_pot(p_member uuid, p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare fid uuid := public._garden_guard(p_member); price int; refund int;
begin
  select p.price into price from public.garden_pots() p where p.id = p_item;
  if price is null or price <= 0 then raise exception 'invalid_item'; end if;
  delete from public.garden_items where member_id = p_member and item = p_item;
  if not found then raise exception 'not_owned'; end if;
  refund := (price * 60) / 100;
  update public.plants set pot = 'dat' where member_id = p_member and pot = p_item;
  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, p_member, refund, 'garden', p_member);
  return refund;
end $$;
revoke all on function public.sell_pot(uuid, text) from public, anon;
grant execute on function public.sell_pot(uuid, text) to authenticated;

-- ============ BÁO THỨC ============
create table if not exists public.alarms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  at_time time not null,
  repeat_days smallint not null default 127 check (repeat_days between 0 and 127), -- như việc tốt: bit0 = Thứ Hai ... bit6 = Chủ nhật
  kid_ids uuid[],                                         -- null = tất cả các bé
  tone text not null default 'chuong' check (tone in ('chuong', 'ga', 'nhac')),
  body text not null default '' check (char_length(body) <= 400), -- lời nhắc cho máy đọc (khi không ghi âm)
  voice text not null default 'f' check (voice in ('f', 'm')),
  audio_path text,
  audio_secs int check (audio_secs is null or audio_secs between 1 and 120),
  audio_mime text,
  enabled boolean not null default true,
  fired_day date,                                         -- ngày gần nhất đã gửi thông báo đẩy
  created_at timestamptz not null default now()
);
create index if not exists alarms_family on public.alarms (family_id);
alter table public.alarms enable row level security;
drop policy if exists "owner đọc báo thức" on public.alarms;
create policy "owner đọc báo thức" on public.alarms for select to authenticated using (public.is_family_owner(family_id));
revoke insert, update, delete on public.alarms from authenticated;
alter table public.alarms replica identity full;
alter publication supabase_realtime add table public.alarms;

-- Tạo hoặc sửa một báo thức (p_id null = tạo mới). Tối đa 20 báo thức mỗi nhà.
create or replace function public.save_alarm(p_id uuid, p_title text, p_at time, p_repeat int, p_kid_ids uuid[], p_tone text, p_body text, p_voice text,
                                             p_audio_path text, p_audio_secs int, p_audio_mime text, p_enabled boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id(); aid uuid; v_title text := left(trim(coalesce(p_title, '')), 40); v_txt text := left(trim(coalesce(p_body, '')), 400);
begin
  if fid is null then raise exception 'no_family'; end if;
  if v_title = '' then raise exception 'empty_title'; end if;
  if p_at is null then raise exception 'invalid_time'; end if;
  if p_repeat < 0 or p_repeat > 127 then raise exception 'invalid_repeat'; end if;
  if p_tone not in ('chuong', 'ga', 'nhac') then raise exception 'invalid_tone'; end if;
  if p_kid_ids is not null and (select count(*) from public.members where id = any (p_kid_ids) and family_id = fid and role = 'kid') <> cardinality(p_kid_ids) then
    raise exception 'invalid_member';
  end if;
  if p_audio_path is not null then
    if p_audio_path not like fid::text || '/%' or p_audio_path like '%..%' or length(p_audio_path) > 200 then raise exception 'invalid_audio'; end if;
    if coalesce(p_audio_secs, 0) < 1 or p_audio_secs > 120 then raise exception 'invalid_audio'; end if;
    if p_audio_mime is null or p_audio_mime not like 'audio/%' then raise exception 'invalid_audio'; end if;
  end if;
  if p_id is null then
    if (select count(*) from public.alarms where family_id = fid) >= 20 then raise exception 'too_many_alarms'; end if;
    insert into public.alarms (family_id, title, at_time, repeat_days, kid_ids, tone, body, voice, audio_path, audio_secs, audio_mime, enabled)
    values (fid, v_title, p_at, p_repeat, p_kid_ids, p_tone, v_txt, case when p_voice = 'm' then 'm' else 'f' end, p_audio_path, p_audio_secs, p_audio_mime, coalesce(p_enabled, true))
    returning id into aid;
  else
    update public.alarms set title = v_title, at_time = p_at, repeat_days = p_repeat, kid_ids = p_kid_ids, tone = p_tone, body = v_txt,
           voice = case when p_voice = 'm' then 'm' else 'f' end, audio_path = p_audio_path, audio_secs = p_audio_secs, audio_mime = p_audio_mime,
           enabled = coalesce(p_enabled, true), fired_day = null
     where id = p_id and family_id = fid returning id into aid;
    if aid is null then raise exception 'invalid_alarm'; end if;
  end if;
  return aid;
end $$;

create or replace function public.set_alarm_enabled(p_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.alarms set enabled = p_enabled, fired_day = case when p_enabled then null else fired_day end where id = p_id and family_id = public.my_family_id();
end $$;

create or replace function public.delete_alarm(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.alarms where id = p_id and family_id = public.my_family_id();
end $$;

do $$
declare f text;
begin
  foreach f in array array['save_alarm(uuid,text,time,int,uuid[],text,text,text,text,int,text,boolean)', 'set_alarm_enabled(uuid,boolean)', 'delete_alarm(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Báo thức đến giờ (theo giờ Việt Nam): trong 2 phút gần nhất, đúng thứ, hôm nay chưa gửi thông báo.
create or replace function public._alarm_due_filter(p_now timestamptz) returns setof public.alarms
language sql stable security definer set search_path = public as $$
  select a.* from public.alarms a
   where a.enabled
     and ((a.repeat_days >> (extract(isodow from (p_now at time zone 'Asia/Ho_Chi_Minh'))::int - 1)) & 1) = 1
     and a.at_time <= (p_now at time zone 'Asia/Ho_Chi_Minh')::time
     and a.at_time > (p_now at time zone 'Asia/Ho_Chi_Minh')::time - interval '2 minutes'
     and a.fired_day is distinct from (p_now at time zone 'Asia/Ho_Chi_Minh')::date
$$;
revoke all on function public._alarm_due_filter(timestamptz) from public, anon, authenticated;

-- Bộ hẹn giờ mỗi phút hỏi hàm này (rẻ, không ghi gì); chỉ khi có báo thức đến giờ mới gọi máy chủ app
create or replace function public.has_due_alarm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public._alarm_due_filter(now()))
$$;
revoke all on function public.has_due_alarm() from public, anon, authenticated;

-- Máy chủ app nhận báo thức đến giờ và đánh dấu đã gửi hôm nay (mỗi báo thức chỉ gửi một lần mỗi ngày)
create or replace function public.claim_due_alarms(p_now timestamptz default now())
returns table (id uuid, family_id uuid, title text, at_text text, kid_names text[])
language plpgsql security definer set search_path = public as $$
begin
  return query
    with due as (select d.id from public._alarm_due_filter(p_now) d),
    upd as (update public.alarms a set fired_day = (p_now at time zone 'Asia/Ho_Chi_Minh')::date from due where a.id = due.id returning a.*)
    select u.id, u.family_id, u.title, to_char(u.at_time, 'HH24:MI'),
           array(select m.name from public.members m where m.family_id = u.family_id and m.role = 'kid' and (u.kid_ids is null or m.id = any (u.kid_ids)) order by m.sort_order, m.created_at)
      from upd u;
end $$;
revoke all on function public.claim_due_alarms(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_alarms(timestamptz) to service_role;

-- Snapshot: thêm báo thức
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
    'alarms', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'at', to_char(a.at_time, 'HH24:MI'), 'repeat_days', a.repeat_days,
                                  'kid_ids', a.kid_ids, 'tone', a.tone, 'body', a.body, 'voice', a.voice, 'audio_path', a.audio_path, 'audio_secs', a.audio_secs,
                                  'audio_mime', a.audio_mime, 'enabled', a.enabled) order by a.at_time, a.created_at)
                          from public.alarms a), '[]'::jsonb),
    'praises', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'from_member', p.from_member, 'to_member', p.to_member, 'body', p.body, 'voice', p.voice, 'audio_path', p.audio_path, 'audio_secs', p.audio_secs, 'audio_mime', p.audio_mime,
                                  'created_at', p.created_at, 'heard', p.heard_at is not null) order by p.created_at desc)
                           from (select * from public.praises order by created_at desc limit 20) p), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from public.member_stats() s), '[]'::jsonb)
  )
$$;

grant execute on function public.family_snapshot(int) to authenticated;
