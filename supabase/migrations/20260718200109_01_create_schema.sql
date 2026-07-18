/*
# MINDCARE — create core schema

## What this does
Creates the full relational schema for the MINDCARE prototype: users (app-level roles),
psychologist profiles, verification documents, tests with questions/options/score ranges,
test attempts with answers, AI chat conversations/messages, notifications, and admin audit log.

This is a single-tenant prototype. The frontend keeps its own simple email/password auth
in the `users` table (NOT Supabase auth.users), so there is no `auth.uid()` ownership to check.
All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because
the data is intentionally shared across the single prototype instance. This matches the
existing localStorage behaviour where every device shares one logical database.

## New tables
1. `users` — accounts with role (STUDENT | PSYCHOLOGIST | ADMIN), status, email/password, profile fields.
2. `psychologist_profiles` — 1:1 with users of role PSYCHOLOGIST: education, specializations, experience, verification status.
3. `documents` — files attached to a psychologist's verification request (type, filename, mime, size).
4. `tests` — authored by psychologists; metadata, status (DRAFT | PUBLISHED | ARCHIVED | HIDDEN), versioning.
5. `questions` — belong to a test, ordered.
6. `answer_options` — belong to a question, carry a score.
7. `score_ranges` — min/max score buckets with title, text, recommendation.
8. `test_attempts` — a student's run of a test; status, total_score, range_id, sharing flags, review status, note.
9. `attempt_answers` — per-question answers inside an attempt; frozen score.
10. `ai_conversations` — a student's chat thread.
11. `ai_messages` — messages in a conversation (user | assistant | system), risk_level.
12. `notifications` — in-app notifications for a user.
13. `audit` — admin action log.

## Security
- RLS enabled on every table.
- All policies are `TO anon, authenticated` with open predicates, because this is a shared
  single-tenant prototype without Supabase Auth (the app manages its own `users` table).

## Notes
- `id` columns are uuid with `gen_random_uuid()` defaults so the client can insert without supplying an id.
- Timestamps default to `now()`.
- Foreign keys use `ON DELETE CASCADE` for owned children (questions, options, ranges, answers, messages).
- `test_attempts.psychologist_id` is denormalised author at attempt start (per spec invariant).
- `attempt_answers.score` is copied from the option at answer time — never recomputed.
*/

-- ========== USERS ==========
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('STUDENT','PSYCHOLOGIST','ADMIN')),
  full_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED','DELETED')),
  blocked_reason text,
  email_verified_at timestamptz,
  email_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);

-- ========== PSYCHOLOGIST PROFILES ==========
CREATE TABLE IF NOT EXISTS psychologist_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  education text NOT NULL,
  specializations text[] NOT NULL DEFAULT '{}',
  experience_years smallint NOT NULL DEFAULT 0,
  about text,
  verification_status text NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING','APPROVED','REJECTED','NEEDS_MORE_DOCS')),
  verified_at timestamptz,
  verified_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  rejection_reason text,
  admin_comment text
);
ALTER TABLE psychologist_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_profiles" ON psychologist_profiles;
CREATE POLICY "anon_select_profiles" ON psychologist_profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_profiles" ON psychologist_profiles;
CREATE POLICY "anon_insert_profiles" ON psychologist_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_profiles" ON psychologist_profiles;
CREATE POLICY "anon_update_profiles" ON psychologist_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_profiles" ON psychologist_profiles;
CREATE POLICY "anon_delete_profiles" ON psychologist_profiles FOR DELETE TO anon, authenticated USING (true);

-- ========== DOCUMENTS ==========
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('DIPLOMA','CERTIFICATE','OTHER')),
  file_name text NOT NULL,
  mime_type text,
  size_bytes integer,
  storage_key text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO anon, authenticated USING (true);

-- ========== TESTS ==========
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  instruction text NOT NULL DEFAULT '',
  estimated_minutes smallint NOT NULL DEFAULT 5,
  disclaimer text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED','HIDDEN')),
  version smallint NOT NULL DEFAULT 1,
  hidden_reason text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_tests" ON tests;
CREATE POLICY "anon_select_tests" ON tests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tests" ON tests;
CREATE POLICY "anon_insert_tests" ON tests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tests" ON tests;
CREATE POLICY "anon_update_tests" ON tests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tests" ON tests;
CREATE POLICY "anon_delete_tests" ON tests FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS tests_status_category_idx ON tests (status, category);

-- ========== QUESTIONS ==========
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  text text NOT NULL,
  order_index smallint NOT NULL DEFAULT 0
);
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_questions" ON questions;
CREATE POLICY "anon_select_questions" ON questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
CREATE POLICY "anon_insert_questions" ON questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_questions" ON questions;
CREATE POLICY "anon_update_questions" ON questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_questions" ON questions;
CREATE POLICY "anon_delete_questions" ON questions FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS questions_test_idx ON questions (test_id, order_index);

