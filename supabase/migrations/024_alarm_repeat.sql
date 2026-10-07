-- Báo thức nhắc lại: nếu bé chưa bấm "Con dậy rồi!", cứ 5 phút gửi thông báo nhắc lại, tối đa 3 lần (trong 30 phút sau giờ hẹn)
alter table public.alarms add column if not exists acked_day date;            -- ngày gần nhất bé đã bấm "Con dậy rồi!"
alter table public.alarms add column if not exists repeats_sent smallint not null default 0;
alter table public.alarms add column if not exists last_sent_at timestamptz;

-- Báo thức cần nhắc lại: hôm nay đã báo, bé chưa bấm dậy, chưa nhắc đủ 3 lần, cách lần gửi trước từ 4,5 phút, còn trong 30 phút sau giờ hẹn
create or replace function public._alarm_repeat_filter(p_now timestamptz) returns setof public.alarms
language sql stable security definer set search_path = public as $$
  select a.* from public.alarms a
   where a.enabled
     and a.fired_day = (p_now at time zone 'Asia/Ho_Chi_Minh')::date
     and a.acked_day is distinct from (p_now at time zone 'Asia/Ho_Chi_Minh')::date
     and a.repeats_sent < 3
     and a.last_sent_at <= p_now - interval '4 minutes 30 seconds'
     and (p_now at time zone 'Asia/Ho_Chi_Minh')::time >= a.at_time
     and (p_now at time zone 'Asia/Ho_Chi_Minh')::time <= a.at_time + interval '30 minutes'
$$;
revoke all on function public._alarm_repeat_filter(timestamptz) from public, anon, authenticated;

create or replace function public.has_due_alarm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public._alarm_due_filter(now())) or exists (select 1 from public._alarm_repeat_filter(now()))
$$;
revoke all on function public.has_due_alarm() from public, anon, authenticated;

-- Máy chủ app nhận các báo thức cần gửi thông báo: lần đầu (repeat_no = 0) hoặc nhắc lại (1 đến 3), và ghi nhận đã gửi
drop function if exists public.claim_due_alarms(timestamptz);
create or replace function public.claim_due_alarms(p_now timestamptz default now())
returns table (id uuid, family_id uuid, title text, at_text text, body text, repeat_no int, kid_names text[])
language plpgsql security definer set search_path = public as $$
begin
  return query
    with first_due as (select d.id from public._alarm_due_filter(p_now) d),
    rep_due as (select r.id from public._alarm_repeat_filter(p_now) r),
    upd_first as (
      update public.alarms a set fired_day = (p_now at time zone 'Asia/Ho_Chi_Minh')::date, repeats_sent = 0, acked_day = null, last_sent_at = p_now
        from first_due where a.id = first_due.id returning a.*, 0 as rn),
    upd_rep as (
      update public.alarms a set repeats_sent = a.repeats_sent + 1, last_sent_at = p_now
        from rep_due where a.id = rep_due.id returning a.*, a.repeats_sent as rn),
    u as (select * from upd_first union all select * from upd_rep)
    select u.id, u.family_id, u.title, to_char(u.at_time, 'HH24:MI'), u.body, u.rn::int,
           array(select m.name from public.members m where m.family_id = u.family_id and m.role = 'kid' and (u.kid_ids is null or m.id = any (u.kid_ids)) order by m.sort_order, m.created_at)
      from u;
end $$;
revoke all on function public.claim_due_alarms(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_alarms(timestamptz) to service_role;

-- Bé bấm "Con dậy rồi!": dừng việc nhắc lại hôm nay
create or replace function public.ack_alarm(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.alarms set acked_day = (now() at time zone 'Asia/Ho_Chi_Minh')::date where id = p_id and family_id = public.my_family_id();
end $$;
revoke all on function public.ack_alarm(uuid) from public, anon;
grant execute on function public.ack_alarm(uuid) to authenticated;

-- Sửa hoặc bật lại báo thức thì tính lại từ đầu
create or replace function public.set_alarm_enabled(p_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.alarms set enabled = p_enabled,
         fired_day = case when p_enabled then null else fired_day end,
         acked_day = case when p_enabled then null else acked_day end,
         repeats_sent = case when p_enabled then 0 else repeats_sent end
   where id = p_id and family_id = public.my_family_id();
end $$;

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
           enabled = coalesce(p_enabled, true), fired_day = null, acked_day = null, repeats_sent = 0, last_sent_at = null
     where id = p_id and family_id = fid returning id into aid;
    if aid is null then raise exception 'invalid_alarm'; end if;
  end if;
  return aid;
end $$;

revoke all on function public.save_alarm(uuid, text, time, int, uuid[], text, text, text, text, int, text, boolean) from public, anon;
grant execute on function public.save_alarm(uuid, text, time, int, uuid[], text, text, text, text, int, text, boolean) to authenticated;
