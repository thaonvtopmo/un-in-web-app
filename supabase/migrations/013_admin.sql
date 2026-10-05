-- Admin tổng, đợt 1: danh sách admin, nhật ký admin, thống kê mỗi đêm, tổng quan, danh sách và chi tiết gia đình.
-- Nguyên tắc: admin chỉ thấy số liệu tổng hợp, không đọc tên con, tên việc hay lời khen. Mọi lần mở chi tiết một nhà đều được ghi nhật ký.

-- ============ AI LÀ ADMIN ============
create table if not exists public.app_admins (
  email text primary key,
  role text not null default 'owner' check (role in ('owner', 'support')),
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated; -- không có policy nào: chỉ hàm trên máy chủ đọc được
-- Danh sách admin để trống. Khi cần, thêm bằng SQL (xem docs/ADMIN-CAC-DOT.md): insert into public.app_admins (email, role) values ('email@gmail.com', 'owner');

-- Vai trò của người đang đăng nhập (null nếu không phải admin)
create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.app_admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;
revoke all on function public.admin_role() from public, anon;
grant execute on function public.admin_role() to authenticated;

create or replace function public._admin_assert() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public.admin_role() is null then raise exception 'not_admin'; end if;
end $$;
revoke all on function public._admin_assert() from public, anon, authenticated;

-- ============ NHẬT KÝ ADMIN ============
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_email text not null,
  action text not null,
  family_id uuid,           -- không khoá ngoại để nhật ký còn nguyên khi nhà bị xoá
  detail jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_at on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

create or replace function public._admin_log(p_action text, p_family uuid, p_detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit (admin_email, action, family_id, detail)
  values (lower(coalesce(auth.jwt() ->> 'email', 'cron')), p_action, p_family, coalesce(p_detail, '{}'::jsonb))
$$;
revoke all on function public._admin_log(text, uuid, jsonb) from public, anon, authenticated;

-- ============ THỐNG KÊ MỖI ĐÊM ============
create table if not exists public.usage_daily (
  day date primary key,
  families int not null default 0,
  members int not null default 0,
  new_families int not null default 0,
  active_1d int not null default 0,
  active_7d int not null default 0,
  active_30d int not null default 0,
  submissions_day int not null default 0,
  approved_day int not null default 0,
  push_devices int not null default 0,
  db_bytes bigint not null default 0,
  captured_at timestamptz not null default now()
);
alter table public.usage_daily enable row level security;
revoke all on public.usage_daily from anon, authenticated;

-- Mỗi gia đình một dòng: số người, lần hoạt động cuối (việc nộp, ghi sổ Ủn hoặc giờ chơi), khối lượng dữ liệu ước tính
create or replace function public._admin_family_rows()
returns table (id uuid, name text, created_at timestamptz, owner_email text, leaderboard boolean, members int, kids int,
               last_active timestamptz, subs_total bigint, subs_30d bigint, ledger_total bigint, summaries bigint, praises bigint, push_devices bigint, est_bytes bigint)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.created_at, u.email::text, f.leaderboard_opt_in,
         (select count(*) from public.members m where m.family_id = f.id)::int,
         (select count(*) from public.members m where m.family_id = f.id and m.role = 'kid')::int,
         greatest(
           (select max(s.submitted_at) from public.submissions s where s.family_id = f.id),
           (select max(l.created_at) from public.coin_ledger l where l.family_id = f.id),
           (select max(p.day)::timestamptz from public.play_sessions p join public.members m on m.id = p.member_id where m.family_id = f.id)
         ),
         x.subs, x.subs30, x.led, x.sums, x.pr, x.push,
         (x.subs * 296 + x.led * 180 + x.sums * 250 + x.pr * 200)::bigint
    from public.families f
    left join auth.users u on u.id = f.owner_user_id
    cross join lateral (select
      (select count(*) from public.submissions s where s.family_id = f.id) as subs,
      (select count(*) from public.submissions s where s.family_id = f.id and s.day >= public.vn_today() - 30) as subs30,
      (select count(*) from public.coin_ledger l where l.family_id = f.id) as led,
      (select count(*) from public.day_summaries d where d.family_id = f.id) as sums,
      (select count(*) from public.praises p where p.family_id = f.id) as pr,
      (select count(*) from public.push_subscriptions ps where ps.family_id = f.id) as push) x
$$;
revoke all on function public._admin_family_rows() from public, anon, authenticated;

create or replace function public._admin_snapshot() returns void
language plpgsql security definer set search_path = public as $$
declare t date := public.vn_today();
begin
  insert into public.usage_daily (day, families, members, new_families, active_1d, active_7d, active_30d, submissions_day, approved_day, push_devices, db_bytes, captured_at)
  select t,
         (select count(*) from public.families),
         (select count(*) from public.members),
         (select count(*) from public.families f where (f.created_at at time zone 'Asia/Ho_Chi_Minh')::date = t),
         count(*) filter (where r.last_active >= now() - interval '1 day'),
         count(*) filter (where r.last_active >= now() - interval '7 days'),
         count(*) filter (where r.last_active >= now() - interval '30 days'),
         (select count(*) from public.submissions s where s.day = t),
         (select count(*) from public.submissions s where s.day = t and s.status = 'approved'),
         (select count(*) from public.push_subscriptions),
         pg_database_size(current_database()),
         now()
    from public._admin_family_rows() r
  on conflict (day) do update set families = excluded.families, members = excluded.members, new_families = excluded.new_families,
    active_1d = excluded.active_1d, active_7d = excluded.active_7d, active_30d = excluded.active_30d,
    submissions_day = excluded.submissions_day, approved_day = excluded.approved_day, push_devices = excluded.push_devices,
    db_bytes = excluded.db_bytes, captured_at = excluded.captured_at;
end $$;
revoke all on function public._admin_snapshot() from public, anon, authenticated;

-- Cron ban đêm gọi (khoá service role)
create or replace function public.admin_snapshot() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_snapshot();
end $$;
revoke all on function public.admin_snapshot() from public, anon, authenticated;
grant execute on function public.admin_snapshot() to service_role;

-- Admin bấm "Chụp số liệu ngay"
create or replace function public.admin_snapshot_now() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_assert();
  perform public._admin_snapshot();
  perform public._admin_log('snapshot_now', null);
end $$;
revoke all on function public.admin_snapshot_now() from public, anon;
grant execute on function public.admin_snapshot_now() to authenticated;

-- ============ TỔNG QUAN ============
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform public._admin_assert();
  select jsonb_build_object(
    'role', public.admin_role(),
    'now', now(),
    'totals', (select jsonb_build_object(
        'families', count(*), 'members', coalesce(sum(r.members), 0), 'kids', coalesce(sum(r.kids), 0),
        'new_7d', count(*) filter (where r.created_at >= now() - interval '7 days'),
        'new_30d', count(*) filter (where r.created_at >= now() - interval '30 days'),
        'active_1d', count(*) filter (where r.last_active >= now() - interval '1 day'),
        'active_7d', count(*) filter (where r.last_active >= now() - interval '7 days'),
        'active_30d', count(*) filter (where r.last_active >= now() - interval '30 days'),
        'dormant', count(*) filter (where r.created_at < now() - interval '7 days' and (r.last_active is null or r.last_active < now() - interval '30 days')),
        'leaderboard', count(*) filter (where r.leaderboard),
        'push_devices', coalesce(sum(r.push_devices), 0))
       from public._admin_family_rows() r),
    'today', jsonb_build_object(
        'submissions', (select count(*) from public.submissions s where s.day = public.vn_today()),
        'approved', (select count(*) from public.submissions s where s.day = public.vn_today() and s.status = 'approved')),
    'db', jsonb_build_object(
        'bytes', pg_database_size(current_database()),
        'limit_bytes', 524288000,
        'tables', coalesce((select jsonb_agg(jsonb_build_object('name', t.relname, 'bytes', t.sz, 'rows', t.n) order by t.sz desc)
                              from (select c.relname::text as relname, pg_total_relation_size(c.oid) as sz, c.reltuples::bigint as n
                                      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                                     where ns.nspname = 'public' and c.relkind = 'r' order by 2 desc limit 8) t), '[]'::jsonb))
  ) into res;
  return res;
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- Chuỗi số liệu theo ngày cho biểu đồ
create or replace function public.admin_series(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_assert();
  return coalesce((select jsonb_agg(to_jsonb(u) order by u.day)
                     from (select * from public.usage_daily where day >= public.vn_today() - least(greatest(coalesce(p_days, 30), 1), 400) order by day) u), '[]'::jsonb);
end $$;
revoke all on function public.admin_series(int) from public, anon;
grant execute on function public.admin_series(int) to authenticated;

-- ============ DANH SÁCH GIA ĐÌNH ============
-- p_status: all | active (7 ngày) | quiet (8–30 ngày) | dormant (quá 30 ngày hoặc chưa dùng) | new (7 ngày đầu)
create or replace function public.admin_families(p_search text default null, p_status text default 'all', p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform public._admin_assert();
  with r as (
    select *, case
        when created_at >= now() - interval '7 days' and last_active is null then 'new'
        when last_active >= now() - interval '7 days' then 'active'
        when last_active >= now() - interval '30 days' then 'quiet'
        else 'dormant' end as status
      from public._admin_family_rows()
     where p_search is null or p_search = '' or name ilike '%' || p_search || '%' or owner_email ilike '%' || p_search || '%'
  ), f as (select * from r where p_status is null or p_status = 'all' or status = p_status)
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select id, name, created_at, owner_email, status, members, kids, last_active, subs_30d, push_devices, est_bytes
          from f order by last_active desc nulls last, created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb))
  into res;
  return res;
end $$;
revoke all on function public.admin_families(text, text, int, int) from public, anon;
grant execute on function public.admin_families(text, text, int, int) to authenticated;

-- Chi tiết một nhà: chỉ số liệu và cài đặt, không có tên con, tên việc hay lời khen. Mỗi lần mở đều ghi nhật ký.
create or replace function public.admin_family(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  perform public._admin_assert();
  if not exists (select 1 from public.families where id = p_id) then raise exception 'not_found'; end if;
  select jsonb_build_object(
    'family', jsonb_build_object('id', f.id, 'name', f.name, 'created_at', f.created_at, 'owner_email', r.owner_email,
        'golden_start', f.golden_start, 'golden_end', f.golden_end, 'daily_minutes', f.daily_minutes,
        'enforce_golden', f.enforce_golden, 'limit_enabled', f.limit_enabled, 'leaderboard', f.leaderboard_opt_in),
    'last_active', r.last_active,
    'est_bytes', r.est_bytes,
    'counts', jsonb_build_object(
        'members', r.members, 'kids', r.kids, 'parents', r.members - r.kids,
        'tasks_active', (select count(*) from public.tasks t where t.family_id = p_id and t.active),
        'tasks_total', (select count(*) from public.tasks t where t.family_id = p_id),
        'rewards_active', (select count(*) from public.rewards w where w.family_id = p_id and w.active),
        'challenges_active', (select count(*) from public.challenges c where c.family_id = p_id and c.status = 'active'),
        'submissions', r.subs_total, 'approved', (select count(*) from public.submissions s where s.family_id = p_id and s.status = 'approved'),
        'ledger', r.ledger_total, 'summaries', r.summaries, 'praises', r.praises, 'push_devices', r.push_devices),
    'activity_14d', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'submissions', coalesce(x.n, 0), 'approved', coalesce(x.a, 0)) order by d.day)
        from (select (public.vn_today() - g)::date as day from generate_series(0, 13) g) d
        left join (select s.day, count(*) as n, count(*) filter (where s.status = 'approved') as a
                     from public.submissions s where s.family_id = p_id and s.day >= public.vn_today() - 13 group by s.day) x on x.day = d.day), '[]'::jsonb)
  ) into res
  from public.families f join public._admin_family_rows() r on r.id = f.id where f.id = p_id;
  perform public._admin_log('view_family', p_id, jsonb_build_object('name', (res -> 'family' ->> 'name')));
  return res;
end $$;
revoke all on function public.admin_family(uuid) from public, anon;
grant execute on function public.admin_family(uuid) to authenticated;

-- ============ XEM NHẬT KÝ ============
create or replace function public.admin_audit_list(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_assert();
  return coalesce((select jsonb_agg(to_jsonb(a)) from (
      select id, at, admin_email, action, family_id, detail from public.admin_audit order by at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) a), '[]'::jsonb);
end $$;
revoke all on function public.admin_audit_list(int) from public, anon;
grant execute on function public.admin_audit_list(int) to authenticated;
