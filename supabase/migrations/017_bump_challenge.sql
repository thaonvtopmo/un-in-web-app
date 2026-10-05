-- +1 / −1 cho kèo cả nhà làm trong một câu lệnh, để bấm nhanh hai lần vẫn cộng đúng 2 (trước đây đọc rồi mới ghi nên có thể mất một lần)
create or replace function public.bump_challenge(p_id uuid, p_member uuid, p_delta int) returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id();
begin
  if fid is null then raise exception 'no_family'; end if;
  if p_delta not in (-1, 1) then raise exception 'invalid_delta'; end if;
  update public.challenges set
    progress_a = case when member_a = p_member then least(target, greatest(0, progress_a + p_delta)) else progress_a end,
    progress_b = case when member_b = p_member then least(target, greatest(0, progress_b + p_delta)) else progress_b end
   where id = p_id and family_id = fid and status = 'active' and p_member in (member_a, member_b);
end $$;
revoke all on function public.bump_challenge(uuid, uuid, int) from public, anon;
grant execute on function public.bump_challenge(uuid, uuid, int) to authenticated;
