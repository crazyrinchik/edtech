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

/**
 * Заход на пробу: тренажёр открыт взрослым из своего кабинета.
 *
 * Педагогу нужно пройти самому то, что он задаёт, иначе он выдаёт вслепую.
 * Но тренажёр, открытый из кабинета, писал бы результат первому ученику в
 * списке: ребёнка он берёт из me(), и о том, что за экраном взрослый, ему
 * узнать неоткуда. В отчёте ученика появлялись бы чужие заходы, пёрышки и
 * рекорды — те самые числа, по которым педагог говорит с родителем.
 *
 * Поэтому из кабинета тренажёр открывается с `proba=1`: ребёнка у такого
 * захода нет вовсе, а без него saveDrillRow не пишет ничего. Ключ едет в
 * адресе наравне с настройками, а не живёт в памяти роутера: ссылку
 * открывают и в новой вкладке, и по ней же возвращаются «назад».
 */
export const PROBE_KEY = "proba";

/**
 * Ссылка «открыть» в кабинете взрослого: <Link search={PROBE_SEARCH}>.
 *
 * Единица числом, а не строкой: строки роутер укладывает в адрес через
 * JSON, и в строке браузера вместо `?proba=1` оказывалось `?proba=%221%22`.
 * Разбирает обе формы drillSearch — число он приводит к строке сам.
 */
export const PROBE_SEARCH = { [PROBE_KEY]: 1 };

/** Только известные ключи и только строками — как они и пришли из адреса. */
export function drillSearch<K extends string>(
  search: Record<string, unknown>,
  keys: readonly K[],
): Partial<Record<K | typeof PROBE_KEY, string>> {
  const out: Partial<Record<K | typeof PROBE_KEY, string>> = {};
  // Пробу принимают все пять тренажёров, поэтому перечислять её в каждом
  // списке ключей незачем: она не настройка, а то, чей это заход.
  for (const key of [...keys, PROBE_KEY] as (K | typeof PROBE_KEY)[]) {
    const value = search[key];
    if (typeof value === "string" && value !== "") out[key] = value;
    else if (typeof value === "number") out[key] = String(value);
  }
  return out;
}

/**
 * Чей это заход и открыта ли у него настройка.
 *
 * Обычный идёт от имени активного ребёнка — того, за которого тренажёр
 * пишет результат. У пробного ребёнка нет: он никуда не ложится, и
 * рассказывать о нём на экране итога нужно иначе (SAVE_PROBE).
 *
 * Настройка и в пробном остаётся платной, только считается по подписке
 * самого взрослого: ребёнок здесь ни при чём, а платит именно он. Тем же
 * правилом открывается форма выдачи в кабинете (trainers-screen.tsx).
 */
export function drillWho(
  account: {
    user: { subscriptionStatus: string } | null;
    children: { id: string }[];
    activeChildId: string | null;
    activeChildPaid: boolean;
  },
  probe: boolean,
): { childId: string | null; paid: boolean } {
  if (probe) {
    return {
      childId: null,
      paid: account.user?.subscriptionStatus === "active" || account.activeChildPaid,
    };
  }
  return {
    childId: account.activeChildId ?? account.children[0]?.id ?? null,
    paid: account.activeChildPaid,
  };
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
