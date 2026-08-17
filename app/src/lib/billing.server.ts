/**
 * Подписка со стороны базы: счёт, зачисление оплаты, продление срока.
 *
 * Живёт отдельно от cloudpayments.server.ts намеренно. Там разговор с чужим
 * API, здесь — наши таблицы; вебхуку нужно и то и другое, а серверным
 * функциям кабинета — почти только это. Промокод продлевает подписку той же
 * функцией, что и оплата: срок должен считаться в одном месте, иначе два
 * способа получить доступ разойдутся в мелочах.
 */

import { db, nowIso, track, uid } from "./core.server";
import { planById, type PlanId } from "./billing";

export type PaymentRow = {
  id: string;
  user_id: string;
  plan: string;
  months: number;
  amount: number;
  status: string;
  email: string | null;
  paid_at: string | null;
};

/** Заводит счёт в состоянии pending — до вебхука он ничего не открывает. */
export async function createPayment(input: {
  userId: string;
  plan: PlanId;
  email: string;
}): Promise<{ id: string; amount: number; description: string }> {
  const plan = planById(input.plan);
  if (!plan) throw new Error("Неизвестный тариф");

  const id = uid("pay");
  await db()
    .prepare(
      `INSERT INTO payments (id, user_id, plan, months, amount, currency, status, email, created_at)
       VALUES (?, ?, ?, ?, ?, 'RUB', 'pending', ?, ?)`,
    )
    .bind(id, input.userId, plan.id, plan.months, plan.amount, input.email, nowIso())
    .run();

  return { id, amount: plan.amount, description: plan.receipt };
}

export async function paymentById(id: string): Promise<PaymentRow | null> {
  return await db()
    .prepare(
      `SELECT id, user_id, plan, months, amount, status, email, paid_at
         FROM payments WHERE id = ?`,
    )
    .bind(id)
    .first<PaymentRow>();
}

export async function markOrder(paymentId: string, orderId: string | null): Promise<void> {
  await db()
    .prepare("UPDATE payments SET order_id = ? WHERE id = ?")
    .bind(orderId, paymentId)
    .run();
}

/**
 * Деньги пришли: закрываем счёт и продлеваем подписку.
 *
 * Идемпотентно по статусу счёта. CloudPayments повторяет доставку
 * уведомления, пока не получит ответ, и повтор после сетевого сбоя — не
 * исключение, а норма; без этой проверки второй заход добавил бы месяц
 * доступа за те же деньги.
 */
export async function applyPaidPayment(
  payment: PaymentRow,
  transactionId: string | null,
): Promise<{ until: string } | null> {
  if (payment.status === "paid") return null;

  await db()
    .prepare("UPDATE payments SET status = 'paid', paid_at = ?, transaction_id = ? WHERE id = ?")
    .bind(nowIso(), transactionId, payment.id)
    .run();

  const until = await extendSubscription(payment.user_id, payment.plan, payment.months);
  await track("subscription_paid", {
    userId: payment.user_id,
    props: { plan: payment.plan, amount: payment.amount, paymentId: payment.id },
  });
  return { until };
}

export async function markPaymentFailed(payment: PaymentRow, reason: string): Promise<void> {
  if (payment.status !== "pending") return;
  await db().prepare("UPDATE payments SET status = 'failed' WHERE id = ?").bind(payment.id).run();
  await track("subscription_payment_failed", {
    userId: payment.user_id,
    props: { plan: payment.plan, reason },
  });
}

/**
 * Продление: срок считается от конца уже оплаченного периода, а не от
 * сегодня. Кто платит за год в середине оплаченного месяца, не должен
 * терять остаток — иначе выгоднее ждать, пока доступ кончится.
 *
 * Прошлый период закрывается, вместо него встаёт одна активная строка с
 * новой датой конца: в кабинете показывается «действует до», и двух
 * действующих строк там быть не может.
 */
export async function extendSubscription(
  userId: string,
  plan: string,
  months: number,
): Promise<string> {
  const current = await db()
    .prepare(
      `SELECT end_date FROM subscriptions
        WHERE user_id = ? AND status = 'active' ORDER BY start_date DESC LIMIT 1`,
    )
    .bind(userId)
    .first<{ end_date: string | null }>();

  const from = startFrom(current?.end_date ?? null);
  const until = addMonths(from, months).toISOString();

  await db().batch([
    db().prepare("UPDATE users SET subscription_status = 'active' WHERE id = ?").bind(userId),
    db()
      .prepare(
        "UPDATE subscriptions SET status = 'replaced' WHERE user_id = ? AND status = 'active'",
      )
      .bind(userId),
    db()
      .prepare(
        `INSERT INTO subscriptions (id, user_id, plan, status, start_date, end_date)
         VALUES (?, ?, ?, 'active', ?, ?)`,
      )
      .bind(uid("sub"), userId, plan, nowIso(), until),
  ]);

  return until;
}

/** Остаток прошлого периода сохраняется, просроченный — нет. */
function startFrom(endDate: string | null): Date {
  const now = new Date();
  if (!endDate) return now;
  const end = new Date(endDate);
  return Number.isNaN(end.getTime()) || end < now ? now : end;
}

/**
 * Календарный месяц, а не тридцать суток: оферта считает период
 * календарными днями (п. 4.3 и формула возврата в п. 7.2), и подписка,
 * оплаченная 31 января, должна кончаться в конце февраля, а не 2 марта.
 */
function addMonths(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  // 31 января + 1 месяц даёт 3 марта: в феврале нет тридцать первого, и
  // JS переносит остаток на следующий месяц. Возвращаем на последний день.
  if (result.getUTCDate() < day) result.setUTCDate(0);
  return result;
}
