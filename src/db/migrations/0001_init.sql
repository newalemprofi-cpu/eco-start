-- Eco Start AI — initial schema
-- One source of truth: plain PostgreSQL (works identically against the
-- local Docker container and a hosted Supabase Postgres instance).
-- See docs/ARCHITECTURE.md for the reasoning behind this choice.

create extension if not exists pgcrypto;

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  default_locale text not null default 'kk' check (default_locale in ('kk','ru','en')),
  plan text not null default 'starter',
  created_at timestamptz not null default now()
);

-- A single identity table for every human in the system, including
-- children. Children authenticate with a PIN instead of a password;
-- everyone else authenticates with email + password. This is a
-- deliberate simplification of the blueprint's split User/Child
-- model — see docs/ARCHITECTURE.md "Deviations from the blueprint".
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  role text not null check (role in ('CHILD','PARENT','TEACHER','SCHOOL_ADMIN','SUPER_ADMIN')),
  email text unique,
  login_code text unique,
  password_hash text,
  pin_hash text,
  display_name text not null,
  avatar_url text,
  locale text not null default 'kk' check (locale in ('kk','ru','en')),
  birth_year int,
  group_id uuid,
  xp int not null default 0,
  level int not null default 1,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  -- Children authenticate with a short login_code + PIN (issued/reset by
  -- their teacher or parent); every other role authenticates with
  -- email + password. Never both, never neither.
  constraint users_login_shape check (
    (role = 'CHILD' and pin_hash is not null and login_code is not null and email is null)
    or (role <> 'CHILD' and password_hash is not null and email is not null and login_code is null)
  )
);
create index if not exists idx_users_school_role on users(school_id, role);
create index if not exists idx_users_group on users(group_id);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  age_band text not null default '5-6',
  locale text not null default 'kk' check (locale in ('kk','ru','en')),
  created_at timestamptz not null default now()
);
create index if not exists idx_groups_school on groups(school_id);

alter table users
  add constraint users_group_fk foreign key (group_id) references groups(id) on delete set null;

create table if not exists teacher_groups (
  teacher_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  primary key (teacher_id, group_id)
);

-- Parent <-> child linking is explicit and parent-initiated; consent_at
-- doubles as the parental-consent record required for child data.
create table if not exists parent_child_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references users(id) on delete cascade,
  child_id uuid not null references users(id) on delete cascade,
  relation text not null default 'parent',
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_id, child_id)
);

create table if not exists species (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('PLANT','ANIMAL','LEAF','OBJECT')),
  common_name jsonb not null, -- { "kk": "...", "ru": "...", "en": "..." }
  latin_name text,
  facts jsonb not null default '[]',
  image_url text,
  is_toxic boolean not null default false,
  caution_note jsonb
);

create table if not exists recognitions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users(id) on delete cascade,
  species_id uuid references species(id),
  kind text not null check (kind in ('PLANT','ANIMAL','LEAF','OBJECT')),
  image_url text not null,
  confidence numeric(4,3) not null default 0,
  ai_provider text not null,
  ai_is_mock boolean not null default false,
  ai_summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_recognitions_child on recognitions(child_id);

create table if not exists greenhouse_entries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users(id) on delete cascade,
  species_id uuid references species(id),
  nickname text not null,
  planted_at date not null default current_date,
  water_schedule text not null default 'every_2_days',
  last_watered_at date,
  status text not null default 'active' check (status in ('active','harvested','archived')),
  created_at timestamptz not null default now()
);
create index if not exists idx_greenhouse_child on greenhouse_entries(child_id);

create table if not exists growth_logs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references greenhouse_entries(id) on delete cascade,
  logged_at date not null default current_date,
  height_cm numeric(6,2),
  photo_url text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_growth_logs_entry on growth_logs(entry_id);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title jsonb not null,
  description jsonb not null,
  config jsonb not null default '{}'
);

create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  score int not null default 0,
  correct_count int not null default 0,
  total_count int not null default 0,
  xp_earned int not null default 0,
  attempt_data jsonb not null default '{}'
);
create index if not exists idx_game_sessions_child on game_sessions(child_id);

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title jsonb not null,
  description jsonb not null,
  icon text not null default 'award',
  xp_reward int not null default 0
);

create table if not exists child_achievements (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references users(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (child_id, achievement_id)
);
create index if not exists idx_child_achievements_child on child_achievements(child_id);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  child_id uuid not null references users(id) on delete cascade,
  title jsonb not null,
  reason text not null,
  issued_at timestamptz not null default now()
);
create index if not exists idx_certificates_child on certificates(child_id);

create table if not exists research_projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  created_by uuid not null references users(id) on delete cascade,
  title text not null,
  question text not null,
  hypothesis text not null,
  measurement_unit text not null default 'cm',
  status text not null default 'active' check (status in ('active','completed')),
  conclusion text,
  teacher_feedback text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_research_group on research_projects(group_id);

create table if not exists research_observations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references research_projects(id) on delete cascade,
  child_id uuid not null references users(id) on delete cascade,
  logged_at date not null default current_date,
  measurement numeric(8,2),
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_research_obs_project on research_observations(project_id);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  topic text not null,
  locale text not null default 'kk' check (locale in ('kk','ru','en')),
  age_band text not null default '5-6',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);
create index if not exists idx_lessons_school on lessons(school_id);

create table if not exists lesson_artifacts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  type text not null check (type in (
    'LESSON_PLAN','PRESENTATION','QUIZ','WORKSHEET','COLORING_PAGE',
    'STORY','CERTIFICATE_TEMPLATE','HOMEWORK','OBSERVATION_SHEET'
  )),
  content jsonb not null default '{}',
  ai_provider text,
  ai_is_mock boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lesson_artifacts_lesson on lesson_artifacts(lesson_id);

create table if not exists lesson_assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  due_at date,
  assigned_at timestamptz not null default now()
);
create index if not exists idx_lesson_assignments_group on lesson_assignments(group_id);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  child_id uuid references users(id) on delete set null,
  created_by uuid not null references users(id) on delete cascade,
  type text not null check (type in ('VIDEO','PODCAST','DIGITAL_BOOK','PRESENTATION','CARTOON','VOICE_STORY','NEWS','STORYBOARD')),
  title text not null,
  file_url text,
  thumbnail_url text,
  script_text text,
  storyboard jsonb,
  ai_provider text,
  ai_is_mock boolean not null default false,
  status text not null default 'private' check (status in ('private','shared_family','shared_school')),
  created_at timestamptz not null default now()
);
create index if not exists idx_media_school on media_assets(school_id);
create index if not exists idx_media_child on media_assets(child_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id, read_at);

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null default 'nature_chat' check (kind in ('nature_chat','teacher_assistant')),
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_threads_user on chat_threads(user_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  sender text not null check (sender in ('user','assistant')),
  content text not null,
  safety_flags jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_messages_thread on chat_messages(thread_id);

create table if not exists ai_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  capability text not null,
  provider text not null,
  is_mock boolean not null default false,
  locale text not null default 'kk',
  latency_ms int not null default 0,
  safety_flags jsonb not null default '[]',
  request_summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_logs_school on ai_logs(school_id, created_at desc);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_school on audit_logs(school_id, created_at desc);
