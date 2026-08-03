import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";

import type { D1Database } from "@cloudflare/workers-types";

import { bindings } from "./bindings.server";
import { DIAGNOSTIC, SEED_SUBJECTS, SEED_TOPICS } from "./content/seed";
import { createPgGateway } from "./pg-gateway.server";

export const SESSION_COOKIE = "sov_session";
const SESSION_DAYS = 30;

/** Снятая блокировка родительского кабинета: своя короткая кука. */
export const PARENT_COOKIE = "sov_parent";
const PARENT_UNLOCK_MIN = 120;

/**
 * Единственная точка доступа к базе — весь остальной код ходит только сюда.
 *
 * На своём сервере это PostgreSQL через db-gateway (в workerd нет TCP,
 * подробности в pg-gateway.server.ts), в Cloudflare — настоящий биндинг D1.
 * Шлюз повторяет интерфейс D1 один в один, поэтому приводится к его типу:
 * так ни один вызов prepare()/batch() выше по коду не меняется.
 */
export function db(): D1Database {
  const { DB, DB_GATEWAY_URL, DB_GATEWAY_TOKEN } = bindings();
  if (DB_GATEWAY_URL && DB_GATEWAY_TOKEN) {
    return createPgGateway(DB_GATEWAY_URL, DB_GATEWAY_TOKEN) as unknown as D1Database;
  }
  if (!DB) throw new Error("База данных недоступна");
  return DB;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* ---------------------------------------------------------------- пароли */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const saltHex = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return `pbkdf2$${saltHex}$${await derive(password, saltHex)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, digest] = stored.split("$");
  if (scheme !== "pbkdf2" || !saltHex || !digest) return false;
  const candidate = await derive(password, saltHex);
  if (candidate.length !== digest.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) diff |= candidate.charCodeAt(i) ^ digest.charCodeAt(i);
  return diff === 0;
}

/* --------------------------------------------------------------- сессии */

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionStatus: string;
};

/**
 * За обратным прокси (свой сервер: Caddy → SSR-worker по http) сам запрос
 * приходит по http, поэтому TLS распознаётся ещё и по X-Forwarded-Proto.
 * Проверка может только добавить флаг Secure, но не снять его.
 */
function secureCookies(): boolean {
  const request = getRequest();
  return (
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}

export async function startSession(userId: string): Promise<void> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db()
    .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, nowIso(), expires.toISOString())
    .run();
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) await db().prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  setCookie(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  await lockParent();
}

/* ------------------------------------------------- код родителя (4 цифры) */

/**
 * Вход в приложение один на семью: ребёнок открывает занятия сам. Но кабинет
 * взрослого — отчёты, подписка, настройки — закрывается коротким кодом, иначе
 * ребёнок в два клика снимает себе лимит времени и выдаёт подписку.
 *
 * Код хранится тем же PBKDF2, что и пароль: четыре цифры перебираются за
 * секунды, поэтому в открытом виде его в базе быть не должно.
 */
export async function hasParentPin(userId: string): Promise<boolean> {
  const row = await db()
    .prepare("SELECT user_id FROM parent_pins WHERE user_id = ?")
    .bind(userId)
    .first();
  return !!row;
}

export async function saveParentPin(userId: string, pin: string): Promise<void> {
  const hash = await hashPassword(pin);
  await db()
    .prepare(
      `INSERT INTO parent_pins (user_id, pin_hash, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET pin_hash = ?, updated_at = ?`,
    )
    .bind(userId, hash, nowIso(), hash, nowIso())
    .run();
}

/** Проверяет код и открывает кабинет на PARENT_UNLOCK_MIN минут. */
export async function unlockParent(userId: string, pin: string): Promise<boolean> {
  const row = await db()
    .prepare("SELECT pin_hash FROM parent_pins WHERE user_id = ?")
    .bind(userId)
    .first<{ pin_hash: string }>();
  if (!row || !(await verifyPassword(pin, row.pin_hash))) return false;

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + PARENT_UNLOCK_MIN * 60_000);
  await db()
    .prepare("INSERT INTO parent_unlocks (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, nowIso(), expires.toISOString())
    .run();
  setCookie(PARENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: PARENT_UNLOCK_MIN * 60,
  });
  return true;
}

export async function lockParent(): Promise<void> {
  const token = getCookie(PARENT_COOKIE);
  if (token) await db().prepare("DELETE FROM parent_unlocks WHERE token = ?").bind(token).run();
  setCookie(PARENT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function isParentUnlocked(userId: string): Promise<boolean> {
  const token = getCookie(PARENT_COOKIE);
  if (!token) return false;
  const row = await db()
    .prepare("SELECT user_id FROM parent_unlocks WHERE token = ? AND expires_at > ?")
    .bind(token, nowIso())
    .first<{ user_id: string }>();
  return !!row && row.user_id === userId;
}

/**
 * Пока код не задан, кабинет открыт: иначе родитель, зарегистрировавшийся до
 * появления кода, остался бы заперт снаружи. Интерфейс в этом случае сразу
 * предлагает код придумать.
 */
export async function requireParentAccess(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await hasParentPin(user.id))) return user;
  if (!(await isParentUnlocked(user.id))) throw new Error("Введите код родителя");
  return user;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const row = await db()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.subscription_status, u.blocked
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`,
    )
    .bind(token, nowIso())
    .first<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      subscription_status: string;
      blocked: number;
    }>();
  if (!row || row.blocked) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    subscriptionStatus: row.subscription_status,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("Нужно войти в аккаунт");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Недостаточно прав");
  return user;
}

