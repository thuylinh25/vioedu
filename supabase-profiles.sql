-- VioEdu — danh sách tài khoản đã đăng nhập, để chọn và thêm vào nhóm.
-- Chạy file này trong Supabase → SQL Editor, SAU supabase-rls.sql.
--
-- Client không đọc được auth.users (PostgREST chỉ phục vụ schema public), nên
-- cần một bảng profiles trong public được trigger đồng bộ từ auth.users.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Ghi lại hồ sơ từ một hàng auth.users. Dùng chung cho trigger và cho backfill.
create or replace function public.sync_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = excluded.full_name,
    avatar_url = excluded.avatar_url;
  return new;
exception when others then
  -- Trigger này chạy TRONG giao dịch tạo tài khoản. Nếu nó báo lỗi thì cả việc
  -- đăng ký hỏng theo ("Database error saving new user"). Hồ sơ chỉ là bản sao
  -- tiện dụng, không đáng để chặn người dùng tạo tài khoản, nên nuốt lỗi ở đây
  -- và để backfill bên dưới bù lại sau.
  return new;
end $;

drop trigger if exists on_auth_user_saved on auth.users;
create trigger on_auth_user_saved
  after insert or update on auth.users
  for each row execute function public.sync_profile();

-- Backfill các tài khoản đã đăng ký trước khi có trigger.
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    u.raw_user_meta_data ->> 'display_name',
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  )
from auth.users u
on conflict (id) do nothing;

-- Liên kết một thành viên trong nhóm với tài khoản đăng nhập của họ.
-- Để null nếu học sinh đó chưa có tài khoản (vẫn thêm tay bằng tên).
alter table public.group_members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Một tài khoản chỉ nằm trong mỗi nhóm một lần; thành viên nhập tay không bị ràng buộc.
create unique index if not exists group_members_group_user_uniq
  on public.group_members (group_id, user_id)
  where user_id is not null;

-- Cùng mô hình dùng chung như các bảng khác: ai đăng nhập cũng thấy mọi hồ sơ,
-- nhưng chỉ sửa được hồ sơ của chính mình.
alter table public.profiles enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;

create policy "read_all" on public.profiles
  for select to authenticated using (true);

-- Ai đăng nhập cũng sửa được hồ sơ, cùng mô hình dùng chung như các bảng khác.
-- Cần thiết để người lập nhóm đặt được tên học sinh cho tài khoản của em đó,
-- và để tên ấy sống sót khi nhóm chứa em bị xóa.
create policy "write_all" on public.profiles
  for update to authenticated using (true) with check (true);
