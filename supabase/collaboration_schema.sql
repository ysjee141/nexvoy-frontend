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
