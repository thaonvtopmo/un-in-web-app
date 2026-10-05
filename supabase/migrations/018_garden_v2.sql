-- Khu vườn v2: mỗi loài một nhịp lớn riêng, cần ít việc hơn. Có loài chỉ ra hoa là hái (hướng dương, hoa cúc, Hy vọng), có loài ra quả.
-- need = số giọt nước để hái được; keep = tiến độ cây quay về sau khi hái (giai đoạn "cây lớn"), nên lần sau chỉ cần tưới phần còn lại.
-- Các mốc từng giai đoạn nằm ở lib/garden.ts (chỉ để vẽ hình); máy chủ chỉ cần need, fruit, keep.
drop function if exists public.garden_species();
create or replace function public.garden_species() returns table (id text, price int, need int, fruit int, keep int)
language sql immutable set search_path = public as $$
  select * from (values
    ('hy_vong', 0, 10, 6, 6),
    ('ngoan', 20, 12, 10, 8),
    ('cham_chi', 30, 20, 18, 13),
    ('dung_cam', 40, 25, 28, 12),
    ('ky_luat', 50, 32, 40, 16),
    ('kien_nhan', 90, 60, 90, 28)
  ) as t(id, price, need, fruit, keep)
$$;
create or replace function public.garden_pots() returns table (id text, price int)
language sql immutable set search_path = public as $$
  select * from (values ('dat', 0), ('xanh', 20), ('hong', 20), ('sao', 40), ('cau_vong', 60)) as t(id, price)
$$;
create or replace function public.garden_slot_price(n int) returns int
language sql immutable as $$ select case n when 3 then 60 when 4 then 120 else null end $$;

-- Hái: cây đủ nước thì nhận Ủn, tiến độ quay về mốc "cây lớn" của loài đó
create or replace function public.harvest_plant(p_plant uuid) returns int
language plpgsql security definer set search_path = public as $$
declare pl public.plants%rowtype; sp record; fid uuid;
begin
  select * into pl from public.plants where id = p_plant and family_id = public.my_family_id();
  if not found then raise exception 'invalid_plant'; end if;
  fid := public._garden_guard(pl.member_id);
  select * into pl from public.plants where id = p_plant for update;
  select * into sp from public.garden_species() where id = pl.species;
  if pl.watered < sp.need then raise exception 'not_ready'; end if;
  update public.plants set watered = sp.keep, harvests = harvests + 1 where id = p_plant;
  insert into public.coin_ledger (family_id, member_id, amount, kind, ref_id) values (fid, pl.member_id, sp.fruit, 'garden', p_plant);
  return sp.fruit;
end $$;
revoke all on function public.garden_species(), public.garden_pots(), public.garden_slot_price(int), public.harvest_plant(uuid) from public, anon;
grant execute on function public.garden_species(), public.garden_pots(), public.garden_slot_price(int), public.harvest_plant(uuid) to authenticated;
