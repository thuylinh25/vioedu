-- VioEdu — tách hồ sơ học sinh ra khỏi nhóm.
-- Chạy trong Supabase → SQL Editor, SAU supabase-rls.sql và supabase-profiles.sql.
--
-- Vấn đề: hồ sơ học sinh chỉ tồn tại dưới dạng một hàng trong group_members,
-- tức là một CHỖ NGỒI TRONG NHÓM. Xóa nhóm là xóa hàng đó, và học sinh biến mất
-- khỏi hệ thống kể cả khi em vẫn còn tài khoản.
--
-- Cách chữa: bảng students giữ con người, group_members chỉ còn giữ việc em đó
-- thuộc nhóm nào. Migration này CỘNG THÊM chứ không đổi cột cũ, nên ứng dụng
-- đang chạy không hỏng; trigger bên dưới giữ hai bên khớp nhau.

-- Dự án này từng có một bảng students khác, do supabase.sql (đã lỗi thời) tạo:
-- id bigint, name text, không có user_id. Nếu nó còn đó thì "create table if not
-- exists" bỏ qua lệnh tạo bên dưới và mọi thứ sau đó gãy. Đổi tên nó ra chỗ khác
-- thay vì xóa, để không mất dữ liệu của ai.
do $LEGACY$
begin
  if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'students'
     )
     and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'students' and column_name = 'user_id'
     )
  then
    alter table public.students rename to students_legacy;
  end if;
end $LEGACY$;

create table if not exists public.students (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- Một tài khoản đại diện đúng một học sinh. Xóa tài khoản thì hồ sơ vẫn còn,
  -- chỉ mất liên kết đăng nhập.
  user_id    uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Không cho hai hồ sơ trùng tên khi cả hai đều chưa gắn tài khoản; có tài khoản
-- rồi thì trùng tên là chuyện bình thường và đã có ràng buộc user_id lo.
create unique index if not exists students_name_unlinked_uniq
  on public.students (lower(name))
  where user_id is null;

alter table public.group_members
  add column if not exists student_id uuid references public.students(id) on delete cascade;

-- ---------------------------------------------------------------- backfill --
-- 1. Học sinh đã gắn tài khoản: gộp theo user_id.
insert into public.students (name, user_id)
select distinct on (gm.user_id) gm.name, gm.user_id
from public.group_members gm
where gm.user_id is not null
order by gm.user_id, gm.created_at
on conflict (user_id) do nothing;

-- 2. Học sinh chưa gắn tài khoản: gộp theo tên.
insert into public.students (name)
select distinct on (lower(gm.name)) gm.name
from public.group_members gm
where gm.user_id is null
  and not exists (
    select 1 from public.students s
    where s.user_id is null and lower(s.name) = lower(gm.name)
  )
order by lower(gm.name), gm.created_at
on conflict do nothing;

-- 3. Trỏ từng hàng trong nhóm về hồ sơ tương ứng.
update public.group_members gm
set student_id = s.id
from public.students s
where gm.student_id is null
  and (
    (gm.user_id is not null and s.user_id = gm.user_id)
    or (gm.user_id is null and s.user_id is null and lower(s.name) = lower(gm.name))
  );

-- 4. Tài khoản đã đăng nhập nhưng chưa từng vào nhóm nào: chỉ tạo hồ sơ khi hồ
--    sơ tài khoản có tên thật, chứ không lấy phần trước @ của email làm tên.
insert into public.students (name, user_id)
select p.full_name, p.id
from public.profiles p
where p.full_name is not null
  and btrim(p.full_name) <> ''
  and lower(btrim(p.full_name)) <> lower(split_part(coalesce(p.email, ''), '@', 1))
  and not exists (select 1 from public.students s where s.user_id = p.id)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------- đồng bộ ---
-- Ứng dụng vẫn ghi name/user_id thẳng vào group_members. Trigger này biến mỗi
-- lần ghi đó thành một hồ sơ trong students và gắn student_id, nên không cần
-- sửa ứng dụng trước khi chạy migration.
create or replace function public.sync_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $BODY$
declare found uuid;
begin
  if new.student_id is not null then
    update public.students
      set name = coalesce(nullif(btrim(new.name), ''), name),
          user_id = coalesce(new.user_id, user_id)
      where id = new.student_id;
    return new;
  end if;

  if new.user_id is not null then
    select id into found from public.students where user_id = new.user_id;
  end if;
  if found is null then
    select id into found from public.students
      where user_id is null and lower(name) = lower(btrim(new.name));
  end if;

  if found is null then
    insert into public.students (name, user_id)
      values (btrim(new.name), new.user_id)
      returning id into found;
  else
    update public.students
      set name = coalesce(nullif(btrim(new.name), ''), name),
          user_id = coalesce(new.user_id, user_id)
      where id = found;
  end if;

  new.student_id := found;
  return new;
exception when others then
  -- Hồ sơ là bản lưu bền, không đáng để chặn việc thêm học sinh vào nhóm.
  return new;
end $BODY$;

drop trigger if exists on_group_member_saved on public.group_members;
create trigger on_group_member_saved
  before insert or update on public.group_members
  for each row execute function public.sync_student();

-- ------------------------------------------------------------------- RLS ----
-- Cùng mô hình dùng chung như mọi bảng khác.
alter table public.students enable row level security;

do $POLICY$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'students'
  loop
    execute format('drop policy %I on public.students', p.policyname);
  end loop;
end $POLICY$;

create policy "shared_all" on public.students
  for all to authenticated using (true) with check (true);
