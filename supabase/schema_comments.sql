-- ==============================================================================
-- BỂ CÁ — SUPABASE CHARACTER COMMENTS & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

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
