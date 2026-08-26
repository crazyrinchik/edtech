-- Заметка репетитора об ученике: «разобрать дроби», «спросить про сотку».
--
-- Видит её только автор: выборка всегда по паре (tutor_id, child_id), в
-- кабинет родителя и на экран ребёнка заметка не отдаётся никаким запросом.
-- Одна строка на пару, а не лента записей: репетитору нужен блокнотик у
-- карточки, история правок ему ничего не даёт.
--
-- Умирает заметка вместе с любым из двоих: purgeChildData чистит по child_id,
-- удаление учётной записи репетитора — по tutor_id (lib/retention.server.ts,
-- deleteAccount в api/app.functions.ts).
CREATE TABLE IF NOT EXISTS tutor_notes (
  tutor_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  note TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tutor_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_tutor_notes_child ON tutor_notes(child_id);
