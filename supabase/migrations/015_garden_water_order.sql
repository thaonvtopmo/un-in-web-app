-- Tưới cây: nếu cây đã ra quả thì báo "thu hoạch trước" (có ích hơn báo hết nước)
create or replace function public.water_plant(p_plant uuid, p_amount int default 1) returns int
language plpgsql security definer set search_path = public as $$
declare pl public.plants%rowtype; sp record; bank int; amt int;
begin
  select * into pl from public.plants where id = p_plant and family_id = public.my_family_id();
  if not found then raise exception 'invalid_plant'; end if;
  perform public._garden_guard(pl.member_id);
  select * into sp from public.garden_species() where id = pl.species;
  select * into pl from public.plants where id = p_plant for update;
  if coalesce(p_amount, 0) < 1 then raise exception 'invalid_amount'; end if;
  if pl.watered >= sp.need then raise exception 'ready_to_harvest'; end if;
  bank := public._garden_earned(pl.member_id) - coalesce((select sum(poured) from public.plants where member_id = pl.member_id), 0);
  if bank < 1 then raise exception 'no_water'; end if;
  amt := least(p_amount, bank, sp.need - pl.watered);
  update public.plants set watered = watered + amt, poured = poured + amt, last_watered_at = now() where id = p_plant;
  return amt;
end $$;
revoke all on function public.water_plant(uuid, int) from public, anon;
grant execute on function public.water_plant(uuid, int) to authenticated;
