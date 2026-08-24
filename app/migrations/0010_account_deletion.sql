-- Удаление учётной записи из кабинета: строки пользователя стираются, но
-- факт согласия и его отзыва обязан пережить аккаунт — им подтверждается
-- правомерность прошлой обработки (п. 9 политики: сведения о согласиях
-- хранятся 3 года после прекращения обработки). Перед DELETE FROM users
-- сюда откладывается минимальный след: кто, когда согласился и когда
-- отозвал. Чистится вручную по истечении срока.
--
-- Отдельная таблица, а не колонка deleted_at в users: ALTER TABLE ... ADD
-- COLUMN IF NOT EXISTS есть в PostgreSQL, но не в SQLite, а миграции
-- прогоняются на каждом старте — безусловный ALTER упал бы на втором.
-- Физическое удаление заодно сразу освобождает почту под повторную
-- регистрацию: UNIQUE-индекс по email остаётся без изменений.
CREATE TABLE IF NOT EXISTS deleted_accounts (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  consent_pd INTEGER NOT NULL DEFAULT 0,
  consent_child_pd INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT,
  registered_at TEXT NOT NULL,
  deleted_at TEXT NOT NULL
);
