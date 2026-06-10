-- 1. Create profiles table linked to auth.users
CREATE TABLE public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  nickname text,
  auth_provider text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Create trips table
CREATE TABLE public.trips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  adults_count integer default 1,
  children_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own trips." ON public.trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trips." ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trips." ON public.trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trips." ON public.trips FOR DELETE USING (auth.uid() = user_id);

-- 3. Create plans table
CREATE TABLE public.plans (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  title text not null,
  location text,
  cost numeric default 0,
  memo text,
  start_datetime_local timestamp without time zone not null,
  end_datetime_local timestamp without time zone not null,
  timezone_string text not null,
  alarm_minutes_before integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage plans for their trips" ON public.plans
  FOR ALL USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- 4. Create plan_urls table
CREATE TABLE public.plan_urls (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade not null,
  url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.plan_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage plan urls for their trips" ON public.plan_urls
  FOR ALL USING (plan_id IN (SELECT id FROM public.plans WHERE trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())));

-- 5. Checklist Templates
CREATE TABLE public.checklist_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade, -- null means public template
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view public or own templates" ON public.checklist_templates
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users can insert own templates" ON public.checklist_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.checklist_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.checklist_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.checklist_template_items (
  id uuid default gen_random_uuid() primary key,
  template_id uuid references public.checklist_templates(id) on delete cascade not null,
  item_name text not null,
  category text default '기타' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view public or own template items" ON public.checklist_template_items
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM public.checklist_templates WHERE user_id IS NULL OR user_id = auth.uid()
    )
  );
CREATE POLICY "Users can manage own template items" ON public.checklist_template_items
  FOR ALL USING (
    template_id IN (
      SELECT id FROM public.checklist_templates WHERE user_id = auth.uid()
    )
  );

-- 6. Trip Checklists
CREATE TABLE public.checklists (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage checklists for their trips" ON public.checklists
  FOR ALL USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE TABLE public.checklist_items (
  id uuid default gen_random_uuid() primary key,
  checklist_id uuid references public.checklists(id) on delete cascade not null,
  item_name text not null,
  category text default '기타' not null,
  is_checked boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage checklist items for their trips" ON public.checklist_items
  FOR ALL USING (checklist_id IN (SELECT id FROM public.checklists WHERE trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())));

-- 7. Function to handle new user insertion automatically
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, auth_provider)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_app_meta_data->>'provider'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- 1. Create trip_members table
CREATE TABLE public.trip_members (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade, -- Null if pending invite
  invited_email text not null,
  role text check (role in ('owner', 'editor', 'viewer')) default 'editor' not null,
  status text check (status in ('pending', 'accepted')) default 'pending' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;

-- 2. Create trip_shares table
CREATE TABLE public.trip_shares (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  share_token text unique not null,
  share_type text check (share_type in ('public', 'password')) default 'public' not null,
  password_hash text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.trip_shares ENABLE ROW LEVEL SECURITY;

-- 3. Revise RLS Policies for trips
-- Allow owners and members to select trips
DROP POLICY IF EXISTS "Users can view own trips." ON public.trips;
CREATE POLICY "Users can view trips they own or are members of." ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.trip_members WHERE trip_id = public.trips.id AND user_id = auth.uid())
  );

-- Allow owners to update
DROP POLICY IF EXISTS "Users can update own trips." ON public.trips;
CREATE POLICY "Owners can update their trips." ON public.trips
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow owners to delete
DROP POLICY IF EXISTS "Users can delete own trips." ON public.trips;
CREATE POLICY "Owners can delete their trips." ON public.trips
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Revise RLS Policies for plans
DROP POLICY IF EXISTS "Users can manage plans for their trips" ON public.plans;
CREATE POLICY "Users with edit permission can manage plans" ON public.plans
  FOR ALL USING (
    trip_id IN (
      SELECT id FROM public.trips WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
    )
  )
  WITH CHECK (
    trip_id IN (
      SELECT id FROM public.trips WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
    )
  );

-- Allow viewers and shared link users to view plans
CREATE POLICY "Viewers can select plans" ON public.plans
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM public.trips WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM public.trip_shares WHERE share_type = 'public' -- basic check, more logic needed in app for password
    )
  );

-- 5. Revise RLS Policies for checklists and items (Same pattern as plans)
DROP POLICY IF EXISTS "Users can manage checklists for their trips" ON public.checklists;
CREATE POLICY "Users with edit permission can manage checklists" ON public.checklists
  FOR ALL USING (
    trip_id IN (
      SELECT id FROM public.trips WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
    )
  );