-- ========== ANSWER OPTIONS ==========
CREATE TABLE IF NOT EXISTS answer_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  order_index smallint NOT NULL DEFAULT 0
);
ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_options" ON answer_options;
CREATE POLICY "anon_select_options" ON answer_options FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_options" ON answer_options;
CREATE POLICY "anon_insert_options" ON answer_options FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_options" ON answer_options;
CREATE POLICY "anon_update_options" ON answer_options FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_options" ON answer_options;
CREATE POLICY "anon_delete_options" ON answer_options FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS options_question_idx ON answer_options (question_id, order_index);

-- ========== SCORE RANGES ==========
CREATE TABLE IF NOT EXISTS score_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  min_score integer NOT NULL,
  max_score integer NOT NULL,
  title text NOT NULL,
  result_text text NOT NULL DEFAULT '',
  recommendation text,
  CONSTRAINT score_ranges_min_le_max CHECK (min_score <= max_score)
);
ALTER TABLE score_ranges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ranges" ON score_ranges;
CREATE POLICY "anon_select_ranges" ON score_ranges FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ranges" ON score_ranges;
CREATE POLICY "anon_insert_ranges" ON score_ranges FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ranges" ON score_ranges;
CREATE POLICY "anon_update_ranges" ON score_ranges FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ranges" ON score_ranges;
CREATE POLICY "anon_delete_ranges" ON score_ranges FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS ranges_test_idx ON score_ranges (test_id);

-- ========== TEST ATTEMPTS ==========
CREATE TABLE IF NOT EXISTS test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES users(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  test_id uuid REFERENCES tests(id) ON DELETE CASCADE,
  test_title text NOT NULL,
  psychologist_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','COMPLETED','ABANDONED')),
  total_score integer,
  range_id uuid REFERENCES score_ranges(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  shared boolean NOT NULL DEFAULT false,
  shared_at timestamptz,
  consent_version text,
  revoked_at timestamptz,
  review_status text CHECK (review_status IN ('NEW','VIEWED','NEEDS_CONSULT','CLOSED')),
  reviewed_at timestamptz,
  note text
);
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_attempts" ON test_attempts;
CREATE POLICY "anon_select_attempts" ON test_attempts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_attempts" ON test_attempts;
CREATE POLICY "anon_insert_attempts" ON test_attempts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_attempts" ON test_attempts;
CREATE POLICY "anon_update_attempts" ON test_attempts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_attempts" ON test_attempts;
CREATE POLICY "anon_delete_attempts" ON test_attempts FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS attempts_psych_idx ON test_attempts (psychologist_id, shared, review_status);
CREATE INDEX IF NOT EXISTS attempts_student_idx ON test_attempts (student_id, completed_at);

-- ========== ATTEMPT ANSWERS ==========
CREATE TABLE IF NOT EXISTS attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  question_text text NOT NULL,
  option_id uuid NOT NULL,
  option_text text NOT NULL,
  score integer NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_answers" ON attempt_answers;
CREATE POLICY "anon_select_answers" ON attempt_answers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_answers" ON attempt_answers;
CREATE POLICY "anon_insert_answers" ON attempt_answers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_answers" ON attempt_answers;
CREATE POLICY "anon_update_answers" ON attempt_answers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_answers" ON attempt_answers;
CREATE POLICY "anon_delete_answers" ON attempt_answers FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS answers_attempt_idx ON attempt_answers (attempt_id);

-- ========== AI CONVERSATIONS ==========
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_conversations" ON ai_conversations;
CREATE POLICY "anon_select_conversations" ON ai_conversations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_conversations" ON ai_conversations;
CREATE POLICY "anon_insert_conversations" ON ai_conversations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_conversations" ON ai_conversations;
CREATE POLICY "anon_update_conversations" ON ai_conversations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_conversations" ON ai_conversations;
CREATE POLICY "anon_delete_conversations" ON ai_conversations FOR DELETE TO anon, authenticated USING (true);

-- ========== AI MESSAGES ==========
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  risk_level text NOT NULL DEFAULT 'NONE' CHECK (risk_level IN ('NONE','CONCERN','CRISIS')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ai_messages" ON ai_messages;
CREATE POLICY "anon_select_ai_messages" ON ai_messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ai_messages" ON ai_messages;
CREATE POLICY "anon_insert_ai_messages" ON ai_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ai_messages" ON ai_messages;
CREATE POLICY "anon_update_ai_messages" ON ai_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ai_messages" ON ai_messages;
CREATE POLICY "anon_delete_ai_messages" ON ai_messages FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS ai_messages_conv_idx ON ai_messages (conversation_id, created_at);

-- ========== NOTIFICATIONS ==========
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  body text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, read, created_at);

-- ========== AUDIT LOG ==========
CREATE TABLE IF NOT EXISTS audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_audit" ON audit;
CREATE POLICY "anon_select_audit" ON audit FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit" ON audit;
CREATE POLICY "anon_insert_audit" ON audit FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit" ON audit;
CREATE POLICY "anon_update_audit" ON audit FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit" ON audit;
CREATE POLICY "anon_delete_audit" ON audit FOR DELETE TO anon, authenticated USING (true);
