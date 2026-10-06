-- Lời khen giữa mọi người trong nhà: bố mẹ gửi cho con hoặc gửi cho nhau (người gửi luôn là bố/mẹ, không tự khen mình)
create or replace function public.send_praise(p_from uuid, p_to uuid, p_body text, p_voice text default 'f',
                                              p_audio_path text default null, p_audio_secs int default null, p_audio_mime text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id(); pid uuid; txt text := left(trim(coalesce(p_body, '')), 400);
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_audio_path is not null then
    -- file ghi âm phải nằm trong thư mục của chính nhà này
    if p_audio_path not like fid::text || '/%' or p_audio_path like '%..%' or length(p_audio_path) > 200 then raise exception 'invalid_audio'; end if;
    if coalesce(p_audio_secs, 0) < 1 or p_audio_secs > 120 then raise exception 'invalid_audio'; end if;
    if p_audio_mime is null or p_audio_mime not like 'audio/%' then raise exception 'invalid_audio'; end if;
  elsif txt = '' then raise exception 'empty_body';
  end if;
  if not exists (select 1 from public.members where id = p_from and family_id = fid and role = 'parent') then raise exception 'invalid_member'; end if;
  if not exists (select 1 from public.members where id = p_to and family_id = fid) then raise exception 'invalid_member'; end if;
  if p_from = p_to then raise exception 'invalid_member'; end if; -- không tự khen mình
  insert into public.praises (family_id, from_member, to_member, body, voice, audio_path, audio_secs, audio_mime)
  values (fid, p_from, p_to, txt, case when p_voice = 'm' then 'm' else 'f' end, p_audio_path, p_audio_secs, p_audio_mime) returning id into pid;
  -- giữ tối đa 50 lời khen gần nhất mỗi gia đình (file ghi âm của lời khen bị bỏ sẽ được dọn mỗi đêm)
  delete from public.praises where family_id = fid and id in (select id from public.praises where family_id = fid order by created_at desc offset 50);
  return pid;
end $$;
revoke all on function public.send_praise(uuid, uuid, text, text, text, int, text) from public, anon;
grant execute on function public.send_praise(uuid, uuid, text, text, text, int, text) to authenticated;
