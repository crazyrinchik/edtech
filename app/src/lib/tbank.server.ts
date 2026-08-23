/**
 * T-Bank (эквайринг): выставление счёта и проверка подписи уведомления.
 *
 * Сценарий без PCI DSS: мы вызываем Init, получаем PaymentURL и уводим
 * человека на платёжную страницу банка. Реквизиты карты сюда не попадают и
 * попасть не могут — так пункт 5.3 оферты («Правообладатель не получает и не
 * хранит реквизиты банковских карт») остаётся правдой без оговорок, а на нас
 * не ложится PCI DSS.
 *
 * Чек по 54-ФЗ выбивает касса, подключённая к тому же терминалу: состав чека
 * уезжает вместе со счётом в поле Receipt, отдельного клиента для кассы нет.
 *
 * Две вещи, на которых легко обжечься при переезде с CloudPayments:
 *
 *   1. Суммы здесь в копейках. В базе и в тарифах (billing.ts) — рубли, как
 *      их видит человек. Пересчёт живёт только в этом файле, ровно в двух
 *      местах: при выставлении счёта и при сверке суммы из уведомления.
 *   2. Сертификат securepay.tinkoff.ru выдан УЦ Минцифры, которого нет ни в
 *      одном браузерном наборе корней. Без него fetch падает с
 *      SELF_SIGNED_CERT_IN_CHAIN ещё до первого байта запроса — корень
 *      подкладывается рантайму в deploy/serve.mjs и deploy/stand.mjs.
 */

import { bindings } from "./bindings.server";

const API = "https://securepay.tinkoff.ru/v2";

type Credentials = { terminalKey: string; password: string };

/**
 * Ключи читаются из окружения при каждом вызове: в workerd env привязывается
 * к запросу, чтение на уровне модуля вернуло бы undefined (см. config.server.ts).
 */
function credentials(): Credentials | null {
  const { TBANK_TERMINAL_KEY, TBANK_TERMINAL_PASSWORD } = bindings();
  if (!TBANK_TERMINAL_KEY || !TBANK_TERMINAL_PASSWORD) return null;
  return { terminalKey: TBANK_TERMINAL_KEY, password: TBANK_TERMINAL_PASSWORD };
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
 * Система налогообложения для чека. По оферте (п. 5.2) у ИП упрощёнка, поэтому
 * умолчание — usn_income; если бухгалтер скажет иначе, значение меняется
 * переменной окружения без выкладки нового кода.
 */
const TAXATIONS = ["osn", "usn_income", "usn_income_outcome", "esn", "patent"] as const;

function taxation(): (typeof TAXATIONS)[number] {
  const raw = (bindings().TBANK_TAXATION ?? "").trim();
  return (TAXATIONS as readonly string[]).includes(raw)
    ? (raw as (typeof TAXATIONS)[number])
    : "usn_income";
}

/** Рубли, которыми живут тарифы и база, в копейки, которыми живёт банк. */
function kopecks(rubles: number): number {
  return Math.round(rubles * 100);
}

/* -------------------------------------------------------------- подпись */

/**
 * Подпись запроса и уведомления: значения корневых полей вместе с паролем,
 * отсортированные по имени поля, склеенные подряд, SHA-256 в hex.
 *
 * Вложенные объекты (Receipt, DATA) в подпись не входят — так описано у
 * банка, и так же считает он сам на своей стороне. Булево Success из
 * уведомления идёт в строку как "true"/"false": JSON.stringify дал бы то же
 * самое, но String(true) читается однозначнее.
 */
async function sign(params: Record<string, unknown>, password: string): Promise<string> {
  const line = Object.entries({ ...params, Password: password })
    .filter(([key, value]) => {
      if (key === "Token") return false;
      if (value === null || value === undefined) return false;
      return typeof value !== "object";
    })
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => String(value))
    .join("");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(line));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------------------------------------------------------- счета */

const GATEWAY_DOWN = "Касса сейчас не отвечает. Попробуйте через минуту — деньги не списаны.";

type InitResponse = {
  Success: boolean;
  ErrorCode?: string;
  Message?: string | null;
  Details?: string | null;
  Status?: string;
  PaymentId?: string | number;
  PaymentURL?: string;
};

export type CreatedOrder = { url: string; paymentId: string | null };

