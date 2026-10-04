-- Kế hoạch theo ngày: mỗi việc có lịch lặp theo thứ trong tuần, và bố mẹ có thể bật/tắt riêng từng ngày.
-- Ngày nào việc nào được giao = (ghi đè của ngày đó) nếu có, nếu không thì theo lịch lặp.

-- Avatar: một biểu tượng (emoji) do bố mẹ chọn cho từng thành viên; trống thì dùng chữ cái đầu
alter table public.members add column if not exists avatar text check (avatar is null or char_length(avatar) <= 16);

-- repeat_days: mặt nạ bit theo thứ, bit0 = Thứ Hai ... bit6 = Chủ nhật. 127 = mỗi ngày, 31 = T2–T6, 96 = cuối tuần, 0 = không lặp.
alter table public.tasks add column if not exists repeat_days smallint not null default 127 check (repeat_days between 0 and 127);

create table if not exists public.task_overrides (
  task_id uuid not null references public.tasks(id) on delete cascade,
  day date not null,
  family_id uuid not null references public.families(id) on delete cascade,
  enabled boolean not null,
  primary key (task_id, day)
);
create index if not exists task_overrides_family_day on public.task_overrides (family_id, day);

alter table public.task_overrides enable row level security;
create policy "owner" on public.task_overrides for all to authenticated
  using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
grant select, insert, update, delete on public.task_overrides to authenticated;
revoke all on public.task_overrides from anon;
alter table public.task_overrides replica identity full;
alter publication supabase_realtime add table public.task_overrides;

-- Việc này có được giao vào ngày đó không?
create or replace function public.task_on_day(p_task uuid, p_day date) returns boolean
language sql stable set search_path = public as $$
  select coalesce(
    (select o.enabled from public.task_overrides o where o.task_id = p_task and o.day = p_day),
    (select ((t.repeat_days >> (extract(isodow from p_day)::int - 1)) & 1) = 1 from public.tasks t where t.id = p_task),
    false)
$$;

-- Con chỉ nộp được việc đã giao cho hôm nay
create or replace function public.submit_task(p_member uuid, p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  ex public.submissions%rowtype;
begin
  if fid is null then raise exception 'no_family'; end if;
  if not exists (select 1 from public.members where id = p_member and family_id = fid and role = 'kid') then
    raise exception 'invalid_member';
  end if;
  if not exists (select 1 from public.tasks where id = p_task and family_id = fid and active and audience in ('kid','together')) then
    raise exception 'invalid_task';
  end if;
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
  if t.assignee_id is not null and t.assignee_id <> p_parent then raise exception 'not_assigned'; end if;
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

-- Đặt kế hoạch cho một ngày. p_items: [{"task": "<uuid>", "enabled": true|false|null}] — null nghĩa là bỏ ghi đè, theo lịch lặp.
create or replace function public.set_day_plan(p_day date, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  it jsonb;
  tid uuid;
begin
  if fid is null then raise exception 'no_family'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'invalid_items'; end if;
  if p_day < public.vn_today() - 7 or p_day > public.vn_today() + 60 then raise exception 'invalid_day'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    tid := (it->>'task')::uuid;
    if not exists (select 1 from public.tasks where id = tid and family_id = fid) then raise exception 'invalid_task'; end if;
    if it->'enabled' is null or jsonb_typeof(it->'enabled') = 'null' then
      delete from public.task_overrides where task_id = tid and day = p_day;
    else
      insert into public.task_overrides (task_id, day, family_id, enabled) values (tid, p_day, fid, (it->>'enabled')::boolean)
      on conflict (task_id, day) do update set enabled = excluded.enabled;
    end if;
  end loop;
end $$;

-- Thêm một việc chỉ cho đúng một ngày (không lặp)
create or replace function public.add_oneoff_task(p_day date, p_title text, p_icon text, p_coins int, p_slot text, p_audience text, p_partner text, p_assignee uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  tid uuid;
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_day < public.vn_today() - 7 or p_day > public.vn_today() + 60 then raise exception 'invalid_day'; end if;
  if p_assignee is not null and not exists (select 1 from public.members where id = p_assignee and family_id = fid and role = 'parent') then
    raise exception 'invalid_member';
  end if;
  insert into public.tasks (family_id, title, icon, coins, slot, audience, partner, assignee_id, repeat_days)
  values (fid, left(trim(p_title), 40), p_icon, p_coins, p_slot, p_audience,
          case when p_audience = 'together' then coalesce(p_partner, 'all') end,
          case when p_audience = 'parent' then p_assignee end, 0)
  returning id into tid;
  insert into public.task_overrides (task_id, day, family_id, enabled) values (tid, p_day, fid, true);
  return tid;
end $$;

-- Snapshot kèm lịch lặp và các ghi đè từ 7 ngày trước tới 60 ngày sau
create or replace function public.family_snapshot(p_days int default 60)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'family', (select jsonb_build_object('id', f.id, 'name', f.name, 'golden_start', f.golden_start, 'golden_end', f.golden_end,
                        'daily_minutes', f.daily_minutes, 'enforce_golden', f.enforce_golden, 'leaderboard_opt_in', f.leaderboard_opt_in)
                 from public.families f limit 1),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role, 'color', m.color, 'initial', m.initial, 'avatar', m.avatar)
                                  order by m.sort_order, m.created_at) from public.members m), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'icon', t.icon, 'coins', t.coins, 'slot', t.slot,
                                  'audience', t.audience, 'partner', t.partner, 'assignee_id', t.assignee_id, 'repeat_days', t.repeat_days) order by t.created_at)
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
    'task_on_day(uuid,date)', 'submit_task(uuid,uuid)', 'judge_parent_task(uuid,uuid,uuid)',
    'set_day_plan(date,jsonb)', 'add_oneoff_task(date,text,text,int,text,text,text,uuid)', 'family_snapshot(int)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
