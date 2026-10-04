-- Việc riêng của bố mẹ (tự tick, không Ủn), hạn hoàn thành, thời gian dự kiến, việc làm một lần không vào kho

alter table public.tasks add column if not exists due_time time;                       -- hạn hoàn thành trong ngày (ví dụ trước 18:00)
alter table public.tasks add column if not exists est_minutes smallint check (est_minutes is null or est_minutes between 1 and 600); -- dự kiến mất bao nhiêu phút
alter table public.tasks add column if not exists self_check boolean not null default false; -- bố mẹ tự đánh dấu xong, không cần con chấm
alter table public.tasks add column if not exists one_off boolean not null default false;    -- chỉ làm một lần, không nằm trong kho việc

-- Việc tự đánh dấu không có Ủn nên cho phép 0 Ủn
alter table public.tasks drop constraint if exists tasks_coins_check;
alter table public.tasks add constraint tasks_coins_check check (coins between 0 and 200);
alter table public.tasks drop constraint if exists tasks_self_check_rules;
alter table public.tasks add constraint tasks_self_check_rules check (not self_check or (audience = 'parent' and coins = 0));

-- Việc đã tạo bằng "việc mới chỉ cho ngày này" từ trước được coi là làm một lần
update public.tasks set one_off = true where repeat_days = 0;

-- Con chỉ chấm được mục "con chấm Đạt", không chấm mục bố mẹ tự đánh dấu
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
  select * into t from public.tasks where id = p_task and family_id = fid and active and audience = 'parent' and not self_check;
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

-- Bố/mẹ tự đánh dấu xong một việc của mình (bấm lại để bỏ). Không có Ủn.
create or replace function public.toggle_self_task(p_parent uuid, p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  t public.tasks%rowtype;
  ex public.submissions%rowtype;
begin
  if fid is null then raise exception 'no_family'; end if;
  if not exists (select 1 from public.members where id = p_parent and family_id = fid and role = 'parent') then raise exception 'invalid_member'; end if;
  select * into t from public.tasks where id = p_task and family_id = fid and active and audience = 'parent' and self_check;
  if not found then raise exception 'invalid_task'; end if;
  if t.parent_ids is not null and not (p_parent = any (t.parent_ids)) then raise exception 'not_assigned'; end if;
  if not public.task_on_day(p_task, public.vn_today()) then raise exception 'not_scheduled'; end if;

  select * into ex from public.submissions where member_id = p_parent and task_id = p_task and day = public.vn_today();
  if found then
    delete from public.submissions where id = ex.id;
  else
    insert into public.submissions (family_id, member_id, task_id, day, status, reviewer_id, seen_by_member, reviewed_at)
    values (fid, p_parent, p_task, public.vn_today(), 'approved', p_parent, true, now());
  end if;
end $$;

-- Thêm việc cho một ngày. p_keep = true: lưu vào kho việc với lịch lặp p_repeat; false: chỉ làm một lần.
drop function if exists public.add_oneoff_task(date, text, text, int, text, text, uuid[], uuid[]);
create or replace function public.add_oneoff_task(
  p_day date, p_title text, p_icon text, p_coins int, p_slot text, p_audience text, p_kid_ids uuid[], p_parent_ids uuid[],
  p_due time default null, p_est int default null, p_self boolean default false, p_keep boolean default false, p_repeat int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  tid uuid;
  selfc boolean := coalesce(p_self, false) and p_audience = 'parent';
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_day < public.vn_today() - 7 or p_day > public.vn_today() + 60 then raise exception 'invalid_day'; end if;
  if p_kid_ids is not null and (select count(*) from public.members where id = any (p_kid_ids) and family_id = fid and role = 'kid') <> cardinality(p_kid_ids) then
    raise exception 'invalid_member';
  end if;
  if p_parent_ids is not null and (select count(*) from public.members where id = any (p_parent_ids) and family_id = fid and role = 'parent') <> cardinality(p_parent_ids) then
    raise exception 'invalid_member';
  end if;
  insert into public.tasks (family_id, title, icon, coins, slot, audience, kid_ids, parent_ids, repeat_days, due_time, est_minutes, self_check, one_off)
  values (fid, left(trim(p_title), 40), p_icon, case when selfc then 0 else p_coins end, p_slot, p_audience,
          case when p_audience in ('kid','together') then p_kid_ids end,
          case when p_audience in ('parent','together') then p_parent_ids end,
          case when p_keep then coalesce(p_repeat, 127) else 0 end, p_due, p_est, selfc, not coalesce(p_keep, false))
  returning id into tid;
  insert into public.task_overrides (task_id, day, family_id, enabled) values (tid, p_day, fid, true);
  return tid;
end $$;

-- Snapshot: thêm giờ hạn, phút dự kiến, tự đánh dấu, làm một lần; ẩn việc làm một lần đã quá cũ
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
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from public.member_stats() s), '[]'::jsonb)
  )
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'judge_parent_task(uuid,uuid,uuid)', 'toggle_self_task(uuid,uuid)',
    'add_oneoff_task(date,text,text,int,text,text,uuid[],uuid[],time,int,boolean,boolean,int)', 'family_snapshot(int)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
