-- Разовое предложение «SOVENOK50»: скидка 50% на подписку для тех, кто
-- уже был зарегистрирован к моменту запуска акции.
--
-- Строка появляется, когда баннер показан в первый раз, и с этого момента
-- отсчитывается срок: предложение действует до конца того дня, когда
-- человек его увидел. Код один на всех, но одноразовость считается по
-- человеку — used_at ставится, когда оплата со скидкой подтверждена банком.
--
-- Отдельные таблицы, а не колонки в users и payments: миграции прогоняются
-- на каждом старте и обязаны быть идемпотентными, а ALTER TABLE ADD COLUMN
-- в SQLite не умеет IF NOT EXISTS (см. README, раздел про миграции).
CREATE TABLE IF NOT EXISTS promo_offers (
  user_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  shown_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  dismissed_at TEXT,
  used_at TEXT,
  payment_id TEXT
);

-- Какие счета выставлены со скидкой. Пишется при создании счёта, а не при
-- оплате: вебхук должен узнать, что этот pending-счёт был льготным, чтобы
-- погасить предложение — иначе два начатых и брошенных счёта дали бы две
-- оплаты по половине цены.
CREATE TABLE IF NOT EXISTS payment_promo (
  payment_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  full_amount INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_promo_user ON payment_promo(user_id);
