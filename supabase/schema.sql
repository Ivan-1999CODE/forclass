create extension if not exists pgcrypto;

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  quiz_id text not null,
  quiz_title text not null,
  quiz_date date,
  status text not null default 'waiting',
  total_questions integer not null,
  current_question_index integer not null default -1,
  summary jsonb not null default '[]'::jsonb,
  responses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.quiz_students (
  id uuid primary key,
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  display_name text not null,
  total_score integer not null default 0,
  joined_at timestamptz not null default now()
);

create table if not exists public.quiz_answers (
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  student_id uuid not null references public.quiz_students(id) on delete cascade,
  question_index integer not null,
  prompt text not null,
  selected_index integer,
  selected_text text,
  correct_index integer not null,
  is_correct boolean not null default false,
  response_ms integer,
  score integer not null default 0,
  answered_at timestamptz not null default now(),
  primary key (session_id, student_id, question_index)
);

create index if not exists quiz_sessions_created_at_idx on public.quiz_sessions(created_at desc);
create index if not exists quiz_students_session_id_idx on public.quiz_students(session_id);
create index if not exists quiz_answers_session_id_idx on public.quiz_answers(session_id);

alter table public.quiz_sessions enable row level security;
alter table public.quiz_students enable row level security;
alter table public.quiz_answers enable row level security;
