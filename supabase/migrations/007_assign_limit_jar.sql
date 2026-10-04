-- 1) Giao việc cho từng người ("gắn thẻ"): kid_ids / parent_ids, null = tất cả
-- 2) Giới hạn phút chơi mỗi ngày có thể bật/tắt (mặc định đang TẮT)
-- 3) Snapshot trả thêm nhật ký góp hũ

alter table public.families add column if not exists limit_enabled boolean not null default false;
grant select (limit_enabled) on public.families to authenticated;
grant update (limit_enabled) on public.families to authenticated;

alter table public.tasks add column if not exists kid_ids uuid[];     -- các bé được giao; null = tất cả các bé
alter table public.tasks add column if not exists parent_ids uuid[];  -- bố/mẹ được giao hoặc cùng làm; null = tất cả bố mẹ

-- Chuyển dữ liệu cũ (partner / assignee_id) sang cách mới
update public.tasks set parent_ids = case
  when audience = 'together' and partner is not null and partner <> 'all' and partner ~ '^[0-9a-fA-F-]{36}$' then array[partner::uuid]
  when audience = 'parent' and assignee_id is not null then array[assignee_id]
  else null end
where parent_ids is null;

-- Chặn con chơi quá giờ: chỉ kiểm tra phút khi bố mẹ bật giới hạn
create or replace function public.assert_kid_can_play(fid uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  f public.families%rowtype;
  lt time := date_trunc('minute', now() at time zone 'Asia/Ho_Chi_Minh')::time;
  used int;
begin
  select * into f from public.families where id = fid;
  if f.enforce_golden and not (lt between f.golden_start and f.golden_end) then
    raise exception 'outside_window';
  end if;
  if f.limit_enabled then
    select seconds_used into used from public.play_sessions where member_id = p_member and day = public.vn_today();
    if coalesce(used, 0) >= f.daily_minutes * 60 then raise exception 'time_up'; end if;
  end if;
end $$;

create or replace function public.kid_session(p_member uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  f public.families%rowtype;
  lt time := date_trunc('minute', now() at time zone 'Asia/Ho_Chi_Minh')::time;
  used int;
begin
  if fid is null then raise exception 'no_family'; end if;
  if not exists (select 1 from public.members where id = p_member and family_id = fid) then raise exception 'invalid_member'; end if;
  select * into f from public.families where id = fid;
  select seconds_used into used from public.play_sessions where member_id = p_member and day = public.vn_today();
  return jsonb_build_object(
    'limit', f.limit_enabled,
    'remaining', case when f.limit_enabled then greatest(0, f.daily_minutes * 60 - coalesce(used, 0)) end,
    'in_window', (not f.enforce_golden) or (lt between f.golden_start and f.golden_end)
  );
end $$;

create or replace function public.heartbeat(p_member uuid, p_seconds int) returns int
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  f public.families%rowtype;
  used int;
begin
  if fid is null then raise exception 'no_family'; end if;
  if not exists (select 1 from public.members where id = p_member and family_id = fid and role = 'kid') then raise exception 'invalid_member'; end if;
  select * into f from public.families where id = fid;
  if not f.limit_enabled then return -1; end if; -- không giới hạn: không ghi phút
  insert into public.play_sessions (member_id, day, seconds_used)
  values (p_member, public.vn_today(), least(greatest(p_seconds, 0), 60))
  on conflict (member_id, day) do update set seconds_used = public.play_sessions.seconds_used + least(greatest(p_seconds, 0), 60)
  returning seconds_used into used;
  return greatest(0, f.daily_minutes * 60 - used);
end $$;

-- Con chỉ nộp việc được giao cho mình
create or replace function public.submit_task(p_member uuid, p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  t public.tasks%rowtype;
  ex public.submissions%rowtype;
begin
  if fid is null then raise exception 'no_family'; end if;
  if not exists (select 1 from public.members where id = p_member and family_id = fid and role = 'kid') then
    raise exception 'invalid_member';
  end if;
  select * into t from public.tasks where id = p_task and family_id = fid and active and audience in ('kid','together');
  if not found then raise exception 'invalid_task'; end if;
  if t.kid_ids is not null and not (p_member = any (t.kid_ids)) then raise exception 'not_assigned'; end if;
  if not public.task_on_day(p_task, public.vn_today()) then raise exception 'not_scheduled'; end if;
  perform public.assert_kid_can_play(fid, p_member);

  select * into ex from public.submissions where member_id = p_member and task_id = p_task and day = public.vn_today();
  if not found then
    insert into public.submissions (family_id, member_id, task_id, day, status)
    values (fid, p_member, p_task, public.vn_today(), 'pending');
  elsif ex.status = 'redo' then
    update public.submissions set status = 'pending', submitted_at = now(), reviewed_at = null, sticker = null where id = ex.id;
  end if;
end $$;

-- Gật đầu: cộng cho con, và cho đúng bố/mẹ được gắn thẻ (không gắn thì cho cả bố mẹ)
create or replace function public.approve_submission(p_submission uuid, p_reviewer uuid, p_sticker text) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  s public.submissions%rowtype;
  t public.tasks%rowtype;
  pid uuid;
begin
  if fid is null then raise exception 'no_family'; end if;
  select * into s from public.submissions where id = p_submission and family_id = fid for update;
  if not found then raise exception 'invalid_submission'; end if;
  if s.status = 'approved' then return; end if;
  if not exists (select 1 from public.members where id = p_reviewer and family_id = fid and role = 'parent') then
    raise exception 'invalid_reviewer';
  end if;
  if s.member_id = p_reviewer then raise exception 'self_review'; end if;
  select * into t from public.tasks where id = s.task_id;

  update public.submissions
     set status = 'approved', reviewer_id = p_reviewer, sticker = coalesce(nullif(p_sticker, ''), 'Giỏi quá!'),
         seen_by_member = false, reviewed_at = now()
   where id = s.id;

  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, s.member_id, t.coins, 'task', s.id);
  if t.audience = 'together' then
    for pid in select id from public.members where family_id = fid and role = 'parent' and (t.parent_ids is null or id = any (t.parent_ids)) loop
      insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, pid, t.coins, 'task', s.id);
    end loop;
  end if;

  update public.challenges set progress_a = least(target, progress_a + 1)
   where family_id = fid and status = 'active' and linked_task_id = t.id and member_a = s.member_id;
  update public.challenges set progress_b = least(target, progress_b + 1)
   where family_id = fid and status = 'active' and linked_task_id = t.id and member_b = s.member_id;
end $$;

create or replace function public.judge_parent_task(p_parent uuid, p_task uuid, p_kid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  t public.tasks%rowtype;
  ex public.submissions%rowtype;
  sid uuid;
begin
  if fid is null then raise exception 'no_family'; end if;
  if not exists (select 1 from public.members where id = p_kid and family_id = fid and role = 'kid') then raise exception 'invalid_member'; end if;
  if not exists (select 1 from public.members where id = p_parent and family_id = fid and role = 'parent') then raise exception 'invalid_member'; end if;
  select * into t from public.tasks where id = p_task and family_id = fid and active and audience = 'parent';
  if not found then raise exception 'invalid_task'; end if;
  if t.parent_ids is not null and not (p_parent = any (t.parent_ids)) then raise exception 'not_assigned'; end if;
  if not public.task_on_day(p_task, public.vn_today()) then raise exception 'not_scheduled'; end if;
  perform public.assert_kid_can_play(fid, p_kid);

  select * into ex from public.submissions where member_id = p_parent and task_id = p_task and day = public.vn_today();
  if found and ex.status = 'approved' then
    delete from public.coin_ledger where ref_id = ex.id and kind = 'judge';
    delete from public.submissions where id = ex.id;
  else
    if found then delete from public.submissions where id = ex.id; end if;
    insert into public.submissions (family_id, member_id, task_id, day, status, reviewer_id, seen_by_member, reviewed_at)
    values (fid, p_parent, p_task, public.vn_today(), 'approved', p_kid, true, now())
    returning id into sid;
    insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, p_parent, t.coins, 'judge', sid);
  end if;
end $$;

-- Hoàn tác gật đầu: trả Ủn đúng người đã được cộng
-- (không đổi so với 004; ledger xoá theo ref_id nên tự đúng với cách giao mới)

-- Việc chỉ cho một ngày, kèm người được giao
drop function if exists public.add_oneoff_task(date, text, text, int, text, text, text, uuid);
create or replace function public.add_oneoff_task(p_day date, p_title text, p_icon text, p_coins int, p_slot text, p_audience text, p_kid_ids uuid[], p_parent_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  tid uuid;
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_day < public.vn_today() - 7 or p_day > public.vn_today() + 60 then raise exception 'invalid_day'; end if;
  if p_kid_ids is not null and (select count(*) from public.members where id = any (p_kid_ids) and family_id = fid and role = 'kid') <> cardinality(p_kid_ids) then
    raise exception 'invalid_member';
  end if;
  if p_parent_ids is not null and (select count(*) from public.members where id = any (p_parent_ids) and family_id = fid and role = 'parent') <> cardinality(p_parent_ids) then
    raise exception 'invalid_member';
  end if;
  insert into public.tasks (family_id, title, icon, coins, slot, audience, kid_ids, parent_ids, repeat_days)
  values (fid, left(trim(p_title), 40), p_icon, p_coins, p_slot, p_audience,
          case when p_audience in ('kid','together') then p_kid_ids end,
          case when p_audience in ('parent','together') then p_parent_ids end, 0)
  returning id into tid;
  insert into public.task_overrides (task_id, day, family_id, enabled) values (tid, p_day, fid, true);
  return tid;
end $$;

-- Snapshot: thêm limit_enabled, kid_ids/parent_ids, nhật ký góp hũ
create or replace function public.family_snapshot(p_days int default 60)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'family', (select jsonb_build_object('id', f.id, 'name', f.name, 'golden_start', f.golden_start, 'golden_end', f.golden_end,
                        'daily_minutes', f.daily_minutes, 'enforce_golden', f.enforce_golden, 'leaderboard_opt_in', f.leaderboard_opt_in,
                        'limit_enabled', f.limit_enabled)
                 from public.families f limit 1),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role, 'color', m.color, 'initial', m.initial, 'avatar', m.avatar)
                                  order by m.sort_order, m.created_at) from public.members m), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'icon', t.icon, 'coins', t.coins, 'slot', t.slot,
                                  'audience', t.audience, 'kid_ids', t.kid_ids, 'parent_ids', t.parent_ids, 'repeat_days', t.repeat_days) order by t.created_at)
                         from public.tasks t where t.active), '[]'::jsonb),
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
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from public.member_stats() s), '[]'::jsonb)
  )
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'kid_session(uuid)', 'heartbeat(uuid,int)', 'submit_task(uuid,uuid)', 'approve_submission(uuid,uuid,text)',
    'judge_parent_task(uuid,uuid,uuid)', 'add_oneoff_task(date,text,text,int,text,text,uuid[],uuid[])', 'family_snapshot(int)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.assert_kid_can_play(uuid, uuid) from public, anon, authenticated;
