-- Thêm 2 chậu hình mèo: Mèo Nơ Đỏ (mèo trắng đeo nơ) và Mèo Con, mỗi chậu 40 Ủn
create or replace function public.garden_pots() returns table (id text, price int)
language sql immutable set search_path = public as $$
  select * from (values ('dat', 0), ('xanh', 20), ('hong', 20), ('sao', 40), ('cau_vong', 60), ('kitty', 40), ('meo', 40)) as t(id, price)
$$;
revoke all on function public.garden_pots() from public, anon;
grant execute on function public.garden_pots() to authenticated;
