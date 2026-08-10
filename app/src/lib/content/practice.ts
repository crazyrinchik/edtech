/*
 * Задания темы каталога: тридцать тренировочных и пять проверочных.
 *
 * Набор выводится из кода темы, поэтому одинаков на всех устройствах и при
 * каждом заходе. Это важнее, чем разнообразие: id задания складывается из
 * кода темы и номера, а по этим id хранятся попытки ученика.
 */

import { CATALOG } from "./curriculum.data";
import type { SeedTask } from "./practice.core";
import { PRACTICE_SIZE, assemble } from "./practice.core";
import { MATH_FAMILIES } from "./practice.math";
import { RUS_FAMILIES } from "./practice.rus";

/** Сколько заданий идёт в проверочную работу по теме. */
export const CHECK_SIZE = 5;

const FAMILIES = { ...MATH_FAMILIES, ...RUS_FAMILIES };

/** Есть ли у темы каталога готовые задания. */
export function hasPractice(code: string): boolean {
  return code in FAMILIES;
}

/** Тренировка: ровно тридцать карточек. */
export function practiceTasks(code: string): SeedTask[] {
  const families = FAMILIES[code];
  if (!families) return [];
  return assemble(code, families, PRACTICE_SIZE);
}

/**
 * Проверочная: те же правила, но другие числа и слова — иначе ребёнок сдаёт
 * работу по памяти, а не по умению.
 */
export function checkTasks(code: string): SeedTask[] {
  const families = FAMILIES[code];
  if (!families) return [];
  return assemble(`${code}#check`, families, CHECK_SIZE).map((t) => ({ ...t, isCheck: true }));
}

/** Тренировка и проверочная подряд — в этом порядке они и лежат в базе. */
export function topicTasks(code: string): SeedTask[] {
  return [...practiceTasks(code), ...checkTasks(code)];
}

/**
 * Темы каталога без заданий: страховка на случай, когда каталог пополнили, а
 * генератор для новой темы ещё не написали. Используется в тестах и в админке.
 */
export function topicsWithoutPractice(): string[] {
  return CATALOG.filter((t) => !hasPractice(t.code)).map((t) => t.code);
}
