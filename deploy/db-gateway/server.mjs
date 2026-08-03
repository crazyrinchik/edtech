// Шлюз между воркером и PostgreSQL.
//
// Воркер (workerd) не умеет в TCP, поэтому шлёт SQL сюда обычным fetch().
// Сервис намеренно минимальный: принимает список подготовленных запросов
// с параметрами и возвращает строки. Наружу порт не публикуется — он живёт
// только во внутренней сети compose, плюс закрыт общим секретом.

import http from "node:http";
import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, types } from "pg";

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.GATEWAY_TOKEN;
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? "/srv/migrations";

if (!TOKEN) {
  console.error("[db-gateway] не задан GATEWAY_TOKEN");
  process.exit(1);
}

// node-pg отдаёт int8 (это все COUNT(*)) и numeric (это все SUM(...))
// строками, чтобы не терять точность. Приложение считает их числами:
// в статистике родителя и админки такие значения идут прямо в арифметику,
// и без разбора "12" + "7" дало бы "127". Значения здесь заведомо мелкие.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.POOL_MAX ?? 8),
  idleTimeoutMillis: 30_000,
});

pool.on("error", (error) => console.error("[db-gateway] ошибка простаивающего клиента:", error));

/** Миграции идемпотентны (CREATE TABLE/INDEX IF NOT EXISTS) — гоняем на каждом старте. */
async function applyMigrations() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pool.query(statement);
    }
    console.log(`[db-gateway] миграция ${file}: ${statements.length} выражений`);
  }
}

/**
 * Хеш в том же формате, что делает приложение (hashPassword в core.server.ts):
 * pbkdf2$<соль>$<ключ>, PBKDF2-HMAC-SHA256, 100 000 итераций, 32 байта.
 * WebCrypto в воркере и node:crypto здесь дают одинаковый результат, поэтому
 * заведённый тут пароль проходит обычную проверку на входе.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `pbkdf2$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Служебные учётные записи задаются при развёртывании, а не через форму
 * регистрации: админка не должна доставаться первому зарегистрировавшемуся,
 * а тестовому аккаунту нужны предсказуемые креды.
 *
 * Выполняется один раз на старте контейнера, поэтому пересчёт PBKDF2 не
 * попадает в путь запроса. Пароль и роль переписываются на каждом старте:
 * источник истины — .env, иначе правка пароля там ничего бы не меняла.
 * Заодно снимается блокировка, если аккаунт заблокировали через админку.
 *
 * Подписка везде free: с 'active' служебные записи считались бы платящими
 * пользователями и задирали конверсию в оплату на дашборде.
 */
async function ensureServiceUser({ emailEnv, passwordEnv, role, name, label }) {
  const email = (process.env[emailEnv] ?? "").toLowerCase().trim();
  const password = process.env[passwordEnv] ?? "";
  if (!email || !password) {
    console.log(`[db-gateway] ${emailEnv}/${passwordEnv} не заданы — ${label} не создаётся`);
    return;
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

  if (existing.rowCount === 0) {
    const id = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, role, subscription_status,
                          consent_pd, consent_child_pd, consent_at, created_at)
       VALUES ($1, $2, $3, $4, $5, 'free', 1, 1, $6, $6)`,
      [id, email, hashPassword(password), name, role, now],
    );
    console.log(`[db-gateway] создан ${label} ${email}`);
    return;
  }

  await pool.query(
    "UPDATE users SET password_hash = $1, role = $2, blocked = 0 WHERE email = $3",
    [hashPassword(password), role, email],
  );
  console.log(`[db-gateway] ${label} ${email} обновлён`);
}

async function ensureServiceUsers() {
  await ensureServiceUser({
    emailEnv: "ADMIN_EMAIL",
    passwordEnv: "ADMIN_PASSWORD",
    role: "admin",
    name: "Администратор",
    label: "администратор",
  });
  // Обычный родитель: нужен, чтобы после выкладки пройти продукт руками
  // ровно так, как его видит настоящий пользователь.
  await ensureServiceUser({
    emailEnv: "TEST_EMAIL",
    passwordEnv: "TEST_PASSWORD",
    role: "parent",
    name: "Тестовый доступ",
    label: "тестовый пользователь",
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      // Сид контента — это ~120 INSERT одной пачкой; 8 МБ с большим запасом.
      if (size > 8 * 1024 * 1024) {
        reject(new Error("тело запроса слишком большое"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function runStatements(statements, transaction) {
  if (!transaction) {
    const results = [];
    for (const { sql, params } of statements) {
      const r = await pool.query(sql, params ?? []);
      results.push({ rows: r.rows ?? [], rowCount: r.rowCount ?? 0 });
    }
    return results;
  }

  // batch() в D1 атомарен, поэтому здесь настоящая транзакция.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = [];
    for (const { sql, params } of statements) {
      const r = await client.query(sql, params ?? []);
      results.push({ rows: r.rows ?? [], rowCount: r.rowCount ?? 0 });
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      await pool.query("SELECT 1");
      return send(res, 200, { ok: true });
    }

    if (req.method !== "POST" || req.url !== "/sql") {
      return send(res, 404, { error: "not found" });
    }

    // Шлюз исполняет произвольный SQL, поэтому проверка идёт до разбора тела.
    if (req.headers["x-gateway-token"] !== TOKEN) {
      return send(res, 401, { error: "unauthorized" });
    }

    const body = JSON.parse(await readBody(req));
    const statements = Array.isArray(body?.statements) ? body.statements : null;
    if (!statements || statements.length === 0) {
      return send(res, 400, { error: "нужен непустой массив statements" });
    }

    const results = await runStatements(statements, Boolean(body.transaction));
    return send(res, 200, { results });
  } catch (error) {
    console.error("[db-gateway]", error);
    return send(res, 500, { error: String(error?.message ?? error) });
  }
});

await applyMigrations();
await ensureServiceUsers();
server.listen(PORT, "0.0.0.0", () => console.log(`[db-gateway] слушает :${PORT}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  });
}
