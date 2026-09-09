/**
 * Оплата подписки: выставить счёт и узнать, чем он кончился.
 *
 * Один модуль на обе платящие роли. Родитель и репетитор покупают одно и то
 * же — открытые темы для своих детей и учеников, — и разводить это по двум
 * кабинетам значило бы держать две копии работы с деньгами.
 *
 * Общение с банком и записи в таблицах — в tbank.server.ts и
 * billing.server.ts. Здесь только вход из браузера: кто платит, за что и
 * куда его вернуть.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { PLANS, planById } from "../billing";
import { createPayment, markOrder, paymentById } from "../billing.server";
import { billingReady, createOrder } from "../tbank.server";
import { db, requireUser, track } from "../core.server";
import { dismissPromoOffer, promoBannerFor, promoDiscount, verifyPromo } from "../promo.server";

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
 * доезжает от Caddy по http и с внутренним хостом, а банк уведёт человека
 * ровно туда, что мы пришлём, и туда же принесёт уведомление об оплате.
 * Ссылка на http://app:8080 вернула бы его в никуда уже после списания
 * денег, а уведомление — в никуда вместе с доступом к подписке.
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
  const ready = billingReady();
  /* Ступень воронки между регистрацией и нажатием «Оплатить». Без неё
     «никто не платит» неотличимо от «никто не дошёл до формы», а это
     разные беды с разным лечением: первая про кассу, вторая про то, что
     кнопку не находят.

     Отметка ставится, только когда форма и правда показывается: без ключей
     терминала PayForm возвращает null, и записывать «увидел» было бы
     враньём. Пишется на каждое открытие вкладки, а не раз на человека, —
     в воронке считаются разные user_id, повторы её не раздувают. */
  if (ready) await track("subscription_form_shown", { userId: user.id });
  return {
    ready,
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
      promo: z.string().trim().max(32).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requirePayer();
    if (!data.offerAccepted) throw new Error("Без согласия с офертой оплату принять нельзя");
    if (!billingReady()) throw new Error("Приём платежей пока не подключён");

    const plan = planById(data.plan);
    if (!plan) throw new Error("Неизвестный тариф");

    // Код проверяется заново в момент счёта, а не только когда его ввели:
    // между «Применить» и «Оплатить» мог кончиться день или пройти оплата
    // из другой вкладки, и цена в кнопке уже неправда.
    const promo = data.promo ? await promoDiscount(user, data.promo, plan.amount) : null;

    const email = data.email.trim().toLowerCase();
    const payment = await createPayment({ userId: user.id, plan: plan.id, email, promo });

    const origin = siteOrigin();
    const order = await createOrder({
      orderId: payment.id,
      customerKey: user.id,
      amount: payment.amount,
      description: payment.description,
      email,
      successUrl: `${origin}/oplata?p=${payment.id}`,
      failUrl: `${origin}/oplata?p=${payment.id}&sboy=1`,
      notificationUrl: `${origin}/api/pay/notify`,
    });
    await markOrder(payment.id, order.paymentId);

    await track("subscription_payment_started", {
      userId: user.id,
      props: {
        plan: plan.id,
        amount: payment.amount,
        paymentId: payment.id,
        offerAccepted: true,
        promo: promo?.code ?? null,
      },
    });

    return { url: order.url, paymentId: payment.id };
  });

/* ------------------------------------------------------ акция SOVENOK50 */

/**
 * Баннер для кабинета: есть ли у этого человека предложение и до какого
 * часа. Первый вызов заводит предложение, и с него идёт отсчёт дня.
 */
export const promoOffer = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requirePayer();
  return await promoBannerFor(user);
});

export const dismissPromo = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requirePayer();
  await dismissPromoOffer(user.id);
  return { ok: true };
});

/**
 * Проверка кода из формы оплаты. Возвращает срок и процент — цену со
 * скидкой форма считает сама той же функцией, что и сервер
 * (discountedAmount в promo.ts).
 */
export const checkPromo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().trim().min(1).max(32) }))
  .handler(async ({ data }) => {
    const user = await requirePayer();
    const offer = await verifyPromo(user, data.code);
    await track("promo_applied", { userId: user.id, props: { code: offer.code } });
    return offer;
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
      status: payment.status as "pending" | "paid" | "failed" | "refunded",
      amount: payment.amount,
      plan: payment.plan,
      until: payment.status === "paid" ? await activeUntil(user.id) : null,
    };
  });
