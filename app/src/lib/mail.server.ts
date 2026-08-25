/*
 * Отправка письма.
 *
 * Приложение живёт в workerd, а у него нет ни сокетов, ни файловой
 * системы: SMTP и nodemailer сюда не поставить в принципе. Остаётся HTTP
 * API почтового сервиса — тот же способ, которым уходят сообщения ботам
 * (см. notify.server.ts) и запросы в эквайринг.
 *
 * Сервис — Yandex Cloud Postbox. Выбран не за API: ключ в заголовок здесь
 * не положишь, запрос нужно подписывать. Выбран за то, что новым
 * обработчиком персональных данных Postbox не становится — Яндекс.Облако
 * уже держит сервис и базу и уже названо в политике (пункт 7.1) и в
 * уведомлении РКН. Любой другой почтовый сервис — это отдельный договор
 * поручения по части 3 статьи 6, новая строка в уведомлении и правка двух
 * опубликованных документов ради письма про пароль. Серверы в РФ здесь
 * тоже по построению, а не по обещанию в оферте.
 *
 * Цена выбора — подпись AWS Signature V4: API совместим с Amazon SES v2.
 * Она собрана ниже руками на WebCrypto, потому что SDK в воркер не
 * поставить, а сама подпись — четыре HMAC и склейка строк.
 *
 * Заменить сервис — переписать sendMail() ниже. Всё остальное про почту
 * не знает: оно спрашивает mailReady() и зовёт sendMail().
 */

import { bindings } from "./bindings.server";

type Mail = {
  to: string;
  subject: string;
  /** Только текст. HTML-письмо чаще уезжает в спам и ломается в клиентах,
   *  а сказать здесь нужно две фразы и одну ссылку. */
  text: string;
  /**
   * Куда уйдёт ответ, если нажать в почтовом клиенте «Ответить».
   *
   * Нужен обращениям об ошибке: письмо приходит от адреса сервиса, но
   * отвечать надо человеку, который его написал. Без этого поля адрес
   * пришлось бы выковыривать из текста письма руками. Не задан — почтовый
   * клиент ответит отправителю, как и раньше.
   */
  replyTo?: string;
};

const ENDPOINT = "https://postbox.cloud.yandex.net/v2/email/outbound-emails";
const REGION = "ru-central1";
const SERVICE = "ses";

const encoder = new TextEncoder();

function config() {
  const { POSTBOX_KEY_ID, POSTBOX_SECRET_KEY, MAIL_FROM, MAIL_FROM_NAME } = bindings();
  const keyId = POSTBOX_KEY_ID?.trim();
  const secret = POSTBOX_SECRET_KEY?.trim();
  const from = MAIL_FROM?.trim();
  if (!keyId || !secret || !from) return null;
  return { keyId, secret, from, fromName: MAIL_FROM_NAME?.trim() || "Совёнок" };
}

type Config = NonNullable<ReturnType<typeof config>>;

/**
 * Настроена ли почта на сервере.
 *
 * Экран восстановления спрашивает это до того, как принять заявку: без
 * ключа письмо не уйдёт, и предлагать человеку «проверьте почту» было бы
 * враньём. Без ключа он увидит ручной путь — адрес поддержки.
 */
export function mailReady(): boolean {
  return config() !== null;
}

/* ------------------------------------------------------------- подпись */

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmac(key: BufferSource, value: string): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", material, encoder.encode(value));
}

/**
 * Заголовок Authorization по правилам AWS Signature V4.
 *
 * Подписываются ровно три заголовка — content-type, host, x-amz-date, — и
 * они же перечислены в SignedHeaders. Список должен совпадать с тем, что
 * реально уйдёт в запросе, и быть отсортирован: сервис собирает у себя ту
 * же строку и сравнивает подписи побайтово. Порядок строк в canonical и
 * ключей в fetch ниже поэтому не косметика.
 *
 * Тело подписывается целиком, поэтому в fetch должна уйти ровно та строка,
 * которую подписали, — отсюда body строкой, а не объектом.
 */
