-- ============================================================================
-- School Management System — MySQL 8 schema
-- Translated from the original Postgres/Supabase schema.
-- Auto-loaded by docker-compose on first MySQL container start.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ----------------------------------------------------------------------------
-- AUTH (replaces Supabase auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_users (
  id              CHAR(36)     NOT NULL DEFAULT (UUID()),
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_users_email (email)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                    CHAR(36)     NOT NULL,
  email                 VARCHAR(255) NOT NULL,
  full_name             VARCHAR(255) NOT NULL DEFAULT '',
  phone                 VARCHAR(64)  NULL,
  photo_url             TEXT         NULL,
  enabled               TINYINT(1)   NOT NULL DEFAULT 0,
  attendance_permitted  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_profiles_auth FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- USER ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
  id       CHAR(36)                              NOT NULL DEFAULT (UUID()),
  user_id  CHAR(36)                              NOT NULL,
  role     ENUM('admin','sub_admin','teacher')   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- SCHOOL SETTINGS (single row, id=1)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_settings (
  id                    INT          NOT NULL DEFAULT 1,
  name                  VARCHAR(255) NOT NULL DEFAULT 'My School',
  logo_url              TEXT         NULL,
  address               TEXT         NULL,
  phone                 VARCHAR(64)  NULL,
  email                 VARCHAR(255) NULL,
  account_number        VARCHAR(64)  NULL,
  student_id_prefix     VARCHAR(16)  NOT NULL DEFAULT 'STU-',
  student_id_padding    INT          NOT NULL DEFAULT 4,
  non_school_weekdays   JSON         NOT NULL,                          -- e.g. '[5]'
  updated_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT IGNORE INTO school_settings (id, non_school_weekdays) VALUES (1, JSON_ARRAY(5));

-- ----------------------------------------------------------------------------
-- ACADEMIC
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_years (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  name        VARCHAR(64)  NOT NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  is_current  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS programs (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  name         VARCHAR(128) NOT NULL,
  description  TEXT         NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS batches (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  name              VARCHAR(128) NOT NULL,
  academic_year_id  CHAR(36)     NOT NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_batches_year (academic_year_id),
  CONSTRAINT fk_batches_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS classes (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  name        VARCHAR(128) NOT NULL,
  program_id  CHAR(36)     NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_classes_program (program_id),
  CONSTRAINT fk_classes_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  name        VARCHAR(128) NOT NULL,
  code        VARCHAR(64)  NOT NULL,
  teacher_id  CHAR(36)     NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_subjects_teacher (teacher_id),
  CONSTRAINT fk_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS class_subjects (
  id          CHAR(36) NOT NULL DEFAULT (UUID()),
  class_id    CHAR(36) NOT NULL,
  subject_id  CHAR(36) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_class_subject (class_id, subject_id),
  CONSTRAINT fk_cs_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE,
  CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- STUDENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  student_code      VARCHAR(64)  NOT NULL,
  first_name        VARCHAR(128) NOT NULL,
  middle_name       VARCHAR(128) NULL,
  last_name         VARCHAR(128) NOT NULL,
  date_of_birth     DATE         NULL,
  gender            VARCHAR(16)  NULL,
  photo_url         TEXT         NULL,
  class_id          CHAR(36)     NULL,
  program_id        CHAR(36)     NULL,
  batch_id          CHAR(36)     NULL,
  academic_year_id  CHAR(36)     NULL,
  roll_number       INT          NULL,
  parent_name       VARCHAR(255) NULL,
  parent_phone      VARCHAR(64)  NULL,
  address           TEXT         NULL,
  exam_code         VARCHAR(64)  NULL,
  enabled           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_code (student_code),
  KEY idx_students_class (class_id),
  KEY idx_students_program (program_id),
  KEY idx_students_batch (batch_id),
  KEY idx_students_year (academic_year_id),
  CONSTRAINT fk_students_class   FOREIGN KEY (class_id)         REFERENCES classes(id)        ON DELETE SET NULL,
  CONSTRAINT fk_students_program FOREIGN KEY (program_id)       REFERENCES programs(id)       ON DELETE SET NULL,
  CONSTRAINT fk_students_batch   FOREIGN KEY (batch_id)         REFERENCES batches(id)        ON DELETE SET NULL,
  CONSTRAINT fk_students_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- ATTENDANCE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id           CHAR(36)                              NOT NULL DEFAULT (UUID()),
  student_id   CHAR(36)                              NOT NULL,
  date         DATE                                  NOT NULL,
  shift1       ENUM('present','absent','leave','holiday') NULL,
  shift2       ENUM('present','absent','leave','holiday') NULL,
  notes        TEXT                                  NULL,
  recorded_by  CHAR(36)                              NULL,
  created_at   DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_student_date (student_id, date),
  KEY idx_attendance_date (date),
  CONSTRAINT fk_att_student FOREIGN KEY (student_id)  REFERENCES students(id)   ON DELETE CASCADE,
  CONSTRAINT fk_att_user    FOREIGN KEY (recorded_by) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- FINANCE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_types (
  id              CHAR(36)       NOT NULL DEFAULT (UUID()),
  name            VARCHAR(128)   NOT NULL,
  default_amount  DECIMAL(12,2)  NOT NULL DEFAULT 0,
  is_recurring    TINYINT(1)     NOT NULL DEFAULT 0,
  created_at      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fee_structures (
  id           CHAR(36)       NOT NULL DEFAULT (UUID()),
  fee_type_id  CHAR(36)       NOT NULL,
  program_id   CHAR(36)       NULL,
  class_id     CHAR(36)       NULL,
  amount       DECIMAL(12,2)  NOT NULL DEFAULT 0,
  created_at   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_fs_type    FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE CASCADE,
  CONSTRAINT fk_fs_program FOREIGN KEY (program_id)  REFERENCES programs(id)  ON DELETE CASCADE,
  CONSTRAINT fk_fs_class   FOREIGN KEY (class_id)    REFERENCES classes(id)   ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_fees (
  id            CHAR(36)       NOT NULL DEFAULT (UUID()),
  student_id    CHAR(36)       NOT NULL,
  period_year   INT            NOT NULL,
  period_month  INT            NOT NULL,
  total_fee     DECIMAL(12,2)  NOT NULL DEFAULT 0,
  discount      DECIMAL(12,2)  NOT NULL DEFAULT 0,
  paid          DECIMAL(12,2)  NOT NULL DEFAULT 0,
  notes         TEXT           NULL,
  created_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_period (student_id, period_year, period_month),
  CONSTRAINT fk_sf_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fee_items (
  id              CHAR(36)       NOT NULL DEFAULT (UUID()),
  student_fee_id  CHAR(36)       NOT NULL,
  fee_type_id     CHAR(36)       NULL,
  label           VARCHAR(255)   NOT NULL,
  amount          DECIMAL(12,2)  NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_fi_sf   FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
  CONSTRAINT fk_fi_type FOREIGN KEY (fee_type_id)    REFERENCES fee_types(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id              CHAR(36)       NOT NULL DEFAULT (UUID()),
  student_fee_id  CHAR(36)       NOT NULL,
  amount          DECIMAL(12,2)  NOT NULL,
  paid_at         DATE           NOT NULL DEFAULT (CURRENT_DATE),
  method          VARCHAR(32)    NULL,
  notes           TEXT           NULL,
  recorded_by     CHAR(36)       NULL,
  created_at      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_pay_sf   FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE,
  CONSTRAINT fk_pay_user FOREIGN KEY (recorded_by)    REFERENCES auth_users(id)   ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- EXPENSES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  name        VARCHAR(128) NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_expense_category (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id           CHAR(36)       NOT NULL DEFAULT (UUID()),
  category_id  CHAR(36)       NULL,
  description  TEXT           NOT NULL,
  amount       DECIMAL(12,2)  NOT NULL,
  spent_at     DATE           NOT NULL DEFAULT (CURRENT_DATE),
  notes        TEXT           NULL,
  created_by   CHAR(36)       NULL,
  created_at   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_expenses_date (spent_at),
  CONSTRAINT fk_exp_cat  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_exp_user FOREIGN KEY (created_by)  REFERENCES auth_users(id)         ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- PAYROLL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id              CHAR(36)       NOT NULL DEFAULT (UUID()),
  user_id         CHAR(36)       NULL,
  full_name       VARCHAR(255)   NOT NULL,
  role            VARCHAR(128)   NULL,
  email           VARCHAR(255)   NULL,
  phone           VARCHAR(64)    NULL,
  monthly_salary  DECIMAL(12,2)  NOT NULL DEFAULT 0,
  joined_at       DATE           NULL,
  active          TINYINT(1)     NOT NULL DEFAULT 1,
  notes           TEXT           NULL,
  created_at      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salary_payments (
  id            CHAR(36)       NOT NULL DEFAULT (UUID()),
  staff_id      CHAR(36)       NOT NULL,
  period_year   INT            NOT NULL,
  period_month  INT            NOT NULL,
  amount        DECIMAL(12,2)  NOT NULL,
  is_advance    TINYINT(1)     NOT NULL DEFAULT 0,
  paid_at       DATE           NOT NULL DEFAULT (CURRENT_DATE),
  notes         TEXT           NULL,
  created_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sal_period (staff_id, period_year, period_month),
  CONSTRAINT fk_sal_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- TRANSPORT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transport_routes (
  id              CHAR(36)     NOT NULL DEFAULT (UUID()),
  name            VARCHAR(128) NOT NULL,
  driver_name     VARCHAR(128) NULL,
  driver_phone    VARCHAR(64)  NULL,
  vehicle_number  VARCHAR(64)  NULL,
  notes           TEXT         NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_transport (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  student_id    CHAR(36)     NOT NULL,
  route_id      CHAR(36)     NOT NULL,
  pickup_point  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_route (student_id),
  CONSTRAINT fk_st_student FOREIGN KEY (student_id) REFERENCES students(id)         ON DELETE CASCADE,
  CONSTRAINT fk_st_route   FOREIGN KEY (route_id)   REFERENCES transport_routes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- EXAMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exams (
  id                CHAR(36)                          NOT NULL DEFAULT (UUID()),
  name              VARCHAR(128)                      NOT NULL,
  term              ENUM('term1','term2')             NOT NULL,
  kind              ENUM('mid','final')               NOT NULL,
  academic_year_id  CHAR(36)                          NULL,
  start_date        DATE                              NOT NULL,
  end_date          DATE                              NOT NULL,
  published         TINYINT(1)                        NOT NULL DEFAULT 0,
  created_at        DATETIME(3)                       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_exam_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_subjects (
  id          CHAR(36)       NOT NULL DEFAULT (UUID()),
  exam_id     CHAR(36)       NOT NULL,
  subject_id  CHAR(36)       NOT NULL,
  class_id    CHAR(36)       NOT NULL,
  exam_date   DATE           NULL,
  start_time  TIME           NULL,
  end_time    TIME           NULL,
  max_marks   DECIMAL(6,2)   NOT NULL DEFAULT 100,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_subject_class (exam_id, subject_id, class_id),
  CONSTRAINT fk_es_exam    FOREIGN KEY (exam_id)    REFERENCES exams(id)    ON DELETE CASCADE,
  CONSTRAINT fk_es_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_es_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_marks (
  id               CHAR(36)       NOT NULL DEFAULT (UUID()),
  exam_subject_id  CHAR(36)       NOT NULL,
  student_id       CHAR(36)       NOT NULL,
  marks            DECIMAL(6,2)   NULL,
  recorded_by      CHAR(36)       NULL,
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_mark_es_student (exam_subject_id, student_id),
  CONSTRAINT fk_em_es      FOREIGN KEY (exam_subject_id) REFERENCES exam_subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_em_student FOREIGN KEY (student_id)      REFERENCES students(id)      ON DELETE CASCADE,
  CONSTRAINT fk_em_user    FOREIGN KEY (recorded_by)     REFERENCES auth_users(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- ANNOUNCEMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  title       VARCHAR(255) NOT NULL,
  body        TEXT         NOT NULL,
  posted_by   CHAR(36)     NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ann_created (created_at),
  CONSTRAINT fk_ann_user FOREIGN KEY (posted_by) REFERENCES auth_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
