-- Role is chosen once at signup (email) or on first visit (Google/phone).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone)
  );
  IF _r IN ('senior', 'family', 'care_team') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _r::public.app_role);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.choose_role(_role public.app_role, _display_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Account type already chosen';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), _role);
  UPDATE public.profiles SET display_name = COALESCE(NULLIF(trim(_display_name), ''), display_name) WHERE id = auth.uid();
END; $$;
REVOKE EXECUTE ON FUNCTION public.choose_role(public.app_role, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_role(public.app_role, TEXT) TO authenticated;

CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_user_id UUID NOT NULL UNIQUE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.patient_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind public.app_role NOT NULL,
  relation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
GRANT SELECT ON public.patient_members TO authenticated;
GRANT ALL ON public.patient_members TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.member_kind(_patient_id UUID, _user_id UUID)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT kind FROM public.patient_members WHERE patient_id = _patient_id AND user_id = _user_id
$$;
REVOKE EXECUTE ON FUNCTION public.member_kind(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_kind(UUID, UUID) TO authenticated;

CREATE POLICY "Senior, care team and shared family read" ON public.patients FOR SELECT TO authenticated USING (
  senior_user_id = auth.uid()
  OR public.member_kind(id, auth.uid()) = 'care_team'
  OR (public.member_kind(id, auth.uid()) = 'family' AND (state->'patient'->'sharedWith') ? auth.uid()::text)
);
CREATE POLICY "Seniors create their own record" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (senior_user_id = auth.uid() AND public.has_role(auth.uid(), 'senior'));
CREATE POLICY "Senior and care team update" ON public.patients FOR UPDATE TO authenticated
  USING (senior_user_id = auth.uid() OR public.member_kind(id, auth.uid()) = 'care_team')
  WITH CHECK (senior_user_id = auth.uid() OR public.member_kind(id, auth.uid()) = 'care_team');

CREATE POLICY "Members and senior read memberships" ON public.patient_members FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.senior_user_id = auth.uid())
);

-- Keep senior_user_id and invite_code fixed after creation.
CREATE OR REPLACE FUNCTION public.patients_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.senior_user_id := OLD.senior_user_id;
  NEW.invite_code := OLD.invite_code;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER patients_guard BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.patients_guard();

-- Family / care team join a senior with the invite code.
CREATE OR REPLACE FUNCTION public.join_patient(_code TEXT, _relation TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pid UUID; _kind public.app_role; _name TEXT; _phone TEXT; _contact JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT role INTO _kind FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('family', 'care_team') LIMIT 1;
  IF _kind IS NULL THEN RAISE EXCEPTION 'Only family and care team can join'; END IF;
  SELECT id INTO _pid FROM public.patients WHERE invite_code = upper(trim(_code));
  IF _pid IS NULL THEN RAISE EXCEPTION 'That code was not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.patient_members WHERE patient_id = _pid AND user_id = auth.uid()) THEN RETURN _pid; END IF;
  SELECT display_name, COALESCE(phone, '') INTO _name, _phone FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.patient_members (patient_id, user_id, kind, relation) VALUES (_pid, auth.uid(), _kind, COALESCE(_relation, ''));
  _contact := jsonb_build_object('id', auth.uid()::text, 'name', COALESCE(NULLIF(_name, ''), 'Family member'),
    'relation', COALESCE(NULLIF(_relation, ''), CASE WHEN _kind = 'care_team' THEN 'Care team' ELSE 'Family' END),
    'phone', _phone, 'kind', CASE WHEN _kind = 'care_team' THEN 'care' ELSE 'family' END);
  UPDATE public.patients SET state = jsonb_set(
    jsonb_set(state, '{patient,contacts}', COALESCE(state->'patient'->'contacts', '[]'::jsonb) || jsonb_build_array(_contact)),
    '{patient,sharedWith}', COALESCE(state->'patient'->'sharedWith', '[]'::jsonb) || to_jsonb(auth.uid()::text))
  WHERE id = _pid;
  RETURN _pid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.join_patient(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_patient(TEXT, TEXT) TO authenticated;

-- Seniors can read their family's names via memberships; family see invite code only via senior.