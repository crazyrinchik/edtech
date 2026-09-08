/* Ищет «Артём вычислила» и «Маша вычислил»: имена в NAMES обоих родов, глагол должен согласоваться. */
import { CATALOG } from "../src/lib/content/curriculum.data";
import { PROGRAM_FAMILIES } from "../src/lib/content/practice.programs";
import { checkTasks, practiceTasks } from "../src/lib/content/practice";
const male = [
  "Петя",
  "Коля",
  "Артём",
  "Егор",
  "Тимур",
  "Петей",
  "Колей",
  "Артёмом",
  "Егором",
  "Тимуром",
];
const female = ["Маша", "Даша", "Лена", "Соня", "Вера"];
const bad: string[] = [];
for (const t of CATALOG)
  for (const p of [null, ...Object.keys(PROGRAM_FAMILIES)]) {
    if (p && !(t.code in PROGRAM_FAMILIES[p])) continue;
    for (const task of [...practiceTasks(t.code, p), ...checkTasks(t.code, p)]) {
      const text = `${task.prompt} ${task.explanation}`;
      for (const n of male)
        if (new RegExp(`${n} [а-яё]+ла\\b`).test(text))
          bad.push(`${t.code}@${p}: ${text.slice(0, 90)}`);
      for (const n of female)
        if (new RegExp(`${n} [а-яё]+л\\b`).test(text))
          bad.push(`${t.code}@${p}: ${text.slice(0, 90)}`);
    }
  }
console.log(bad.length ? bad.join("\n") : "рассогласований нет");
