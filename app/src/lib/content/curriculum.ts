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
 * Тем от выбора программы не становится больше и меньше: набор задан ФОП НОО,
 * программа меняет порядок и названия. А вот уровень заданий внутри темы
 * у программ разный (practice.programs.ts), поэтому тема под программу
 * живёт в базе отдельной строкой с id вида «код@программа» — см.
 * variantTopicId. Все функции ниже принимают и такой id: каталожная
 * часть у варианта та же.
 *
 * Разбор отличий (DELTAS в curriculum.data) экран больше не показывает:
 * репетитор приходит сюда за списком тем и кнопкой «задать», а не за
 * сравнением учебника с базовым темпом. Данные в каталоге остались — если
 * отличия снова понадобятся, это будет отдельный экран, а не приписка
 * поверх списка.
 */

import type { ProgramInfo, SubjectId } from "./curriculum.data";
import { CATALOG, PROGRAMS } from "./curriculum.data";

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

/* ------------------------------------------------- варианты под программу */

/** Тема под уровень программы: своя строка в базе, свои задания, тот же код каталога. */
export function variantTopicId(code: string, programId: string): string {
  return `${code}@${programId}`;
}

/** «m2.ar.muldiv@peterson» → код каталога и программа; у общей темы программа пустая. */
export function splitTopicId(id: string): { code: string; programId: string | null } {
  const at = id.indexOf("@");
  if (at < 0) return { code: id, programId: null };
  return { code: id.slice(0, at), programId: id.slice(at + 1) };
}

export function isVariantTopicId(id: string): boolean {
  return id.includes("@");
}

/** Тема каталога по коду или по id варианта; сид и свои темы админки — null. */
export function topicByCode(id: string) {
  const { code } = splitTopicId(id);
  return CATALOG.find((t) => t.code === code) ?? null;
}

/** Как тема называется в базе: вариант несёт имя программы, чтобы в отчётах не путаться. */
export function topicDbName(id: string): string | null {
  const topic = topicByCode(id);
  if (!topic) return null;
  const { programId } = splitTopicId(id);
  const program = programById(programId);
  return program ? `${topic.title} · ${program.short}` : topic.title;
}

/**
 * Бесплатной остаётся первая тема каждого предмета в классе: репетитор без
 * подписки должен увидеть, из чего состоят задания, но не получить всю
 * программу целиком.
 */
export function isFreeTopic(id: string): boolean {
  const topic = topicByCode(id);
  if (!topic) return false;
  return catalogSlice(topic.subject, topic.grade)[0]?.code === topic.code;
}

/** Порядковый номер темы в каталоге — им же сортируются строки в базе. */
export function catalogIndex(id: string): number {
  const { code } = splitTopicId(id);
  return CATALOG.findIndex((t) => t.code === code);
}