/** Ребёнок доступен только своему родителю. */
export async function requireOwnChild(childId: string, userId: string) {
  const child = await db()
    .prepare("SELECT * FROM children WHERE id = ? AND parent_id = ?")
    .bind(childId, userId)
    .first<Record<string, unknown>>();
  if (!child) throw new Error("Профиль ребёнка не найден");
  return child;
}

/* ------------------------------------------------------------- аналитика */

export async function track(
  name: string,
  opts: { userId?: string | null; childId?: string | null; props?: unknown } = {},
): Promise<void> {
  try {
    await db()
      .prepare("INSERT INTO events (id, name, user_id, child_id, props, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(
        uid("ev"),
        name,
        opts.userId ?? null,
        opts.childId ?? null,
        opts.props ? JSON.stringify(opts.props) : null,
        nowIso(),
      )
      .run();
  } catch {
    // аналитика никогда не должна ломать пользовательский сценарий
  }
}

/* --------------------------------------------------------- первичный сид */

let seedChecked = false;

export async function ensureSeeded(): Promise<void> {
  if (seedChecked) return;
  const D = db();
  const existing = await D.prepare("SELECT COUNT(*) AS n FROM topics").first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) {
    seedChecked = true;
    return;
  }

  const statements = [];
  for (const s of SEED_SUBJECTS) {
    statements.push(
      D.prepare("INSERT INTO subjects (id, name, sort_order) VALUES (?, ?, ?) ON CONFLICT DO NOTHING").bind(
        s.id,
        s.name,
        s.sortOrder,
      ),
    );
  }

  SEED_TOPICS.forEach((topic, topicIndex) => {
    statements.push(
      D.prepare(
        "INSERT INTO topics (id, subject_id, grade, sort_order, name, summary, is_free) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      ).bind(topic.id, topic.subjectId, topic.grade, topicIndex, topic.name, topic.summary, topic.isFree ? 1 : 0),
    );
    topic.tasks.forEach((task, taskIndex) => {
      statements.push(
        D.prepare(
          "INSERT INTO tasks (id, topic_id, kind, sort_order, prompt, payload, answer, explanation, is_check) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
        ).bind(
          `${topic.id}-t${taskIndex}`,
          topic.id,
          task.kind,
          taskIndex,
          task.prompt,
          JSON.stringify(task.payload),
          task.answer,
          task.explanation,
          task.isCheck ? 1 : 0,
        ),
      );
    });
  });

  // Промокоды для первых пользователей (подписка активируется вручную).
  for (const code of ["SOVENOK", "PILOT2026", "SEMYA"]) {
    statements.push(
      D.prepare("INSERT INTO promo_codes (code, months) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(code, 12),
    );
  }

  await D.batch(statements);
  seedChecked = true;
}

/** Задания входной диагностики для класса ребёнка. */
export function diagnosticFor(grade: number) {
  const pick = (subject: "math" | "rus") =>
    DIAGNOSTIC[subject].find((d) => d.grade === grade) ?? DIAGNOSTIC[subject][0];
  return [
    { subjectId: "math" as const, subjectName: "Математика", tasks: pick("math").tasks },
    { subjectId: "rus" as const, subjectName: "Русский язык", tasks: pick("rus").tasks },
  ];
}

/** Ответ сравнивается мягко: регистр, пробелы и «ё» не должны валить ребёнка. */
export function answersMatch(given: string, expected: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").replace(/[.,!?;]+$/, "").trim();
  return norm(given) === norm(expected);
}
