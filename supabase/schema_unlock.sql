-- ==============================================================================
-- BỂ CÁ — SUPABASE DATABASE SCHEMA: CHARACTER LOCK & USER-SPECIFIC UNLOCK
-- ==============================================================================

-- 1. Table: characters (Global Catalog managed strictly by Admin)
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
  lore text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for fast lookup
create index if not exists idx_characters_locked on public.characters (is_locked, unlock_type);

-- 2. Table: character_secrets (ADMIN-ONLY — NEVER exposed to regular users)
-- Stores hashed unlock codes or private configuration
create table if not exists public.character_secrets (
  character_id uuid primary key references public.characters(id) on delete cascade,
  unlock_code_hash text not null,
  salt text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. Table: user_characters (Per-user relationship & unlock state)
-- Ensures user 1 unlocking character X DOES NOT unlock for user 2!
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

create index if not exists idx_user_characters_user on public.user_characters (user_id, is_unlocked);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
alter table public.characters enable row level security;
alter table public.character_secrets enable row level security;
alter table public.user_characters enable row level security;

-- Policies for public.characters:
-- Anyone (anon / authenticated) can read characters
create policy "Public read characters"
  on public.characters
  for select
  using (true);

-- Only Admin can INSERT / UPDATE / DELETE characters
create policy "Admin manage characters"
  on public.characters
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

-- Policies for public.character_secrets:
-- ZERO access for normal users! Only Admin can read/write.
create policy "Admin only character secrets"
  on public.character_secrets
  for all
  to authenticated
  using (
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Policies for public.user_characters:
-- Users can view ONLY their own records
create policy "Users read own character relation"
  on public.user_characters
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can update ONLY non-security fields (is_favorite, is_pet)
-- They CANNOT arbitrarily set is_unlocked = true through client mutation!
create policy "Users update own favorite and pet status"
  on public.user_characters
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and is_unlocked = (select is_unlocked from public.user_characters uc where uc.id = user_characters.id)
    and unlock_source = (select unlock_source from public.user_characters uc where uc.id = user_characters.id)
  );

-- Admin can view and manage all user_characters (for manual unlock/revocation)
create policy "Admin manage all user_characters"
  on public.user_characters
  for all
  to authenticated
  using (
    coalesce(auth.jwt() ->> 'role', '') = 'admin'
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ==============================================================================
-- 5. SECURE STORED PROCEDURES (SECURITY DEFINER) FOR UNLOCK FLOWS
-- ==============================================================================

-- 5.1 Verify code and unlock for caller without exposing the code
create or replace function public.verify_character_unlock_code(
  p_character_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_stored_hash text;
  v_input_hash text;
  v_unlock_type text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập để mở khóa nhân vật.');
  end if;

  -- Check character exists and requires code
  select unlock_type into v_unlock_type
  from public.characters
  where id = p_character_id;

  if v_unlock_type is null then
    return jsonb_build_object('success', false, 'message', 'Nhân vật không tồn tại.');
  end if;

  if v_unlock_type != 'code' then
    return jsonb_build_object('success', false, 'message', 'Nhân vật không sử dụng mã mở khóa.');
  end if;

  -- Retrieve secret hash
  select unlock_code_hash into v_stored_hash
  from public.character_secrets
  where character_id = p_character_id;

  if v_stored_hash is null then
    return jsonb_build_object('success', false, 'message', 'Chưa có cấu hình mã mở khóa cho nhân vật này.');
  end if;

  -- Compare hash (case-insensitive trim)
  v_input_hash := encode(digest(trim(lower(p_code)), 'sha256'), 'hex');

  if v_input_hash != v_stored_hash then
    return jsonb_build_object('success', false, 'message', 'Mã mở khóa không chính xác.');
  end if;

  -- Upsert into user_characters
  insert into public.user_characters (user_id, character_id, is_unlocked, unlocked_at, unlock_source)
  values (v_user_id, p_character_id, true, now(), 'code')
  on conflict (user_id, character_id)
  do update set
    is_unlocked = true,
    unlocked_at = coalesce(public.user_characters.unlocked_at, now()),
    unlock_source = 'code',
    updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Mở khóa nhân vật thành công!');
end;
$$;

-- 5.2 Evaluate condition and unlock for caller
create or replace function public.evaluate_character_unlock_condition(
  p_character_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_unlock_type text;
  v_condition jsonb;
  v_unlocked_count int;
  v_required_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'message', 'Vui lòng đăng nhập.');
  end if;

  select unlock_type, unlock_condition into v_unlock_type, v_condition
  from public.characters
  where id = p_character_id;

  if v_unlock_type != 'condition' or v_condition is null then
    return jsonb_build_object('success', false, 'message', 'Nhân vật không có điều kiện mở khóa hợp lệ.');
  end if;

  -- Example: collection count condition
  if (v_condition ->> 'type') = 'collection_count' then
    v_required_count := coalesce((v_condition ->> 'requiredCount')::int, 3);
    
    select count(*) into v_unlocked_count
    from public.user_characters
    where user_id = v_user_id and is_unlocked = true;

    if v_unlocked_count < v_required_count then
      return jsonb_build_object(
        'success', false, 
        'message', format('Chưa đủ điều kiện: Cần mở khóa ít nhất %s nhân vật (hiện tại: %s).', v_required_count, v_unlocked_count)
      );
    end if;
  end if;

  -- Condition satisfied, grant unlock to caller
  insert into public.user_characters (user_id, character_id, is_unlocked, unlocked_at, unlock_source)
  values (v_user_id, p_character_id, true, now(), 'condition')
  on conflict (user_id, character_id)
  do update set
    is_unlocked = true,
    unlocked_at = coalesce(public.user_characters.unlocked_at, now()),
    unlock_source = 'condition',
    updated_at = now();

  return jsonb_build_object('success', true, 'message', 'Đã thỏa mãn điều kiện và mở khóa thành công!');
end;
$$;
