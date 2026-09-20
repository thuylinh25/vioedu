create table if not exists students (id bigint generated always as identity primary key, name text unique not null);
create table if not exists schedules (id bigint generated always as identity primary key, student_name text not null, study_date date not null, start_time time not null, duration integer not null default 30, done boolean not null default false, created_at timestamptz not null default now());
insert into students(name) values ('Thanh Phong'),('An Nguyên'),('Trà My') on conflict (name) do nothing;
-- Before production, enable RLS and add policies appropriate to your authentication model.
