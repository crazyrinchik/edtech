// Локальный стенд: приложение с настоящей базой, без Docker.
//
// `vite dev` поднимает витрину, демо и тренажёры, но не базу: D1 в нём не
// стартует, и всё, что требует данных — ученик, репетитор, кабинет родителя, —
// честно падает из db(). Полное окружение — это docker compose, но он нужен не
// всегда и есть не на всякой машине.
//
// Стенд собирает то же самое из двух готовых частей репозитория:
//   1. serve.mjs — воркер в miniflare с биндингом DB поверх локального SQLite;
//   2. Caddyfile — asset-first: есть файл в dist/client, отдаём его; нет —
//      запрос уходит в SSR-воркер.
// Здесь это один процесс на одном порту, поэтому Caddy не нужен.
//
// Перед запуском нужен свежий бандл: `cd app && bunx vite build`.
//
//   npm --prefix deploy install     # один раз, ставит miniflare
//   node deploy/stand.mjs           # http://localhost:8788
//
// Зависимость у стенда та же одна, что у контейнера, но манифесты разные:
// контейнер собирается из runtime.package.json (см. Dockerfile), стенд — из
// deploy/package.json. Меняете версию miniflare — меняйте в обоих.
//
// Данные лежат в deploy/.stand (гитигнор). Удалить папку — начать с чистой
// базы: миграции идемпотентны и накатятся заново на первом же старте.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Miniflare } from "miniflare";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const APP = path.join(ROOT, "app");
const SERVER_DIR = path.join(APP, "dist", "server");
const CLIENT_DIR = path.join(APP, "dist", "client");
const MIGRATIONS_DIR = path.join(APP, "migrations");
const DATA_DIR = process.env.STAND_DATA ?? path.join(HERE, ".stand");
const PORT = Number(process.env.PORT ?? 8788);

function die(message) {
  console.error(`[stand] ${message}`);
  process.exit(1);
}

// Стенд умеет только локальный SQLite и заводит в базе служебные строки.
// Если в окружении оказались настройки боевой базы — это чужой .env, и
// запускаться здесь нельзя ни при каких обстоятельствах.
if (process.env.DB_GATEWAY_URL || process.env.DB_GATEWAY_TOKEN) {
  die(
    "в окружении есть DB_GATEWAY_URL/DB_GATEWAY_TOKEN — это настройки боевой базы. " +
      "Стенд работает только с локальным SQLite и сам пишет в базу тестовые строки. " +
      "Запустите его в чистом окружении.",
  );
}
if ((process.env.SOVENOK_DB ?? "").trim().toLowerCase() === "postgres") {
  die("SOVENOK_DB=postgres: стенд работает только с локальным D1/SQLite.");
}

try {
  await stat(path.join(SERVER_DIR, "server.js"));
} catch {
  die(`нет сборки в ${SERVER_DIR}. Соберите: cd app && bunx vite build`);
}

await mkdir(DATA_DIR, { recursive: true });

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
  d1Persist: path.join(DATA_DIR, "d1"),
  bindings: {
    HF_ENV: "development",
    APP_SLUG: "sovenok",
    SOVENOK_DB: "d1",
    DB_GATEWAY_URL: "",
    DB_GATEWAY_TOKEN: "",
  },
});

const db = await mf.getD1Database("DB");

// Миграции идемпотентны (CREATE TABLE/INDEX IF NOT EXISTS) — гоняем на каждом
// старте, ровно как это делает serve.mjs в контейнере.
for (const file of (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await db.prepare(statement).run();
  console.log(`[migrations] ${file}: ${statements.length}`);
}

/* --------------------------------------------------------------- фикстура

   Репетитор, четверо учеников и готовая сессия. Аккаунт заводится строками в
   базе, а не через форму регистрации: пароль стенду не нужен и не задаётся —
   в password_hash лежит строка, под которую не подойдёт ни один пароль, вход
   только по куке ниже. Вставки идемпотентны, перезапуск ничего не ломает.

   Отключить: STAND_FIXTURE=0. */

const TOKEN = "stand-session-token";

if ((process.env.STAND_FIXTURE ?? "1") !== "0") {
  const now = new Date().toISOString();
  const plus30 = new Date(Date.now() + 30 * 864e5).toISOString();
  const tutor = "usr_stand_tutor";
  const kids = [
    { id: "chi_masha", name: "Маша", grade: 1, avatar: "owl" },
    { id: "chi_artem", name: "Артём", grade: 1, avatar: "fox" },
    { id: "chi_liza", name: "Лиза", grade: 2, avatar: "cat" },
    { id: "chi_timur", name: "Тимур", grade: 1, avatar: "frog" },
  ];

  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, role, subscription_status,
                          consent_pd, consent_child_pd, consent_at, blocked, created_at)
       VALUES (?, ?, ?, ?, 'tutor', 'active', 1, 1, ?, 0, ?) ON CONFLICT DO NOTHING`,
    )
    .bind(tutor, "stand@example.invalid", "no-login:stand-fixture", "Ирина Петровна", now, now)
    .run();

  await db
    .prepare(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    )
    .bind(TOKEN, tutor, now, plus30)
    .run();

  for (const kid of kids) {
    await db
      .prepare(
        `INSERT INTO children (id, parent_id, name, avatar, grade, daily_limit_min,
                               sound_on, diagnostics_done, created_at)
         VALUES (?, ?, ?, ?, ?, 20, 1, 1, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(kid.id, tutor, kid.name, kid.avatar, kid.grade, now)
      .run();
    await db
      .prepare(
        `INSERT INTO child_access (child_id, user_id, role, created_at)
         VALUES (?, ?, 'tutor', ?) ON CONFLICT DO NOTHING`,
      )
      .bind(kid.id, tutor, now)
      .run();
  }
  console.log(`[fixture] репетитор «Ирина Петровна», учеников ${kids.length}`);
}

/* ------------------------------------------- asset-first, как в Caddyfile */

const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

// "/" всегда уходит в SSR: index.html не собирается. Выход за пределы
// dist/client проверяется после resolve, а не по строке запроса.
async function tryFile(pathname) {
  if (pathname === "/") return null;
  let file;
  try {
    file = path.resolve(CLIENT_DIR, "." + decodeURIComponent(pathname));
  } catch {
    return null;
  }
  if (file !== CLIENT_DIR && !file.startsWith(CLIENT_DIR + path.sep)) return null;
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  const file = await tryFile(url.pathname);
  if (file) {
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(res);
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  try {
    const response = await mf.dispatchFetch(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: "manual",
    });

    const headers = {};
    for (const [key, value] of response.headers) {
      // set-cookie приходит списком, и свернуть его в одну строку значит
      // потерять все куки кроме первой: на входе их две.
      if (key.toLowerCase() !== "set-cookie") headers[key] = value;
    }
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length) headers["set-cookie"] = cookies;

    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("[stand]", error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error?.stack ?? error));
  }
}).listen(PORT, () => {
  console.log(`[stand] http://localhost:${PORT}`);
  if ((process.env.STAND_FIXTURE ?? "1") !== "0") {
    console.log(`[stand] войти репетитором: document.cookie = "sov_session=${TOKEN}; path=/"`);
  }
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => mf.dispose().finally(() => process.exit(0)));
}
