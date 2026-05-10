-- ============================================================================
-- School Management System — SQLite schema
-- Translated from the original Postgres/Supabase schema.
-- Auto-applied on first server boot by db.ts (idempotent).
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- AUTH
CREATE TABLE IF NOT EXISTS auth_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id                    TEXT PRIMARY KEY,
  email                 TEXT NOT NULL,
  full_name             TEXT NOT NULL DEFAULT '',
  phone                 TEXT,
  photo_url             TEXT,
  enabled               INTEGER NOT NULL DEFAULT 0,
  attendance_permitted  INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE
);

-- USER ROLES
CREATE TABLE IF NOT EXISTS user_roles (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role    TEXT NOT NULL CHECK (role IN ('admin','sub_admin','teacher')),
  UNIQUE (user_id, role),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

-- SCHOOL SETTINGS (single row, id=1)
CREATE TABLE IF NOT EXISTS school_settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  name                TEXT NOT NULL DEFAULT 'My School',
  logo_url            TEXT,
  address             TEXT,
  phone               TEXT,
  email               TEXT,
  account_number      TEXT,
  student_id_prefix   TEXT NOT NULL DEFAULT 'STU-',
  student_id_padding  INTEGER NOT NULL DEFAULT 4,
  non_school_weekdays TEXT NOT NULL DEFAULT '[5]',  -- JSON array
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT OR IGNORE INTO school_settings (id) VALUES (1);

-- ACADEMIC
CREATE TABLE IF NOT EXISTS academic_years (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS programs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS batches (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  academic_year_id TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  program_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL,
  teacher_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (teacher_id) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS class_subjects (
  id         TEXT PRIMARY KEY,
  class_id   TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  UNIQUE (class_id, subject_id),
  FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id               TEXT PRIMARY KEY,
  student_code     TEXT NOT NULL UNIQUE,
  first_name       TEXT NOT NULL,
  middle_name      TEXT,
  last_name        TEXT NOT NULL,
  date_of_birth    TEXT,
  gender           TEXT,
  photo_url        TEXT,
  class_id         TEXT,
  program_id       TEXT,
  batch_id         TEXT,
  academic_year_id TEXT,
  roll_number      INTEGER,
  parent_name      TEXT,
  parent_phone     TEXT,
  address          TEXT,
  exam_code        TEXT,
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (class_id)         REFERENCES classes(id)        ON DELETE SET NULL,
  FOREIGN KEY (program_id)       REFERENCES programs(id)       ON DELETE SET NULL,
  FOREIGN KEY (batch_id)         REFERENCES batches(id)        ON DELETE SET NULL,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
);

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL,
  date        TEXT NOT NULL,
  shift1      TEXT CHECK (shift1 IN ('present','absent','leave','holiday')),
  shift2      TEXT CHECK (shift2 IN ('present','absent','leave','holiday')),
  notes       TEXT,
  recorded_by TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (student_id, date),
  FOREIGN KEY (student_id)  REFERENCES students(id)   ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

-- FINANCE
CREATE TABLE IF NOT EXISTS fee_types (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  default_amount REAL NOT NULL DEFAULT 0,
  is_recurring   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id          TEXT PRIMARY KEY,
  fee_type_id TEXT NOT NULL,
  program_id  TEXT,
  class_id    TEXT,
  amount      REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id)  REFERENCES programs(id)  ON DELETE CASCADE,
  FOREIGN KEY (class_id)    REFERENCES classes(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_fees (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL,
  period_year  INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  total_fee    REAL NOT NULL DEFAULT 0,
  discount     REAL NOT NULL DEFAULT 0,
  paid         REAL NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (student_id, period_year, period_month),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fee_items (
  id             TEXT PRIMARY KEY,
  student_fee_id TEXT NOT NULL,
  fee_type_id    TEXT,
  label          TEXT NOT NULL,
  amount         REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_type_id)    REFERENCES fee_types(id)    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id             TEXT PRIMARY KEY,
  student_fee_id TEXT NOT NULL,
  amount         REAL NOT NULL,
  paid_at        TEXT NOT NULL DEFAULT (date('now')),
  method         TEXT,
  notes          TEXT,
  recorded_by    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by)    REFERENCES auth_users(id)   ON DELETE SET NULL
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expense_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  category_id TEXT,
  description TEXT NOT NULL,
  amount      REAL NOT NULL,
  spent_at    TEXT NOT NULL DEFAULT (date('now')),
  notes       TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES auth_users(id)         ON DELETE SET NULL
);

-- PAYROLL
CREATE TABLE IF NOT EXISTS staff (
  id             TEXT PRIMARY KEY,
  user_id        TEXT,
  full_name      TEXT NOT NULL,
  role           TEXT,
  email          TEXT,
  phone          TEXT,
  monthly_salary REAL NOT NULL DEFAULT 0,
  joined_at      TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS salary_payments (
  id           TEXT PRIMARY KEY,
  staff_id     TEXT NOT NULL,
  period_year  INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  amount       REAL NOT NULL,
  is_advance   INTEGER NOT NULL DEFAULT 0,
  paid_at      TEXT NOT NULL DEFAULT (date('now')),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- TRANSPORT
CREATE TABLE IF NOT EXISTS transport_routes (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  driver_name    TEXT,
  driver_phone   TEXT,
  vehicle_number TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS student_transport (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL UNIQUE,
  route_id     TEXT NOT NULL,
  pickup_point TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id)         ON DELETE CASCADE,
  FOREIGN KEY (route_id)   REFERENCES transport_routes(id) ON DELETE CASCADE
);

-- EXAMS
CREATE TABLE IF NOT EXISTS exams (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  term             TEXT NOT NULL CHECK (term IN ('term1','term2')),
  kind             TEXT NOT NULL CHECK (kind IN ('mid','final')),
  academic_year_id TEXT,
  start_date       TEXT NOT NULL,
  end_date         TEXT NOT NULL,
  published        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS exam_subjects (
  id         TEXT PRIMARY KEY,
  exam_id    TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  class_id   TEXT NOT NULL,
  exam_date  TEXT,
  start_time TEXT,
  end_time   TEXT,
  max_marks  REAL NOT NULL DEFAULT 100,
  UNIQUE (exam_id, subject_id, class_id),
  FOREIGN KEY (exam_id)    REFERENCES exams(id)    ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_marks (
  id              TEXT PRIMARY KEY,
  exam_subject_id TEXT NOT NULL,
  student_id      TEXT NOT NULL,
  marks           REAL,
  recorded_by     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (exam_subject_id, student_id),
  FOREIGN KEY (exam_subject_id) REFERENCES exam_subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)      REFERENCES students(id)      ON DELETE CASCADE,
  FOREIGN KEY (recorded_by)     REFERENCES auth_users(id)    ON DELETE SET NULL
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_year ON students(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(spent_at);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);
