/**
 * Уведомления CloudPayments об оплате подписки.
 *
 * Доступ открывает только этот обработчик. Возврат человека на страницу
 * «спасибо» ничего не подтверждает: адрес возврата виден в браузере и
 * набирается руками, а вебхук приходит с сервера и подписан ключом, который
 * знают только касса и мы. Поэтому кабинет после возврата не верит query, а
 * спрашивает у базы статус счёта (см. billing.functions.ts).
 *
 * Живёт не в routes/, а вызывается из воркер-энтри (src/server.ts) — по той
 * же причине, что и вебхук ботов: файл-маршрут утянул бы серверный доступ к
 * базе в клиентский бандл.
 *
 * Адреса ставятся один раз руками в личном кабинете CloudPayments,
 * «Сайты» → «Уведомления», способ отправки — POST:
 *   Check  https://<домен>/api/pay/check
 *   Pay    https://<домен>/api/pay/pay
 *   Fail   https://<домен>/api/pay/fail
 */

import { applyPaidPayment, markPaymentFailed, paymentById } from "./billing.server";
import { verifySignature } from "./cloudpayments.server";

export const BILLING_WEBHOOK_PREFIX = "/api/pay/";

/**
 * Ответ кассе. code 0 — принято, 10 — счёт не найден, 11 — сумма не та,
 * 12 — принять сейчас не можем (касса повторит доставку).
 *
 * HTTP всегда 200: на любой другой код CloudPayments считает уведомление
 * недоставленным и повторяет его сутками, даже когда повторять бессмысленно.
 */
function reply(code: number): Response {
  return new Response(JSON.stringify({ code }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const notFound = () => new Response("not found", { status: 404 });

export async function handleBillingWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") return notFound();

  const kind = new URL(request.url).pathname
    .slice(BILLING_WEBHOOK_PREFIX.length)
    .replace(/\/+$/, "");
  if (kind !== "check" && kind !== "pay" && kind !== "fail") return notFound();

  // Сырое тело читается до разбора: подпись считается именно по нему.
  const raw = await request.text();
  const signature = request.headers.get("Content-HMAC") ?? request.headers.get("X-Content-HMAC");
  if (!(await verifySignature(raw, signature))) {
    // 404, а не 403: неподписанный запрос не должен узнать, что ручка есть.
    console.error("CloudPayments: подпись уведомления не сошлась");
    return notFound();
  }

  // Уведомления приходят как форма; JSON включается отдельной настройкой,
  // но разбирается тем же кодом, если её однажды включат.
  const data = parseBody(raw, request.headers.get("content-type"));

  const invoiceId = data.InvoiceId ?? "";
  const payment = invoiceId ? await paymentById(invoiceId) : null;
  if (!payment) {
    console.error(`CloudPayments: счёт ${invoiceId || "(пусто)"} не найден`);
    return reply(10);
  }

  if ((data.Currency ?? "RUB") !== "RUB" || Number(data.Amount) !== payment.amount) {
    console.error(
      `CloudPayments: счёт ${payment.id} на ${payment.amount} RUB, ` +
        `уведомление на ${data.Amount} ${data.Currency}`,
    );
    return reply(11);
  }

  try {
    if (kind === "fail") {
      await markPaymentFailed(payment, data.Reason ?? "unknown");
    } else if (kind === "pay") {
      await applyPaidPayment(payment, data.TransactionId ?? null);
    }
    // check остаётся проверкой: счёт найден, сумма сошлась — принимаем.
    return reply(0);
  } catch (error) {
    // База недоступна — просим повторить. Ответ 0 здесь означал бы, что
    // деньги приняты, а доступ не открыт и открывать его больше некому.
    console.error(error);
    return reply(12);
  }
}

type Notification = {
  InvoiceId?: string;
  TransactionId?: string;
  Amount?: string;
  Currency?: string;
  Reason?: string;
};

function parseBody(raw: string, contentType: string | null): Notification {
  if ((contentType ?? "").includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [
          key,
          value == null ? undefined : String(value),
        ]),
      ) as Notification;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw)) as Notification;
}
