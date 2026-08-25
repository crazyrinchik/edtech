/*
 * «Сообщить об ошибке»: приём обращения со страницы.
 *
 * Форма открыта всем, включая тех, кто не регистрировался: тренажёры и
 * нулевой урок работают без входа, и поломку там увидят раньше, чем в
 * кабинете. Отсюда три обязательства.
 *
 * 1. Обращение сначала ложится в базу, и только потом уходит письмом.
 *    Сказать «спасибо, получили» и потерять текст, потому что почтовый
 *    сервис ответил пятисоткой, нельзя.
 * 2. Адресат один и задан на сервере. Форма, у которой получателя
 *    выбирает браузер, — это открытый почтовый ретранслятор, и её найдут
 *    в первую же неделю.
 * 3. Заброс ограничен по отпечатку адреса, а не по совести отправителя.
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { currentUser, db, nowIso, requireAdmin, track, uid } from "../core.server";
import { bindings } from "../bindings.server";
import { mailReady, sendMail } from "../mail.server";
import { SUPPORT_EMAIL } from "../support";

/** Больше пяти обращений в час с одного адреса — это уже не поломка. */
const MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Профиль ребёнка, выбранный в этом браузере.
 *
 * Имя куки повторяет app.functions.ts, где её ставит выбор профиля.
 * Импортировать оттуда константу значило бы тянуть в этот модуль весь
 * файл на две тысячи строк ради одной строки текста.
 */
const CHILD_COOKIE = "sov_child";

/** Длинные строки режем: в письме нужен признак, а не поток. */
function clip(value: string | null | undefined, max: number): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Отпечаток адреса отправителя.
 *
 * Сам адрес не хранится: для счётчика «сколько обращений за час» хватает
 * отпечатка, а ночной дамп базы не должен превращаться в журнал
 * посещений. Приложение стоит за Caddy, поэтому реальный адрес приходит
 * в X-Forwarded-For — берём первый элемент цепочки. Заголовка нет
 * (запрос изнутри, стенд) — ограничение просто не применяется: лучше
 * пропустить обращение, чем потерять его.
 */
async function clientFingerprint(): Promise<string | null> {
  const headers = getRequest().headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("cf-connecting-ip")?.trim();
  return ip ? await sha256Hex(ip) : null;
}

/** Куда уходит письмо: переменная окружения, иначе адрес из support.ts. */
function supportAddress(): string {
  return bindings().SUPPORT_EMAIL?.trim() || SUPPORT_EMAIL;
}

/**
 * Что форме нужно знать до того, как её начали заполнять.
 *
 * Почта вошедшего — чтобы подставить её в поле ответа и не заставлять
 * набирать заново. Готовность почтового сервиса — чтобы не обещать
 * ответ, которого не будет: без ключа Postbox обращение сохранится в
 * базе, но письмо не уйдёт, и человеку об этом говорят сразу, а не после
 * отправки. Отдельная лёгкая функция вместо me(): там сид контента и
 * список детей, а здесь нужны две строки.
 */
export const supportContext = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  // Адрес поддержки клиенту отсюда не отдаём: он и так напечатан на
  // странице и берётся из lib/support.ts. Переменная SUPPORT_EMAIL может
  // указывать на служебный ящик, и показывать его посетителю незачем.
  return { email: user?.email ?? null, mailReady: mailReady() };
});

