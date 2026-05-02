
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'sub_admin', 'teacher');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'exception');
CREATE TYPE public.exam_term AS ENUM ('term1', 'term2');
CREATE TYPE public.exam_kind AS ENUM ('mid', 'final');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  photo_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  attendance_permitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- has_role: SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_sub(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','sub_admin'))
$$;

CREATE OR REPLACE FUNCTION public.is_enabled(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.profiles WHERE id = _user_id), false)
$$;

-- Trigger: on signup, create profile + assign role.
-- First user ever => admin + enabled. Others => teacher + disabled (admin must approve).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;

  IF user_count = 0 THEN
    INSERT INTO public.profiles (id, email, full_name, enabled)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.profiles (id, email, full_name, enabled)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), false);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SCHOOL SETTINGS ============
CREATE TABLE public.school_settings (
  id INT PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'My School',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  account_number TEXT,
  student_id_prefix TEXT NOT NULL DEFAULT 'STU-',
  student_id_padding INT NOT NULL DEFAULT 4,
  non_school_weekdays INT[] NOT NULL DEFAULT '{5}', -- 0=Sun..6=Sat; default Friday
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.school_settings (id) VALUES (1);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACADEMIC ============
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, academic_year_id)
);

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  UNIQUE (class_id, subject_id)
);

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  photo_url TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  roll_number INT,
  parent_name TEXT,
  parent_phone TEXT,
  address TEXT,
  exam_code TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, roll_number)
);
CREATE INDEX idx_students_class ON public.students(class_id);
CREATE INDEX idx_students_year ON public.students(academic_year_id);
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto student_code generator
CREATE OR REPLACE FUNCTION public.generate_student_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefix TEXT;
  v_pad INT;
  v_next INT;
BEGIN
  IF NEW.student_code IS NOT NULL AND NEW.student_code <> '' THEN
    RETURN NEW;
  END IF;
  SELECT student_id_prefix, student_id_padding INTO v_prefix, v_pad FROM public.school_settings WHERE id=1;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(student_code, '^'||v_prefix, ''), '')::INT), 0) + 1
    INTO v_next FROM public.students WHERE student_code LIKE v_prefix || '%';
  NEW.student_code := v_prefix || lpad(v_next::TEXT, v_pad, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_students_code BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.generate_student_code();

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift1 attendance_status,
  shift2 attendance_status,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX idx_attendance_date ON public.attendance(date);

-- Prevent future-date attendance
CREATE OR REPLACE FUNCTION public.check_attendance_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot record attendance for a future date';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_attendance_date BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.check_attendance_date();

-- ============ FINANCE ============
CREATE TABLE public.fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_recurring BOOLEAN NOT NULL DEFAULT false, -- true = monthly tuition
  default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.fee_types (name, is_recurring, default_amount) VALUES ('Tuition', true, 0);

CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_type_id UUID NOT NULL REFERENCES public.fee_types(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One bill per student per month
CREATE TABLE public.student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, period_year, period_month)
);
CREATE INDEX idx_student_fees_student ON public.student_fees(student_id);
CREATE TRIGGER trg_student_fees_updated BEFORE UPDATE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Items composing each monthly bill
CREATE TABLE public.fee_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID NOT NULL REFERENCES public.student_fees(id) ON DELETE CASCADE,
  fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID NOT NULL REFERENCES public.student_fees(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_fee ON public.payments(student_fee_id);

-- ============ EXAMS ============
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  term exam_term NOT NULL,
  kind exam_kind NOT NULL, -- mid (20) / final (80)
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_date DATE,
  start_time TIME,
  end_time TIME,
  max_marks NUMERIC(6,2) NOT NULL DEFAULT 100,
  UNIQUE (exam_id, class_id, subject_id)
);

CREATE TABLE public.exam_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_subject_id UUID NOT NULL REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks NUMERIC(6,2),
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_subject_id, student_id)
);
CREATE TRIGGER trg_exam_marks_updated BEFORE UPDATE ON public.exam_marks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STAFF / PAYROLL ============
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- linked user (teacher) or null
  active BOOLEAN NOT NULL DEFAULT true,
  joined_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  is_advance BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ EXPENSES ============
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.expense_categories (name) VALUES ('Utilities'),('Supplies'),('Maintenance'),('Other');

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ TRANSPORT ============
CREATE TABLE public.transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.student_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  pickup_point TEXT,
  UNIQUE (student_id, route_id)
);

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ENABLE RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- profiles: user can read/update own; admin can read/update all
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin_or_sub(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- user_roles: only admin manages; everyone reads own
CREATE POLICY "roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_sub(auth.uid()));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- school_settings: anyone authenticated reads; admin only updates
CREATE POLICY "settings_read" ON public.school_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_write" ON public.school_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
-- Public read for exam publish portal
CREATE POLICY "settings_public_read" ON public.school_settings FOR SELECT TO anon USING (true);

-- Generic: admin/sub_admin full; teacher read
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'academic_years','programs','batches','classes','subjects','class_subjects',
    'students','fee_types','fee_structures','student_fees','fee_items','payments',
    'staff','salary_payments','expense_categories','expenses','transport_routes','student_transport'
  ])
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true);', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_sub(auth.uid()));', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_or_sub(auth.uid()));', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));', t||'_del', t);
  END LOOP;
