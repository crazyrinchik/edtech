-- Рекламная метка визита, в котором завели учётную запись.
--
-- Отдельная таблица, а не колонки в users: миграции прогоняются на каждом
-- старте и обязаны быть идемпотентными, а ALTER TABLE ADD COLUMN в SQLite
-- не умеет IF NOT EXISTS (см. README, раздел про миграции).
--
-- Строка появляется только когда метка в адресе была: у регистраций из
-- поиска, закладок и приглашений её нет и быть не должно.
CREATE TABLE IF NOT EXISTS signup_source (
  user_id TEXT PRIMARY KEY,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  yclid TEXT,
  landing TEXT,
  created_at TEXT NOT NULL
);

-- По кампании группируют отчёт «сколько регистраций и сколько из них
-- оплатили»; по нему же таблица чаще всего и читается.
CREATE INDEX IF NOT EXISTS idx_signup_source_campaign ON signup_source(utm_campaign);
