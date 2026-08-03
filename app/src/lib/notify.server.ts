// Напоминания родителю в мессенджер: «ребёнок позанимался».
//
// Кабинет родитель открывает не каждый день, а знать, что занятие было, хочет
// сразу. Поэтому после занятия приложение шлёт короткое сообщение в тот
// мессенджер, который родитель привязал сам: Telegram или MAX.
//
// Привязка идёт кодом, а не логином: родитель берёт в кабинете код вида
// sov-7k2f9, пишет его боту, бот через вебхук (routes/api.notify.$channel.ts)
// сообщает свой chat_id, и строка в notify_channels получает адресата.
// Токены ботов лежат в переменных окружения — в базе их нет.

import { bindings } from "./bindings.server";
import { db, nowIso, uid } from "./core.server";

export type NotifyChannel = "tg" | "max";

export const CHANNEL_TITLES: Record<NotifyChannel, string> = {
  tg: "Telegram",
  max: "MAX",
};

export type ChannelRow = {
  id: string;
  user_id: string;
  channel: string;
  chat_id: string | null;
  link_code: string | null;
  enabled: number;
  created_at: string;
  confirmed_at: string | null;
  last_sent_at: string | null;
};

/** Код привязки: без похожих друг на друга символов, чтобы диктовать голосом. */
export function linkCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `sov-${out}`;
}

function tokenFor(channel: NotifyChannel): string | null {
  const { TELEGRAM_BOT_TOKEN, MAX_BOT_TOKEN } = bindings();
  const token = channel === "tg" ? TELEGRAM_BOT_TOKEN : MAX_BOT_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

/** Настроен ли канал на сервере: без токена бот не ответит, и это надо показать. */
export function channelReady(channel: NotifyChannel): boolean {
  return !!tokenFor(channel);
}

async function deliver(channel: NotifyChannel, chatId: string, text: string): Promise<boolean> {
  const token = tokenFor(channel);
  if (!token) return false;
  try {
    if (channel === "tg") {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_notification: false }),
      });
      return response.ok;
    }
    // MAX: Bot API отвечает по тому же принципу, адресат уходит в query.
    const response = await fetch(
      `https://botapi.max.ru/messages?access_token=${encodeURIComponent(token)}&chat_id=${encodeURIComponent(chatId)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    return response.ok;
  } catch {
    // Мессенджер недоступен — это не повод ронять занятие ребёнка.
    return false;
  }
}

/**
 * Шлёт сообщение во все подтверждённые и включённые каналы родителя.
 * Ошибки гасятся: уведомление — приятный побочный эффект, а не часть занятия.
 */
export async function notifyParent(userId: string, text: string): Promise<void> {
  try {
    const rows = await db()
      .prepare(
        "SELECT * FROM notify_channels WHERE user_id = ? AND enabled = 1 AND chat_id IS NOT NULL",
      )
      .bind(userId)
      .all<ChannelRow>();
    for (const row of rows.results ?? []) {
      const ok = await deliver(row.channel as NotifyChannel, row.chat_id!, text);
      if (ok) {
        await db()
          .prepare("UPDATE notify_channels SET last_sent_at = ? WHERE id = ?")
          .bind(nowIso(), row.id)
          .run();
      }
    }
  } catch {
    // см. выше
  }
}

/**
 * Привязка канала по коду из сообщения боту. Возвращает приветствие, которое
 * вебхук отправит обратно, или null, если кода в тексте не было.
 */
export async function linkChannelByCode(
  channel: NotifyChannel,
  chatId: string,
  text: string,
): Promise<string | null> {
  const match = text.match(/sov-[a-z0-9]{5}/i);
  if (!match) return null;
  const code = match[0].toLowerCase();

  const row = await db()
    .prepare("SELECT * FROM notify_channels WHERE link_code = ? AND channel = ?")
    .bind(code, channel)
    .first<ChannelRow>();
  if (!row) return "Такой код не найден. Откройте кабинет родителя и возьмите новый.";

  await db()
    .prepare(
      "UPDATE notify_channels SET chat_id = ?, confirmed_at = ?, link_code = NULL WHERE id = ?",
    )
    .bind(chatId, nowIso(), row.id)
    .run();
  return "Готово. Буду присылать короткий отчёт после каждого занятия ребёнка.";
}

/** Ответ боту в тот же чат — подтверждение привязки видно сразу. */
export async function replyToChat(channel: NotifyChannel, chatId: string, text: string) {
  await deliver(channel, chatId, text);
}

/** Строка канала для родителя: если её нет, создаётся вместе с кодом. */
export async function ensureChannel(userId: string, channel: NotifyChannel): Promise<ChannelRow> {
  const existing = await db()
    .prepare("SELECT * FROM notify_channels WHERE user_id = ? AND channel = ?")
    .bind(userId, channel)
    .first<ChannelRow>();
  if (existing) return existing;

  const row: ChannelRow = {
    id: uid("ntf"),
    user_id: userId,
    channel,
    chat_id: null,
    link_code: linkCode(),
    enabled: 1,
    created_at: nowIso(),
    confirmed_at: null,
    last_sent_at: null,
  };
  await db()
    .prepare(
      `INSERT INTO notify_channels (id, user_id, channel, chat_id, link_code, enabled, created_at)
       VALUES (?, ?, ?, NULL, ?, 1, ?)`,
    )
    .bind(row.id, row.user_id, row.channel, row.link_code, row.created_at)
    .run();
  return row;
}
