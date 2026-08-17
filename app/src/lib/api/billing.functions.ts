/**
 * Оплата подписки: выставить счёт и узнать, чем он кончился.
 *
 * Один модуль на обе платящие роли. Родитель и репетитор покупают одно и то
 * же — открытые темы для своих детей и учеников, — и разводить это по двум
 * кабинетам значило бы держать две копии работы с деньгами.
 *
 * Общение с CloudPayments и записи в таблицах — в cloudpayments.server.ts и
 * billing.server.ts. Здесь только вход из браузера: кто платит, за что и
 * куда его вернуть.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { PLANS, planById } from "../billing";
import { createPayment, markOrder, paymentById } from "../billing.server";
import { billingReady, createOrder } from "../cloudpayments.server";
import { db, requireUser, track } from "../core.server";

const PLAN_IDS = PLANS.map((p) => p.id) as [string, ...string[]];

/** Платит взрослый за себя. Ребёнок в кассу не ходит. */
async function requirePayer() {
  const user = await requireUser();
  if (user.role !== "parent" && user.role !== "tutor" && user.role !== "admin") {
    throw new Error("Подписку оформляет взрослый");
  }
  return user;
}

/**
 * Адрес сайта для возврата из кассы.
 *
 * Собирается из заголовков прокси, а не из request.url: до воркера запрос
 * доезжает от Caddy по http и с внутренним хостом, а CloudPayments уведёт
 * человека ровно туда, что мы пришлём. Ссылка на http://app:8080 вернула бы
 * его в никуда уже после списания денег.
 */
function siteOrigin(): string {
  const request = getRequest();
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

async function activeUntil(userId: string): Promise<string | null> {
  const row = await db()
    .prepare(
      `SELECT end_date FROM subscriptions
        WHERE user_id = ? AND status = 'active' ORDER BY start_date DESC LIMIT 1`,
    )
    .bind(userId)
    .first<{ end_date: string | null }>();
  return row?.end_date ?? null;
}

/**
 * Состояние оплаты для формы: подключена ли касса, куда слать чек, до какого
 * числа уже оплачено.
 *
 * ready приходит с сервера, а не берётся из сборки: ключи живут в окружении,
 * и клиент про них знать не должен. Пока их нет, форма оплаты не рисуется
 * вовсе — вместо неё остаётся промокод.
 */
export const billingInfo = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requirePayer();
  return {
    ready: billingReady(),
    email: user.email,
    active: user.subscriptionStatus === "active",
    until: await activeUntil(user.id),
  };
});

/**
 * Счёт и адрес платёжной страницы.
 *
 * Согласие с офертой приходит отдельным полем и проверяется на сервере:
 * галочка в браузере — это про удобство, а акцепт по п. 3 оферты должен
 * фиксироваться там, где его нельзя снять из консоли. Факт согласия уходит
 * в события вместе с идентификатором счёта.
 */
export const startPayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      plan: z.enum(PLAN_IDS),
      email: z.string().trim().email("Проверьте адрес: на него придёт чек"),
      offerAccepted: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requirePayer();
    if (!data.offerAccepted) throw new Error("Без согласия с офертой оплату принять нельзя");
    if (!billingReady()) throw new Error("Приём платежей пока не подключён");

    const plan = planById(data.plan);
    if (!plan) throw new Error("Неизвестный тариф");

    const email = data.email.trim().toLowerCase();
    const payment = await createPayment({ userId: user.id, plan: plan.id, email });

    const order = await createOrder({
      invoiceId: payment.id,
      accountId: user.id,
      amount: payment.amount,
      description: payment.description,
      email,
      successUrl: `${siteOrigin()}/oplata?p=${payment.id}`,
      failUrl: `${siteOrigin()}/oplata?p=${payment.id}&sboy=1`,
    });
    await markOrder(payment.id, order.orderId);

    await track("subscription_payment_started", {
      userId: user.id,
      props: { plan: plan.id, amount: payment.amount, paymentId: payment.id, offerAccepted: true },
    });

    return { url: order.url, paymentId: payment.id };
  });

/**
 * Чем кончился счёт. Спрашивается со страницы возврата, пока идёт вебхук.
 *
 * Возврат из кассы обгоняет уведомление на секунду-другую, и человек в этот
 * момент видит «ждём подтверждения», а не «не оплачено»: второе неправда и
 * толкает платить второй раз.
 */
export const paymentStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requirePayer();
    const payment = await paymentById(data.id);
    if (!payment || payment.user_id !== user.id) throw new Error("Счёт не найден");
    return {
      status: payment.status as "pending" | "paid" | "failed",
      amount: payment.amount,
      plan: payment.plan,
      until: payment.status === "paid" ? await activeUntil(user.id) : null,
    };
  });
