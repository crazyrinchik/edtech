-- Свои задания репетитора: текст руками плюс приложенный файл.
--
-- Готовые темы закрывают программу, но у репетитора всегда есть своё:
-- карточка из учебника, страница прописей, задача с занятия. Такое
-- задание проверяет не платформа, а сам педагог — поэтому здесь есть
-- ответ ученика и оценка, которых нет у обычных пунктов домашки.

CREATE TABLE IF NOT EXISTS custom_tasks (
  id TEXT PRIMARY KEY,
  tutor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  -- Файл лежит рядом с заданием в base64. Это осознанный размен: на своём
  -- сервере объектного хранилища нет, а класть файлы на диск контейнера
  -- нельзя — приложение живёт в workerd, у него нет файловой системы.
  -- Отсюда жёсткий предел размера в коде: дампы базы не должны распухать.
  file_name TEXT,
  file_type TEXT,
  file_data TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_tutor ON custom_tasks(tutor_id, created_at);

-- Ответ ученика и оценка педагога. Строка появляется, когда ребёнок
-- отправил ответ, и дополняется, когда работу проверили.
CREATE TABLE IF NOT EXISTS custom_submissions (
  item_id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  answer TEXT,
  submitted_at TEXT,
  grade INTEGER,
  comment TEXT,
  graded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_custom_submissions_child ON custom_submissions(child_id);
