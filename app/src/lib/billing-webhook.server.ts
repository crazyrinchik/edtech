/**
 * Уведомления T-Bank об оплате подписки.
 *
 * Доступ открывает только этот обработчик. Возврат человека на страницу
 * «спасибо» ничего не подтверждает: адрес возврата виден в браузере и
 * набирается руками, а уведомление приходит с сервера банка и подписано
 * паролем терминала, который знают только банк и мы. Поэтому кабинет после
 * возврата не верит query, а спрашивает у базы статус счёта (см.
 * billing.functions.ts).
 *
 * Живёт не в routes/, а вызывается из воркер-энтри (src/server.ts) — по той
 * же причине, что и вебхук ботов: файл-маршрут утянул бы серверный доступ к
 * базе в клиентский бандл.
 *
 * Адрес уведомления передаётся в самом Init (NotificationURL), поэтому в
 * личном кабинете банка руками ставить нечего: он всегда совпадает с тем
 * доменом, с которого человек пришёл платить.
 */

import { applyPaidPayment, markPaymentFailed, paymentById } from "./billing.server";
import {
  amountMatches,
  terminalMatches,
  verifyNotification,
  type Notification,
} from "./tbank.server";

export const BILLING_WEBHOOK_PREFIX = "/api/pay/";

/**
 * Банк считает уведомление доставленным, только если в ответе HTTP 200 и тело
 * ровно «OK». Любой другой ответ ставит уведомление в очередь повторов: раз в
 * час сутки, дальше раз в сутки месяц. Это и есть наш способ сказать «сейчас
 * не смогли, принесите ещё раз».
 */
const ok = () => new Response("OK", { status: 200, headers: { "content-type": "text/plain" } });
const retryLater = () => new Response("RETRY", { status: 500 });
const notFound = () => new Response("not found", { status: 404 });

/**
 * Статусы одностадийной оплаты. Деньги списаны в CONFIRMED; AUTHORIZED при
 * ней приходит следом за ним (банк шлёт оба) и сам по себе ничего не
 * открывает. REFUNDED и PARTIAL_REFUNDED сюда тоже приходят, но возврат —
 * отдельная операция в кассе, и подписку он не отзывает: этим занимается
 * человек, а не обработчик.
 */
const PAID = "CONFIRMED";
const FAILED = new Set(["REJECTED", "DEADLINE_EXPIRED", "CANCELED", "AUTH_FAIL"]);

export async function handleBillingWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") return notFound();

  const kind = new URL(request.url).pathname
    .slice(BILLING_WEBHOOK_PREFIX.length)
    .replace(/\/+$/, "");
  if (kind !== "notify") return notFound();

  const data = await parseBody(request);
  if (!data) {
    console.error("T-Bank: уведомление не разобралось");
    return notFound();
  }

  if (!(await verifyNotification(data))) {
    // 404, а не 403: неподписанный запрос не должен узнать, что ручка есть.
    console.error("T-Bank: подпись уведомления не сошлась");
    return notFound();
  }

  // Подпись сошлась — значит, пароль терминала знают. Ключ сверяется всё
  // равно: он говорит, что уведомление про наш терминал, а не про соседний
  // в том же личном кабинете.
  if (!terminalMatches(data.TerminalKey)) {
    console.error(`T-Bank: уведомление с чужого терминала ${String(data.TerminalKey)}`);
    return notFound();
  }

  const notification = data as Notification;
  const orderId = notification.OrderId ?? "";
  const payment = orderId ? await paymentById(orderId) : null;
  if (!payment) {
    // Счёта нет и не появится — повторять бессмысленно, отвечаем «принято».
    console.error(`T-Bank: счёт ${orderId || "(пусто)"} не найден`);
    return ok();
  }

  const status = notification.Status ?? "";
  try {
    if (status === PAID) {
      // Сумма сверяется только здесь: это единственный статус, в котором она
      // что-то решает. У возврата в уведомлении приходит остаток по счёту
      // (после полного возврата — ноль), и общая проверка суммы отбивала бы
      // его как расхождение, не дав дойти до разбора статуса. Отказ сумму
      // тоже не обещает: там важен код ошибки, а не деньги.
      if (!amountMatches(notification.Amount, payment.amount)) {
        console.error(
          `T-Bank: счёт ${payment.id} на ${payment.amount} ₽, ` +
            `уведомление об оплате на ${String(notification.Amount)} коп.`,
        );
        return ok();
      }
      await applyPaidPayment(payment, String(notification.PaymentId ?? ""));
    } else if (FAILED.has(status)) {
      await markPaymentFailed(payment, notification.ErrorCode ?? status);
    }
    // Остальные статусы (NEW, FORM_SHOWED, AUTHORIZING, AUTHORIZED, возвраты)
    // подтверждаем и не трогаем базу: подписку двигают только два исхода.
    // Возврат в их числе намеренно — деньги возвращает человек через кассу,
    // и доступ он же закрывает; автоматически подписку это не отзывает.
    return ok();
  } catch (error) {
    // База недоступна — просим повторить. «OK» здесь означал бы, что деньги
    // приняты, а доступ не открыт и открывать его больше некому.
    console.error(error);
    return retryLater();
  }
}

/**
 * Тело уведомления — JSON. Форму банк не шлёт, но пустое или битое тело
 * возможно всегда, и разбор не должен ронять обработчик до проверки подписи.
 */
async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
