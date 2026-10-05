-- Khôi phục member_stats như bản 004 (migration 014 từng ghi đè nhầm bằng bản cũ hơn)
create or replace function public.member_stats()
returns table (member_id uuid, balance bigint, week_coins bigint, last_week_coins bigint)
language sql stable security invoker set search_path = public as $$
  with w as (select date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') as this_week)
  select m.id,
         coalesce(sum(l.amount), 0),
         coalesce(sum(l.amount) filter (where l.amount > 0 and l.kind in ('task','judge','challenge')
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= w.this_week), 0),
         coalesce(sum(l.amount) filter (where l.amount > 0 and l.kind in ('task','judge','challenge')
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') >= w.this_week - interval '7 days'
                    and (l.created_at at time zone 'Asia/Ho_Chi_Minh') <  w.this_week), 0)
    from public.members m
   cross join w
    left join public.coin_ledger l on l.member_id = m.id
   group by m.id, w.this_week
$$;
