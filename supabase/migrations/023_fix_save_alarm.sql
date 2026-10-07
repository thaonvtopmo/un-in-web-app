-- Sửa save_alarm: tên biến trùng tên cột khiến lệnh sửa báo thức lỗi
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

revoke all on function public.save_alarm(uuid, text, time, int, uuid[], text, text, text, text, int, text, boolean) from public, anon;
grant execute on function public.save_alarm(uuid, text, time, int, uuid[], text, text, text, text, int, text, boolean) to authenticated;
