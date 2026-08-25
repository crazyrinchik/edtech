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
  /**
   * Какую базу использовать: "postgres" (PostgreSQL через шлюз) или "d1"
   * (биндинг DB, путь отката). Разбор и умолчание — в dbKind() (core.server.ts).
   */
  SOVENOK_DB?: string;
  // Развёртывание на своём сервере: PostgreSQL за внутренним HTTP-шлюзом.
  // Обе переменные обязательны при SOVENOK_DB=postgres.
  DB_GATEWAY_URL?: string;
  DB_GATEWAY_TOKEN?: string;
  // Напоминания родителю. Без токена канал просто не предлагается в кабинете,
  // остальное приложение работает как раньше (см. lib/notify.server.ts).
  TELEGRAM_BOT_TOKEN?: string;
  MAX_BOT_TOKEN?: string;
  /** Общий секрет в адресе вебхука: без него бот-обработчик отвечает 404. */
  NOTIFY_WEBHOOK_SECRET?: string;
  /**
   * Приём платежей: эквайринг T-Bank (карты) и подключённая к тому же
   * терминалу касса (чеки по 54-ФЗ). Обе строки — из личного кабинета
   * эквайринга, «Терминалы»: Terminal Key и пароль терминала. Без них форма
   * оплаты не показывается, остаётся промокод (см. billingReady() в
   * tbank.server.ts).
   */
  TBANK_TERMINAL_KEY?: string;
  TBANK_TERMINAL_PASSWORD?: string;
  /** Система налогообложения в чеке; умолчание usn_income — УСН доход. */
  TBANK_TAXATION?: string;
  /**
   * Почта для писем о восстановлении пароля (см. lib/mail.server.ts).
   * Ключ из личного кабинета Unisender Go и подтверждённый там же адрес
   * отправителя. Без них форма восстановления не притворяется рабочей:
   * она честно показывает адрес поддержки.
   */
  UNISENDER_GO_KEY?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  /**
   * Куда уходят обращения из кнопки «Сообщить об ошибке».
   *
   * Не задана — письмо идёт на адрес из lib/support.ts, тот самый, что
   * напечатан на странице восстановления пароля. Переменная нужна, чтобы
   * стенд не слал письма в живой ящик и чтобы адрес поддержки можно было
   * сменить, не пересобирая приложение.
   */
  SUPPORT_EMAIL?: string;
  /**
   * Собственный адрес сервиса, из которого собирается ссылка в письме.
   *
   * Задаётся явно, а не берётся из заголовка Host, и это не педантизм:
   * Host приходит от того, кто прислал запрос. Подменив его, чужой
   * человек заставил бы нас прислать жертве письмо с настоящим текстом,
   * но со ссылкой на свой домен. Классическая host header injection, и
   * ловится она ровно одной строкой в окружении.
   */
  APP_ORIGIN?: string;
};

export function bindings(): AppEnv {
  return env as unknown as AppEnv;
}
