import type { OwlItem } from "../components/mascot";

/**
 * Лавка совёнка: что можно купить за пёрышки.
 *
 * Рост совёнка сюда не входит — он идёт от уровня и достаётся сам. Здесь
 * только аксессуары, и каждый из них ребёнок выбирает и покупает сам.
 * Уровень задаёт, когда вещь появляется на витрине, а цена — сколько за
 * ней работать: без порога по уровню всё скупалось бы в первый день, без
 * цены покупка не была бы наградой.
 */
export type ShopItem = {
  id: Exclude<OwlItem, "none">;
  title: string;
  note: string;
  cost: number;
  minLevel: number;
};

/** Пёрышки за работу. Домашка даёт меньше темы, но и делается чаще. */
export const COINS_PER_HOMEWORK_ITEM = 5;
export const COINS_PER_TOPIC = 10;

export const SHOP: ShopItem[] = [
  { id: "scarf", title: "Тёплый шарф", note: "Чтобы не мёрзнуть ночью", cost: 20, minLevel: 1 },
  { id: "glasses", title: "Очки умника", note: "В них лучше видно задачи", cost: 40, minLevel: 2 },
  { id: "cap", title: "Колпак звездочёта", note: "Для ночных наблюдений", cost: 70, minLevel: 3 },
  {
    id: "graduate",
    title: "Шапочка выпускника",
    note: "Для самых мудрых сов",
    cost: 120,
    minLevel: 4,
  },
];

export function shopItem(id: string): ShopItem | undefined {
  return SHOP.find((i) => i.id === id);
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function coinsLabel(n: number): string {
  return `${n} ${plural(n, "пёрышко", "пёрышка", "пёрышек")}`;
}
