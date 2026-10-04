-- Ủn Ỉn Cả Nhà – hàm server cho luồng chính (nộp việc, gật đầu, đổi phiếu, góp hũ, giờ vàng...)
-- Mọi biến động Ủn đều đi qua các hàm này; client không tự ghi coin_ledger.

-- ============ QUYỀN TRUY CẬP DATA API ============
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.members, public.tasks, public.submissions, public.rewards, public.redemptions,
  public.jar_goals, public.challenges, public.play_sessions
  to authenticated;
grant select on public.coin_ledger to authenticated;
revoke all on all tables in schema public from anon;

-- ============ HÀM PHỤ ============
create or replace function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.families where owner_user_id = auth.uid()
$$;

create or replace function public.vn_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- Dữ liệu mẫu cho gia đình mới: 6 việc tốt của con, 3 việc làm cùng nhau, 4 checklist bố mẹ, 6 phiếu, 1 hũ
create or replace function public.seed_family_defaults(fid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.tasks (family_id, title, icon, coins, slot, audience, partner) values
    (fid, 'Dậy trước 6h30',                  'sun',   20, 'sang',  'kid', null),
    (fid, 'Đi học đúng giờ',                 'bag',   15, 'sang',  'kid', null),
    (fid, 'Ăn đúng giờ',                     'bowl',  10, 'chieu', 'kid', null),
    (fid, 'Chăm em / giúp bố mẹ',            'heart', 25, 'chieu', 'kid', null),
    (fid, 'Nghe lời bố mẹ',                  'ear',   15, 'toi',   'kid', null),
    (fid, 'Ngủ trước 21h',                   'moon',  30, 'toi',   'kid', null),
    (fid, 'Cùng bố mẹ tưới cây',             'tree',  20, 'chieu', 'together', 'all'),
    (fid, 'Cùng bố mẹ dọn đồ chơi',          'balls', 20, 'toi',   'together', 'all'),
    (fid, 'Cả nhà ăn tối không điện thoại',  'phone', 30, 'toi',   'together', 'all'),
    (fid, 'Không lướt điện thoại khi ăn',    'phone', 15, 'toi',   'parent', null),
    (fid, 'Đọc truyện cho con',              'book',  15, 'toi',   'parent', null),
    (fid, 'Về nhà trước 19h',                'home',  10, 'chieu', 'parent', null),
    (fid, 'Chơi với con 30 phút',            'balls', 20, 'toi',   'parent', null);

  insert into public.rewards (family_id, title, icon, cost, tier) values
    (fid, 'Cùng mẹ nấu món con thích', 'bowl',  30,   'nho'),
    (fid, 'Bố đọc thêm 1 truyện',      'book',  40,   'nho'),
    (fid, 'Cùng bố mẹ đi nhà bóng',    'balls', 180,  'vua'),
    (fid, 'Cả nhà đi công viên',       'tree',  250,  'vua'),
    (fid, 'Cả nhà đi sở thú',          'paw',   800,  'lon'),
    (fid, 'Cả nhà đi dã ngoại',        'tent',  1000, 'lon');

  insert into public.jar_goals (family_id, title, target) values (fid, 'Cả nhà đi Sở thú', 500);
end $$;

-- Tạo gia đình (cập nhật: gọi thêm seed mặc định)
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

  perform public.seed_family_defaults(fid);
  return fid;
end $$;

-- Kiểm tra con có được thao tác không: trong giờ vàng và còn phút chơi (kiểm tra ở server)
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
  select seconds_used into used from public.play_sessions where member_id = p_member and day = public.vn_today();
  if coalesce(used, 0) >= f.daily_minutes * 60 then
    raise exception 'time_up';
  end if;
end $$;

-- ============ LUỒNG CHÍNH ============

-- Con bấm "Xong rồi nè!"
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
  perform public.assert_kid_can_play(fid, p_member);

  select * into ex from public.submissions where member_id = p_member and task_id = p_task and day = public.vn_today();
  if not found then
    insert into public.submissions (family_id, member_id, task_id, day, status)
    values (fid, p_member, p_task, public.vn_today(), 'pending');
  elsif ex.status = 'redo' then
    update public.submissions set status = 'pending', submitted_at = now(), reviewed_at = null, sticker = null where id = ex.id;
  end if; -- đã pending/approved thì bỏ qua: mỗi việc chỉ nộp 1 lần/ngày
end $$;

-- Bố/mẹ gật đầu: cộng Ủn ngay, cộng cho cả bố/mẹ làm cùng, tăng tiến độ kèo
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
    for pid in select id from public.members where family_id = fid and role = 'parent' and (t.partner = 'all' or id::text = t.partner) loop
      insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, pid, t.coins, 'task', s.id);
    end loop;
  end if;

  update public.challenges set progress_a = least(target, progress_a + 1)
   where family_id = fid and status = 'active' and linked_task_id = t.id and member_a = s.member_id;
  update public.challenges set progress_b = least(target, progress_b + 1)
   where family_id = fid and status = 'active' and linked_task_id = t.id and member_b = s.member_id;
