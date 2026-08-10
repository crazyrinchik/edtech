/*
 * Каталог тем со стороны репетитора: что показать и в каком порядке.
 *
 * Два режима. Общий список — это каталог как он есть, порядок федеральной
 * рабочей программы; репетитор выбирает его, когда учебник ученика неизвестен
 * или когда нужно посмотреть весь класс целиком. Конкретная программа
 * переставляет те же темы в порядке своего учебника и подписывает их главами:
 * «Табличное умножение» в Школе России и в Петерсон — одна и та же тема, но
 * в разных местах года и под разными названиями.
 *
 * Тем от выбора программы не становится больше и меньше: набор задан ФОП НОО.
 * Отличия программы показываются отдельно (DELTAS) — этого достаточно, чтобы
 * репетитор понял, где ученик опережает класс, а где отстаёт.
 */

import type { ProgramInfo, SubjectId } from "./curriculum.data";
import { CATALOG, DELTAS, PROGRAMS } from "./curriculum.data";

export type { ProgramInfo, SubjectId };
export { GRADES, SUBJECTS } from "./curriculum.data";

/** Тема каталога в контексте выбранной программы. */
export type OrderedTopic = {
  code: string;
  subject: SubjectId;
  grade: number;
  title: string;
  hours: number | null;
  /** Как тема названа в учебнике программы; в общем списке пусто. */
  chapters: string[];
  /** Тема есть в порядке программы, а не добавлена из каталога хвостом. */
  inProgram: boolean;
};

export function programById(id: string | null | undefined): ProgramInfo | null {
  if (!id) return null;
  return PROGRAMS.find((p) => p.id === id) ?? null;
}

export function programList(): ProgramInfo[] {
  return PROGRAMS;
}

function catalogSlice(subject: SubjectId, grade: number) {
  return CATALOG.filter((t) => t.subject === subject && t.grade === grade);
}

/** Общий список: порядок федеральной рабочей программы, без глав учебника. */
export function baseOrder(subject: SubjectId, grade: number): OrderedTopic[] {
  return catalogSlice(subject, grade).map((t) => ({ ...t, chapters: [], inProgram: true }));
}

/**
 * Порядок конкретной программы.
 *
 * Главы учебника идут подряд и часто возвращаются к одной теме по нескольку
 * раз («Числа до 20» в начале года и в повторении) — тема встаёт на место
 * первого появления, а все её главы собираются в подпись. Темы каталога, не
 * названные в оглавлении, дописываются в конец: набор тем в классе задан
 * стандартом, и пропасть они не могут.
 */
export function programOrder(programId: string, subject: SubjectId, grade: number): OrderedTopic[] {
  const program = programById(programId);
  const steps = program?.steps?.[subject]?.[String(grade)];
  if (!program || !steps || steps.length === 0) return baseOrder(subject, grade);

  const slice = catalogSlice(subject, grade);
  const byCode = new Map(slice.map((t) => [t.code, t]));
  const chapters = new Map<string, string[]>();
  const order: string[] = [];

  for (const step of steps) {
    if (!step.code || !byCode.has(step.code)) continue;
    if (!chapters.has(step.code)) {
      chapters.set(step.code, []);
      order.push(step.code);
    }
    chapters.get(step.code)!.push(step.title);
  }

  const listed = order.map((code) => ({
    ...byCode.get(code)!,
    chapters: chapters.get(code) ?? [],
    inProgram: true,
  }));
  const rest = slice
    .filter((t) => !chapters.has(t.code))
    .map((t) => ({ ...t, chapters: [], inProgram: false }));

  return [...listed, ...rest];
}

/** Темы класса в нужном порядке: программа выбрана или открыт общий список. */
export function topicsFor(
  programId: string | null,
  subject: SubjectId,
  grade: number,
): OrderedTopic[] {
  return programId ? programOrder(programId, subject, grade) : baseOrder(subject, grade);
}

/** Предметы, которые программа описывает: у Петерсон в каталоге только математика. */
export function programSubjects(programId: string | null): SubjectId[] {
  const program = programById(programId);
  if (!program) return ["math", "rus"];
  return program.subjects;
}

/** Чем программа отличается от базового темпа в этом классе. */
export function deltasFor(programId: string | null, grade: number) {
  if (!programId) return [];
  return DELTAS.filter((d) => d.program === programId && d.grade === grade);
}

export function topicByCode(code: string) {
  return CATALOG.find((t) => t.code === code) ?? null;
}

/**
 * Бесплатной остаётся первая тема каждого предмета в классе: репетитор без
 * подписки должен увидеть, из чего состоят задания, но не получить всю
 * программу целиком.
 */
export function isFreeTopic(code: string): boolean {
  const topic = topicByCode(code);
  if (!topic) return false;
  return catalogSlice(topic.subject, topic.grade)[0]?.code === code;
}

/** Порядковый номер темы в каталоге — им же сортируются строки в базе. */
export function catalogIndex(code: string): number {
  return CATALOG.findIndex((t) => t.code === code);
}
