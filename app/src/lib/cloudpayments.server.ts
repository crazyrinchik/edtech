/**
 * CloudPayments: выставление счёта и проверка подписи вебхука.
 *
 * Карты принимает CloudPayments, чек по 54-ФЗ выбивает подключённая к нему
 * касса CloudKassir — это один личный кабинет и одна пара ключей (Public ID
 * и API Secret в разделе «Сайты»). Отдельного клиента для кассы нет: состав
 * чека уезжает вместе со счётом в поле JsonData, касса разбирает его сама.
 *
 * Реквизиты карты сюда не попадают и попасть не могут. Мы выставляем счёт
 * через /orders/create и уводим человека на платёжную страницу
 * CloudPayments; в наш рантайм возвращается только адрес этой страницы.
 * Так пункт 5.3 оферты («Правообладатель не получает и не хранит реквизиты
 * банковских карт») остаётся правдой без единой оговорки, а на нас не
 * ложится PCI DSS.
 */

import { bindings } from "./bindings.server";

const API = "https://api.cloudpayments.ru";

type Credentials = { publicId: string; secret: string };

/**
 * Ключи читаются из окружения при каждом вызове: в workerd env привязывается
 * к запросу, чтение на уровне модуля вернуло бы undefined (см. config.server.ts).
 */
function credentials(): Credentials | null {
  const { CLOUDPAYMENTS_PUBLIC_ID, CLOUDPAYMENTS_API_SECRET } = bindings();
  if (!CLOUDPAYMENTS_PUBLIC_ID || !CLOUDPAYMENTS_API_SECRET) return null;
  return { publicId: CLOUDPAYMENTS_PUBLIC_ID, secret: CLOUDPAYMENTS_API_SECRET };
}

/**
 * Подключён ли приём платежей. Без ключей форма оплаты не показывается вовсе
 * — как и канал напоминаний без токена бота. Кнопка, которая всегда отвечает
 * «не получилось», хуже отсутствующей кнопки.
 */
export function billingReady(): boolean {
  return credentials() !== null;
}

/**
 * Система налогообложения для чека. 0 — ОСН, 1 — УСН доход, 2 — УСН
 * доход-расход, 3 — ЕНВД, 4 — ЕСХН, 5 — патент. По оферте (п. 5.2) у ИП
 * упрощёнка, поэтому умолчание — 1; если бухгалтер скажет иначе, значение
 * меняется переменной окружения без выкладки нового кода.
 */
function taxationSystem(): number {
  const raw = (bindings().CLOUDPAYMENTS_TAXATION_SYSTEM ?? "").trim();
  const parsed = Number(raw);
  return raw && Number.isInteger(parsed) && parsed >= 0 && parsed <= 5 ? parsed : 1;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const creds = credentials();
  if (!creds) throw new Error("Приём платежей не настроен");

  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa(`${creds.publicId}:${creds.secret}`)}`,
    },
    body: JSON.stringify(body),
  });
  // Человеку — что делать, в журнал — что случилось. Ответ кассы («HTTP 401»,
  // «Invalid Public ID») говорит о наших ключах, а не о его карте, и на
  // странице оплаты только пугает.
  if (!response.ok) {
    console.error(`CloudPayments ${path}: HTTP ${response.status} ${await response.text()}`);
    throw new Error(GATEWAY_DOWN);
  }
  return (await response.json()) as T;
}

const GATEWAY_DOWN = "Касса сейчас не отвечает. Попробуйте через минуту — деньги не списаны.";

type OrderResponse = {
  Success: boolean;
  Message?: string | null;
  Model?: { Id?: string; Number?: number; Url?: string };
};

export type CreatedOrder = { url: string; orderId: string | null };

/**
 * Счёт на оплату: возвращает адрес платёжной страницы CloudPayments.
 *
 * amount — рубли целиком, invoiceId — наш идентификатор строки payments:
 * он же вернётся в вебхуке и по нему находится, что именно оплатили.
 * accountId — идентификатор пользователя, по нему в личном кабинете видно
 * плательщика, не заглядывая в нашу базу.
 */
export async function createOrder(order: {
  invoiceId: string;
  accountId: string;
  amount: number;
  description: string;
  email: string;
  successUrl: string;
  failUrl: string;
}): Promise<CreatedOrder> {
  const result = await call<OrderResponse>("/orders/create", {
    Amount: order.amount,
    Currency: "RUB",
    Description: order.description,
    InvoiceId: order.invoiceId,
    AccountId: order.accountId,
    Email: order.email,
    // Письмо со ссылкой на оплату не нужно: человек уже стоит перед формой
    // и уходит на платёжную страницу сразу. Письмо в этот момент только
    // размножает ссылки на один и тот же счёт.
    SendEmail: false,
    SuccessRedirectUrl: order.successUrl,
    FailRedirectUrl: order.failUrl,
    JsonData: { cloudPayments: { customerReceipt: receipt(order) } },
  });

  const url = result.Model?.Url;
  if (!result.Success || !url) {
    console.error(`CloudPayments /orders/create: ${result.Message ?? "ответ без ссылки"}`);
    throw new Error(GATEWAY_DOWN);
  }
  return { url, orderId: result.Model?.Id ?? null };
}

/**
 * Состав чека для CloudKassir.
 *
 * vat: null — «без НДС»: у ИП на упрощёнке налога в чеке нет. method 4 —
 * полный расчёт (деньги и доступ в один момент), object 4 — услуга.
 * amounts.electronic обязателен и должен сходиться с суммой позиции до
 * копейки, иначе касса не примет чек, а платёж при этом пройдёт.
 */
function receipt(order: { amount: number; description: string; email: string }) {
  return {
    Items: [
      {
        label: order.description,
        price: order.amount,
        quantity: 1,
        amount: order.amount,
        vat: null,
        method: 4,
        object: 4,
      },
    ],
    taxationSystem: taxationSystem(),
    email: order.email,
    isBso: false,
    amounts: { electronic: order.amount, advancePayment: 0, credit: 0, provision: 0 },
  };
}

/* ------------------------------------------------------------- вебхуки */

/**
 * Подпись уведомления: base64 от HMAC-SHA256 по сырому телу запроса,
 * ключ — API Secret. Заголовок называется Content-HMAC, но встречается и
 * X-Content-HMAC, поэтому смотрим оба.
 *
 * Сверять нужно именно сырое тело: после разбора в объект и обратной сборки
 * порядок полей и кодирование пробелов уже другие, и подпись не сойдётся.
 */
export async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  const creds = credentials();
  if (!creds || !header) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(creds.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return timingSafeEqual(expected, header.trim());
}

/** Сравнение за постоянное время: обычное === выдаёт длину общего префикса. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
