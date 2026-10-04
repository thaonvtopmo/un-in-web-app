-- Khi tạo gia đình, nhận thêm lựa chọn bật/tắt giới hạn phút chơi (mặc định TẮT)
create or replace function public.create_family(p_name text, p_pin text, p_members jsonb, p_settings jsonb default '{}'::jsonb)
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

  insert into public.families (owner_user_id, name, parent_pin_hash, golden_start, golden_end, daily_minutes, enforce_golden, leaderboard_opt_in, limit_enabled)
  values (
    auth.uid(),
    left(coalesce(nullif(trim(p_name), ''), 'Nhà mình'), 40),
    crypt(p_pin, gen_salt('bf')),
    coalesce((p_settings->>'golden_start')::time, '19:30'),
    coalesce((p_settings->>'golden_end')::time, '19:45'),
    coalesce((p_settings->>'daily_minutes')::int, 10),
    coalesce((p_settings->>'enforce_golden')::boolean, true),
    coalesce((p_settings->>'leaderboard_opt_in')::boolean, true),
    coalesce((p_settings->>'limit_enabled')::boolean, false)
  )
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

revoke all on function public.create_family(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_family(text, text, jsonb, jsonb) to authenticated;