export const reportProblem = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      message: z
        .string()
        .trim()
        .min(10, "Опишите, что случилось, хотя бы одним предложением")
        .max(2000, "Слишком длинно — оставьте главное, остальное дошлём почтой"),
      /** Необязательная почта для ответа. Пустую строку принимаем как «не оставил». */
      replyTo: z.union([z.literal(""), z.string().trim().email("Похоже, в адресе опечатка")]),
      /** Адрес страницы со стороны браузера: он точнее, чем адрес этого запроса. */
      page: z.string().max(500).optional(),
      /**
       * Ловушка для роботов: поле, невидимое человеку. Заполнено — значит,
       * форму заполняли не руками.
       */
      trap: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Роботу отвечаем ровно то же, что человеку: по ответу не должно быть
    // видно, что ловушка сработала, иначе её обойдут со второго раза.
    if (data.trap) return { ok: true as const, mailed: true, throttled: false };

    const user = await currentUser();
    const childId = getCookie(CHILD_COOKIE) ?? null;
    const ipHash = await clientFingerprint();

    if (ipHash) {
      const since = new Date(Date.now() - HOUR_MS).toISOString();
      const recent = await db()
        .prepare("SELECT COUNT(*) AS n FROM bug_reports WHERE ip_hash = ? AND created_at > ?")
        .bind(ipHash, since)
        .first<{ n: number }>();
      if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
        return { ok: true as const, mailed: false, throttled: true };
      }
    }

    // Почта для ответа: своя важнее почты аккаунта — человек мог написать
    // с чужого компьютера или попросить ответить на рабочий адрес.
    const replyTo = data.replyTo.trim().toLowerCase() || user?.email || null;
    const page = clip(data.page, 300);
    const userAgent = clip(getRequest().headers.get("user-agent"), 300);
    const id = uid("br");
    const createdAt = nowIso();

    await db()
      .prepare(
        `INSERT INTO bug_reports
           (id, user_id, child_id, reply_to, message, page, user_agent, ip_hash, created_at, mailed_at, handled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .bind(
        id,
        user?.id ?? null,
        childId,
        replyTo,
        data.message.trim(),
        page,
        userAgent,
        ipHash,
        createdAt,
      )
      .run();

    let mailed = false;
    if (mailReady()) {
      mailed = await sendMail({
        to: supportAddress(),
        // Страница в теме письма — чтобы в ящике было видно, куда бежать,
        // не открывая письма.
        subject: `Совёнок: ошибка${page ? ` на ${new URL(page, "https://sovenok.space").pathname}` : ""}`,
        // Отвечают на такие письма кнопкой «Ответить», а не копированием
        // адреса из текста. Если человек почту не оставил, поле не ставим:
        // ответ ушёл бы самому себе.
        replyTo: replyTo ?? undefined,
        text: [
          data.message.trim(),
          "",
          "———",
          `Кто: ${user ? `${user.email} (${user.role})` : "не вошёл в аккаунт"}`,
          `Ответить: ${replyTo ?? "адрес не оставлен"}`,
          `Страница: ${page ?? "неизвестна"}`,
          `Ребёнок: ${childId ?? "не выбран"}`,
          `Браузер: ${userAgent ?? "неизвестен"}`,
          `Время: ${createdAt}`,
          `Запись: ${id} — админка, вкладка «Обращения»`,
        ].join("\n"),
      });
      if (mailed) {
        await db()
          .prepare("UPDATE bug_reports SET mailed_at = ? WHERE id = ?")
          .bind(nowIso(), id)
          .run();
      }
    }

    await track("bug_reported", { userId: user?.id ?? null, props: { page, mailed } });
    return { ok: true as const, mailed, throttled: false };
  });

/* ------------------------------------------------------------- админка */

type BugReportRow = {
  id: string;
  user_id: string | null;
  child_id: string | null;
  reply_to: string | null;
  message: string;
  page: string | null;
  user_agent: string | null;
  created_at: string;
  mailed_at: string | null;
  handled_at: string | null;
  email: string | null;
};

/**
 * Последние обращения. Почта отправителя вытаскивается из users, а не
 * берётся из reply_to: там может стоять адрес, который человек назвал
 * сам, и по нему аккаунт не найти.
 */
export const adminBugReports = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const rows = await db()
    .prepare(
      `SELECT b.id, b.user_id, b.child_id, b.reply_to, b.message, b.page, b.user_agent,
              b.created_at, b.mailed_at, b.handled_at, u.email
         FROM bug_reports b LEFT JOIN users u ON u.id = b.user_id
        ORDER BY b.created_at DESC
        LIMIT 100`,
    )
    .all<BugReportRow>();
  return { reports: rows.results ?? [] };
});

/**
 * Ответ на обращение прямо из админки.
 *
 * Раньше в админке стояла ссылка mailto:, и ответ уходил из того ящика, в
 * который вошёл почтовый клиент, — то есть из личного. Человек получал
 * письмо от частного лица, а не от сервиса. Здесь письмо уходит через тот
 * же Postbox, от адреса сервиса, а Reply-To ставится на почту поддержки:
 * в списке писем видно «Совёнок», а «Ответить» приводит ответ туда, где
 * его прочитают.
 *
 * Текст обращения подклеивается цитатой. Между обращением и ответом может
 * пройти день, и «отвечаем: да, починили» без напоминания, на что именно,
 * читается как письмо не по адресу.
 *
 * Отправленный ответ помечает обращение разобранным: отвечать на него
 * второй раз обычно уже не нужно, а лишний клик по «Разобрано» забывается.
 */
export const adminReplyToReport = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      text: z
        .string()
        .trim()
        .min(1, "Пустой ответ отправлять некуда")
        .max(4000, "Слишком длинно для письма"),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();

    const report = await db()
      .prepare("SELECT reply_to, message, created_at FROM bug_reports WHERE id = ?")
      .bind(data.id)
      .first<{ reply_to: string | null; message: string; created_at: string }>();

    // Обращение без адреса — человек его не оставил. Отвечать некуда, и
    // сказать об этом надо в админке, а не молча ничего не сделать.
    if (!report?.reply_to) return { ok: false as const, reason: "no-address" as const };
    if (!mailReady()) return { ok: false as const, reason: "mail-off" as const };

    const sent = await sendMail({
      to: report.reply_to,
      subject: "Совёнок: ответ на ваше обращение",
      replyTo: supportAddress(),
      text: [
        data.text.trim(),
        "",
        "———",
        `Вы написали нам ${new Date(report.created_at).toLocaleDateString("ru-RU")}:`,
        ...report.message.split("\n").map((line) => `> ${line}`),
      ].join("\n"),
    });

    if (sent) {
      await db()
        .prepare("UPDATE bug_reports SET handled_at = ? WHERE id = ?")
        .bind(nowIso(), data.id)
        .run();
    }
    return { ok: true as const, sent };
  });

export const adminHandleBugReport = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), handled: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    await db()
      .prepare("UPDATE bug_reports SET handled_at = ? WHERE id = ?")
      .bind(data.handled ? nowIso() : null, data.id)
      .run();
    return { ok: true as const };
  });
