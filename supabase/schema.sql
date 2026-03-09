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
