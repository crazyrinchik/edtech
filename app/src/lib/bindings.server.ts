// Доступ к биндингам воркера, только на сервере.
//
// Рантайм — workerd, но поднимает его miniflare на нашей машине
// (deploy/serve.mjs), а не Cloudflare: в Cloudflare это приложение не
// выкладывается, данные детей должны лежать в базе на территории РФ.
// Поэтому из всего списка реально существует только DB — локальный D1
// поверх SQLite, и тот лишь как путь отката с PostgreSQL. STORAGE, KV и
// CONTAINER не провижинятся ничем и всегда undefined; они оставлены в типе,
// чтобы обращение к ним не компилировалось молча в `any`. Guard перед use.
//
// `cloudflare:workers` — модуль рантайма, отдающий env воркера. Он не
// бандлится (см. ssr.external в vite.config.ts), его даёт workerd.
import { env } from "cloudflare:workers";
// Import the binding types directly — NOT via the global tsconfig `types` list,
// which would clobber the DOM globals the client/SSR React code relies on.
import type {
  D1Database,
  DurableObjectNamespace,
  KVNamespace,
  R2Bucket,
} from "@cloudflare/workers-types";

type AppEnv = {
  DB?: D1Database;
  STORAGE?: R2Bucket;
  KV?: KVNamespace;
  // The container's Durable Object — present only when "container" is set in
  // the manifest. Reach an instance with env.CONTAINER.getByName(id), then
  // .fetch(). See skills/containers.md.
  CONTAINER?: DurableObjectNamespace;
  HF_ENV?: string;
  APP_SLUG?: string;
  // Развёртывание на своём сервере: PostgreSQL за внутренним HTTP-шлюзом.
  // Если заданы обе переменные, db() идёт туда вместо биндинга DB.
  DB_GATEWAY_URL?: string;
  DB_GATEWAY_TOKEN?: string;
  // Напоминания родителю. Без токена канал просто не предлагается в кабинете,
  // остальное приложение работает как раньше (см. lib/notify.server.ts).
  TELEGRAM_BOT_TOKEN?: string;
  MAX_BOT_TOKEN?: string;
  /** Общий секрет в адресе вебхука: без него бот-обработчик отвечает 404. */
  NOTIFY_WEBHOOK_SECRET?: string;
};

export function bindings(): AppEnv {
  return env as unknown as AppEnv;
}
