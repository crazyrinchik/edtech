// Вебхук ботов: сюда мессенджер приносит сообщения, написанные родителем.
//
// Единственная задача обработчика — поймать код привязки (sov-xxxxx) и
// запомнить, в какой чат писать отчёты. Адрес закрыт общим секретом в query:
// без него ручка отвечает 404, чтобы её нельзя было найти перебором.
//
// Живёт не в routes/, а вызывается из воркер-энтри (src/server.ts): файл-маршрут
// попал бы и в клиентский бандл, а тянуть туда серверный доступ к базе незачем.
//
// Установка вебхука делается один раз руками:
//   Telegram: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<домен>/api/notify/tg?secret=<секрет>
//   MAX:      POST https://botapi.max.ru/subscriptions?access_token=<TOKEN>
//             {"url": "https://<домен>/api/notify/max?secret=<секрет>"}

import { bindings } from "./bindings.server";
import { linkChannelByCode, replyToChat, type NotifyChannel } from "./notify.server";

export const NOTIFY_WEBHOOK_PREFIX = "/api/notify/";

/** Ответ 200 без тела: мессенджеры повторяют доставку, если получают ошибку. */
const ok = () => new Response("ok", { status: 200 });
const notFound = () => new Response("not found", { status: 404 });

type Incoming = { chatId: string | null; text: string };

/** Формы апдейтов у мессенджеров разные, поэтому разбор — руками и осторожно. */
type TelegramUpdate = {
  message?: { chat?: { id?: number | string }; text?: string };
  edited_message?: { chat?: { id?: number | string }; text?: string };
};

type MaxUpdate = {
  message?: {
    sender?: { user_id?: number | string };
    recipient?: { chat_id?: number | string; user_id?: number | string };
    body?: { text?: string };
  };
};

function readTelegram(payload: TelegramUpdate): Incoming {
  const message = payload.message ?? payload.edited_message;
  const id = message?.chat?.id;
  return { chatId: id != null ? String(id) : null, text: message?.text ?? "" };
}

function readMax(payload: MaxUpdate): Incoming {
  const message = payload.message;
  const id = message?.recipient?.chat_id ?? message?.recipient?.user_id ?? message?.sender?.user_id;
  return { chatId: id != null ? String(id) : null, text: message?.body?.text ?? "" };
}

export async function handleNotifyWebhook(request: Request): Promise<Response> {
  const { NOTIFY_WEBHOOK_SECRET } = bindings();
  const url = new URL(request.url);
  if (request.method !== "POST") return notFound();
  if (!NOTIFY_WEBHOOK_SECRET || url.searchParams.get("secret") !== NOTIFY_WEBHOOK_SECRET) {
    return notFound();
  }

  const channel = url.pathname
    .slice(NOTIFY_WEBHOOK_PREFIX.length)
    .replace(/\/+$/, "") as NotifyChannel;
  if (channel !== "tg" && channel !== "max") return notFound();

  let payload: TelegramUpdate & MaxUpdate;
  try {
    payload = (await request.json()) as TelegramUpdate & MaxUpdate;
  } catch {
    return ok();
  }

  const incoming = channel === "tg" ? readTelegram(payload) : readMax(payload);
  if (!incoming.chatId || !incoming.text) return ok();

  // Ответ боту в тот же чат: без подтверждения родитель не понимает, сработала
  // ли привязка, и присылает код ещё раз.
  const reply = await linkChannelByCode(channel, incoming.chatId, incoming.text);
  await replyToChat(
    channel,
    incoming.chatId,
    reply ?? "Пришлите код из кабинета родителя — он выглядит как sov-a1b2c.",
  );
  return ok();
}
