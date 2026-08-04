-- Награды: пёрышки за работу и лавка аксессуаров.
--
-- Раньше совёнок рос и одевался одним движением: уровень открывал сразу и
-- новый размер, и новую вещь (OWL_UNLOCKS). Теперь это разные вещи. Рост
-- по-прежнему следует за уровнем и даётся сам, а аксессуары покупаются за
-- пёрышки — их приносит в том числе выполненная домашняя работа, ради
-- которой ребёнок и открывает приложение.
--
-- Баланс нигде не хранится: он считается как сумма начислений минус сумма
-- покупок. Отдельное поле с балансом рано или поздно разойдётся с историей,
-- а здесь расходиться нечему.

-- Начисления. Первичный ключ по (ребёнок, источник, объект) и есть защита
-- от повторной выдачи: пёрышки за один и тот же пункт домашки начисляются
-- один раз, сколько бы раз экран ни перезагрузили.
CREATE TABLE IF NOT EXISTS coin_grants (
  child_id TEXT NOT NULL,
  source TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  coins INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (child_id, source, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_coin_grants_child ON coin_grants(child_id);

-- Купленные аксессуары. Цена пишется в строку покупки, а не берётся из
-- каталога при подсчёте: если цена в каталоге изменится, у ребёнка не
-- должен задним числом поменяться баланс.
CREATE TABLE IF NOT EXISTS child_items (
  child_id TEXT NOT NULL,
  item TEXT NOT NULL,
  cost INTEGER NOT NULL,
  bought_at TEXT NOT NULL,
  PRIMARY KEY (child_id, item)
);

-- Что надето сейчас. Отдельной таблицей, а не колонкой в children:
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS есть в PostgreSQL, но не в
-- SQLite, а миграции прогоняются на каждом старте.
CREATE TABLE IF NOT EXISTS child_owl (
  child_id TEXT PRIMARY KEY,
  equipped TEXT,
  updated_at TEXT NOT NULL
);
