-- ============================================================
--  PROJECT #GINHAWA — COMPLETE SUPABASE SCHEMA (v2)
--  Paste this entire file into the Supabase SQL Editor and run.
--  Changes from v1:
--    • profiles now stores instagram_link + email
--    • handle_new_user trigger reads those fields
--    • items_with_reporter view exposes reporter_instagram + reporter_email
--    • Storage bucket + policies are now active (not commented out)
-- ============================================================

-- ── 0. EXTENSIONS ─────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ── 1. PROFILES TABLE ─────────────────────────────────────
create table if not exists public.profiles (
  id              uuid        primary key references auth.users(id) on delete cascade,
  full_name       text        not null,
  college_dept    text        not null,
  facebook_link   text,
  instagram_link  text,       -- NEW
  email           text,       -- NEW (visible contact email, not auth email)
  created_at      timestamptz not null default now()
);

-- Add columns if table already exists (safe to re-run)
alter table public.profiles add column if not exists instagram_link text;
alter table public.profiles add column if not exists email          text;

alter table public.profiles enable row level security;

create policy "profiles: public read"
  on public.profiles for select
  using (true);

create policy "profiles: owner update"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);


-- ── 2. ITEMS TABLE ────────────────────────────────────────
create table if not exists public.items (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  title           text        not null,
  description     text,
  category        text        not null
                    check (category in ('Electronics','Documents','Accessories',
                                        'Bags & Apparels','School Supplies','Others')),
  type            text        not null check (type in ('Lost','Found')),
  status          text        not null default 'Searching'
                    check (status in ('Searching','Resolved')),
  campus_location text,
  image_url       text,       -- public URL from Supabase Storage
  created_at      timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "items: public read"
  on public.items for select
  using (true);

create policy "items: authenticated insert"
  on public.items for insert
  with check (auth.uid() = user_id);

create policy "items: owner update"
  on public.items for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "items: owner delete"
  on public.items for delete
  using (auth.uid() = user_id);


-- ── 3. FEEDBACK TABLE ─────────────────────────────────────
create table if not exists public.feedback (
  id            uuid        primary key default uuid_generate_v4(),
  name          text        not null,
  email         text,
  message_type  text,
  message       text        not null,
  created_at    timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback: public insert"
  on public.feedback for insert
  with check (true);

create policy "feedback: authenticated read"
  on public.feedback for select
  using (auth.role() = 'authenticated');


-- ── 4. AUTO-CREATE PROFILE TRIGGER ────────────────────────
-- Reads full_name, college_dept, facebook_link, instagram_link, email
-- from raw_user_meta_data passed by the frontend on signUp().

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, college_dept, facebook_link, instagram_link, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',    'New User'),
    coalesce(new.raw_user_meta_data->>'college_dept', 'Unknown'),
    new.raw_user_meta_data->>'facebook_link',
    new.raw_user_meta_data->>'instagram_link',        -- NEW
    new.raw_user_meta_data->>'email'                  -- NEW
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 5. STORAGE BUCKET ─────────────────────────────────────
-- Creates the item-images bucket and its RLS policies.
-- Safe to re-run — uses ON CONFLICT DO NOTHING.

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict do nothing;

-- Drop old policies before recreating (prevents "already exists" error)
drop policy if exists "item-images: public read"           on storage.objects;
drop policy if exists "item-images: authenticated upload"  on storage.objects;
drop policy if exists "item-images: owner delete"          on storage.objects;

create policy "item-images: public read"
  on storage.objects for select
  using (bucket_id = 'item-images');

create policy "item-images: authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'item-images' and auth.role() = 'authenticated');

create policy "item-images: owner delete"
  on storage.objects for delete
  using (bucket_id = 'item-images' and owner = auth.uid()::text);


-- ── 6. ITEMS_WITH_REPORTER VIEW ───────────────────────────
-- Drop and recreate to pick up the new profile columns.

drop view if exists public.items_with_reporter;

create view public.items_with_reporter as
  select
    i.*,
    p.full_name       as reporter_name,
    p.college_dept    as reporter_college,
    p.facebook_link   as reporter_facebook,
    p.instagram_link  as reporter_instagram,   -- NEW
    p.email           as reporter_email         -- NEW
  from public.items i
  join public.profiles p on p.id = i.user_id;

-- ============================================================
--  END OF SCHEMA v2
-- ============================================================