import "./lib/error-capture";

import { BILLING_WEBHOOK_PREFIX, handleBillingWebhook } from "./lib/billing-webhook.server";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleHealth, HEALTH_PATH } from "./lib/health.server";
import { handleNotifyWebhook, NOTIFY_WEBHOOK_PREFIX } from "./lib/notify-webhook.server";
import { sweepIfDue } from "./lib/retention.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Профили, к которым родитель так и не пришёл, снимаются по сроку.
      // Своего cron у развёртывания нет, поэтому зачистку заводит первый
      // запрос после паузы; в остальное время это сравнение двух чисел.
      // Стоит до ранних return: пусть её будят и вебхуки с ручкой живости.
      await sweepIfDue();
      // Вебхуки ботов перехватываются до роутера: это не страница и не
      // серверная функция, а внешний POST от мессенджера.
      const { pathname } = new URL(request.url);
      if (pathname.startsWith(NOTIFY_WEBHOOK_PREFIX)) {
        return await handleNotifyWebhook(request);
      }
      // Уведомление кассы об оплате — тоже внешний POST, и ему тем более
      // нечего делать в роутере: от него зависит, открыть ли подписку.
      if (pathname.startsWith(BILLING_WEBHOOK_PREFIX)) {
        return await handleBillingWebhook(request);
      }
      // Живость для выкладки — тоже мимо роутера: ручка должна отвечать даже
      // тогда, когда со страницами что-то не так.
      if (pathname === HEALTH_PATH) {
        return await handleHealth(request);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