async function authorization(cfg: Config, body: string, amzDate: string): Promise<string> {
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${REGION}/${SERVICE}/aws4_request`;
  const url = new URL(ENDPOINT);

  const canonical = [
    "POST",
    url.pathname,
    "",
    "content-type:application/json",
    `host:${url.host}`,
    `x-amz-date:${amzDate}`,
    "",
    "content-type;host;x-amz-date",
    await sha256Hex(body),
  ].join("\n");

  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonical)].join("\n");

  const kDate = await hmac(encoder.encode(`AWS4${cfg.secret}`), day);
  const kRegion = await hmac(kDate, REGION);
  const kService = await hmac(kRegion, SERVICE);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, toSign));

  return `AWS4-HMAC-SHA256 Credential=${cfg.keyId}/${scope}, SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`;
}

/* -------------------------------------------------------------- письмо */

function base64(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Кириллица в заголовке письма.
 *
 * В заголовках MIME разрешён только ASCII, а у нас там и «Совёнок», и тема
 * про ошибку на странице. RFC 2047 позволяет завернуть такой кусок в
 * =?UTF-8?B?...?=, и почтовые клиенты разворачивают его сами. Латиницу
 * оставляем как есть: её проще читать в сыром письме.
 *
 * Длина одного такого слова ограничена 75 символами вместе с обёрткой —
 * это 45 байт текста, — а в теме обращения едет адрес страницы, который
 * туда не помещается. Поэтому режем на несколько слов; рвать при этом
 * можно только по границам символов, иначе клиент получит половину буквы.
 * Соседние слова он склеит обратно сам, пробел между ними при склейке
 * пропадает.
 */
function mimeWords(value: string): string[] {
  if (!/[^\x20-\x7e]/.test(value)) return [value];
  const words: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const char of value) {
    const size = encoder.encode(char).length;
    if (bytes + size > 45) {
      words.push(`=?UTF-8?B?${base64(chunk)}?=`);
      chunk = "";
      bytes = 0;
    }
    chunk += char;
    bytes += size;
  }
  if (chunk) words.push(`=?UTF-8?B?${base64(chunk)}?=`);
  return words;
}

/** Одной строкой — для поля JSON, где перенос строки был бы порчей запроса. */
function mimeWord(value: string): string {
  return mimeWords(value).join(" ");
}

/**
 * Значение заголовка, собранного руками.
 *
 * Перевод строки внутри значения — это дописанный в письмо чужой заголовок
 * (Bcc, например). Адрес для ответа приходит из формы, и хотя проверка
 * почты его туда не пропустит, полагаться на неё здесь не стоит: цена
 * ошибки — рассылка с нашего адреса.
 */
function headerValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

/**
 * Письмо целиком, в виде MIME.
 *
 * Нужно только ради Reply-To: отдельного поля для него в Postbox нет, а в
 * произвольных заголовках простого письма Reply-To стоит в списке
 * запрещённых. Остаётся Raw — собрать сообщение самим. Тело кладём в
 * base64 и режем по 76 символов: так требует RFC 2045, и так текст
 * переживает любой шлюз по дороге.
 */
function rawMessage(cfg: Config, mail: Mail & { replyTo: string }): string {
  const headers = [
    `From: ${mimeWords(cfg.fromName).join("\r\n ")} <${cfg.from}>`,
    `To: ${headerValue(mail.to)}`,
    `Reply-To: ${headerValue(mail.replyTo)}`,
    // Длинную тему складываем переносом с пробелом — так письмо остаётся в
    // пределах строки, которую примет любой шлюз по дороге.
    `Subject: ${mimeWords(mail.subject).join("\r\n ")}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const body = base64(mail.text).replace(/.{1,76}/g, "$&\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

/**
 * Отправка. Возвращает, ушло ли письмо.
 *
 * Ошибку наружу не бросаем: вызывающий код не должен из-за недоступного
 * почтового сервиса отвечать пятисотой. Он и так обязан отвечать
 * одинаково на существующий и несуществующий адрес — иначе форма
 * восстановления превращается в проверку, зарегистрирован ли человек.
 *
 * Письмо без Reply-To уходит простым: тему, кодировку и заголовки собирает
 * сервис, и на главном пути — ссылке на смену пароля — ошибиться нечем.
 * Ручной MIME достаётся только обращениям об ошибке, которые идут во
 * внутренний ящик: если в нём что-то не так, это увидит владелец сервиса,
 * а не человек, потерявший пароль.
 *
 * Ссылки на трекинговые Postbox не подменяет, и выключать для этого ничего
 * не нужно: подмена работает только в HTML-части письма, а мы шлём чистый
 * текст. Это ещё одна причина его не бросать — письмо про смену пароля с
 * подменённой ссылкой само выглядит как фишинг.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;

  const content = mail.replyTo
    ? { Raw: { Data: base64(rawMessage(cfg, { ...mail, replyTo: mail.replyTo })) } }
    : {
        Simple: {
          Subject: { Data: mail.subject, Charset: "UTF-8" },
          Body: { Text: { Data: mail.text, Charset: "UTF-8" } },
        },
      };

  const body = JSON.stringify({
    FromEmailAddress: `${mimeWord(cfg.fromName)} <${cfg.from}>`,
    Destination: { ToAddresses: [mail.to] },
    Content: content,
  });

  // 20260826T101112Z — формат, которого ждёт подпись: без разделителей и
  // без долей секунды. Часы сервера при этом важны: расхождение больше
  // пяти минут сервис считает повтором чужого запроса и отвечает отказом.
  const amzDate = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amz-date": amzDate,
        authorization: await authorization(cfg, body, amzDate),
      },
      body,
    });
    if (!response.ok) return false;
    const answer = (await response.json().catch(() => null)) as { MessageId?: string } | null;
    return Boolean(answer?.MessageId);
  } catch {
    return false;
  }
}
