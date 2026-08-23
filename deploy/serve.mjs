// Запуск SSR-бандла Cloudflare Worker на собственном сервере.
//
// miniflare поднимает тот же самый workerd, что стоит за Cloudflare Workers,
// и подсовывает воркеру биндинг DB — локальный D1 поверх SQLite-файла в
// /data/d1. Поэтому код приложения (src/lib/core.server.ts, `cloudflare:workers`,
// crypto.subtle, prepare().bind().run(), batch()) работает без единой правки.

import { Miniflare } from "miniflare";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const D1_PERSIST = process.env.D1_PERSIST ?? "/data/d1";
const SERVER_DIR = path.join(ROOT, "dist", "server");
const MIGRATIONS_DIR = path.join(ROOT, "migrations");
const RUSSIAN_ROOT_CA = path.join(ROOT, "russian-trusted-root-ca.pem");

// Какая база заказана — явно, а не по наличию переменных шлюза. Умолчание
// строгое (postgres): прод, у которого из .env пропал GATEWAY_TOKEN, обязан
// не подняться, а не уехать молча на пустой локальный SQLite. Тот же разбор
// живёт в dbKind() (app/src/lib/core.server.ts) — воркеру он тоже нужен.
const SOVENOK_DB = (process.env.SOVENOK_DB ?? "postgres").trim().toLowerCase() || "postgres";
const GATEWAY_URL = process.env.DB_GATEWAY_URL ?? "";
const GATEWAY_TOKEN = process.env.DB_GATEWAY_TOKEN ?? "";

function die(message) {
  console.error(`[sovenok] ${message}`);
  process.exit(1);
}

if (SOVENOK_DB !== "postgres" && SOVENOK_DB !== "d1") {
  die(`SOVENOK_DB=${SOVENOK_DB}: допустимы только "postgres" и "d1"`);
}

// Падаем здесь, до прослушивания порта: контейнер уйдёт в перезапуск, ручка
// живости не ответит, и выкладка откатится на прошлый тег вместо того, чтобы
// показать людям рабочий сайт с пустой базой.
if (SOVENOK_DB === "postgres" && !(GATEWAY_URL && GATEWAY_TOKEN)) {
  die(
    "SOVENOK_DB=postgres, но DB_GATEWAY_URL и DB_GATEWAY_TOKEN не заданы. " +
      "Проверьте .env на сервере (GATEWAY_TOKEN). Откат на локальный D1 — " +
      "осознанный: SOVENOK_DB=d1.",
  );
}

/**
 * Переменные окружения, которые воркер читает как биндинги.
 *
 * Список перечислен руками, потому что miniflare не отдаёт воркеру
 * process.env: всё, чего нет в bindings, внутри просто undefined. Пока
 * этого списка не было, ключи кассы и токены ботов доезжали до контейнера
 * и там же оставались — форма оплаты и канал напоминаний прятались на
 * рабочем проде, будто их не настраивали.
 *
 * Пустые значения не передаются вовсе: приложение отличает «не задано» от
 * «задано пустым» только по undefined (billingReady(), notify.server.ts).
 */
function passthrough() {
  const names = [
    "TELEGRAM_BOT_TOKEN",
    "MAX_BOT_TOKEN",
    "NOTIFY_WEBHOOK_SECRET",
    "TBANK_TERMINAL_KEY",
    "TBANK_TERMINAL_PASSWORD",
    "TBANK_TAXATION",
  ];
  return Object.fromEntries(
    names.map((name) => [name, (process.env[name] ?? "").trim()]).filter(([, value]) => value),
  );
}

await mkdir(D1_PERSIST, { recursive: true });

const mf = new Miniflare({
  scriptPath: path.join(SERVER_DIR, "server.js"),
  modules: true,
  modulesRoot: SERVER_DIR,
  // Vite бьёт SSR-бандл на чанки — workerd должен принять их все как ES-модули.
  modulesRules: [
    { type: "ESModule", include: ["**/*.js", "**/*.mjs"] },
    { type: "CompiledWasm", include: ["**/*.wasm"] },
    { type: "Text", include: ["**/*.txt", "**/*.html", "**/*.css"] },
    { type: "Data", include: ["**/*.bin"] },
  ],
  compatibilityDate: "2025-05-01",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: { DB: "sovenok" },
  d1Persist: D1_PERSIST,
  bindings: {
    HF_ENV: process.env.HF_ENV ?? "production",
    APP_SLUG: process.env.APP_SLUG ?? "sovenok",
    // Режим базы передаётся воркеру уже разобранным: db() в приложении сверяет
    // его с тем, что реально настроено, и падает при расхождении.
    SOVENOK_DB,
    // Биндинг D1 остаётся смонтированным и при postgres: он путь отката.
    DB_GATEWAY_URL: GATEWAY_URL,
    DB_GATEWAY_TOKEN: GATEWAY_TOKEN,
    ...passthrough(),
  },
  // Исходящий трафик воркера — с обычным набором корневых сертификатов плюс
  // корень УЦ Минцифры. Им подписан securepay.tinkoff.ru, и без него вызов
  // эквайринга падает внутри workerd, не дойдя до нашего кода: приложение
  // видит только «internal error», а человек — «касса не отвечает».
  //
  // allow перечислен явно: у сетевой службы workerd умолчание — один
  // "public", а db-gateway живёт на приватном адресе внутри docker-сети,
  // и без "private" воркер потерял бы базу.
  outboundService: {
    network: {
      allow: ["public", "private", "local"],
      tlsOptions: {
        trustBrowserCas: true,
        trustedCertificates: [readFileSync(RUSSIAN_ROOT_CA, "utf8")],
      },
    },
  },
  host: "0.0.0.0",
  port: PORT,
});

// Миграции идемпотентны (CREATE TABLE/INDEX IF NOT EXISTS), поэтому
// прогоняются на каждом старте — отдельная таблица версий не нужна.
async function applyMigrations() {
  const db = await mf.getD1Database("DB");
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
    console.log(`[migrations] ${file}: ${statements.length} statement(s)`);
  }
}

// С PostgreSQL схему накатывает db-gateway, здесь это было бы лишней работой
// над базой, в которую приложение всё равно не ходит.
if (SOVENOK_DB === "postgres") {
  console.log("[sovenok] база: PostgreSQL через db-gateway (SOVENOK_DB=postgres)");
} else {
  await applyMigrations();
  console.log(`[sovenok] база: D1/SQLite → ${D1_PERSIST} (SOVENOK_DB=d1)`);
}

const url = await mf.ready;
console.log(`[sovenok] SSR worker слушает ${url.origin}`);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    mf.dispose().finally(() => process.exit(0));
  });
}
