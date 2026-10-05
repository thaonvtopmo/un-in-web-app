-- Nhìn lại (tổng kết ngày/tuần/tháng/năm, sticker) và Lời khen của bố mẹ (giọng đọc)

-- ============ TỔNG KẾT THEO NGÀY ============
-- Mỗi (người, ngày): số việc được giao, số việc đã làm, Ủn kiếm được, sticker, tên các việc đã làm / chưa làm tốt.
-- Chỉ lưu những ngày đã qua; hôm nay và hai ngày gần nhất luôn tính lại trực tiếp từ dữ liệu.
create table if not exists public.day_summaries (
  member_id uuid not null references public.members(id) on delete cascade,
  day date not null,
  family_id uuid not null references public.families(id) on delete cascade,
  planned smallint not null default 0,
  done smallint not null default 0,
  coins int not null default 0,
  stickers text[] not null default '{}',
  done_titles text[] not null default '{}',
  missed text[] not null default '{}',
  primary key (member_id, day)
);
create index if not exists day_summaries_family_day on public.day_summaries (family_id, day);
alter table public.day_summaries enable row level security;
drop policy if exists "owner đọc tổng kết" on public.day_summaries;
create policy "owner đọc tổng kết" on public.day_summaries for select to authenticated using (public.is_family_owner(family_id));
revoke insert, update, delete on public.day_summaries from authenticated;

