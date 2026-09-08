/*
 * Проверка генераторов заданий: bun run scripts/check-practice.ts [программа]
 *
 * Прогоняет каждую тему каталога в общем наборе и во всех программных
 * вариантах и валит сборку, если тема не набирает тридцать непохожих
 * карточек, у выбора нет ответа среди вариантов, в тексте всплыло NaN или
 * undefined. Ошибка в генераторе — это неверный ответ у ребёнка, поэтому
 * проверка должна быть зелёной до коммита.
 */
import { CATALOG } from "../src/lib/content/curriculum.data";
import { PROGRAM_FAMILIES } from "../src/lib/content/practice.programs";
import { CHECK_SIZE, checkTasks, hasPractice, practiceTasks } from "../src/lib/content/practice";
import type { SeedTask } from "../src/lib/content/practice.core";
import { PRACTICE_SIZE } from "../src/lib/content/practice.core";

const only = process.argv[2] ?? null;
const problems: string[] = [];
let checked = 0;

function verify(label: string, tasks: SeedTask[], expected: number) {
  if (tasks.length !== expected)
    problems.push(`${label}: ${tasks.length} карточек вместо ${expected}`);
  const seen = new Set<string>();
  tasks.forEach((t, i) => {
    const where = `${label}#${i}`;
    const text = `${t.prompt} ${t.answer} ${t.explanation} ${JSON.stringify(t.payload)}`;
    if (/NaN|undefined|null|\[object/.test(text))
      problems.push(`${where}: в тексте NaN/undefined: ${t.prompt}`);
    if (!t.prompt.trim()) problems.push(`${where}: пустой вопрос`);
    if (!t.answer.trim()) problems.push(`${where}: пустой ответ`);
    if (!t.explanation.trim()) problems.push(`${where}: пустой разбор`);
    const key = t.prompt.trim().toLowerCase();
    if (seen.has(key)) problems.push(`${where}: повтор вопроса`);
    seen.add(key);
    if (t.kind === "choice") {
      const opts = t.payload.options ?? [];
      if (opts.length < 2) problems.push(`${where}: меньше двух вариантов`);
      if (!opts.includes(t.answer))
        problems.push(`${where}: ответа «${t.answer}» нет среди вариантов ${opts.join("|")}`);
      if (new Set(opts).size !== opts.length)
        problems.push(`${where}: варианты повторяются: ${opts.join("|")}`);
    }
    if (t.kind === "match") {
      const l = t.payload.left ?? [];
      const rr = t.payload.right ?? [];
      if (l.length < 2 || l.length !== rr.length) problems.push(`${where}: пары не сходятся`);
      if (t.answer !== rr.join("|"))
        problems.push(`${where}: ответ сопоставления не равен правому столбцу`);
    }
    if (t.kind === "input" && t.answer.length > 40)
      problems.push(`${where}: слишком длинный ответ для ввода: ${t.answer}`);
  });
}

for (const topic of CATALOG) {
  const variants: (string | null)[] = [
    null,
    ...Object.keys(PROGRAM_FAMILIES).filter((p) => topic.code in PROGRAM_FAMILIES[p]),
  ];
  for (const program of variants) {
    if (only && program !== only) continue;
    if (!program && !hasPractice(topic.code)) {
      problems.push(`${topic.code}: нет генератора`);
      continue;
    }
    const label = program ? `${topic.code}@${program}` : topic.code;
    checked += 1;
    verify(label, practiceTasks(topic.code, program), PRACTICE_SIZE);
    verify(`${label}#check`, checkTasks(topic.code, program), CHECK_SIZE);
  }
}

for (const [program, families] of Object.entries(PROGRAM_FAMILIES)) {
  for (const code of Object.keys(families)) {
    if (!CATALOG.some((t) => t.code === code))
      problems.push(`${program}: код ${code} не из каталога`);
    if (families[code].length === 0) problems.push(`${program}/${code}: пустой список генераторов`);
  }
}

console.log(`Проверено наборов: ${checked}`);
if (problems.length) {
  console.error(problems.slice(0, 60).join("\n"));
  if (problems.length > 60) console.error(`… и ещё ${problems.length - 60}`);
  process.exit(1);
}
console.log("Все наборы в порядке");
