-- ==============================================================================
-- BỂ CÁ — SUPABASE DATABASE SCHEMA & ADMIN SECURITY POLICIES (PROMPT #5 & PATCH)
-- ==============================================================================

-- 1. PROFILES & ROLE-BASED ACCESS CONTROL (RBAC)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  name text,
  bio text,
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member', 'user')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Ensure columns exist if table was already created earlier
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles enable row level security;

-- Policy: Everyone can read basic profile info
create policy "Public read profiles"
  on public.profiles for select
  using (true);

-- Policy: Users CANNOT change their own role! Only non-security fields can be modified.
create policy "Users update own profile non-security fields"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    -- Prohibit user from mutating role to 'admin'
    role = (select role from public.profiles where id = auth.uid())
  );

-- Helper function: Check if current authenticated user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- Trigger: Automatically handle new user signup
-- Rule: New users receive 'member'. Only owner 'quynhchinga1229@gmail.com' receives 'admin'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    case
      when lower(new.email) = 'quynhchinga1229@gmail.com' then 'admin'
      else 'member'
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case
      when lower(excluded.email) = 'quynhchinga1229@gmail.com' then 'admin'
      else profiles.role
    end,
    updated_at = now();
  return new;
end;
$$;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- Seed/Promote App Owner to sole ADMIN
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = 'quynhchinga1229@gmail.com'
   or id in (select id from auth.users where lower(email) = 'quynhchinga1229@gmail.com');

-- 2. CHARACTERS MASTER CATALOG
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text not null,
  short_description text,
  description text default '',
  character_link text,
  is_locked boolean not null default false,
  unlock_type text not null default 'none' check (unlock_type in ('none', 'code', 'condition', 'manual')),
  unlock_condition jsonb default null,
  tags text[] default '{}',
  quote text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.characters enable row level security;

-- Public can read all characters
create policy "Public read characters"
  on public.characters for select
  using (true);

-- ONLY ADMIN can insert/update/delete characters
create policy "Admin insert characters"
  on public.characters for insert
  to authenticated
  with check (public.is_admin());

create policy "Admin update characters"
  on public.characters for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete characters"
  on public.characters for delete
  to authenticated
  using (public.is_admin());

-- 3. CHARACTER SECRETS (ADMIN ONLY — NEVER EXPOSED TO NORMAL USERS)
create table if not exists public.character_secrets (
  character_id uuid primary key references public.characters(id) on delete cascade,
  unlock_code_hash text not null,
  salt text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.character_secrets enable row level security;

create policy "Admin only character secrets"
  on public.character_secrets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. DYNAMIC TAGS & JUNCTION TABLE
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now() not null
);

create table if not exists public.character_tags (
  character_id uuid not null references public.characters(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (character_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.character_tags enable row level security;

create policy "Public read tags" on public.tags for select using (true);
create policy "Admin manage tags" on public.tags for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Public read character_tags" on public.character_tags for select using (true);
create policy "Admin manage character_tags" on public.character_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. MUSIC TRACKS
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text default '',
  cover_url text default '',
  audio_url text not null,
  is_active boolean not null default true,
  duration integer default 180,
  root_freq numeric default 220,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.music_tracks enable row level security;

-- Normal users can ONLY see active tracks
create policy "Public read active music"
  on public.music_tracks for select
  using (is_active = true or public.is_admin());

-- Admin has full CRUD on music tracks
create policy "Admin manage music"
  on public.music_tracks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6. USER CHARACTERS (PER-USER UNLOCK & FAVORITE STATE)
create table if not exists public.user_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  is_unlocked boolean not null default false,
  unlocked_at timestamptz,
  unlock_source text not null default 'none' check (unlock_source in ('none', 'code', 'condition', 'manual', 'admin')),
  is_favorite boolean not null default false,
  is_pet boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, character_id)
);

alter table public.user_characters enable row level security;

create policy "Users read own character relations"
  on public.user_characters for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Users update own favorite and pet"
  on public.user_characters for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and is_unlocked = (select is_unlocked from public.user_characters uc where uc.id = user_characters.id)
  );

create policy "Admin manage all user_characters"
  on public.user_characters for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 7. AUDIT LOG TABLE
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  entity text not null,
  details text,
  created_at timestamptz default now() not null
);

alter table public.admin_audit_logs enable row level security;
create policy "Admin only audit logs" on public.admin_audit_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 8. STORAGE BUCKET POLICIES
-- bucket 'characters': public read, admin upload/delete
-- bucket 'music': public read, admin upload/delete
-- bucket 'avatars': public read, user-owned upload/delete (<userId>/<fileName>)

-- Insert 'avatars' bucket if not already created
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Insert 'characters' bucket for character avatars
insert into storage.buckets (id, name, public)
values ('characters', 'characters', true)
on conflict (id) do update set public = true;

-- Characters: Public read for all character objects
create policy "Public read characters"
  on storage.objects for select
  using (bucket_id = 'characters');

-- Characters: Admin can insert/update/delete character images
create policy "Admin upload characters"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'characters' and public.is_admin());

create policy "Admin update characters"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'characters' and public.is_admin());

create policy "Admin delete characters"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'characters' and public.is_admin());

-- Avatars: Public read for all avatar objects
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Avatars: Authenticated users can only upload to their own user folder (avatars/<user-id>/*)
create policy "Users upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- Avatars: Authenticated users can only update objects in their own folder
create policy "Users update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- Avatars: Authenticated users can only delete objects in their own folder
create policy "Users delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- 9. CHARACTER COMMENTS & ROW LEVEL SECURITY (RLS) POLICIES
create table if not exists public.character_comments (
  id text primary key,
  character_id text not null,
  user_id text not null,
  author_name text not null,
  author_email text,
  author_role text default 'member' check (author_role in ('admin', 'member')),
  author_avatar text,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.character_comments enable row level security;

-- Everyone can read character comments
drop policy if exists "Public read character comments" on public.character_comments;
create policy "Public read character comments"
  on public.character_comments for select
  using (true);

-- Authenticated users can insert comments with their own user_id (or Admin)
drop policy if exists "Authenticated users insert comments" on public.character_comments;
create policy "Authenticated users insert comments"
  on public.character_comments for insert
  to authenticated
  with check (
    auth.uid()::text = user_id
    or public.is_admin()
  );

-- STRICT RLS: User can delete ONLY their own comments; Admin can delete ANY comment
drop policy if exists "Users and admin delete comments" on public.character_comments;
create policy "Users and admin delete comments"
  on public.character_comments for delete
  to authenticated
  using (
    auth.uid()::text = user_id
    or public.is_admin()
  );

