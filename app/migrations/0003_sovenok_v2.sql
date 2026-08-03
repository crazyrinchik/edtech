-- Совёнок, второй заход: код родителя, тренажёры и напоминания в мессенджер.
--
-- Только новые таблицы. ALTER TABLE ... ADD COLUMN IF NOT EXISTS есть в
-- PostgreSQL, но не в SQLite, а миграции прогоняются на каждом старте шлюза —
-- поэтому расширения схемы делаются отдельными таблицами.

-- Код родителя: вход в приложение единый, а кабинет взрослого открывается
-- четырьмя цифрами. Хранится хешем в том же формате, что и пароль.
CREATE TABLE IF NOT EXISTS parent_pins (
  user_id TEXT PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Снятая блокировка кабинета живёт своей короткой сессией: закрыл вкладку,
-- прошло два часа — код спросят снова, даже если вход в аккаунт ещё жив.
CREATE TABLE IF NOT EXISTS parent_unlocks (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parent_unlocks_user ON parent_unlocks(user_id);

-- Тренажёры (устный счёт, скорочтение) не привязаны к темам, поэтому пишутся
-- отдельно от lessons: у них нет topic_id, зато есть свои настройки и скорость.
CREATE TABLE IF NOT EXISTS drills (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  settings TEXT,
  correct INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  seconds INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_drills_child ON drills(child_id, created_at);

-- Куда писать родителю, когда ребёнок позанимался. Пока подтверждения нет,
-- строка живёт с кодом привязки и без chat_id.
CREATE TABLE IF NOT EXISTS notify_channels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  chat_id TEXT,
  link_code TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  last_sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notify_user ON notify_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_notify_code ON notify_channels(link_code);
