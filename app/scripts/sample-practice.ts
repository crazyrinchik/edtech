/* Выборка заданий для просмотра глазами: bun run scripts/sample-practice.ts <программа|base> [сколько на тему] */
import { CATALOG } from "../src/lib/content/curriculum.data";
import { PROGRAM_FAMILIES } from "../src/lib/content/practice.programs";
import { checkTasks, practiceTasks } from "../src/lib/content/practice";

const program = process.argv[2] === "base" ? null : (process.argv[2] ?? null);
const n = Number(process.argv[3] ?? 6);
for (const topic of CATALOG) {
  if (program && !(topic.code in (PROGRAM_FAMILIES[program] ?? {}))) continue;
  const tasks = [...practiceTasks(topic.code, program), ...checkTasks(topic.code, program)];
  console.log(`\n=== ${topic.code}${program ? "@" + program : ""} — ${topic.title}`);
  for (const t of tasks.slice(0, n)) {
    const opts = t.payload.options
      ? ` [${t.payload.options.join(" | ")}]`
      : t.payload.left
        ? ` [${t.payload.left.join("|")} → ${t.payload.right?.join("|")}]`
        : "";
    console.log(
      `- (${t.kind}${t.isCheck ? ", check" : ""}) ${t.prompt}${opts}\n    = ${t.answer}   // ${t.explanation}`,
    );
  }
}
