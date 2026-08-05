-- Вложение в ответ ученика: фотография тетради или скан.
--
-- Отдельной таблицей, а не колонками в custom_submissions: ALTER TABLE ...
-- ADD COLUMN IF NOT EXISTS есть в PostgreSQL, но не в SQLite, а миграции
-- прогоняются на каждом старте — безусловный ALTER упал бы на втором.
--
-- Хранение то же, что у задания педагога: base64 в базе, предел размера
-- задан в коде. Объектного хранилища на своём сервере нет, а приложение
-- живёт в workerd и файловой системы не имеет.
CREATE TABLE IF NOT EXISTS custom_answer_files (
  item_id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_data TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answer_files_child ON custom_answer_files(child_id);