end $$;

-- "Nhắc nhẹ": không trừ Ủn, con làm lại
create or replace function public.remind_submission(p_submission uuid) returns void
language sql security definer set search_path = public as $$
  update public.submissions set status = 'redo'
   where id = p_submission and family_id = public.my_family_id() and status = 'pending';
$$;

-- Con chấm checklist của bố/mẹ: bấm lại thì huỷ trong ngày
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

-- Đổi phiếu: kiểm tra số dư trong 1 transaction
create or replace function public.redeem_reward(p_member uuid, p_reward uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  r public.rewards%rowtype;
  bal bigint;
  rid uuid;
begin
  if fid is null then raise exception 'no_family'; end if;
  if not exists (select 1 from public.members where id = p_member and family_id = fid and role = 'kid') then raise exception 'invalid_member'; end if;
  select * into r from public.rewards where id = p_reward and family_id = fid and active;
  if not found then raise exception 'invalid_reward'; end if;
  perform public.assert_kid_can_play(fid, p_member);

  perform pg_advisory_xact_lock(hashtext(p_member::text));
  select coalesce(sum(amount), 0) into bal from public.coin_ledger where member_id = p_member;
  if bal < r.cost then raise exception 'insufficient'; end if;

  insert into public.redemptions (family_id, member_id, reward_id) values (fid, p_member, p_reward) returning id into rid;
  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, p_member, -r.cost, 'redeem', rid);
  return rid;
end $$;

-- Bố/mẹ bấm "Giữ lời rồi!"
create or replace function public.complete_redemption(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.redemptions set status = 'done', done_at = now()
   where id = p_id and family_id = public.my_family_id() and status = 'promised';
$$;

-- Góp Hũ Mơ Ước (con hoặc bố mẹ). Trả về true nếu hũ vừa đầy.
create or replace function public.contribute_jar(p_member uuid, p_goal uuid, p_amount int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  g public.jar_goals%rowtype;
  mrole text;
  bal bigint;
  total bigint;
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_amount < 1 or p_amount > 500 then raise exception 'invalid_amount'; end if;
  select role into mrole from public.members where id = p_member and family_id = fid;
  if mrole is null then raise exception 'invalid_member'; end if;
  if mrole = 'kid' then perform public.assert_kid_can_play(fid, p_member); end if;
  select * into g from public.jar_goals where id = p_goal and family_id = fid and status = 'active' for update;
  if not found then raise exception 'jar_closed'; end if;

  perform pg_advisory_xact_lock(hashtext(p_member::text));
  select coalesce(sum(amount), 0) into bal from public.coin_ledger where member_id = p_member;
  if bal < p_amount then raise exception 'insufficient'; end if;

  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, p_member, -p_amount, 'jar', p_goal);
  select coalesce(-sum(amount), 0) into total from public.coin_ledger where kind = 'jar' and ref_id = p_goal;
  if total >= g.target then
    update public.jar_goals set status = 'reached' where id = p_goal;
    return true;
  end if;
  return false;
end $$;

-- Đặt/sửa mục tiêu hũ. Hũ đang chạy thì sửa tại chỗ; hũ đã đầy thì tạo hũ mới.
create or replace function public.set_jar_goal(p_title text, p_target int) returns void
language plpgsql security definer set search_path = public as $$
declare
  fid uuid := public.my_family_id();
  g public.jar_goals%rowtype;
  total bigint;
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_target < 50 then raise exception 'invalid_target'; end if;
  select * into g from public.jar_goals where family_id = fid and status = 'active' limit 1;
  if found then
    update public.jar_goals set title = left(p_title, 40), target = p_target where id = g.id;
    select coalesce(-sum(amount), 0) into total from public.coin_ledger where kind = 'jar' and ref_id = g.id;
    if total >= p_target then update public.jar_goals set status = 'reached' where id = g.id; end if;
  else
    insert into public.jar_goals (family_id, title, target) values (fid, left(p_title, 40), p_target);
  end if;
end $$;

-- ============ GIỜ VÀNG + 10 PHÚT ============
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
    'remaining', greatest(0, f.daily_minutes * 60 - coalesce(used, 0)),
    'in_window', (not f.enforce_golden) or (lt between f.golden_start and f.golden_end)
  );
