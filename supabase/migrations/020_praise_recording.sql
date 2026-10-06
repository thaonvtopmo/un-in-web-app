-- Lời khen bằng giọng ghi âm của bố mẹ: file lưu ở Supabase Storage (kho riêng tư), bảng praises chỉ giữ đường dẫn
alter table public.praises add column if not exists audio_path text;
alter table public.praises add column if not exists audio_secs int check (audio_secs is null or audio_secs between 1 and 120);
alter table public.praises add column if not exists audio_mime text;
-- Lời khen có thể chỉ có giọng ghi âm (không có chữ)
alter table public.praises drop constraint if exists praises_body_check;
alter table public.praises add constraint praises_body_check check (char_length(body) between 0 and 400);
alter table public.praises drop constraint if exists praise_has_content;
alter table public.praises add constraint praise_has_content check (char_length(body) > 0 or audio_path is not null);

drop function if exists public.send_praise(uuid, uuid, text, text);
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
  insert into public.praises (family_id, from_member, to_member, body, voice, audio_path, audio_secs, audio_mime)
  values (fid, p_from, p_to, txt, case when p_voice = 'm' then 'm' else 'f' end, p_audio_path, p_audio_secs, p_audio_mime) returning id into pid;
  -- giữ tối đa 50 lời khen gần nhất mỗi gia đình (file ghi âm của lời khen bị bỏ sẽ được dọn mỗi đêm)
  delete from public.praises where family_id = fid and id in (select id from public.praises where family_id = fid order by created_at desc offset 50);
  return pid;
end $$;
revoke all on function public.send_praise(uuid, uuid, text, text, text, int, text) from public, anon;
grant execute on function public.send_praise(uuid, uuid, text, text, text, int, text) to authenticated;

-- ============ KHO FILE GHI ÂM ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('praise-audio', 'praise-audio', false, 3145728, array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'audio/x-m4a'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Tên file luôn dạng <id gia đình>/<tên file>; chỉ chủ nhà đó mới đọc, ghi, xoá được
create or replace function public._audio_owner_ok(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
              then public.is_family_owner(split_part(p_name, '/', 1)::uuid) else false end
$$;
revoke all on function public._audio_owner_ok(text) from public, anon;
grant execute on function public._audio_owner_ok(text) to authenticated;

drop policy if exists "praise-audio đọc" on storage.objects;
drop policy if exists "praise-audio ghi" on storage.objects;
drop policy if exists "praise-audio xoá" on storage.objects;
create policy "praise-audio đọc" on storage.objects for select to authenticated using (bucket_id = 'praise-audio' and public._audio_owner_ok(name));
create policy "praise-audio ghi" on storage.objects for insert to authenticated with check (bucket_id = 'praise-audio' and public._audio_owner_ok(name));
create policy "praise-audio xoá" on storage.objects for delete to authenticated using (bucket_id = 'praise-audio' and public._audio_owner_ok(name));

-- Snapshot: lời khen kèm file ghi âm (nếu có)
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
    'praises', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'from_member', p.from_member, 'to_member', p.to_member, 'body', p.body, 'voice', p.voice, 'audio_path', p.audio_path, 'audio_secs', p.audio_secs, 'audio_mime', p.audio_mime,
                                  'created_at', p.created_at, 'heard', p.heard_at is not null) order by p.created_at desc)
                           from (select * from public.praises order by created_at desc limit 20) p), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(to_jsonb(s)) from public.member_stats() s), '[]'::jsonb)
  )
$$;

grant execute on function public.family_snapshot(int) to authenticated;
