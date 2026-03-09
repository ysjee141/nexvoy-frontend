-- ==========================================
-- Nexvoy Collaboration & Sharing System
-- Consolidated Database Patch
-- ==========================================

-- 1. Create Tables (if not exists)
CREATE TABLE IF NOT EXISTS public.trip_members (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade,
  invited_email text not null,
  role text check (role in ('owner', 'editor', 'viewer')) default 'editor' not null,
  status text check (status in ('pending', 'accepted')) default 'pending' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.trip_shares (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  share_token text unique not null,
  share_type text check (share_type in ('public', 'password')) default 'public' not null,
  password_hash text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_shares ENABLE ROW LEVEL SECURITY;

-- 2. Security Functions (to break recursion and handle guest access)
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

CREATE OR REPLACE FUNCTION public.check_is_public_trip(_trip_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_shares
    WHERE trip_id = _trip_id AND share_type = 'public'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Comprehensive RLS Policies

-- [TRIPS]
DROP POLICY IF EXISTS "Users can view own trips." ON public.trips;
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
DROP POLICY IF EXISTS "Public select trips if shared" ON public.trips;

CREATE POLICY "Access trips by owner, member, or public share" ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    public.check_is_trip_member(id, auth.uid()) OR
    public.check_is_public_trip(id)
  );

-- [TRIP_SHARES]
DROP POLICY IF EXISTS "Anyone can select share link by token" ON public.trip_shares;
DROP POLICY IF EXISTS "Owners can manage share links" ON public.trip_shares;
DROP POLICY IF EXISTS "Public select trip_shares" ON public.trip_shares;

CREATE POLICY "Public select shares" ON public.trip_shares FOR SELECT USING (true);
CREATE POLICY "Manage shares as owner" ON public.trip_shares FOR ALL USING (public.check_is_trip_owner(trip_id, auth.uid()));

-- [TRIP_MEMBERS]
DROP POLICY IF EXISTS "Users can see members of trips they belong to" ON public.trip_members;
DROP POLICY IF EXISTS "Owners can manage members" ON public.trip_members;

CREATE POLICY "Select members if related" ON public.trip_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    invited_email = (auth.jwt() ->> 'email') OR
    public.check_is_trip_owner(trip_id, auth.uid()) OR
    public.check_is_trip_member(trip_id, auth.uid())
  );

CREATE POLICY "Manage members as owner" ON public.trip_members
  FOR ALL USING (public.check_is_trip_owner(trip_id, auth.uid()));

CREATE POLICY "Invited users can accept invitations" ON public.trip_members
  FOR UPDATE 
  USING (
    invited_email = (auth.jwt() ->> 'email') AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid() AND status = 'accepted'
  );

-- [PLANS]
DROP POLICY IF EXISTS "Users can manage plans for their trips" ON public.plans;
DROP POLICY IF EXISTS "Users with edit permission can manage plans" ON public.plans;
DROP POLICY IF EXISTS "Viewers can select plans" ON public.plans;
DROP POLICY IF EXISTS "Public select plans if shared" ON public.plans;

CREATE POLICY "Select plans if shared or related" ON public.plans
  FOR SELECT USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_member(trip_id, auth.uid()) OR
    public.check_is_public_trip(trip_id)
  );

CREATE POLICY "Manage plans if editor or owner" ON public.plans
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_editor(trip_id, auth.uid())
  );
