-- Supabase / PostgreSQL starter schema.
-- Run this in Supabase SQL Editor. Apply RLS policies and auth integration before production.
create extension if not exists pgcrypto;

create type public.classroom_role as enum ('teacher', 'student');
create type public.message_kind as enum ('chat', 'student_question', 'drawing_description', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null check (char_length(room_code) between 3 and 100),
  title text not null default 'STEM Classroom',
  subject text not null default 'general',
  created_by uuid not null references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.classroom_role not null default 'student',
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create table public.classroom_messages (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  kind public.message_kind not null default 'chat',
  body text not null check (char_length(body) <= 5000),
  created_at timestamptz not null default now()
);

create table public.caption_segments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  speaker_id uuid references auth.users(id) on delete set null,
  raw_text text not null,
  processed_text text not null,
  subject text not null default 'general',
  processing_method text not null default 'baseline',
  created_at timestamptz not null default now()
);

create index classroom_messages_room_time_idx
  on public.classroom_messages (classroom_id, created_at);
create index caption_segments_room_time_idx
  on public.caption_segments (classroom_id, created_at);

-- RLS is enabled so tables are not accidentally public. Add policy rules tied to
-- authenticated classroom membership before wiring client-side persistence.
alter table public.profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.classroom_messages enable row level security;
alter table public.caption_segments enable row level security;

-- No permissive policies are added intentionally: direct client access is denied
-- until project-specific authenticated policies are designed.
