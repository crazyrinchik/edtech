/*
 * Общая механика тренировочных наборов.
 *
 * Заданий нужно тридцать на каждую тему каталога, а тем семьдесят девять.
 * Держать две с половиной тысячи карточек списком нельзя: их не прочитать
 * глазами и не поправить. Поэтому тема описывается генераторами, а числа и
 * слова берутся из псевдослучайного ряда, засеянного кодом темы: набор
 * каждый раз получается один и тот же, значит id задания стабилен и попытки
 * ученика не разъезжаются между заходами.
 */

import type { SeedTask, TaskPayload } from "./seed";

export type { SeedTask, TaskPayload };

/** Сколько тренировочных заданий обязана дать каждая тема. */
export const PRACTICE_SIZE = 30;

/* ------------------------------------------------------------ случайность */

export type Rng = {
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  /** Перемешанная копия: нужна, когда варианты ответа нельзя давать по порядку. */
  shuffle: <T>(items: readonly T[]) => T[];
};

/** Мулберри-32: короткий детерминированный генератор без зависимостей. */
export function rng(seedText: string): Rng {
  let state = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    state ^= seedText.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/* -------------------------------------------------------------- карточки */

export const choice = (
  prompt: string,
  options: string[],
  answer: string,
  explanation: string,
): SeedTask => ({
  kind: "choice",
  prompt,
  payload: { options },
  answer,
  explanation,
  isCheck: false,
});

export const input = (prompt: string, answer: string, explanation: string): SeedTask => ({
  kind: "input",
  prompt,
  payload: {},
  answer,
  explanation,
  isCheck: false,
});

export const match = (
  prompt: string,
  pairs: [string, string][],
  explanation: string,
): SeedTask => ({
  kind: "match",
  prompt,
  payload: { left: pairs.map((p) => p[0]), right: pairs.map((p) => p[1]) },
  answer: pairs.map((p) => p[1]).join("|"),
  explanation,
  isCheck: false,
});

/**
 * Вариант с ответом среди отвлекающих: ребёнку нельзя показывать список, где
 * правильное всегда первое, а лишние варианты повторяются.
 */
export function pickOne(
  r: Rng,
  prompt: string,
  answer: string,
  distractors: string[],
  explanation: string,
): SeedTask {
  const options = r.shuffle([answer, ...distractors.filter((d) => d !== answer).slice(0, 3)]);
  return choice(prompt, options, answer, explanation);
}

/* ------------------------------------------------------------- сбор темы */

/**
 * Тридцать непохожих карточек из нескольких генераторов.
 *
 * Генератор просят повторно, пока не наберётся нужное число: у большинства
 * тем варианты параметризованы, и повтор формулировки — обычное дело, его
 * достаточно отбросить. Порядок остаётся «по кругу», а не блоками, чтобы
 * ребёнок не делал двадцать одинаковых примеров подряд.
 */
export function assemble(
  seedText: string,
  families: ((r: Rng) => SeedTask)[],
  size: number = PRACTICE_SIZE,
): SeedTask[] {
  const r = rng(seedText);
  const out: SeedTask[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 2000 && out.length < size; round += 1) {
    const family = families[round % families.length];
    const task = family(r);
    const key = task.prompt.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(task);
  }
  return out;
}

/** Из готового банка карточек: темы, где вопросы не выводятся формулой. */
export function fromBank(seedText: string, bank: SeedTask[]): SeedTask[] {
  const r = rng(seedText);
  const unique = bank.filter(
    (t, i) =>
      bank.findIndex((x) => x.prompt.trim().toLowerCase() === t.prompt.trim().toLowerCase()) === i,
  );
  return r.shuffle(unique).slice(0, PRACTICE_SIZE);
}

/* --------------------------------------------------------- мелкие утилиты */

/** «5 яблок», «2 яблока», «1 яблоко» — иначе условия задач читаются коряво. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export const NAMES = [
  "Маша",
  "Петя",
  "Даша",
  "Коля",
  "Лена",
  "Артём",
  "Соня",
  "Егор",
  "Вера",
  "Тимур",
] as const;
