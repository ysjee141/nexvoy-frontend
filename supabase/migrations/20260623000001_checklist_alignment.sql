-- Checklist alignment: user categories, template sharing, multi assignees.

-- 1. Category management -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS checklist_categories_owner_name_idx
  ON public.checklist_categories (
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

ALTER TABLE public.checklist_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view default or own checklist categories" ON public.checklist_categories;
CREATE POLICY "Users can view default or own checklist categories"
  ON public.checklist_categories
  FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own checklist categories" ON public.checklist_categories;
CREATE POLICY "Users can insert own checklist categories"
  ON public.checklist_categories
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own checklist categories" ON public.checklist_categories;
CREATE POLICY "Users can update own checklist categories"
  ON public.checklist_categories
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own checklist categories" ON public.checklist_categories;
CREATE POLICY "Users can delete own checklist categories"
  ON public.checklist_categories
  FOR DELETE
  USING (user_id = auth.uid());

INSERT INTO public.checklist_categories (user_id, name, sort_order)
VALUES
  (NULL, '필수', 10),
  (NULL, '의류', 20),
  (NULL, '전자기기', 30),
  (NULL, '세면도구', 40),
  (NULL, '상비약', 50),
  (NULL, '서류', 60),
  (NULL, '음식', 70),
  (NULL, '기타', 80)
ON CONFLICT DO NOTHING;

-- 2. Template sharing --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_template_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.checklist_templates(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'viewer' NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(template_id, shared_with_user_id)
);

ALTER TABLE public.checklist_template_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_is_template_owner(_template_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_templates
    WHERE id = _template_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_can_view_template(_template_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_templates
    WHERE id = _template_id
      AND (user_id IS NULL OR user_id = _user_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.checklist_template_shares
    WHERE template_id = _template_id
      AND shared_with_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_can_edit_template(_template_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_is_template_owner(_template_id, _user_id)
  OR EXISTS (
    SELECT 1
    FROM public.checklist_template_shares
    WHERE template_id = _template_id
      AND shared_with_user_id = _user_id
      AND role = 'editor'
  );
$$;

DROP POLICY IF EXISTS "Users can view public or own templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Users can view accessible templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Owners and editors can update templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Owners can delete templates" ON public.checklist_templates;

CREATE POLICY "Users can view accessible templates"
  ON public.checklist_templates
  FOR SELECT
  USING (public.check_can_view_template(id, auth.uid()));

CREATE POLICY "Users can insert own templates"
  ON public.checklist_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and editors can update templates"
  ON public.checklist_templates
  FOR UPDATE
  USING (public.check_can_edit_template(id, auth.uid()))
  WITH CHECK (user_id IS NULL OR public.check_can_edit_template(id, auth.uid()));

CREATE POLICY "Owners can delete templates"
  ON public.checklist_templates
  FOR DELETE
  USING (public.check_is_template_owner(id, auth.uid()));

DROP POLICY IF EXISTS "Users can view public or own template items" ON public.checklist_template_items;
DROP POLICY IF EXISTS "Users can view accessible template items" ON public.checklist_template_items;
DROP POLICY IF EXISTS "Users can manage own template items" ON public.checklist_template_items;
DROP POLICY IF EXISTS "Owners and editors can manage template items" ON public.checklist_template_items;

CREATE POLICY "Users can view accessible template items"
  ON public.checklist_template_items
  FOR SELECT
  USING (public.check_can_view_template(template_id, auth.uid()));

CREATE POLICY "Owners and editors can manage template items"
  ON public.checklist_template_items
  FOR ALL
  USING (public.check_can_edit_template(template_id, auth.uid()))
  WITH CHECK (public.check_can_edit_template(template_id, auth.uid()));

DROP POLICY IF EXISTS "Template owners can manage shares" ON public.checklist_template_shares;
CREATE POLICY "Template owners can manage shares"
  ON public.checklist_template_shares
  FOR ALL
  USING (public.check_is_template_owner(template_id, auth.uid()))
  WITH CHECK (public.check_is_template_owner(template_id, auth.uid()));

DROP POLICY IF EXISTS "Shared users can view their template shares" ON public.checklist_template_shares;
CREATE POLICY "Shared users can view their template shares"
  ON public.checklist_template_shares
  FOR SELECT
  USING (
    shared_with_user_id = auth.uid()
    OR created_by = auth.uid()
    OR public.check_is_template_owner(template_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.prevent_checklist_template_owner_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'checklist template owner cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_checklist_template_owner_change ON public.checklist_templates;
CREATE TRIGGER prevent_checklist_template_owner_change
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_checklist_template_owner_change();

-- 2-0. Pre-create assignee table before checklist_items policies reference it.
CREATE TABLE IF NOT EXISTS public.checklist_item_assignees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid REFERENCES public.checklist_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(item_id, user_id)
);

ALTER TABLE public.checklist_item_assignees ENABLE ROW LEVEL SECURITY;

-- 2-1. Trip checklist RLS alignment ------------------------------------------
DROP POLICY IF EXISTS "Users with edit permission can manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Select checklists if shared or related" ON public.checklists;
DROP POLICY IF EXISTS "Manage checklists if editor or owner" ON public.checklists;

CREATE POLICY "Select checklists if shared or related"
  ON public.checklists
  FOR SELECT
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_member(trip_id, auth.uid())
    OR public.check_is_public_trip(trip_id)
  );

CREATE POLICY "Manage checklists if editor or owner"
  ON public.checklists
  FOR ALL
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  )
  WITH CHECK (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items if shared or related" ON public.checklist_items;
DROP POLICY IF EXISTS "Manage checklist items if editor or owner" ON public.checklist_items;

CREATE POLICY "Select checklist items if shared or related"
  ON public.checklist_items
  FOR SELECT
  USING (
    checklist_id IN (
      SELECT c.id
      FROM public.checklists c
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_member(c.trip_id, auth.uid())
        OR public.check_is_public_trip(c.trip_id)
    )
    AND (
      COALESCE(is_private, false) = false
      OR assigned_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.checklist_item_assignees a
        WHERE a.item_id = public.checklist_items.id
          AND a.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Manage checklist items if editor or owner"
  ON public.checklist_items
  FOR ALL
  USING (
    checklist_id IN (
      SELECT c.id
      FROM public.checklists c
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_editor(c.trip_id, auth.uid())
    )
  )
  WITH CHECK (
    checklist_id IN (
      SELECT c.id
      FROM public.checklists c
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_editor(c.trip_id, auth.uid())
    )
  );

-- 3. Multi assignees ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_item_assignees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid REFERENCES public.checklist_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(item_id, user_id)
);

ALTER TABLE public.checklist_item_assignees ENABLE ROW LEVEL SECURITY;

INSERT INTO public.checklist_item_assignees (item_id, user_id)
SELECT id, assigned_user_id
FROM public.checklist_items
WHERE assigned_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Users can view assignees for accessible checklist items" ON public.checklist_item_assignees;
CREATE POLICY "Users can view assignees for accessible checklist items"
  ON public.checklist_item_assignees
  FOR SELECT
  USING (
    item_id IN (
      SELECT ci.id
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_member(c.trip_id, auth.uid())
        OR public.check_is_public_trip(c.trip_id)
    )
  );

DROP POLICY IF EXISTS "Editors can manage assignees for checklist items" ON public.checklist_item_assignees;
CREATE POLICY "Editors can manage assignees for checklist items"
  ON public.checklist_item_assignees
  FOR ALL
  USING (
    item_id IN (
      SELECT ci.id
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_editor(c.trip_id, auth.uid())
    )
  )
  WITH CHECK (
    item_id IN (
      SELECT ci.id
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_editor(c.trip_id, auth.uid())
    )
  );

-- 4. Per-user check RLS alignment --------------------------------------------
DROP POLICY IF EXISTS "Users can view user checks for accessible trips" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Users can manage their own checks" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Users can view user checks for accessible checklist items" ON public.checklist_item_user_checks;
DROP POLICY IF EXISTS "Users can manage own checks for accessible checklist items" ON public.checklist_item_user_checks;

CREATE POLICY "Users can view user checks for accessible checklist items"
  ON public.checklist_item_user_checks
  FOR SELECT
  USING (
    item_id IN (
      SELECT ci.id
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_member(c.trip_id, auth.uid())
        OR public.check_is_public_trip(c.trip_id)
    )
  );

CREATE POLICY "Users can manage own checks for accessible checklist items"
  ON public.checklist_item_user_checks
  FOR ALL
  USING (
    user_id = auth.uid()
    AND item_id IN (
      SELECT ci.id
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_member(c.trip_id, auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND item_id IN (
      SELECT ci.id
      FROM public.checklist_items ci
      JOIN public.checklists c ON c.id = ci.checklist_id
      WHERE public.check_is_trip_owner(c.trip_id, auth.uid())
        OR public.check_is_trip_member(c.trip_id, auth.uid())
    )
  );
