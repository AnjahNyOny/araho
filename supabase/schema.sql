-- ============================================================================
-- ARAHO : Schéma Supabase PostgreSQL avec Multi-Utilisateurs & Partage Public
-- ============================================================================
-- Exécutez ce script dans le "SQL Editor" de votre tableau de bord Supabase.

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";

-- 2. TABLE PROFILES (Liée à auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Création automatique du profil lors de l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. TABLE TASKS
create table if not exists public.tasks (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  name text not null,
  description text default '',
  icon text default 'code',
  color text default '#007AFF',
  daily_goal_min int default 0,
  start_date date default current_date,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- 4. TABLE RECURRENCES
create table if not exists public.recurrences (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  task_id text references public.tasks(id) on delete cascade not null,
  days_of_week int[] not null,
  start_min int not null,
  duration_min int not null,
  from_date date not null,
  until_date date,
  created_at timestamptz default now()
);

alter table public.recurrences enable row level security;

create policy "Users can CRUD own recurrences"
  on public.recurrences for all
  using (auth.uid() = user_id);

-- 5. TABLE SLOTS
create table if not exists public.slots (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  task_id text references public.tasks(id) on delete cascade not null,
  date date not null,
  start_min int not null,
  duration_min int not null,
  status text default 'planned',
  recurrence_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.slots enable row level security;

create policy "Users can CRUD own slots"
  on public.slots for all
  using (auth.uid() = user_id);

-- 6. TABLE SESSIONS
create table if not exists public.sessions (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  task_id text references public.tasks(id) on delete cascade not null,
  slot_id text,
  date date not null,
  status text default 'completed',
  started_at timestamptz,
  ended_at timestamptz,
  duration_min int not null,
  created_at timestamptz default now()
);

alter table public.sessions enable row level security;

create policy "Users can CRUD own sessions"
  on public.sessions for all
  using (auth.uid() = user_id);

-- 7. TABLE NOTES (Privées par défaut)
create table if not exists public.notes (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  session_id text references public.sessions(id) on delete cascade not null,
  task_id text references public.tasks(id) on delete cascade not null,
  date date not null,
  learned text default '',
  difficulties text default '',
  next_step text default '',
  confidence int default 3,
  tags text[] default '{}',
  created_at timestamptz default now()
);

alter table public.notes enable row level security;

create policy "Users can CRUD own notes"
  on public.notes for all
  using (auth.uid() = user_id);

-- 8. TABLE SHARES (Liens de partage secrets en lecture seule)
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  label text default 'Ma petite amie',
  show_tasks boolean default true,
  show_schedule boolean default true,
  show_notes boolean default false, -- IMPORTANT : Notes intimes masquées par défaut
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.shares enable row level security;

create policy "Users can manage own shares"
  on public.shares for all
  using (auth.uid() = user_id);

-- 9. FONCTION RPC DE LECTURE SEULE PUBLIQUE POUR LE LIEN SECRET
-- Cette fonction permet à quiconque ayant le token secret valide de consulter
-- le planning de la période sans avoir besoin d'être authentifié.
create or replace function public.get_shared_schedule(
  p_token text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_share record;
  v_profile record;
  v_tasks jsonb;
  v_slots jsonb;
  v_active_session jsonb;
begin
  -- 1. Vérification du token actif
  select * into v_share
  from public.shares
  where token = p_token and is_active = true;

  if not found then
    return jsonb_build_object('error', 'Lien de partage invalide ou expiré');
  end if;

  -- 2. Profil de l'utilisateur
  select display_name into v_profile
  from public.profiles
  where id = v_share.user_id;

  -- 3. Tâches associées (id, nom, icône, couleur)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'color', t.color,
    'icon', t.icon,
    'dailyGoalMin', t.daily_goal_min
  )), '[]'::jsonb) into v_tasks
  from public.tasks t
  where t.user_id = v_share.user_id and t.archived = false;

  -- 4. Tous les créneaux pour la période demandée :
  --    a) Les créneaux réels (slots)
  --    b) Les occurrences générées par les récurrences pour les jours de la période
  with days as (
    select generate_series(p_start_date::timestamp, p_end_date::timestamp, '1 day'::interval)::date as d
  ),
  real_slots as (
    select 
      s.id,
      s.task_id,
      s.date,
      s.start_min,
      s.duration_min,
      s.status,
      s.recurrence_id
    from public.slots s
    where s.user_id = v_share.user_id
      and s.date >= p_start_date
      and s.date <= p_end_date
  ),
  virtual_slots as (
    select 
      r.id || ':' || days.d as id,
      r.task_id,
      days.d as date,
      r.start_min,
      r.duration_min,
      'planned' as status,
      r.id as recurrence_id
    from days
    cross join public.recurrences r
    join public.tasks t on t.id = r.task_id and t.archived = false
    where r.user_id = v_share.user_id
      and extract(dow from days.d)::int = any(r.days_of_week)
      and days.d >= r.from_date
      and (r.until_date is null or days.d <= r.until_date)
      and not exists (
        select 1 from real_slots rs 
        where rs.recurrence_id = r.id and rs.date = days.d
      )
  ),
  combined_slots as (
    select * from real_slots
    union all
    select * from virtual_slots
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cs.id,
    'taskId', cs.task_id,
    'date', cs.date,
    'startMin', cs.start_min,
    'durationMin', cs.duration_min,
    'status', cs.status
  ) order by cs.start_min), '[]'::jsonb) into v_slots
  from combined_slots cs;

  -- 5. Session active en cours (si l'utilisateur est actuellement en train de faire une session)
  select jsonb_build_object(
    'id', sess.id,
    'taskId', sess.task_id,
    'taskName', t.name,
    'taskColor', t.color,
    'startedAt', sess.started_at,
    'durationMin', sess.duration_min
  ) into v_active_session
  from public.sessions sess
  join public.tasks t on t.id = sess.task_id
  where sess.user_id = v_share.user_id
    and sess.status = 'active'
  order by sess.created_at desc
  limit 1;

  return jsonb_build_object(
    'ownerName', coalesce(v_profile.display_name, 'Mon planning'),
    'label', v_share.label,
    'showTasks', v_share.show_tasks,
    'showSchedule', v_share.show_schedule,
    'showNotes', v_share.show_notes,
    'activeSession', v_active_session,
    'tasks', v_tasks,
    'slots', v_slots
  );
end;
$$;