DROP POLICY IF EXISTS "Users can manage checklist items for their trips" ON public.checklist_items;
CREATE POLICY "Users with edit permission can manage checklist items" ON public.checklist_items
  FOR ALL USING (
    checklist_id IN (
      SELECT id FROM public.checklists WHERE trip_id IN (
        SELECT id FROM public.trips WHERE user_id = auth.uid()
        UNION
        SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid() AND (role = 'owner' OR role = 'editor')
      )
    )
  );

-- 6. Policies for trip_members
CREATE POLICY "Users can see members of trips they belong to" ON public.trip_members
  FOR SELECT USING (
    trip_id IN (
      SELECT id FROM public.trips WHERE user_id = auth.uid()
      UNION
      SELECT trip_id FROM public.trip_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage members" ON public.trip_members
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );
-- Add missing RLS policies for trip_shares
CREATE POLICY "Owners can manage share links" ON public.trip_shares
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

-- Allow anyone to select share links by token (for public/password access)
CREATE POLICY "Anyone can select share link by token" ON public.trip_shares
  FOR SELECT USING (true);
-- 1. Create security functions to break recursion
CREATE OR REPLACE FUNCTION public.check_is_trip_owner(_trip_id uuid, _user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = _trip_id AND user_id = _user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = _trip_id AND user_id = _user_id AND status = 'accepted'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_trip_editor(_trip_id uuid, _user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = _trip_id AND user_id = _user_id AND status = 'accepted' AND role IN ('owner', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Update Trips Policies
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;
CREATE POLICY "Users can view trips they own or are members of." ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR public.check_is_trip_member(id, auth.uid())
  );

-- 3. Update Trip Members Policies
DROP POLICY IF EXISTS "Users can see members of trips they belong to" ON public.trip_members;
CREATE POLICY "Users can see members of trips they belong to" ON public.trip_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    invited_email = (auth.jwt() ->> 'email') OR
    public.check_is_trip_owner(trip_id, auth.uid()) OR
    public.check_is_trip_member(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners can manage members" ON public.trip_members;
CREATE POLICY "Owners can manage members" ON public.trip_members
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid())
  );

-- 4. Update Trip Shares Policies
DROP POLICY IF EXISTS "Owners can manage share links" ON public.trip_shares;
CREATE POLICY "Owners can manage share links" ON public.trip_shares
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid())
  );

-- 5. Update Plans Policies
DROP POLICY IF EXISTS "Users with edit permission can manage plans" ON public.plans;
CREATE POLICY "Users with edit permission can manage plans" ON public.plans
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_editor(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Viewers can select plans" ON public.plans;
CREATE POLICY "Viewers can select plans" ON public.plans
  FOR SELECT USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_member(trip_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares WHERE trip_id = public.plans.trip_id AND share_type = 'public')
  );

-- 6. Update Checklists Policies
DROP POLICY IF EXISTS "Users with edit permission can manage checklists" ON public.checklists;
CREATE POLICY "Users with edit permission can manage checklists" ON public.checklists
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_editor(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
CREATE POLICY "Users with edit permission can manage checklist items" ON public.checklist_items
  FOR ALL USING (
    checklist_id IN (
      SELECT id FROM public.checklists 
      WHERE public.check_is_trip_owner(trip_id, auth.uid()) OR public.check_is_trip_editor(trip_id, auth.uid())
    )
  );
-- Allow anyone to select trip basic info if a public share link exists
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;
CREATE POLICY "Users can view trips via owner, member or public share" ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    public.check_is_trip_member(id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares WHERE trip_id = public.trips.id AND share_type = 'public')
  );
-- Create a function to check if a trip has any public share link
CREATE OR REPLACE FUNCTION public.check_is_public_trip(_trip_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_shares
    WHERE trip_id = _trip_id AND share_type = 'public'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Update trips SELECT policy
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
CREATE POLICY "Users can view trips via owner, member or public share" ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    public.check_is_trip_member(id, auth.uid()) OR
    public.check_is_public_trip(id)
  );
-- Final RLS fix for trips and shares to ensure guest access
-- 1. Ensure trip_shares is truly public for SELECT
DROP POLICY IF EXISTS "Anyone can select share link by token" ON public.trip_shares;
CREATE POLICY "Public select trip_shares" ON public.trip_shares
  FOR SELECT USING (true);

-- 2. Ensure trips is readable if a public share link exists
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
CREATE POLICY "Public select trips if shared" ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    public.check_is_trip_member(id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares ts WHERE ts.trip_id = id AND ts.share_type = 'public')
  );

-- 3. Ensure plans are also readable
DROP POLICY IF EXISTS "Viewers can select plans" ON public.plans;
CREATE POLICY "Public select plans if shared" ON public.plans
  FOR SELECT USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_member(trip_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares ts WHERE ts.trip_id = trip_id AND ts.share_type = 'public')
  );
