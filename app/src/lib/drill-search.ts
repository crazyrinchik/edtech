/*
 * Настройки тренажёра, приехавшие в адресе.
 *
 * Педагог задаёт тренажёр со своими настройками, и они уходят ребёнку прямо
 * в ссылке: /schet?digits=2&ops=add,sub&limit=0. Разбор живёт здесь, а не в
 * каталоге настроек (lib/drills.ts): каталог тянет за собой банк слов
 * правописания, и подключать его к каждому тренажёру ради четырёх строк
 * незачем.
 *
 * Всё чужое молча отбрасывается. Ссылку правит кто угодно, а тренажёр должен
 * открыться в любом случае: неизвестное значение — это не ошибка, это просто
 * настройка по умолчанию.
 */

/** Только известные ключи и только строками — как они и пришли из адреса. */
export function drillSearch<K extends string>(
  search: Record<string, unknown>,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = search[key];
    if (typeof value === "string" && value !== "") out[key] = value;
    else if (typeof value === "number") out[key] = String(value);
  }
  return out;
}

/** Одно значение из списка допустимых. */
export function pickOne<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.find((value) => value === raw) ?? fallback;
}

/** Несколько значений через запятую. Пустой список равен отсутствию настройки. */
export function pickMany<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T[],
): T[] {
  if (!raw) return fallback;
  const chosen = raw.split(",").filter((v): v is T => allowed.some((a) => a === v));
  return chosen.length ? chosen : fallback;
}

/** Число из списка допустимых: разрядность, скорость, размер таблицы. */
export function pickNumber<T extends number>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = Number(raw);
  return allowed.find((a) => a === value) ?? fallback;
}
