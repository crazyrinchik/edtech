/*
 * Задания под уровень конкретной программы.
 *
 * Набор тем в классе у всех УМК один (curriculum.ts), но уровень заданий
 * внутри темы — нет. Второклассник по Петерсон складывает трёхзначные в
 * столбик и знает всю таблицу умножения, а по Школе России в это время
 * умножает на 2 и 3. Ребёнку по Эльконину — Давыдову «посчитай яблоки» — не
 * тот язык, в котором он работает: у него число появляется из измерения
 * величины меркой. Поэтому у темы может быть свой набор генераторов под
 * программу; там, где программа идёт базовым темпом, задания общие, и
 * экран об этом говорит прямо, а не выдаёт общий набор за авторский.
 *
 * Условия написаны здесь, а не переписаны из учебников: тексты задач
 * авторских УМК — чужое произведение. Взято только то, что задаёт сама
 * программа: какие числа, какие действия, какая терминология.
 */

import type { Family } from "./practice.core";
import { PETERSON_12 } from "./practice.peterson12";
import { PETERSON_34 } from "./practice.peterson34";
import { ELKONIN_MATH, NSH21_MATH, PERSPEKTIVA_MATH, PLANETA_MATH } from "./practice.programs.math";
import { ELKONIN_RUS, NSH21_RUS, PERSPEKTIVA_RUS } from "./practice.programs.rus";

/** Код темы каталога → генераторы под уровень программы. */
export type ProgramFamilies = Record<string, Family[]>;

/**
 * Школа России в реестре отсутствует намеренно: это и есть базовый темп,
 * по которому написан общий набор (curriculum.source.json, deltas:
 * «baseline»).
 */
export const PROGRAM_FAMILIES: Record<string, ProgramFamilies> = {
  peterson: { ...PETERSON_12, ...PETERSON_34 },
  nsh21: { ...NSH21_MATH, ...NSH21_RUS },
  perspektiva: { ...PERSPEKTIVA_MATH, ...PERSPEKTIVA_RUS },
  planeta_znaniy: { ...PLANETA_MATH },
  elkonin_davydov: { ...ELKONIN_MATH, ...ELKONIN_RUS },
};

/** Свои генераторы темы под программу; null — программа идёт общим набором. */
export function programFamilies(
  programId: string | null | undefined,
  code: string,
): Family[] | null {
  if (!programId) return null;
  return PROGRAM_FAMILIES[programId]?.[code] ?? null;
}

/** Программы, у которых по этой теме свой уровень заданий. */
export function programsWithOwnTasks(code: string): string[] {
  return Object.keys(PROGRAM_FAMILIES).filter((p) => code in PROGRAM_FAMILIES[p]);
}