/**
 * Счёт на оплату: возвращает адрес платёжной страницы банка.
 *
 * amount — рубли целиком, orderId — наш идентификатор строки payments: он же
 * вернётся в уведомлении и по нему находится, что именно оплатили.
 * customerKey — идентификатор пользователя, по нему в личном кабинете видно
 * плательщика, не заглядывая в нашу базу.
 *
 * PayType «O» — одностадийная оплата: деньги списываются сразу, отдельного
 * Confirm не нужно. Двухстадийная оставила бы холд, который кто-то должен
 * подтверждать руками, а доступ к темам открывается в тот же момент.
 */
export async function createOrder(order: {
  orderId: string;
  customerKey: string;
  amount: number;
  description: string;
  email: string;
  successUrl: string;
  failUrl: string;
  notificationUrl: string;
}): Promise<CreatedOrder> {
  const creds = credentials();
  if (!creds) throw new Error("Приём платежей не настроен");

  const amount = kopecks(order.amount);
  const params = {
    TerminalKey: creds.terminalKey,
    Amount: amount,
    OrderId: order.orderId,
    Description: order.description,
    PayType: "O",
    Language: "ru",
    CustomerKey: order.customerKey,
    SuccessURL: order.successUrl,
    FailURL: order.failUrl,
    NotificationURL: order.notificationUrl,
  };

  const body = {
    ...params,
    Token: await sign(params, creds.password),
    Receipt: receipt({ amount, description: order.description, email: order.email }),
  };

  const response = await fetch(`${API}/Init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  // Человеку — что делать, в журнал — что случилось. Ответ банка («Invalid
  // token», «Terminal not found») говорит о наших ключах, а не о его карте,
  // и на странице оплаты только пугает.
  if (!response.ok) {
    console.error(`T-Bank /Init: HTTP ${response.status} ${await response.text()}`);
    throw new Error(GATEWAY_DOWN);
  }

  const result = (await response.json()) as InitResponse;
  const url = result.PaymentURL;
  if (!result.Success || !url) {
    console.error(
      `T-Bank /Init: ErrorCode ${result.ErrorCode ?? "—"} ${result.Message ?? "ответ без ссылки"}` +
        `${result.Details ? ` (${result.Details})` : ""}`,
    );
    throw new Error(GATEWAY_DOWN);
  }
  return { url, paymentId: result.PaymentId != null ? String(result.PaymentId) : null };
}

/**
 * Состав чека для кассы.
 *
 * Tax «none» — «без НДС»: у ИП на упрощёнке налога в чеке нет.
 * PaymentMethod «full_payment» — полный расчёт (деньги и доступ в один
 * момент), PaymentObject «service» — услуга. Price и Amount здесь уже в
 * копейках и обязаны сойтись с Amount счёта до копейки, иначе касса не
 * примет чек, а платёж при этом пройдёт.
 */
function receipt(order: { amount: number; description: string; email: string }) {
  return {
    Email: order.email,
    Taxation: taxation(),
    Items: [
      {
        Name: order.description,
        Price: order.amount,
        Quantity: 1,
        Amount: order.amount,
        Tax: "none",
        PaymentMethod: "full_payment",
        PaymentObject: "service",
      },
    ],
  };
}

/* ------------------------------------------------------------- вебхуки */

/**
 * Подпись уведомления. Считается по тем же правилам, что и подпись запроса,
 * поэтому проверка — это пересчёт и сверка с присланным Token.
 *
 * Сверять нужно разобранный объект, а не сырое тело: в подпись входят только
 * корневые поля, и порядок их в JSON банк не обещает.
 */
export async function verifyNotification(data: Record<string, unknown>): Promise<boolean> {
  const creds = credentials();
  if (!creds) return false;

  const received = typeof data.Token === "string" ? data.Token : "";
  if (!received) return false;

  return timingSafeEqual(await sign(data, creds.password), received.trim().toLowerCase());
}

/** Сравнение за постоянное время: обычное === выдаёт длину общего префикса. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Уведомление о платеже. Всё, что банк присылает и на что мы смотрим. */
export type Notification = {
  TerminalKey?: string;
  OrderId?: string;
  PaymentId?: string | number;
  Status?: string;
  Success?: boolean;
  Amount?: number;
  ErrorCode?: string;
  Message?: string;
};

/** Сумма уведомления сходится со счётом? Слева копейки, справа рубли базы. */
export function amountMatches(notified: unknown, rubles: number): boolean {
  return Number(notified) === kopecks(rubles);
}

/** Ключ терминала из уведомления — наш? Чужое уведомление до базы не доходит. */
export function terminalMatches(terminalKey: unknown): boolean {
  const creds = credentials();
  return creds !== null && terminalKey === creds.terminalKey;
}