end $$;

-- Client gửi mỗi 30 giây khi con đang dùng app
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
  insert into public.play_sessions (member_id, day, seconds_used)
  values (p_member, public.vn_today(), least(greatest(p_seconds, 0), 60))
  on conflict (member_id, day) do update set seconds_used = public.play_sessions.seconds_used + least(greatest(p_seconds, 0), 60)
  returning seconds_used into used;
  return greatest(0, f.daily_minutes * 60 - used);
end $$;

-- ============ THỐNG KÊ ============
-- Số dư, Ủn kiếm tuần này, tuần trước (tuần bắt đầu thứ Hai 00:00 giờ Việt Nam). RLS vẫn áp dụng.
create or replace function public.member_stats()
returns table (member_id uuid, balance bigint, week_coins bigint, last_week_coins bigint)
language sql stable security invoker set search_path = public as $$
  with w as (select date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') as this_week)
  select m.id,
         coalesce(sum(l.amount), 0),
         coalesce(sum(l.amount) filter (where l.amount > 0 and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= w.this_week), 0),
         coalesce(sum(l.amount) filter (where l.amount > 0
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= w.this_week - interval '7 days'
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') <  w.this_week), 0)
    from public.members m
   cross join w
    left join public.coin_ledger l on l.member_id = m.id
   group by m.id, w.this_week
$$;

-- ============ QUYỀN GỌI HÀM ============
do $$
declare f text;
begin
  foreach f in array array[
    'my_family_id()', 'is_family_owner(uuid)', 'submit_task(uuid,uuid)', 'approve_submission(uuid,uuid,text)',
    'remind_submission(uuid)', 'judge_parent_task(uuid,uuid,uuid)', 'redeem_reward(uuid,uuid)',
    'complete_redemption(uuid)', 'contribute_jar(uuid,uuid,int)', 'set_jar_goal(text,int)',
    'kid_session(uuid)', 'heartbeat(uuid,int)', 'member_stats()', 'create_family(text,text,jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.seed_family_defaults(uuid) from public, anon, authenticated;
revoke all on function public.assert_kid_can_play(uuid, uuid) from public, anon, authenticated;

-- ============ ĐỒNG BỘ THỜI GIAN THỰC ============
alter table public.submissions replica identity full;
alter table public.coin_ledger replica identity full;
alter table public.redemptions replica identity full;
alter table public.jar_goals replica identity full;
alter table public.challenges replica identity full;
alter table public.tasks replica identity full;
alter table public.rewards replica identity full;
alter table public.members replica identity full;
alter publication supabase_realtime add table
  public.submissions, public.coin_ledger, public.redemptions, public.jar_goals,
  public.challenges, public.tasks, public.rewards, public.members;
