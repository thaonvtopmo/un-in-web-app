-- Báo cáo tuần: "Ủn đã tiêu" tính ròng, trừ phần đã được hoàn lại khi huỷ phiếu.
create or replace function public.week_report(p_offset int default 0)
returns table (member_id uuid, day date, earned bigint, spent bigint, tasks_done int)
language sql stable security invoker set search_path = public as $$
  with w as (select (date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') + (p_offset * interval '7 days'))::date as start_day),
  days as (select generate_series(w.start_day, w.start_day + 6, interval '1 day')::date as d from w)
  select m.id, days.d,
    coalesce((select sum(l.amount) from public.coin_ledger l
               where l.member_id = m.id and l.amount > 0 and l.kind in ('task','judge','challenge')
                 and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = days.d), 0)::bigint,
    greatest(0,
      coalesce((select -sum(l.amount) from public.coin_ledger l
                 where l.member_id = m.id and l.amount < 0 and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = days.d), 0)
      - coalesce((select sum(l.amount) from public.coin_ledger l
                   where l.member_id = m.id and l.amount > 0 and l.kind = 'adjust'
                     and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = days.d), 0))::bigint,
    (select count(*) from public.submissions s where s.member_id = m.id and s.status = 'approved' and s.day = days.d)::int
  from public.members m cross join days
  order by m.sort_order, m.created_at, days.d
$$;
revoke all on function public.week_report(int) from public, anon;
grant execute on function public.week_report(int) to authenticated;
