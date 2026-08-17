-- Счета на подписку. Приём карт — CloudPayments, чек по 54-ФЗ выбивает
-- подключённая к нему касса CloudKassir.
--
-- Отдельная таблица, а не колонки в subscriptions: счёт живёт своей жизнью
-- и до подписки может не дожить. Человек открыл платёжную страницу, закрыл
-- вкладку, вернулся через час и завёл новый счёт — в базе должны остаться
-- обе попытки, иначе непонятно, за что пришли деньги, когда вебхук наконец
-- принесёт InvoiceId получасовой давности.
--
-- id счёта он же InvoiceId в CloudPayments: свой идентификатор в чужой
-- системе дешевле, чем таблица соответствий, и он же делает вебхук
-- идемпотентным — повтор доставки находит ту же строку уже в статусе paid.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  months INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  -- pending → paid | failed. Обратных переходов нет: оплаченный счёт
  -- закрыт навсегда, возврат заводится отдельной операцией в кассе.
  status TEXT NOT NULL,
  email TEXT,
  order_id TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at);
