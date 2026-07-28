import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";

import { bindings } from "./bindings.server";
import { DIAGNOSTIC, SEED_SUBJECTS, SEED_TOPICS } from "./content/seed";

export const SESSION_COOKIE = "sov_session";
const SESSION_DAYS = 30;

export function db() {
  const { DB } = bindings();
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

export async function startSession(userId: string): Promise<void> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db()
    .prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, nowIso(), expires.toISOString())
    .run();
  const secure = new URL(getRequest().url).protocol === "https:";
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) await db().prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  setCookie(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
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
      D.prepare("INSERT OR IGNORE INTO subjects (id, name, sort_order) VALUES (?, ?, ?)").bind(
        s.id,
        s.name,
        s.sortOrder,
      ),
    );
  }

  SEED_TOPICS.forEach((topic, topicIndex) => {
    statements.push(
      D.prepare(
        "INSERT OR IGNORE INTO topics (id, subject_id, grade, sort_order, name, summary, is_free) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(topic.id, topic.subjectId, topic.grade, topicIndex, topic.name, topic.summary, topic.isFree ? 1 : 0),
    );
    topic.tasks.forEach((task, taskIndex) => {
      statements.push(
        D.prepare(
          "INSERT OR IGNORE INTO tasks (id, topic_id, kind, sort_order, prompt, payload, answer, explanation, is_check) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
      D.prepare("INSERT OR IGNORE INTO promo_codes (code, months) VALUES (?, ?)").bind(code, 12),
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
