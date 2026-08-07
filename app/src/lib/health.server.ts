// Служебная ручка живости: отвечает, к какой базе подключено приложение.
//
// Проверка «страница отдала 200» ловит только упавший процесс. Она бы пропустила
// самый неприятный случай — выкладку, поднявшуюся на пустой локальной SQLite
// вместо PostgreSQL (потерянный GATEWAY_TOKEN в .env). Сайт при этом работает,
// но без чужих аккаунтов и прогресса, а новые регистрации пишутся мимо бэкапов.
//
// Поэтому здесь два ответа рядом: какой режим ЗАКАЗАН (SOVENOK_DB) и какой
// движок ОТВЕЧАЕТ на самом деле. Расходятся — 503, и выкладка откатывается.
//
// Живёт не в routes/, а вызывается из воркер-энтри (src/server.ts) — как и
// вебхук ботов: это не страница, и от работоспособности роутера ручка
// зависеть не должна.
//
// Наружу не уходит ничего, кроме двух слов про базу: ни версий, ни адреса
// шлюза, ни единой строки данных.

import type { D1Database } from "@cloudflare/workers-types";

import { db, dbKind, type DbKind } from "./core.server";

export const HEALTH_PATH = "/api/zdorovie";

type DbEngine = "postgres" | "sqlite";

/**
 * Какой движок отвечает на том конце. Спрашивается у самой базы, а не у
 * переменных окружения: врать здесь должно быть нечему.
 *
 * Проба — функция, которая есть только у одного из двух. sqlite_version() не
 * годится: D1 её запрещает («not authorized to use function»), поэтому со
 * стороны SQLite берётся typeof() — в PostgreSQL такой функции нет.
 */
async function detectEngine(D: D1Database): Promise<DbEngine> {
  try {
    await D.prepare("SELECT version() AS v").first();
    return "postgres";
  } catch {
    // База могла и просто не ответить: тогда упадёт и вторая проба,
    // а исключение уйдёт наверх и превратится в 503.
    await D.prepare("SELECT typeof(1) AS v").first();
    return "sqlite";
  }
}

const EXPECTED: Record<DbKind, DbEngine> = { postgres: "postgres", d1: "sqlite" };

export async function handleHealth(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("not found", { status: 404 });
  }

  const answer = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });

  let kind: DbKind;
  try {
    kind = dbKind();
  } catch (error) {
    console.error(error);
    return answer(503, { ok: false, error: "SOVENOK_DB задан неверно" });
  }

  try {
    const engine = await detectEngine(db());
    const ok = engine === EXPECTED[kind];
    // Порядок ключей фиксирован: healthcheck в deploy.yml сверяет подстроку.
    return answer(ok ? 200 : 503, { ok, db: kind, engine });
  } catch (error) {
    // Текст ошибки содержит адрес шлюза, наружу он не идёт — только в лог.
    console.error(error);
    return answer(503, { ok: false, db: kind, error: "база не отвечает" });
  }
}