END $$;

-- attendance: read all authenticated; insert/update by admin/sub OR teacher with permission
CREATE POLICY "attendance_read" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_write_ins" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_sub(auth.uid()) OR (public.has_role(auth.uid(),'teacher') AND public.is_enabled(auth.uid()) AND (SELECT attendance_permitted FROM public.profiles WHERE id=auth.uid())));
CREATE POLICY "attendance_write_upd" ON public.attendance FOR UPDATE TO authenticated
  USING (public.is_admin_or_sub(auth.uid()) OR (public.has_role(auth.uid(),'teacher') AND public.is_enabled(auth.uid()) AND (SELECT attendance_permitted FROM public.profiles WHERE id=auth.uid())));
CREATE POLICY "attendance_del" ON public.attendance FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- exams: admin/sub manage; teacher reads
CREATE POLICY "exams_read" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exams_write" ON public.exams FOR ALL TO authenticated USING (public.is_admin_or_sub(auth.uid())) WITH CHECK (public.is_admin_or_sub(auth.uid()));
-- public can read published exams
CREATE POLICY "exams_public" ON public.exams FOR SELECT TO anon USING (published = true);

CREATE POLICY "exam_subjects_read" ON public.exam_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_subjects_write" ON public.exam_subjects FOR ALL TO authenticated USING (public.is_admin_or_sub(auth.uid())) WITH CHECK (public.is_admin_or_sub(auth.uid()));
CREATE POLICY "exam_subjects_public" ON public.exam_subjects FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.published));

-- exam_marks: read by authenticated; teachers can write only for their assigned subject
CREATE POLICY "exam_marks_read" ON public.exam_marks FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_marks_ins" ON public.exam_marks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_sub(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.exam_subjects es
      JOIN public.subjects s ON s.id = es.subject_id
      WHERE es.id = exam_subject_id AND s.teacher_id = auth.uid()
    )
  );
CREATE POLICY "exam_marks_upd" ON public.exam_marks FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_sub(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.exam_subjects es
      JOIN public.subjects s ON s.id = es.subject_id
      WHERE es.id = exam_subject_id AND s.teacher_id = auth.uid()
    )
  );
CREATE POLICY "exam_marks_del" ON public.exam_marks FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
-- public read of marks for published exams (publish portal)
CREATE POLICY "exam_marks_public" ON public.exam_marks FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.exam_subjects es JOIN public.exams e ON e.id=es.exam_id WHERE es.id = exam_subject_id AND e.published));

-- students: public read of minimal info via published exam portal handled at the join level — keep only authenticated read
-- (students table itself stays authenticated-only)

-- announcements
CREATE POLICY "ann_read" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ann_write" ON public.announcements FOR ALL TO authenticated USING (public.is_admin_or_sub(auth.uid())) WITH CHECK (public.is_admin_or_sub(auth.uid()));

-- public read of subjects (for displaying exam result)
CREATE POLICY "subjects_public" ON public.subjects FOR SELECT TO anon USING (true);
-- public read of classes (for result rendering)
CREATE POLICY "classes_public" ON public.classes FOR SELECT TO anon USING (true);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('school-assets','school-assets', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos','student-photos', true) ON CONFLICT DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "school_assets_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'school-assets');
CREATE POLICY "school_assets_admin_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'school-assets' AND public.is_admin_or_sub(auth.uid()));
CREATE POLICY "school_assets_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'school-assets' AND public.is_admin_or_sub(auth.uid()));
CREATE POLICY "school_assets_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'school-assets' AND public.is_admin(auth.uid()));

CREATE POLICY "student_photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
CREATE POLICY "student_photos_auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-photos' AND public.is_admin_or_sub(auth.uid()));
CREATE POLICY "student_photos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'student-photos' AND public.is_admin_or_sub(auth.uid()));
CREATE POLICY "student_photos_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'student-photos' AND public.is_admin(auth.uid()));
