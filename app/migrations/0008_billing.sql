-- Счета на подписку. Приём карт — эквайринг T-Bank, чек по 54-ФЗ выбивает
-- подключённая к тому же терминалу касса.
--
-- Отдельная таблица, а не колонки в subscriptions: счёт живёт своей жизнью
-- и до подписки может не дожить. Человек открыл платёжную страницу, закрыл
-- вкладку, вернулся через час и завёл новый счёт — в базе должны остаться
-- обе попытки, иначе непонятно, за что пришли деньги, когда уведомление
-- наконец принесёт OrderId получасовой давности.
--
-- id счёта он же OrderId в банке: свой идентификатор в чужой системе дешевле,
-- чем таблица соответствий, и он же делает вебхук идемпотентным — повтор
-- доставки находит ту же строку уже в статусе paid. Встречный номер банка
-- (PaymentId) ложится в order_id: названия зеркальные, и их легко спутать.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  months INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  -- pending → paid | failed, и paid → refunded, когда деньги вернули.
  -- Дальше refunded переходов нет: возврат закрывает счёт навсегда, а
  -- новая оплата заводит новую строку.
  status TEXT NOT NULL,
  email TEXT,
  order_id TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at);
