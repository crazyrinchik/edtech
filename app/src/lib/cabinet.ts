/**
 * Слова и адреса разделов «Темы и задания» и «Тренажёры», которые зависят
 * от того, чей это кабинет — репетитора или родителя. Отдельным модулем,
 * а не в файле экрана: fast refresh требует, чтобы файл с компонентом
 * экспортировал только компоненты.
 */

export type Audience = "tutor" | "parent";

/** Слова и адреса, которые зависят от того, чей это кабинет. */
export const SCREEN_WORDS: Record<
  Audience,
  {
    back: string;
    backTo: string;
    topicsTo: string;
    drillsTo: string;
    whoDat: string;
    pick: string;
    assigned: string;
    paidHint: string;
    noOne: string;
  }
> = {
  tutor: {
    back: "К ученикам",
    backTo: "/repetitor",
    topicsTo: "/repetitor/temy",
    drillsTo: "/repetitor/trenazhery",
    whoDat: "ученику",
    pick: "Выберите учеников",
    assigned: "Задано ученикам",
    paidHint:
      "Названия тем и порядок видны всегда, а содержимое — на первой теме каждого предмета. С подпиской открываются задания всех тем, и их можно задавать любому ученику.",
    noOne:
      "Учеников пока нет — добавьте первого в списке учеников, и тренажёры можно будет задавать.",
  },
  parent: {
    back: "В кабинет",
    backTo: "/roditel",
    topicsTo: "/roditel/temy",
    drillsTo: "/roditel/trenazhery",
    whoDat: "ребёнку",
    pick: "Выберите, кому",
    assigned: "Задано",
    paidHint:
      "Названия тем и порядок видны всегда, а содержимое — на первой теме каждого предмета. С подпиской открываются задания всех тем, и их можно задавать ребёнку.",
    noOne: "Профиля ребёнка пока нет — заведите его в кабинете, и тренажёры можно будет задавать.",
  },
};

/**
 * Куда отправить взрослого, если он открыл не свой раздел.
 *
 * Возвращает адрес, на который надо уйти, или null, если оставаться можно.
 * Родитель за закрытым кодом уходит в кабинет: там дверь с кодом, и
 * серверные ручки без него всё равно откажут (requireAssigner).
 */
export function wrongDoor(
  audience: Audience,
  account: { user: { role: string } | null; parentPinSet: boolean; parentUnlocked: boolean },
  section: "temy" | "trenazhery",
): string | null {
  if (!account.user) return "/vhod";
  const role = account.user.role;
  if (audience === "parent") {
    if (role === "tutor") return `/repetitor/${section}`;
    if (account.parentPinSet && !account.parentUnlocked) return "/roditel";
    return null;
  }
  if (role !== "tutor" && role !== "admin") return `/roditel/${section}`;
  return null;
}
