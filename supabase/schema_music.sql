-- ==============================================================================
-- BỂ CÁ — SUPABASE DATABASE SCHEMA: MUSIC & STORAGE RLS POLICIES
-- ==============================================================================

-- 1. Table: music_tracks
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  cover_url text,
  audio_url text not null,
  audio_path text,
  storage_bucket text default 'music' not null,
  content_type text,
  is_active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Migration support if table already exists
alter table public.music_tracks add column if not exists sort_order integer default 0 not null;

-- Index for fast retrieval of active tracks for player ordered by sort_order
create index if not exists idx_music_tracks_sort_order on public.music_tracks (is_active, sort_order asc, created_at desc);

-- 2. Enable Row Level Security (RLS)
alter table public.music_tracks enable row level security;

-- 3. RLS Security Policies for music_tracks

-- Policy 1: Normal Users (Anon & Authenticated)
-- Users can ONLY SELECT tracks that are active (is_active = true)
create policy "Users can view active tracks"
  on public.music_tracks
  for select
  using (is_active = true);

-- Policy 2: Admin full access (SELECT, INSERT, UPDATE, DELETE)
-- Checks if authenticated user has role = 'admin' in auth token claims or profiles table
create policy "Admins have full access to music_tracks"
  on public.music_tracks
  for all
  to authenticated
  using (
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ==============================================================================
-- 4. Supabase Storage Buckets for Audio & Covers
-- ==============================================================================

-- Bucket 1: 'music' (for audio files: mp3, wav, flac, ogg, aac)
insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do nothing;

-- Bucket 2: 'music-covers' (for artwork/covers: png, jpg, webp)
insert into storage.buckets (id, name, public)
values ('music-covers', 'music-covers', true)
on conflict (id) do nothing;

-- Storage Policy: Anyone can read files from 'music' bucket
create policy "Public read music audio"
  on storage.objects
  for select
  using (bucket_id = 'music');

-- Storage Policy: Anyone can read files from 'music-covers' bucket
create policy "Public read music covers"
  on storage.objects
  for select
  using (bucket_id = 'music-covers');

-- Storage Policy: Only Admins can upload to 'music'
create policy "Admin upload music audio"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'music'
    and (
      coalesce(auth.jwt() ->> 'role', '') = 'admin'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'admin'
      )
    )
  );

-- Storage Policy: Only Admins can update/delete from 'music'
create policy "Admin modify music audio"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'music'
    and (
      coalesce(auth.jwt() ->> 'role', '') = 'admin'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'admin'
      )
    )
  );
