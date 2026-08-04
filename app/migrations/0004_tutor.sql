-- Совёнок, третий заход: платформа для репетитора.
--
-- Смена модели. Раньше владельцем ученика был один родитель
-- (children.parent_id), он же платил, и весь доступ проверялся
-- сравнением с этим полем. Теперь с одним учеником работают несколько
-- взрослых: репетитор ведёт занятия и платит, родитель смотрит прогресс.
--
-- Миграции прогоняются на каждом старте и должны быть идемпотентными,
-- поэтому ON CONFLICT DO NOTHING, а не INSERT OR IGNORE: второе есть
-- только в SQLite, а на сервере база PostgreSQL (см. deploy/db-gateway).

-- Кто имеет доступ к ученику и в какой роли. children.parent_id остаётся,
-- но означает теперь «кто дал согласие на обработку данных», а не «кто
-- видит»: согласие по 152-ФЗ даёт законный представитель, и подменять его
-- репетитором нельзя.
CREATE TABLE IF NOT EXISTS child_access (
  child_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'parent',
  created_at TEXT NOT NULL,
  PRIMARY KEY (child_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_child_access_user ON child_access(user_id, role);

-- Перенос существующих связей: у сегодняшних родителей ничего не меняется.
-- WHERE обязателен: в INSERT ... SELECT без него SQLite не может разобрать
-- ON CONFLICT (он читается как часть JOIN). Заодно отсекает учеников,
-- заведённых репетитором, — у них parent_id пуст до принятия приглашения.
INSERT INTO child_access (child_id, user_id, role, created_at)
  SELECT id, parent_id, 'parent', created_at FROM children WHERE parent_id IS NOT NULL
  ON CONFLICT (child_id, user_id) DO NOTHING;

-- Приглашение родителя к уже заведённому ученику. Репетитор создаёт
-- ученика сам и сразу начинает работать; родитель по коду заводит себе
-- пароль и ставит согласие. Пароль родителя репетитор не знает никогда.
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  tutor_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'parent',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_invites_child ON invites(child_id);

-- Домашняя работа. Результат отдельно не хранится: он считается из
-- attempts и lessons за окно назначения, эти данные пишутся и так.
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  tutor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  comment TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL,
  canceled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_assignments_child ON assignments(child_id, created_at);

-- Пункт домашки: тема целиком или заход в тренажёр. ref_id — topic_id для
-- kind='topic' и вид тренажёра ('schet' / 'chtenie') для kind='drill'.
CREATE TABLE IF NOT EXISTS assignment_items (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  target_percent INTEGER NOT NULL DEFAULT 70,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_assignment_items ON assignment_items(assignment_id, sort_order);
