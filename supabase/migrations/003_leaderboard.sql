-- Bảng xếp hạng Ủn kiếm được của các nhà + thiết lập khi tạo gia đình

alter table public.families add column if not exists leaderboard_opt_in boolean not null default true;
grant select (leaderboard_opt_in) on public.families to authenticated;
grant update (leaderboard_opt_in) on public.families to authenticated;

-- create_family nhận thêm cài đặt giờ vàng và lựa chọn tham gia xếp hạng
drop function if exists public.create_family(text, text, jsonb);
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

  insert into public.families (owner_user_id, name, parent_pin_hash, golden_start, golden_end, daily_minutes, enforce_golden, leaderboard_opt_in)
  values (
    auth.uid(),
    left(coalesce(nullif(trim(p_name), ''), 'Nhà mình'), 40),
    crypt(p_pin, gen_salt('bf')),
    coalesce((p_settings->>'golden_start')::time, '19:30'),
    coalesce((p_settings->>'golden_end')::time, '19:45'),
    coalesce((p_settings->>'daily_minutes')::int, 10),
    coalesce((p_settings->>'enforce_golden')::boolean, true),
    coalesce((p_settings->>'leaderboard_opt_in')::boolean, true)
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

-- Xếp hạng theo Ủn trung bình mỗi người trong tuần (công bằng giữa nhà đông và nhà ít người).
-- Chỉ trả về tên gia đình và số liệu tổng, KHÔNG có tên hay thông tin từng thành viên.
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
                      where l.family_id = f.id and l.amount > 0
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

revoke all on function public.family_leaderboard() from public, anon;
grant execute on function public.family_leaderboard() to authenticated;
