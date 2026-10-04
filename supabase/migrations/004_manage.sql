-- Hoàn thiện quản lý: snapshot 1 truy vấn, hoàn tác gật đầu, huỷ phiếu có hoàn Ủn,
-- checklist gán riêng từng người, báo cáo tuần, đăng ký thông báo đẩy.

-- ============ "Ủn kiếm được" chỉ tính việc làm, không tính tiền hoàn lại ============
create or replace function public.member_stats()
returns table (member_id uuid, balance bigint, week_coins bigint, last_week_coins bigint)
language sql stable security invoker set search_path = public as $$
  with w as (select date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') as this_week)
  select m.id,
         coalesce(sum(l.amount), 0),
         coalesce(sum(l.amount) filter (where l.amount > 0 and l.kind in ('task','judge','challenge')
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= w.this_week), 0),
         coalesce(sum(l.amount) filter (where l.amount > 0 and l.kind in ('task','judge','challenge')
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= w.this_week - interval '7 days'
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') <  w.this_week), 0)
    from public.members m
   cross join w
    left join public.coin_ledger l on l.member_id = m.id
   group by m.id, w.this_week
$$;

create or replace function public.family_leaderboard()
returns table (rank int, family_name text, week_coins bigint, member_count int, avg_coins numeric, is_mine boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  wk timestamp := date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return query
  with fam as (
    select f.id, f.name,
           (select count(*) from public.members m where m.family_id = f.id) as n,
           coalesce((select sum(l.amount) from public.coin_ledger l
                      where l.family_id = f.id and l.amount > 0 and l.kind in ('task','judge','challenge')
                        and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= wk), 0) as wc
      from public.families f
     where f.leaderboard_opt_in
  ), ranked as (
    select fam.*, round(fam.wc::numeric / greatest(fam.n, 1), 1) as avg_c,
           row_number() over (order by fam.wc::numeric / greatest(fam.n, 1) desc, fam.wc desc, fam.id) as rk
      from fam
  )
  select r.rk::int,
         case when r.name = 'Nhà mình' or trim(r.name) = '' then 'Nhà ẩn danh ' || upper(left(r.id::text, 4)) else r.name end,
         r.wc, r.n::int, r.avg_c, (r.id = fid)
    from ranked r
   where r.rk <= 20 or r.id = fid
   order by r.rk;
end $$;

-- ============ SNAPSHOT: toàn bộ dữ liệu gia đình trong 1 lần gọi ============
create or replace function public.family_snapshot(p_days int default 60)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'family', (select jsonb_build_object('id', f.id, 'name', f.name, 'golden_start', f.golden_start, 'golden_end', f.golden_end,
                        'daily_minutes', f.daily_minutes, 'enforce_golden', f.enforce_golden, 'leaderboard_opt_in', f.leaderboard_opt_in)
                 from public.families f limit 1),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'role', m.role, 'color', m.color, 'initial', m.initial)
                                  order by m.sort_order, m.created_at) from public.members m), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'icon', t.icon, 'coins', t.coins, 'slot', t.slot,
                                  'audience', t.audience, 'partner', t.partner, 'assignee_id', t.assignee_id) order by t.created_at)
                         from public.tasks t where t.active), '[]'::jsonb),
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

-- ============ CHECKLIST GÁN RIÊNG: con chỉ chấm đúng mục của người đó ============
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

-- ============ HOÀN TÁC GẬT ĐẦU (trong ngày) ============
create or replace function public.revoke_approval(p_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  s public.submissions%rowtype;
  t public.tasks%rowtype;
  bad int;
begin
  if fid is null then raise exception 'no_family'; end if;
  select * into s from public.submissions where id = p_submission and family_id = fid for update;
  if not found then raise exception 'invalid_submission'; end if;
  if s.status <> 'approved' then raise exception 'not_approved'; end if;
  if s.day <> public.vn_today() then raise exception 'too_late'; end if;
  select * into t from public.tasks where id = s.task_id;
  if t.audience = 'parent' then raise exception 'invalid_task'; end if;

  delete from public.coin_ledger where ref_id = s.id and kind = 'task';
  select count(*) into bad from (
    select m.id from public.members m
     where m.family_id = fid and coalesce((select sum(amount) from public.coin_ledger l where l.member_id = m.id), 0) < 0) x;
  if bad > 0 then raise exception 'balance_negative'; end if; -- con đã tiêu mất số Ủn này rồi

  update public.submissions
     set status = 'pending', reviewer_id = null, sticker = null, seen_by_member = false, reviewed_at = null
   where id = s.id;
  update public.challenges set progress_a = greatest(0, progress_a - 1)
   where family_id = fid and status = 'active' and linked_task_id = t.id and member_a = s.member_id;
  update public.challenges set progress_b = greatest(0, progress_b - 1)
   where family_id = fid and status = 'active' and linked_task_id = t.id and member_b = s.member_id;
end $$;

-- ============ HUỶ PHIẾU ĐÃ NGOÉO TAY: hoàn đủ Ủn cho con ============
create or replace function public.cancel_redemption(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  d public.redemptions%rowtype;
  cost int;
begin
  if fid is null then raise exception 'no_family'; end if;
  select * into d from public.redemptions where id = p_id and family_id = fid for update;
  if not found then raise exception 'invalid_redemption'; end if;
  if d.status <> 'promised' then raise exception 'not_promised'; end if;
  select r.cost into cost from public.rewards r where r.id = d.reward_id;
  update public.redemptions set status = 'cancelled' where id = d.id;
  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, d.member_id, cost, 'adjust', d.id);
end $$;

-- ============ BÁO CÁO TUẦN: Ủn kiếm / tiêu / số việc theo từng người, từng ngày ============
create or replace function public.week_report(p_offset int default 0)
returns table (member_id uuid, day date, earned bigint, spent bigint, tasks_done int)
language sql stable security invoker set search_path = public as $$
  with w as (select (date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') + (p_offset * interval '7 days'))::date as start_day),
  days as (select generate_series(w.start_day, w.start_day + 6, interval '1 day')::date as d from w)
  select m.id, days.d,
    coalesce((select sum(l.amount) from public.coin_ledger l
               where l.member_id = m.id and l.amount > 0 and l.kind in ('task','judge','challenge')
                 and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = days.d), 0)::bigint,
    coalesce((select -sum(l.amount) from public.coin_ledger l
               where l.member_id = m.id and l.amount < 0 and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = days.d), 0)::bigint,
    (select count(*) from public.submissions s where s.member_id = m.id and s.status = 'approved' and s.day = days.d)::int
  from public.members m cross join days
  order by m.sort_order, m.created_at, days.d
$$;

-- ============ THÔNG BÁO ĐẨY ============
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  label text,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy "owner" on public.push_subscriptions for all to authenticated
  using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- ============ QUYỀN GỌI HÀM ============
do $$
declare f text;
begin
  foreach f in array array[
    'family_snapshot(int)', 'judge_parent_task(uuid,uuid,uuid)', 'revoke_approval(uuid)', 'cancel_redemption(uuid)',
    'week_report(int)', 'member_stats()', 'family_leaderboard()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
