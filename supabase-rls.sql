-- VioEdu — không gian dữ liệu dùng chung.
-- Mọi tài khoản đã đăng nhập đều đọc và ghi được cùng một bộ nhóm / thành viên /
-- lịch học. Khách chưa đăng nhập (anon) không đọc được gì.
-- Chạy file này trong Supabase → SQL Editor.

alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.schedules      enable row level security;

-- Xoá sạch policy cũ theo tên thật đang có, thay vì đoán tên.
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('groups', 'group_members', 'schedules')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Một policy FOR ALL cho mỗi bảng: đọc, thêm, sửa, xoá đều mở cho vai trò
-- authenticated. owner_id vẫn được ghi lại để biết ai tạo, nhưng không còn
-- giới hạn quyền nữa.
create policy "shared_all" on public.groups
  for all to authenticated using (true) with check (true);

create policy "shared_all" on public.group_members
  for all to authenticated using (true) with check (true);

create policy "shared_all" on public.schedules
  for all to authenticated using (true) with check (true);
