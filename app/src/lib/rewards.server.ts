/**
 * Пёрышки: начисление за работу и покупка аксессуаров.
 *
 * Начисления идемпотентны по (ребёнок, источник, объект), поэтому их можно
 * пересчитывать при каждом открытии экрана. Это важно: выполненность пункта
 * домашки нигде не хранится — она выводится из занятий, — и «момента
 * выполнения», в который можно было бы начислить награду, просто не
 * существует. Поэтому синхронизация ленивая: открыли экран, досчитали, что
 * заработано, дописали недостающие строки.
 */

import { COINS_PER_HOMEWORK_ITEM, COINS_PER_TOPIC, shopItem } from "./shop";
import { db, nowIso } from "./core.server";

/**
 * Пункты домашки, которые уже выполнены.
 *
 * Условие повторяет buildAssignments в tutor.functions: пункт закрыт, если
 * после выдачи задания было занятие с долей верных не ниже целевой.
 * «Лучший результат в окне ≥ порога» и «существует занятие ≥ порога» —
 * одно и то же, поэтому здесь это один запрос, а не выборка всех занятий.
 * ROUND обязателен: без него 69.6% не дотянет до порога, а в карточке
 * репетитора тот же результат округляется до 70 и считается сданным.
 */
async function doneAssignmentItems(childId: string): Promise<{ id: string }[]> {
  const rows = await db()
    .prepare(
      `SELECT ai.id AS id
         FROM assignment_items ai
         JOIN assignments a ON a.id = ai.assignment_id
        WHERE a.child_id = ? AND a.canceled_at IS NULL
          AND (
            (ai.kind = 'topic' AND EXISTS (
               SELECT 1 FROM lessons l
                WHERE l.child_id = a.child_id AND l.topic_id = ai.ref_id
                  AND l.started_at >= a.created_at AND l.total > 0
                  AND ROUND(100.0 * l.correct / l.total) >= ai.target_percent))
            OR
            (ai.kind = 'custom' AND EXISTS (
               SELECT 1 FROM custom_submissions cs
                WHERE cs.item_id = ai.id AND cs.grade IS NOT NULL))
            OR
            (ai.kind = 'drill' AND EXISTS (
               SELECT 1 FROM drills d
                WHERE d.child_id = a.child_id AND d.kind = ai.ref_id
                  AND d.created_at >= a.created_at))
          )`,
    )
    .bind(childId)
    .all<{ id: string }>();
  return rows.results ?? [];
}

/** Досчитать награды за всё, что уже сделано. Возвращает, сколько начислено сейчас. */
export async function syncCoins(childId: string): Promise<number> {
  const granted = await db()
    .prepare("SELECT source, ref_id FROM coin_grants WHERE child_id = ?")
    .bind(childId)
    .all<{ source: string; ref_id: string }>();
  const seen = new Set((granted.results ?? []).map((g) => `${g.source}:${g.ref_id}`));

  const pending: { source: string; refId: string; coins: number }[] = [];

  for (const item of await doneAssignmentItems(childId)) {
    if (!seen.has(`homework:${item.id}`)) {
      pending.push({ source: "homework", refId: item.id, coins: COINS_PER_HOMEWORK_ITEM });
    }
  }

  const topics = await db()
    .prepare("SELECT topic_id FROM progress WHERE child_id = ? AND status = 'completed'")
    .bind(childId)
    .all<{ topic_id: string }>();
  for (const t of topics.results ?? []) {
    if (!seen.has(`topic:${t.topic_id}`)) {
      pending.push({ source: "topic", refId: t.topic_id, coins: COINS_PER_TOPIC });
    }
  }

  if (pending.length === 0) return 0;

  const now = nowIso();
  await db().batch(
    pending.map((p) =>
      db()
        .prepare(
          `INSERT INTO coin_grants (child_id, source, ref_id, coins, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (child_id, source, ref_id) DO NOTHING`,
        )
        .bind(childId, p.source, p.refId, p.coins, now),
    ),
  );
  return pending.reduce((sum, p) => sum + p.coins, 0);
}

export type OwlState = {
  coins: number;
  earned: number;
  owned: string[];
  equipped: string;
};

export async function owlState(childId: string): Promise<OwlState> {
  const earnedRow = await db()
    .prepare("SELECT COALESCE(SUM(coins), 0) AS n FROM coin_grants WHERE child_id = ?")
    .bind(childId)
    .first<{ n: number }>();
  const spentRow = await db()
    .prepare("SELECT COALESCE(SUM(cost), 0) AS n FROM child_items WHERE child_id = ?")
    .bind(childId)
    .first<{ n: number }>();
  const items = await db()
    .prepare("SELECT item FROM child_items WHERE child_id = ? ORDER BY bought_at")
    .bind(childId)
    .all<{ item: string }>();
  const owl = await db()
    .prepare("SELECT equipped FROM child_owl WHERE child_id = ?")
    .bind(childId)
    .first<{ equipped: string | null }>();

  const earned = Number(earnedRow?.n ?? 0);
  const spent = Number(spentRow?.n ?? 0);
  return {
    coins: earned - spent,
    earned,
    owned: (items.results ?? []).map((i) => i.item),
    equipped: owl?.equipped ?? "none",
  };
}

export async function buyOwlItemFor(childId: string, item: string, level: number): Promise<void> {
  const catalogue = shopItem(item);
  if (!catalogue) throw new Error("Такой вещи нет в лавке");

  const state = await owlState(childId);
  if (state.owned.includes(item)) throw new Error("Эта вещь уже есть");
  if (level < catalogue.minLevel) throw new Error(`Откроется на уровне ${catalogue.minLevel}`);
  if (state.coins < catalogue.cost) throw new Error("Пока не хватает пёрышек");

  await db()
    .prepare("INSERT INTO child_items (child_id, item, cost, bought_at) VALUES (?, ?, ?, ?)")
    .bind(childId, item, catalogue.cost, nowIso())
    .run();
  // Купленное надевается сразу: отдельный шаг «а теперь надень» ребёнок
  // проходит один раз и дальше воспринимает как лишний.
  await equipOwlItemFor(childId, item);
}

export async function equipOwlItemFor(childId: string, item: string): Promise<void> {
  if (item !== "none") {
    const owned = await db()
      .prepare("SELECT item FROM child_items WHERE child_id = ? AND item = ?")
      .bind(childId, item)
      .first<{ item: string }>();
    if (!owned) throw new Error("Эта вещь ещё не куплена");
  }
  await db()
    .prepare(
      `INSERT INTO child_owl (child_id, equipped, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (child_id) DO UPDATE SET equipped = ?, updated_at = ?`,
    )
    .bind(childId, item, nowIso(), item, nowIso())
    .run();
}