-- Tính tổng kết của một gia đình trong một ngày (chưa lưu).
-- Việc được giao = việc còn dùng, đúng lịch của ngày đó, giao đúng người. "Đã làm" gồm việc đã gật đầu và việc con đã nộp, đang chờ gật đầu.
-- Sticker: star (làm hết, từ 2 việc), chamchi (từ 3 việc), sang/chieu/toi (xong trọn một buổi), dunggio (xong việc có hạn đúng hạn).
create or replace function public.compute_day(p_family uuid, p_day date)
returns table (member_id uuid, planned int, done int, coins int, stickers text[], done_titles text[], missed text[])
language sql stable security definer set search_path = public as $$
  with pl as (
    select m.id as mid, t.id as tid, t.title, t.slot, t.due_time, s.status, s.submitted_at
      from public.members m
      join public.tasks t on t.family_id = p_family and t.active
       and public.task_on_day(t.id, p_day)
       and ((t.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= p_day
            or exists (select 1 from public.task_overrides o where o.task_id = t.id and o.day = p_day and o.enabled))
       and ((m.role = 'kid' and t.audience in ('kid', 'together') and (t.kid_ids is null or m.id = any (t.kid_ids)))
         or (m.role = 'parent' and t.audience = 'parent' and (t.parent_ids is null or m.id = any (t.parent_ids))))
      left join public.submissions s on s.member_id = m.id and s.task_id = t.id and s.day = p_day
     where m.family_id = p_family
  ), agg as (
    select mid,
           count(*)::int as planned,
           count(*) filter (where status in ('approved', 'pending'))::int as done,
           array_agg(title order by case slot when 'sang' then 1 when 'chieu' then 2 else 3 end, title) filter (where status in ('approved', 'pending')) as done_titles,
           array_agg(case when status = 'redo' then title || ' (làm lại)' else title end order by case slot when 'sang' then 1 when 'chieu' then 2 else 3 end, title)
             filter (where status is null or status = 'redo') as missed,
           bool_or(status in ('approved', 'pending') and due_time is not null
                   and (submitted_at at time zone 'Asia/Ho_Chi_Minh')::time <= due_time) as ontime
      from pl group by mid
  ), slots as (
    select mid, array_agg(slot order by slot) filter (where all_done) as full_slots
      from (select mid, slot, bool_and(coalesce(status in ('approved', 'pending'), false)) as all_done from pl group by mid, slot) x
     group by mid
  ), earned as (
    select l.member_id as mid, sum(l.amount)::int as coins
      from public.coin_ledger l
     where l.family_id = p_family and l.amount > 0 and l.kind in ('task', 'judge', 'challenge')
       and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = p_day
     group by l.member_id
  )
  select coalesce(a.mid, e.mid),
         coalesce(a.planned, 0), coalesce(a.done, 0), coalesce(e.coins, 0),
         array_remove(array[
           case when a.planned >= 2 and a.done = a.planned then 'star' end,
           case when a.done >= 3 then 'chamchi' end,
           case when 'sang' = any (coalesce(s.full_slots, '{}')) then 'sang' end,
           case when 'chieu' = any (coalesce(s.full_slots, '{}')) then 'chieu' end,
           case when 'toi' = any (coalesce(s.full_slots, '{}')) then 'toi' end,
           case when a.ontime then 'dunggio' end
         ], null),
         coalesce(a.done_titles, '{}'), coalesce(a.missed, '{}')
    from agg a full join earned e on e.mid = a.mid
    left join slots s on s.mid = coalesce(a.mid, e.mid)
$$;
revoke all on function public.compute_day(uuid, date) from public, anon, authenticated;

-- Lưu tổng kết của một ngày (dùng cho cron và cho hàm bên dưới)
create or replace function public.finalize_family_day(p_family uuid, p_day date) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.day_summaries where family_id = p_family and day = p_day;
  insert into public.day_summaries (member_id, day, family_id, planned, done, coins, stickers, done_titles, missed)
  select c.member_id, p_day, p_family, c.planned, c.done, c.coins, c.stickers, c.done_titles, c.missed
    from public.compute_day(p_family, p_day) c
   where c.planned > 0 or c.coins > 0;
end $$;
revoke all on function public.finalize_family_day(uuid, date) from public, anon, authenticated;

-- Cron ban đêm: lưu lại tổng kết hôm nay và vài ngày trước (phòng khi có việc được gật đầu muộn)
create or replace function public.finalize_all(p_back int default 2) returns int
language plpgsql security definer set search_path = public as $$
declare f record; d int; n int := 0;
begin
  for f in select id from public.families loop
    for d in 0..greatest(0, p_back) loop
      perform public.finalize_family_day(f.id, public.vn_today() - d);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.finalize_all(int) from public, anon, authenticated;
grant execute on function public.finalize_all(int) to service_role;

-- Lưu lại lịch sử cho một gia đình (chạy một lần khi mới có tính năng, và khi cần bù)
create or replace function public.backfill_summaries(p_days int default 60) returns int
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id(); d int; start_day date;
begin
  if fid is null then raise exception 'no_family'; end if;
  start_day := greatest(public.vn_today() - least(coalesce(p_days, 60), 120), (select (created_at at time zone 'Asia/Ho_Chi_Minh')::date from public.families where id = fid));
  for d in 0..(public.vn_today() - start_day) loop
    perform public.finalize_family_day(fid, start_day + d);
  end loop;
  return public.vn_today() - start_day + 1;
end $$;
revoke all on function public.backfill_summaries(int) from public, anon;
grant execute on function public.backfill_summaries(int) to authenticated;

-- Đọc tổng kết một khoảng ngày (tối đa 400 ngày). Hôm nay và 2 ngày gần nhất tính trực tiếp, các ngày cũ hơn đọc từ bảng đã lưu.
create or replace function public.review_range(p_from date, p_to date)
returns table (member_id uuid, day date, planned int, done int, coins int, stickers text[], done_titles text[], missed text[])
language plpgsql stable security definer set search_path = public as $$
declare fid uuid := public.my_family_id(); live_from date := public.vn_today() - 2; d date;
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'invalid_range'; end if;
  return query
    select s.member_id, s.day, s.planned::int, s.done::int, s.coins, s.stickers, s.done_titles, s.missed
      from public.day_summaries s
     where s.family_id = fid and s.day between p_from and least(p_to, live_from - 1)
     order by s.day;
  for d in select g::date from generate_series(greatest(p_from, live_from), least(p_to, public.vn_today()), interval '1 day') g loop
    return query
      select c.member_id, d, c.planned, c.done, c.coins, c.stickers, c.done_titles, c.missed
        from public.compute_day(fid, d) c where c.planned > 0 or c.coins > 0;
  end loop;
end $$;
revoke all on function public.review_range(date, date) from public, anon;
grant execute on function public.review_range(date, date) to authenticated;

-- ============ LỜI KHEN CỦA BỐ MẸ ============
create table if not exists public.praises (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_member uuid not null references public.members(id) on delete cascade,
  to_member uuid not null references public.members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 400),
  created_at timestamptz not null default now(),
  heard_at timestamptz
);
create index if not exists praises_family_created on public.praises (family_id, created_at desc);
alter table public.praises enable row level security;
drop policy if exists "owner đọc lời khen" on public.praises;
create policy "owner đọc lời khen" on public.praises for select to authenticated using (public.is_family_owner(family_id));
revoke insert, update, delete on public.praises from authenticated;
alter table public.praises replica identity full;
alter publication supabase_realtime add table public.praises;

create or replace function public.send_praise(p_from uuid, p_to uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id(); pid uuid; txt text := left(trim(coalesce(p_body, '')), 400);
begin
  if fid is null then raise exception 'no_family'; end if;
  if txt = '' then raise exception 'empty_body'; end if;
  if not exists (select 1 from public.members where id = p_from and family_id = fid and role = 'parent') then raise exception 'invalid_member'; end if;
  if not exists (select 1 from public.members where id = p_to and family_id = fid) then raise exception 'invalid_member'; end if;
  insert into public.praises (family_id, from_member, to_member, body) values (fid, p_from, p_to, txt) returning id into pid;
  -- giữ tối đa 50 lời khen gần nhất mỗi gia đình
  delete from public.praises where family_id = fid and id in (select id from public.praises where family_id = fid order by created_at desc offset 50);
  return pid;
end $$;

create or replace function public.mark_praise_heard(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.praises set heard_at = coalesce(heard_at, now()) where id = p_id and family_id = public.my_family_id();
end $$;

create or replace function public.delete_praise(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.praises where id = p_id and family_id = public.my_family_id();
end $$;

do $$
declare f text;
begin
  foreach f in array array['send_praise(uuid,uuid,text)', 'mark_praise_heard(uuid)', 'delete_praise(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
