-- Совёнок: схема MVP. Только аддитивные операции (единая живая база).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'parent',
  subscription_status TEXT NOT NULL DEFAULT 'free',
  consent_pd INTEGER NOT NULL DEFAULT 0,
  consent_child_pd INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT 'owl',
  grade INTEGER NOT NULL,
  birth_year INTEGER,
  daily_limit_min INTEGER NOT NULL DEFAULT 20,
  sound_on INTEGER NOT NULL DEFAULT 1,
  diagnostics_done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  grade INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  summary TEXT,
  is_free INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id, grade, sort_order);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  is_check INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_topic ON tasks(topic_id, sort_order);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_child ON attempts(child_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_topic ON attempts(child_id, topic_id);

CREATE TABLE IF NOT EXISTS progress (
  child_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  stars INTEGER NOT NULL DEFAULT 0,
  best_percent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, topic_id)
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lessons_child ON lessons(child_id, started_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT,
  child_id TEXT,
  props TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name, created_at);

CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  months INTEGER NOT NULL DEFAULT 1,
  used_by TEXT,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
