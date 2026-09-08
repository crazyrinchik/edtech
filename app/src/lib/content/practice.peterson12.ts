/*
 * Задания под уровень «Учусь учиться» (Л. Г. Петерсон), 1-2 класс.
 *
 * Петерсон идёт заметно впереди базового темпа: в 1 классе — числа до 100,
 * «мешки» (множества), части и целое, уравнения; во 2 классе — числа до
 * 1000, сложение в столбик с переходом через разряд, вся таблица умножения,
 * площадь и объём, программы действий и дерево возможностей. Общий набор
 * (practice.math.ts) первокласснику по Петерсон к концу года мал, поэтому
 * здесь свои генераторы на те темы каталога, где программа ушла вперёд.
 *
 * Условия свои: из программы взяты только числа, действия и термины
 * («часть и целое», «мешок», «операция», «программа действий»).
 */

import type { Family, Rng } from "./practice.core";
import { NAMES, choice, input, match, pickOne, plural } from "./practice.core";

/* ---------------------------------------------------------- словари */

const THINGS: [string, string, string][] = [
  ["яблоко", "яблока", "яблок"],
  ["карандаш", "карандаша", "карандашей"],
  ["наклейка", "наклейки", "наклеек"],
  ["шишка", "шишки", "шишек"],
  ["конфета", "конфеты", "конфет"],
  ["марка", "марки", "марок"],
  ["орех", "ореха", "орехов"],
  ["кубик", "кубика", "кубиков"],
];

/** «7 карандашей»: счётная форма нужна почти каждой задаче. */
function count(n: number, thing: [string, string, string]): string {
  return `${n} ${plural(n, thing[0], thing[1], thing[2])}`;
}

const times = (n: number) => `${n} ${plural(n, "раз", "раза", "раз")}`;

/** «в 2 раза», «в 5 раз»: числительное с «раз» склоняется. */
const inTimes = (n: number) => `в ${n} ${plural(n, "раз", "раза", "раз")}`;

/** «У Маши», «у Артёма»: имена из NAMES в родительном падеже. */
const GEN: Record<string, string> = {
  Маша: "Маши",
  Петя: "Пети",
  Даша: "Даши",
  Коля: "Коли",
  Лена: "Лены",
  Артём: "Артёма",
  Соня: "Сони",
  Егор: "Егора",
  Вера: "Веры",
  Тимур: "Тимура",
};
const genName = (r: Rng) => GEN[r.pick(NAMES)];

/** Для фраз с глаголом в женском роде («вычислила», «задумала»). */
const GIRLS = ["Маша", "Даша", "Лена", "Соня", "Вера"] as const;

const tens = (n: number) => `${n} ${plural(n, "десяток", "десятка", "десятков")}`;
const ones = (n: number) => `${n} ${plural(n, "единица", "единицы", "единиц")}`;

const cmpSign = (a: number, b: number) => (a > b ? ">" : a < b ? "<" : "=");

const UNITS = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = [
  "",
  "",
  "двадцать",
  "тридцать",
  "сорок",
  "пятьдесят",
  "шестьдесят",
  "семьдесят",
  "восемьдесят",
  "девяносто",
];
const HUNDREDS = [
  "",
  "сто",
  "двести",
  "триста",
  "четыреста",
  "пятьсот",
  "шестьсот",
  "семьсот",
  "восемьсот",
  "девятьсот",
];

/** Число словами, 1-999: для заданий «прочитай» и «запиши цифрами». */
function words(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    if (Math.floor(rest / 10) >= 2) parts.push(TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(UNITS[rest % 10]);
  }
  return parts.join(" ");
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Убирает повторы среди отвлекающих вариантов: pickOne их не чистит. */
const uniq = (items: string[]) => [...new Set(items)];

/* =============================================================== 1 класс */

/* ------------------------------------------ m1.num.11_20: числа до 100 */

const p1num = [
  (r: Rng) => {
    const n = r.int(21, 99);
    return input(
      `Сколько десятков в числе ${n}?`,
      String(Math.floor(n / 10)),
      `${n} — это ${tens(Math.floor(n / 10))} и ${ones(n % 10)}. Десятки показывает первая цифра.`,
    );
  },
  (r: Rng) => {
    const n = r.int(21, 99);
    return input(
      `Сколько единиц в числе ${n}, не считая десятков?`,
      String(n % 10),
      `В числе ${n} — ${Math.floor(n / 10)} дес. ${n % 10} ед. Единицы показывает вторая цифра.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 9);
    const u = r.int(1, 9);
    return input(
      `Запиши число, в котором ${d} дес. и ${u} ед.`,
      String(d * 10 + u),
      `${tens(d)} — это ${d * 10}, и ещё ${ones(u)}: ${d * 10 + u}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(11, 99);
    const b = r.int(11, 99);
    const sign = cmpSign(a, b);
    return choice(
      `Какой знак поставить: ${a} … ${b}?`,
      [">", "<", "="],
      sign,
      sign === "="
        ? "Числа одинаковые, значит между ними знак равенства."
        : "Сначала сравниваем десятки. Если десятков поровну, сравниваем единицы.",
    );
  },
  (r: Rng) => {
    const d = r.int(2, 8);
    return input(
      `Продолжи счёт десятками: ${d * 10}, ${d * 10 + 10}, …`,
      String(d * 10 + 20),
      `Считаем круглыми числами, каждый раз на десяток больше: после ${d * 10 + 10} идёт ${d * 10 + 20}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(21, 98);
    return input(
      `Назови соседей числа ${n} через запятую (сначала меньший).`,
      `${n - 1}, ${n + 1}`,
      `Перед ${n} при счёте идёт ${n - 1}, после — ${n + 1}.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 9);
    const u = r.int(1, 9);
    const n = d * 10 + u;
    const swapped = u * 10 + d;
    return pickOne(
      r,
      `Как читается число ${n}?`,
      words(n),
      uniq([words(swapped), words(n + 10 <= 99 ? n + 10 : n - 10), words(n - 1)]),
      `${n} — это ${d} дес. и ${u} ед.: «${words(n)}».`,
    );
  },
  (r: Rng) => {
    const n = r.int(21, 99);
    return input(
      `Запиши цифрами число «${words(n)}».`,
      String(n),
      `«${words(n)}» — это ${Math.floor(n / 10)} дес. и ${n % 10} ед.: ${n}.`,
    );
  },
];

/* --------------------------------- m1.ar.10: части и целое, уравнения */

const p1parts = [
  (r: Rng) => {
    const whole = r.int(6, 20);
    const part = r.int(1, whole - 1);
    return input(
      `Целое равно ${whole}, одна часть — ${part}. Найди другую часть.`,
      String(whole - part),
      `Чтобы найти часть, из целого вычитаем другую часть: ${whole} − ${part} = ${whole - part}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 10);
    const b = r.int(1, 10);
    return input(
      `Части равны ${a} и ${b}. Найди целое.`,
      String(a + b),
      `Целое равно сумме частей: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(1, 12);
    const a = r.int(1, 20 - x);
    return input(
      `Реши уравнение: x + ${a} = ${x + a}`,
      String(x),
      `x — часть, ${x + a} — целое. Часть = целое − другая часть: ${x + a} − ${a} = ${x}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(6, 20);
    const x = r.int(1, a - 1);
    return input(
      `Реши уравнение: ${a} − x = ${a - x}`,
      String(x),
      `${a} — целое, x — часть. Часть = целое − другая часть: ${a} − ${a - x} = ${x}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(1, 10);
    const b = r.int(1, 10);
    return input(
      `Реши уравнение: x − ${a} = ${b}`,
      String(a + b),
      `x — целое, ${a} и ${b} — части. Целое = часть + часть: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(1, 10 - a);
    const which = r.int(0, 2);
    const names = ["слагаемое", "слагаемое", "сумма"];
    const shown = which === 0 ? a : which === 1 ? b : a + b;
    return pickOne(
      r,
      `В записи ${a} + ${b} = ${a + b} число ${shown} называется …`,
      names[which],
      ["слагаемое", "сумма", "уменьшаемое", "разность"],
      `${a} и ${b} — слагаемые (части), ${a + b} — сумма (целое).`,
    );
  },
  (r: Rng) => {
    const a = r.int(5, 10);
    const b = r.int(1, a - 1);
    const which = r.int(0, 2);
    const names = ["уменьшаемое", "вычитаемое", "разность"];
    const shown = which === 0 ? a : which === 1 ? b : a - b;
    return pickOne(
      r,
      `В записи ${a} − ${b} = ${a - b} число ${shown} называется …`,
      names[which],
      ["уменьшаемое", "вычитаемое", "разность", "сумма"],
      `${a} — уменьшаемое (целое), ${b} — вычитаемое (часть), ${a - b} — разность (другая часть).`,
    );
  },
  (r: Rng) => {
    const whole = r.int(8, 20);
    const part = r.int(2, whole - 2);
    return pickOne(
      r,
      `Целое ${whole}, части x и ${part}. Какое уравнение подходит к этой схеме?`,
      `x + ${part} = ${whole}`,
      [`x − ${part} = ${whole}`, `${whole} + ${part} = x`, `x + ${whole} = ${part}`],
      `Целое стоит после знака «=», части складываются: x + ${part} = ${whole}. Тогда x = ${whole - part}.`,
    );
  },
];

/* --------------- m1.ar.20: переход через десяток и двузначные числа */

const p1ar20 = [
  (r: Rng) => {
    const a = r.int(6, 9);
    const b = r.int(11 - a, 9);
    return input(
      `Сколько будет ${a} + ${b}?`,
      String(a + b),
      `Дополняем ${a} до десятка: ${a} + ${10 - a} = 10, потом 10 + ${b - (10 - a)} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const total = r.int(11, 18);
    const b = r.int(total - 9, 9);
    return input(
      `Сколько будет ${total} − ${b}?`,
      String(total - b),
      `Вычитаем по частям: ${total} − ${total - 10} = 10, затем 10 − ${b - (total - 10)} = ${total - b}.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 9);
    const u = r.int(1, 5);
    const b = r.int(1, 9 - u);
    const a = d * 10 + u;
    return input(
      `Сколько будет ${a} + ${b}?`,
      String(a + b),
      `Единицы прибавляем к единицам: ${u} + ${b} = ${u + b}, десятков по-прежнему ${d}. Ответ ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 7);
    const b = r.int(1, 9 - a);
    return input(
      `Сколько будет ${a * 10} + ${b * 10}?`,
      String((a + b) * 10),
      `Считаем десятками: ${a} дес. + ${b} дес. = ${a + b} дес., то есть ${(a + b) * 10}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const b = r.int(1, a - 1);
    return input(
      `Сколько будет ${a * 10} − ${b * 10}?`,
      String((a - b) * 10),
      `${a} дес. − ${b} дес. = ${a - b} дес., это ${(a - b) * 10}.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 9);
    const u = r.int(1, 9);
    const n = d * 10 + u;
    const askUnits = r.int(0, 1) === 1;
    return askUnits
      ? input(
          `Сколько будет ${n} − ${u}?`,
          String(d * 10),
          `Убираем все единицы, остаются одни десятки: ${d} дес. = ${d * 10}.`,
        )
      : input(
          `Сколько будет ${n} − ${d * 10}?`,
          String(u),
          `Убираем все десятки, остаются единицы: ${u}.`,
        );
  },
  (r: Rng) => {
    const d = r.int(3, 9);
    const u = r.int(1, 9);
    const b = r.int(1, d - 1);
    const a = d * 10 + u;
    return input(
      `Сколько будет ${a} − ${b * 10}?`,
      String(a - b * 10),
      `Десятки вычитаем из десятков: ${d} − ${b} = ${d - b} дес., единиц по-прежнему ${u}. Ответ ${a - b * 10}.`,
    );
  },
  (r: Rng) => {
    const sum = r.int(12, 20);
    const a = r.int(3, 9);
    return input(
      `Вставь пропущенное число: ${a} + … = ${sum}`,
      String(sum - a),
      `Ищем часть: из целого ${sum} вычитаем известную часть ${a}: ${sum - a}.`,
    );
  },
];

/* ----------------------- m1.inf.group: мешки, свойства, римские цифры */

const BAG_ITEMS = ["яблоко", "груша", "слива", "орех"];
const APPLES: [string, string, string] = ["яблоко", "яблока", "яблок"];
const PEARS: [string, string, string] = ["груша", "груши", "груш"];
const CUBES: [string, string, string] = ["кубик", "кубика", "кубиков"];

const COLORS = ["красный", "синий", "жёлтый", "зелёный"];
const SHAPES = ["круг", "квадрат", "треугольник"];
const SIZES = ["большой", "маленький"];

const CATS: { items: string[]; plural: string; one: string }[] = [
  { items: ["яблоко", "груша", "слива", "вишня"], plural: "фрукты", one: "фрукт" },
  { items: ["морковь", "огурец", "капуста", "свёкла"], plural: "овощи", one: "овощ" },
  { items: ["кот", "заяц", "лиса", "волк"], plural: "животные", one: "животное" },
  { items: ["стол", "стул", "шкаф", "диван"], plural: "мебель", one: "мебель" },
];

const p1bags = [
  (r: Rng) => {
    const n = r.int(3, 6);
    const bag = Array.from({ length: n }, () => r.pick(BAG_ITEMS));
    const target = r.pick(bag);
    const k = bag.filter((x) => x === target).length;
    return input(
      `В мешке лежат: ${bag.join(", ")}. Сколько раз в мешке встречается «${target}»?`,
      String(k),
      `Пересчитываем только элементы «${target}»: их ${k}.`,
    );
  },
  (r: Rng) => {
    const a = r.shuffle(BAG_ITEMS).slice(0, r.int(2, 3));
    const same = r.int(0, 1) === 1;
    let b = r.shuffle(a);
    if (!same) {
      const extra = BAG_ITEMS.filter((x) => !a.includes(x));
      b = [...b.slice(0, b.length - 1), r.pick(extra)];
    }
    return pickOne(
      r,
      `Первый мешок: ${a.join(", ")}. Второй мешок: ${b.join(", ")}. Равны ли мешки?`,
      same ? "равны" : "не равны",
      ["равны", "не равны"],
      same
        ? "В мешках одни и те же элементы, а порядок в мешке не важен, значит мешки равны."
        : `В первом мешке нет элемента «${b[b.length - 1]}», значит мешки не равны.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 6);
    const b = r.int(1, 5);
    const c = r.int(1, 6);
    return input(
      `В первом мешке ${count(a, APPLES)} и ${count(b, PEARS)}, во втором ${count(c, APPLES)}. Мешки сложили. Сколько яблок в новом мешке?`,
      String(a + c),
      `При сложении мешков элементы складывают вместе: яблок ${a} + ${c} = ${a + c}.`,
    );
  },
  (r: Rng) => {
    const whole = r.int(6, 12);
    const part = r.int(2, whole - 2);
    return input(
      `В группе ${whole} игрушек: ${count(part, CUBES)}, остальные мячи. Сколько мячей?`,
      String(whole - part),
      `Вся группа — целое, кубики — часть. Часть = целое − другая часть: ${whole} − ${part} = ${whole - part}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(1, 12);
    return input(
      `Запиши число ${n} римскими цифрами (буквами I, V, X).`,
      ROMAN[n - 1],
      `Римская запись числа ${n} — ${ROMAN[n - 1]}: I — один, V — пять, X — десять.`,
    );
  },
  (r: Rng) => {
    const n = r.int(1, 12);
    return input(
      `Какое число записано римскими цифрами: ${ROMAN[n - 1]}?`,
      String(n),
      `${ROMAN[n - 1]} — это ${n}. Меньшая цифра слева от большей вычитается, справа — прибавляется.`,
    );
  },
  (r: Rng) => {
    const props = ["цветом", "формой", "размером"];
    const nouns = ["цвет", "форма", "размер"];
    const diff = r.int(0, 2);
    const colors = r.shuffle(COLORS);
    const shapes = r.shuffle(SHAPES);
    const sizes = r.shuffle(SIZES);
    const first = `${sizes[0]} ${colors[0]} ${shapes[0]}`;
    const second = `${diff === 2 ? sizes[1] : sizes[0]} ${diff === 0 ? colors[1] : colors[0]} ${diff === 1 ? shapes[1] : shapes[0]}`;
    const same = nouns.filter((_, i) => i !== diff);
    return pickOne(
      r,
      `Чем отличаются ${first} и ${second}?`,
      props[diff],
      props,
      `Свойства «${same[0]}» и «${same[1]}» у них одинаковые, отличается только одно свойство — ${nouns[diff]}.`,
    );
  },
  (r: Rng) => {
    const pattern = r.pick([
      ["★", "□"],
      ["□", "★"],
      ["★", "★", "□"],
      ["★", "□", "□"],
    ]);
    const len = r.int(5, 7);
    const row = Array.from({ length: len }, (_, i) => pattern[i % pattern.length]);
    const next = pattern[len % pattern.length];
    return pickOne(
      r,
      `Найди закономерность и продолжи ряд: ${row.join(" ")} …`,
      next,
      ["★", "□"],
      `Ряд повторяет группу «${pattern.join(" ")}». Следующим идёт ${next}.`,
    );
  },
  (r: Rng) => {
    const [main, other] = r.shuffle(CATS);
    const items = r.shuffle(main.items).slice(0, 3);
    const odd = r.pick(other.items);
    const row = r.shuffle([...items, odd]);
    return pickOne(
      r,
      `Что лишнее: ${row.join(", ")}?`,
      odd,
      items,
      `${items.map((x) => `«${x}»`).join(", ")} — это ${main.plural}, а «${odd}» — ${other.one}.`,
    );
  },
];

/* ----------------------- m1.task.1: задачи на части и целое до 20 */

const FLOWERS: [string, string, string] = ["цветок", "цветка", "цветков"];
const CARS: [string, string, string] = ["машинка", "машинки", "машинок"];
const PLANES: [string, string, string] = ["самолётик", "самолётика", "самолётиков"];

const p1task = [
  (r: Rng) => {
    const whole = r.int(8, 20);
    const part = r.int(2, whole - 2);
    return input(
      `В корзине всего ${whole} грибов: ${part} из них белые, остальные лисички. Сколько лисичек?`,
      String(whole - part),
      `Все грибы — целое, белые — часть. Часть = целое − другая часть: ${whole} − ${part} = ${whole - part}.`,
    );
  },
  (r: Rng) => {
    const thing = r.pick(THINGS);
    const a = r.int(3, 10);
    const b = r.int(2, 10);
    return input(
      `У ${genName(r)} ${count(a, thing)} в одной коробке и ${b} в другой. Сколько всего?`,
      String(a + b),
      `Ищем целое: складываем части ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const [n1, n2] = r
      .shuffle(NAMES)
      .slice(0, 2)
      .map((n) => GEN[n]);
    const thing = r.pick(THINGS);
    const a = r.int(6, 20);
    const b = r.int(2, a - 2);
    return input(
      `У ${n1} ${count(a, thing)}, а у ${n2} — ${b}. На сколько больше у ${n1}?`,
      String(a - b),
      `Чтобы узнать, на сколько одно число больше другого, из большего вычитаем меньшее: ${a} − ${b} = ${a - b}.`,
    );
  },
  (r: Rng) => {
    const thing = r.pick(THINGS);
    const a = r.int(8, 15);
    const b = r.int(2, 6);
    const c = r.int(2, 5);
    return input(
      `Было ${count(a, thing)}. ${b} отдали, потом ещё ${c} подарили. Сколько стало?`,
      String(a - b + c),
      `Два действия: ${a} − ${b} = ${a - b}, затем ${a - b} + ${c} = ${a - b + c}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 7);
    const b = r.int(1, 5);
    return input(
      `В первой вазе ${count(a, FLOWERS)}, во второй на ${b} больше. Сколько цветов в двух вазах вместе?`,
      String(a + a + b),
      `Сначала вторая ваза: ${a} + ${b} = ${a + b}. Потом целое: ${a} + ${a + b} = ${a + a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(9, 20);
    const b = r.int(2, 8);
    return pickOne(
      r,
      `Задача: «Было ${a} шаров, ${b} улетели. Сколько осталось?» Какое выражение подходит?`,
      `${a} − ${b}`,
      [`${a} + ${b}`, `${b} − ${a}`, `${b} + ${a}`],
      `Шаров стало меньше: из целого ${a} убираем часть ${b}. Ответ ${a - b}.`,
    );
  },
  (r: Rng) => {
    const findWhole = r.int(0, 1) === 1;
    const a = r.int(3, 9);
    const b = r.int(2, 8);
    const text = findWhole
      ? `У ${genName(r)} ${count(a, CARS)} и ${count(b, PLANES)}. Сколько всего игрушек?`
      : `У ${genName(r)} ${a + b} игрушек, из них ${count(a, CARS)}. Сколько самолётиков?`;
    return pickOne(
      r,
      `Задача: «${text}» Что здесь неизвестно — часть или целое?`,
      findWhole ? "целое" : "часть",
      ["часть", "целое"],
      findWhole
        ? `Все игрушки вместе — это целое: ${a} + ${b} = ${a + b}.`
        : `Все игрушки — целое ${a + b}, машинки — часть. Ищем другую часть: ${a + b} − ${a} = ${b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(6, 12);
    const b = r.int(2, 5);
    return input(
      `На верхней полке ${a} книг, это на ${b} больше, чем на нижней. Сколько книг на нижней полке?`,
      String(a - b),
      `Если на верхней на ${b} больше, то на нижней на ${b} меньше: ${a} − ${b} = ${a - b}.`,
    );
  },
];

/* ---------------------- m1.val.length: длина, масса, объём, мерки */

const p1val = [
  (r: Rng) => {
    const dm = r.int(1, 9);
    const cm = r.int(1, 9);
    return input(
      `${dm} дм ${cm} см — это сколько сантиметров?`,
      String(dm * 10 + cm),
      `${dm} дм = ${dm * 10} см, и ещё ${cm} см: ${dm * 10 + cm} см.`,
    );
  },
  (r: Rng) => {
    const cm = r.int(21, 99);
    return input(
      `Сколько полных дециметров в ${cm} см?`,
      String(Math.floor(cm / 10)),
      `${cm} см = ${Math.floor(cm / 10)} дм ${cm % 10} см: в каждом дециметре 10 см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 6);
    const b = r.int(1, 4);
    return input(
      `На одной чаше весов арбуз, на другой гири ${a} кг и ${b} кг. Весы в равновесии. Сколько весит арбуз? Ответ запиши в килограммах.`,
      String(a + b),
      `Весы в равновесии, значит массы равны: ${a} + ${b} = ${a + b} кг.`,
    );
  },
  (r: Rng) => {
    const a = r.int(5, 20);
    const b = r.int(2, a - 2);
    const add = r.int(0, 1) === 1;
    return add
      ? input(
          `В бочке ${a} л воды. Долили ещё ${b} л. Сколько литров стало?`,
          String(a + b),
          `Воды стало больше: ${a} + ${b} = ${a + b} л.`,
        )
      : input(
          `В бочке ${a} л воды. Отлили ${b} л. Сколько литров осталось?`,
          String(a - b),
          `Воды стало меньше: ${a} − ${b} = ${a - b} л.`,
        );
  },
  (r: Rng) => {
    const merka = r.int(2, 5);
    const n = r.int(2, 6);
    return input(
      `Полоску измерили меркой ${merka} см. Мерка уложилась ${times(n)}. Какой длины полоска? Ответ запиши в сантиметрах.`,
      String(merka * n),
      `Мерка ${merka} см повторилась ${times(n)}: ${Array(n).fill(merka).join(" + ")} = ${merka * n} см.`,
    );
  },
  (r: Rng) => {
    const jar = r.pick([2, 3, 5]);
    const n = r.int(2, 6);
    return input(
      `Банкой ${jar} л наполняют ведро. Ведро вмещает ${jar * n} л. Сколько раз нужно налить банку?`,
      String(n),
      `Считаем, сколько раз по ${jar} л уложится в ${jar * n} л: ${times(n)}.`,
    );
  },
  (r: Rng) => {
    const dm = r.int(1, 9);
    const cm = r.int(1, 99);
    const sign = cmpSign(dm * 10, cm);
    return choice(
      `Какой знак поставить: ${dm} дм … ${cm} см?`,
      [">", "<", "="],
      sign,
      `Переводим в одни единицы: ${dm} дм = ${dm * 10} см. ${dm * 10} ${sign} ${cm}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const b = r.int(2, 9);
    const c = r.int(1, Math.min(a + b - 1, 9));
    const unit = r.pick(["кг", "л", "см"]);
    return input(
      `Вычисли: ${a} ${unit} + ${b} ${unit} − ${c} ${unit}. Ответ запиши числом.`,
      String(a + b - c),
      `Величины в одних единицах складывают и вычитают как числа: ${a} + ${b} = ${a + b}, ${a + b} − ${c} = ${a + b - c} ${unit}.`,
    );
  },
];

/* =============================================================== 2 класс */

/* ---------------------------------------- m2.num.100: числа до 1000 */

const p2num = [
  (r: Rng) => {
    const n = r.int(101, 999);
    return input(
      `Сколько сотен в числе ${n}?`,
      String(Math.floor(n / 100)),
      `${n} — это ${Math.floor(n / 100)} сот. ${Math.floor(n / 10) % 10} дес. ${n % 10} ед. Сотни показывает первая цифра.`,
    );
  },
  (r: Rng) => {
    const h = r.int(1, 9);
    const d = r.int(1, 9);
    const u = r.int(1, 9);
    return input(
      `Запиши число, в котором ${h} сот. ${d} дес. ${u} ед.`,
      String(h * 100 + d * 10 + u),
      `${h} сот. = ${h * 100}, ${d} дес. = ${d * 10}, ${u} ед.: ${h * 100} + ${d * 10} + ${u} = ${h * 100 + d * 10 + u}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(101, 999);
    return input(
      `Какая цифра стоит в разряде десятков числа ${n}?`,
      String(Math.floor(n / 10) % 10),
      `Разряды справа налево: единицы, десятки, сотни. В разряде десятков числа ${n} стоит ${Math.floor(n / 10) % 10}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(101, 999);
    const b = r.int(101, 999);
    const sign = cmpSign(a, b);
    return choice(
      `Какой знак поставить: ${a} … ${b}?`,
      [">", "<", "="],
      sign,
      sign === "="
        ? "Числа одинаковые."
        : "Сравниваем по разрядам: сначала сотни, потом десятки, потом единицы.",
    );
  },
  (r: Rng) => {
    const n = r.int(110, 999);
    return input(
      `Сколько всего десятков в числе ${n}?`,
      String(Math.floor(n / 10)),
      `В каждой сотне 10 десятков. Закрываем единицы — остаётся ${Math.floor(n / 10)}: столько всего десятков.`,
    );
  },
  (r: Rng) => {
    const n = r.int(101, 999);
    return input(
      `Запиши цифрами число «${words(n)}».`,
      String(n),
      `«${words(n)}» — это ${Math.floor(n / 100)} сот. ${Math.floor(n / 10) % 10} дес. ${n % 10} ед.: ${n}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(10, 98) * 10 + 9;
    const before = r.int(0, 1) === 1;
    return before
      ? input(
          `Какое число идёт сразу после ${n}?`,
          String(n + 1),
          `После ${n} единицы заполняют десяток, и следующий десяток начинается: ${n + 1}.`,
        )
      : input(
          `Какое число стоит перед ${n + 1}?`,
          String(n),
          `Перед ${n + 1} идёт число на единицу меньше: ${n}.`,
        );
  },
  (r: Rng) => {
    const h = r.int(1, 9);
    const d = r.int(1, 9);
    const u = r.int(1, 9);
    return input(
      `Какое число равно сумме разрядных слагаемых ${h * 100} + ${d * 10} + ${u}?`,
      String(h * 100 + d * 10 + u),
      `${h * 100} — сотни, ${d * 10} — десятки, ${u} — единицы. Записываем цифры по разрядам: ${h * 100 + d * 10 + u}.`,
    );
  },
];

/* --------------------- m2.ar.addsub: столбик с переходом через разряд */

const p2addsub = [
  (r: Rng) => {
    const ta = r.int(2, 7);
    const tb = r.int(1, 8 - ta);
    const ua = r.int(5, 9);
    const ub = r.int(10 - ua, 9);
    const a = ta * 10 + ua;
    const b = tb * 10 + ub;
    return input(
      `Вычисли столбиком: ${a} + ${b}`,
      String(a + b),
      `Единицы: ${ua} + ${ub} = ${ua + ub}, пишем ${(ua + ub) % 10}, один десяток переносим. Десятки: ${ta} + ${tb} + 1 = ${ta + tb + 1}. Ответ ${a + b}.`,
    );
  },
  (r: Rng) => {
    const ta = r.int(3, 9);
    const tb = r.int(1, ta - 1);
    const ua = r.int(0, 8);
    const ub = r.int(ua + 1, 9);
    const a = ta * 10 + ua;
    const b = tb * 10 + ub;
    return input(
      `Вычисли столбиком: ${a} − ${b}`,
      String(a - b),
      `Единиц не хватает (${ua} < ${ub}), занимаем десяток: ${ua + 10} − ${ub} = ${ua + 10 - ub}. Десятки: ${ta - 1} − ${tb} = ${ta - 1 - tb}. Ответ ${a - b}.`,
    );
  },
  (r: Rng) => {
    const ha = r.int(1, 5);
    const hb = r.int(1, 8 - ha);
    const ta = r.int(0, 9);
    const tb = r.int(0, 9);
    const ua = r.int(5, 9);
    const ub = r.int(10 - ua, 9);
    const a = ha * 100 + ta * 10 + ua;
    const b = hb * 100 + tb * 10 + ub;
    return input(
      `Вычисли столбиком: ${a} + ${b}`,
      String(a + b),
      `Складываем по разрядам справа налево. Если в разряде получилось 10 и больше, единицу переносим в следующий разряд. Ответ ${a + b}.`,
    );
  },
  (r: Rng) => {
    const ha = r.int(3, 9);
    const hb = r.int(1, ha - 1);
    const ta = r.int(0, 9);
    const tb = r.int(0, 9);
    const ua = r.int(0, 8);
    const ub = r.int(ua + 1, 9);
    const a = ha * 100 + ta * 10 + ua;
    const b = hb * 100 + tb * 10 + ub;
    return input(
      `Вычисли столбиком: ${a} − ${b}`,
      String(a - b),
      `Вычитаем по разрядам справа налево. Когда в разряде не хватает, занимаем единицу у соседнего старшего разряда. Ответ ${a - b}. Проверка: ${a - b} + ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(120, 880);
    const b = r.int(15, 99);
    const shift = r.pick([0, 0, 10, 1, 100]);
    const shown = a - b + (r.int(0, 1) === 1 ? shift : -shift);
    const ok = shown === a - b;
    return pickOne(
      r,
      `${r.pick(GIRLS)} вычислила: ${a} − ${b} = ${shown}. Проверь сложением. Верно ли?`,
      ok ? "верно" : "неверно",
      ["верно", "неверно"],
      ok
        ? `Проверяем обратным действием: ${shown} + ${b} = ${a}. Сходится, значит верно.`
        : `Проверяем обратным действием: ${shown} + ${b} = ${shown + b}, а не ${a}. Правильный ответ ${a - b}.`,
    );
  },
  (r: Rng) => {
    const total = r.int(300, 999);
    const a = r.int(105, total - 100);
    return input(
      `Вставь пропущенное число: ${a} + … = ${total}`,
      String(total - a),
      `Неизвестная часть: из целого вычитаем известную часть. ${total} − ${a} = ${total - a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(150, 600);
    const b = r.int(105, 399);
    return input(
      `В библиотеке было ${a} ${plural(a, "книга", "книги", "книг")}. Привезли ещё ${b}. Сколько книг стало?`,
      String(a + b),
      `Книг стало больше, складываем столбиком: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(400, 999);
    const b = r.int(105, 299);
    const c = r.int(105, a - b - 50);
    return input(
      `Вычисли: ${a} − ${b} − ${c}`,
      String(a - b - c),
      `Слева направо: ${a} − ${b} = ${a - b}, затем ${a - b} − ${c} = ${a - b - c}.`,
    );
  },
];

/* ----------------------- m2.ar.muldiv: вся таблица, деление, остаток */

const MUL_TERMS = ["множитель", "множитель", "произведение"];
const DIV_TERMS = ["делимое", "делитель", "частное"];

const p2muldiv = [
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Сколько будет ${a} × ${b}?`,
      String(a * b),
      `${a} взяли ${times(b)}: ${a} × ${b} = ${a * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Сколько будет ${a * b} : ${a}?`,
      String(b),
      `Деление проверяем умножением: ${a} × ${b} = ${a * b}, значит ${a * b} : ${a} = ${b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Какое число нужно разделить на ${b}, чтобы получилось ${a}?`,
      String(a * b),
      `Делимое находят умножением: ${a} × ${b} = ${a * b}. Проверка: ${a * b} : ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 9);
    const q = r.int(2, 9);
    const rem = r.int(1, d - 1);
    const n = d * q + rem;
    const askRem = r.int(0, 1) === 1;
    return askRem
      ? input(
          `Раздели ${n} на ${d} с остатком. Какой получится остаток?`,
          String(rem),
          `Самое большое число до ${n}, которое делится на ${d}, — это ${d * q} (${d} × ${q}). Остаток ${n} − ${d * q} = ${rem}.`,
        )
      : input(
          `Раздели ${n} на ${d} с остатком. Сколько получится в частном?`,
          String(q),
          `${d} × ${q} = ${d * q}, это самое большое число до ${n}, которое делится на ${d}. Частное ${q}, остаток ${rem}.`,
        );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const isMul = r.int(0, 1) === 1;
    const which = r.int(0, 2);
    if (isMul) {
      const shown = [a, b, a * b][which];
      return pickOne(
        r,
        `В записи ${a} × ${b} = ${a * b} число ${shown} называется …`,
        MUL_TERMS[which],
        ["множитель", "произведение", "делимое", "частное"],
        `${a} и ${b} — множители, ${a * b} — произведение.`,
      );
    }
    const shown = [a * b, b, a][which];
    return pickOne(
      r,
      `В записи ${a * b} : ${b} = ${a} число ${shown} называется …`,
      DIV_TERMS[which],
      ["делимое", "делитель", "частное", "произведение"],
      `${a * b} — делимое, ${b} — делитель, ${a} — частное.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const k = r.int(2, 9);
    const up = r.int(0, 1) === 1;
    return up
      ? input(
          `Увеличь ${a} ${inTimes(k)}.`,
          String(a * k),
          `«В ${k} ${plural(k, "раз", "раза", "раз")} больше» — умножаем: ${a} × ${k} = ${a * k}.`,
        )
      : input(
          `Уменьши ${a * k} ${inTimes(k)}.`,
          String(a),
          `«В ${k} ${plural(k, "раз", "раза", "раз")} меньше» — делим: ${a * k} : ${k} = ${a}.`,
        );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const thing = r.pick(THINGS);
    const byBox = r.int(0, 1) === 1;
    return byBox
      ? input(
          `В ${b} коробках по ${count(a, thing)}. Сколько всего?`,
          String(a * b),
          `По ${a} взяли ${times(b)}: ${a} × ${b} = ${a * b}.`,
        )
      : input(
          `${count(a * b, thing)} разложили в пакеты по ${a}. Сколько получилось пакетов?`,
          String(b),
          `Считаем, сколько раз по ${a} в ${a * b}: ${a * b} : ${a} = ${b}.`,
        );
  },
  (r: Rng) => {
    const pairs: [string, string][] = [];
    const used = new Set<number>();
    while (pairs.length < 3) {
      const a = r.int(2, 9);
      const b = r.int(2, 9);
      if (used.has(a * b)) continue;
      used.add(a * b);
      pairs.push([`${a} × ${b}`, String(a * b)]);
    }
    return match(
      "Соедини каждый пример с его ответом.",
      pairs,
      `По таблице умножения: ${pairs.map((p) => `${p[0]} = ${p[1]}`).join(", ")}.`,
    );
  },
];

/* ----------------- m2.ar.expr: скобки, уравнения на × и :, свойства */

const ACTIONS = ["сложение", "вычитание", "умножение", "деление"];
const ORDINAL = ["первым", "вторым", "третьим"];

const p2expr = [
  (r: Rng) => {
    const a = r.int(2, 5);
    const b = r.int(2, 5);
    const c = r.int(2, 9);
    const d = r.int(1, 9);
    return input(
      `Вычисли: (${a} + ${b}) × ${c} − ${d}`,
      String((a + b) * c - d),
      `Сначала скобки: ${a} + ${b} = ${a + b}. Потом умножение: ${a + b} × ${c} = ${(a + b) * c}. Потом вычитание: ${(a + b) * c} − ${d} = ${(a + b) * c - d}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const c = r.int(2, 9);
    const d = r.int(2, 9);
    return input(
      `Вычисли: ${a} × ${b} + ${c} × ${d}`,
      String(a * b + c * d),
      `Умножение раньше сложения: ${a} × ${b} = ${a * b}, ${c} × ${d} = ${c * d}, затем ${a * b} + ${c * d} = ${a * b + c * d}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const b = r.int(3, 9);
    const q = r.int(2, 9);
    const k = r.int(2, 9);
    return input(
      `Вычисли: ${a} × ${b} − ${q * k} : ${q}`,
      String(a * b - k),
      `Умножение и деление раньше вычитания: ${a} × ${b} = ${a * b}, ${q * k} : ${q} = ${k}, затем ${a * b} − ${k} = ${a * b - k}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(2, 9);
    const a = r.int(2, 9);
    return input(
      `Реши уравнение: x × ${a} = ${x * a}`,
      String(x),
      `Неизвестный множитель находят делением произведения на известный множитель: ${x * a} : ${a} = ${x}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(2, 9);
    const q = r.int(2, 9);
    return input(
      `Реши уравнение: ${x * q} : x = ${q}`,
      String(x),
      `Неизвестный делитель находят делением делимого на частное: ${x * q} : ${q} = ${x}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const q = r.int(2, 9);
    return input(
      `Реши уравнение: x : ${a} = ${q}`,
      String(a * q),
      `Неизвестное делимое находят умножением частного на делитель: ${q} × ${a} = ${a * q}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(5, 30);
    const c = r.int(5, 30);
    const a = r.int(b + c + 5, 99);
    return input(
      `Вычисли удобным способом: ${a} − (${b} + ${c})`,
      String(a - b - c),
      `Чтобы вычесть сумму, можно вычесть слагаемые по очереди: ${a} − ${b} = ${a - b}, ${a - b} − ${c} = ${a - b - c}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const c = r.int(2, 9);
    const d = r.int(2, 9);
    const kind = r.int(0, 2);
    const text =
      kind === 0
        ? `${a} + ${b} × ${c} − ${d}`
        : kind === 1
          ? `(${a} + ${b}) × ${c} − ${d}`
          : `${a} × ${b} − ${c * d} : ${c}`;
    const order =
      kind === 0
        ? ["умножение", "сложение", "вычитание"]
        : kind === 1
          ? ["сложение", "умножение", "вычитание"]
          : ["умножение", "деление", "вычитание"];
    const step = r.int(0, 2);
    const why =
      kind === 0
        ? "Скобок нет: сначала умножение, потом сложение и вычитание по порядку слева направо."
        : kind === 1
          ? "Сначала действие в скобках, потом умножение, потом вычитание."
          : "Скобок нет: умножение и деление по порядку слева направо, вычитание последним.";
    return pickOne(
      r,
      `Какое действие в выражении ${text} выполняют ${ORDINAL[step]}?`,
      order[step],
      ACTIONS,
      `${why} ${ORDINAL[step].replace(/^(.)/, (ch) => ch.toUpperCase())} идёт ${order[step]}.`,
    );
  },
];

/* --------------------- m2.geo.val: периметр, площадь, объём в кубиках */

const MEASURES: [string, string][] = [
  ["длину отрезка", "см"],
  ["площадь фигуры", "см²"],
  ["объём фигуры", "см³"],
  ["массу предмета", "кг"],
];

const CELLS: [string, string, string] = ["клетка", "клетки", "клеток"];

const p2geoVal = [
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Прямоугольник на клетчатой бумаге: ${count(a, CELLS)} в длину и ${count(b, CELLS)} в ширину. Сколько клеток он занимает?`,
      String(a * b),
      `В каждом ряду ${count(a, CELLS)}, рядов ${b}: ${a} × ${b} = ${count(a * b, CELLS)}. Это площадь в клетках.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Стороны прямоугольника ${a} см и ${b} см. Найди его площадь. Ответ запиши в квадратных сантиметрах.`,
      String(a * b),
      `Площадь прямоугольника — произведение сторон: ${a} × ${b} = ${a * b} см².`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Стороны прямоугольника ${a} см и ${b} см. Найди его периметр. Ответ запиши в сантиметрах.`,
      String(2 * (a + b)),
      `Периметр — сумма всех сторон: (${a} + ${b}) × 2 = ${2 * (a + b)} см.`,
    );
  },
  (r: Rng) => {
    const n = r.int(1, 9);
    return input(
      `Сколько квадратных сантиметров в ${n} дм²?`,
      String(n * 100),
      `В одном квадратном дециметре 10 × 10 = 100 см². Значит ${n} дм² = ${n * 100} см².`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 4);
    const b = r.int(2, 4);
    const c = r.int(2, 4);
    return input(
      `Из кубиков сложили коробку: ${a} кубика в длину, ${b} в ширину и ${c} в высоту. Сколько всего кубиков?`,
      String(a * b * c),
      `В одном слое ${a} × ${b} = ${count(a * b, CUBES)}, слоёв ${c}: ${a * b} × ${c} = ${a * b * c}. Это объём в кубиках.`,
    );
  },
  (r: Rng) => {
    const i = r.int(0, 3);
    const [what, unit] = MEASURES[i];
    return pickOne(
      r,
      `В каких единицах измеряют ${what}?`,
      unit,
      MEASURES.map((m) => m[1]),
      `Длину — в см, площадь — в квадратных (см²), объём — в кубических (см³), массу — в кг.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Площадь прямоугольника ${a * b} см², одна сторона ${a} см. Найди другую сторону. Ответ запиши в сантиметрах.`,
      String(b),
      `Площадь = сторона × сторона, значит другая сторона = ${a * b} : ${a} = ${b} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const area = r.int(0, 1) === 1;
    return area
      ? input(
          `Сторона квадрата ${a} см. Найди его площадь. Ответ запиши в квадратных сантиметрах.`,
          String(a * a),
          `У квадрата стороны равны: ${a} × ${a} = ${a * a} см².`,
        )
      : input(
          `Сторона квадрата ${a} см. Найди его периметр. Ответ запиши в сантиметрах.`,
          String(4 * a),
          `Четыре равные стороны: ${a} × 4 = ${4 * a} см.`,
        );
  },
];

/* --------------- m2.inf: операции, программы действий, дерево вариантов */

const OPS: { name: (n: number) => string; inverse: (n: number) => string }[] = [
  { name: (n) => `прибавить ${n}`, inverse: (n) => `вычесть ${n}` },
  { name: (n) => `вычесть ${n}`, inverse: (n) => `прибавить ${n}` },
  { name: (n) => `умножить на ${n}`, inverse: (n) => `разделить на ${n}` },
  { name: (n) => `разделить на ${n}`, inverse: (n) => `умножить на ${n}` },
];

const p2inf = [
  (r: Rng) => {
    const n = r.int(2, 9);
    const op = r.pick(OPS);
    return pickOne(
      r,
      `Какая операция обратна операции «${op.name(n)}»?`,
      op.inverse(n),
      OPS.map((o) => o.name(n)),
      `Обратная операция возвращает число назад. Чтобы отменить «${op.name(n)}», нужно «${op.inverse(n)}».`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(1, 9);
    const c = r.int(2, 5);
    return input(
      `Возьми число ${a}. Программа действий: прибавь ${b}, умножь на ${c}. Какой результат?`,
      String((a + b) * c),
      `Выполняем шаги по порядку: ${a} + ${b} = ${a + b}, затем ${a + b} × ${c} = ${(a + b) * c}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(6, 15);
    const b = r.int(1, a - 2);
    const c = r.int(2, 5);
    const d = r.int(1, 9);
    return input(
      `Число ${a}. Программа: вычти ${b}, умножь на ${c}, прибавь ${d}. Что получится?`,
      String((a - b) * c + d),
      `Три шага по порядку: ${a} − ${b} = ${a - b}, ${a - b} × ${c} = ${(a - b) * c}, ${(a - b) * c} + ${d} = ${(a - b) * c + d}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(1, 9);
    const c = r.int(2, 5);
    const result = (a + b) * c;
    return input(
      `${r.pick(GIRLS)} задумала число, прибавила ${b}, умножила на ${c} и получила ${result}. Какое число задумано?`,
      String(a),
      `Идём обратной программой с конца: ${result} : ${c} = ${a + b}, ${a + b} − ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 3);
    const m = r.int(2, 3);
    const items = r.pick([
      ["футболки", "кепки", "нарядов"],
      ["шапки", "шарфа", "сочетаний"],
      ["сорта мороженого", "сиропа", "порций"],
    ]);
    return input(
      `У ${genName(r)} ${n} ${items[0]} и ${m} ${items[1]}. Сколько разных ${items[2]} можно составить, беря по одному из каждого?`,
      String(n * m),
      `Строим дерево возможностей: от каждого из ${n} вариантов первого отходят ${m} ветки второго. Всего ${n} × ${m} = ${n * m}.`,
    );
  },
  (r: Rng) => {
    const digits = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, r.int(2, 3));
    const sorted = [...digits].sort((x, y) => x - y);
    const total = digits.length === 2 ? 2 : 6;
    const askMax = r.int(0, 1) === 1;
    const max = digits.length === 2 ? sorted[1] * 10 + sorted[0] : sorted[2] * 10 + sorted[1];
    return askMax
      ? input(
          `Из цифр ${sorted.join(", ")} составляют двузначные числа без повтора цифр. Запиши самое большое из них.`,
          String(max),
          `Наибольшее число получится, если на первое место поставить самую большую цифру, на второе — следующую: ${max}.`,
        )
      : input(
          `Из цифр ${sorted.join(", ")} составляют двузначные числа без повтора цифр. Сколько таких чисел?`,
          String(total),
          `Дерево возможностей: на первое место ${digits.length} варианта, на второе — на один меньше. Всего ${digits.length} × ${digits.length - 1} = ${total}.`,
        );
  },
  (r: Rng) => {
    const k = r.pick([2, 3]);
    const start = r.int(2, 5);
    const chain = [start, start * k, start * k * k];
    return input(
      `Продолжи цепочку: ${chain.join(" → ")} → ?`,
      String(start * k * k * k),
      `Каждое звено получают из предыдущего одной и той же операцией «умножить на ${k}»: ${chain[2]} × ${k} = ${start * k * k * k}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const n = r.int(2, 9);
    const isMul = r.int(0, 1) === 1;
    const b = isMul ? a * n : a + n;
    return pickOne(
      r,
      `Какая операция превращает ${a} в ${b}?`,
      isMul ? `умножить на ${n}` : `прибавить ${n}`,
      uniq([
        `прибавить ${n}`,
        `умножить на ${n}`,
        `вычесть ${n}`,
        `прибавить ${b - a === n ? n + 1 : n}`,
      ]),
      isMul ? `${a} × ${n} = ${b}.` : `${a} + ${n} = ${b}.`,
    );
  },
];

/* ---------------- m2.task.2: составные задачи, цена и стоимость */

/** Товар и слово «один/одна» под его род: «одна тетрадь», «один ластик». */
const GOODS: { thing: [string, string, string]; one: string }[] = [
  { thing: ["тетрадь", "тетради", "тетрадей"], one: "одна" },
  { thing: ["ручка", "ручки", "ручек"], one: "одна" },
  { thing: ["блокнот", "блокнота", "блокнотов"], one: "один" },
  { thing: ["ластик", "ластика", "ластиков"], one: "один" },
];

const BADGES: [string, string, string] = ["значок", "значка", "значков"];
const ROSES: [string, string, string] = ["роза", "розы", "роз"];
const PUPILS: [string, string, string] = ["ученик", "ученика", "учеников"];
const SACKS: [string, string, string] = ["мешок", "мешка", "мешков"];

const p2task = [
  (r: Rng) => {
    const { thing, one } = r.pick(GOODS);
    const price = r.int(3, 9);
    const n = r.int(2, 9);
    return input(
      `${one === "одна" ? "Одна" : "Один"} ${thing[0]} стоит ${price} ₽. Сколько стоят ${count(n, thing)}? Ответ запиши в рублях.`,
      String(price * n),
      `Стоимость = цена × количество: ${price} × ${n} = ${price * n} ₽.`,
    );
  },
  (r: Rng) => {
    const { thing, one } = r.pick(GOODS);
    const price = r.int(3, 9);
    const n = r.int(2, 9);
    const askPrice = r.int(0, 1) === 1;
    return askPrice
      ? input(
          `За ${count(n, thing)} заплатили ${price * n} ₽. Сколько стоит ${one} ${thing[0]}? Ответ запиши в рублях.`,
          String(price),
          `Цена = стоимость : количество: ${price * n} : ${n} = ${price} ₽.`,
        )
      : input(
          `${one === "одна" ? "Одна" : "Один"} ${thing[0]} стоит ${price} ₽. На ${price * n} ₽ купили несколько таких. Сколько штук купили?`,
          String(n),
          `Количество = стоимость : цена: ${price * n} : ${price} = ${n}.`,
        );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const k = r.int(2, 5);
    const [n1, n2] = r
      .shuffle(NAMES)
      .slice(0, 2)
      .map((n) => GEN[n]);
    return input(
      `У ${n1} ${count(a, BADGES)}, а у ${n2} ${inTimes(k)} больше. Сколько значков у них вместе?`,
      String(a + a * k),
      `Сначала у ${n2}: ${a} × ${k} = ${a * k}. Потом вместе: ${a} + ${a * k} = ${a + a * k}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(110, 450);
    const b = r.int(15, 95);
    return input(
      `В одной школе ${count(a, PUPILS)}, в другой на ${b} больше. Сколько учеников в двух школах?`,
      String(2 * a + b),
      `Во второй школе ${a} + ${b} = ${a + b}. Вместе: ${a} + ${a + b} = ${2 * a + b}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(300, 900);
    const a = r.int(50, 150);
    const b = r.int(50, 120);
    const c = r.int(40, 200);
    return input(
      `На складе было ${count(n, SACKS)} муки. Увезли ${a}, потом ещё ${b}, а затем привезли ${c}. Сколько мешков стало?`,
      String(n - a - b + c),
      `Три действия: ${n} − ${a} = ${n - a}, ${n - a} − ${b} = ${n - a - b}, ${n - a - b} + ${c} = ${n - a - b + c}.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 6);
    const per = r.int(3, 9);
    const e = r.int(1, per - 1);
    const thing = r.pick(THINGS);
    return input(
      `${count(d * per, thing)} разложили поровну в ${d} ${plural(d, "пакет", "пакета", "пакетов")}. Из одного пакета взяли ${e}. Сколько осталось в этом пакете?`,
      String(per - e),
      `В каждом пакете ${d * per} : ${d} = ${per}. Осталось ${per} − ${e} = ${per - e}.`,
    );
  },
  (r: Rng) => {
    const k = r.int(2, 6);
    const per = r.int(4, 9);
    const m = r.int(2, k * per - 2);
    return input(
      `В ${k} коробках по ${per} пирожных. ${m} пирожных раздали детям. Сколько пирожных осталось?`,
      String(k * per - m),
      `Всего ${per} × ${k} = ${k * per}. Осталось ${k * per} − ${m} = ${k * per - m}.`,
    );
  },
  (r: Rng) => {
    const k = r.int(2, 5);
    const q = r.int(2, 9);
    const a = k * q;
    return input(
      `В букете ${count(a, ROSES)}, а тюльпанов ${inTimes(k)} меньше. Сколько всего цветов в букете?`,
      String(a + q),
      `Тюльпанов ${a} : ${k} = ${q}. Всего ${a} + ${q} = ${a + q}.`,
    );
  },
];

/* =============================================================== реестр */

export const PETERSON_12: Record<string, Family[]> = {
  "m1.num.11_20": p1num,
  "m1.ar.10": p1parts,
  "m1.ar.20": p1ar20,
  "m1.inf.group": p1bags,
  "m1.task.1": p1task,
  "m1.val.length": p1val,
  "m2.num.100": p2num,
  "m2.ar.addsub": p2addsub,
  "m2.ar.muldiv": p2muldiv,
  "m2.ar.expr": p2expr,
  "m2.geo.val": p2geoVal,
  "m2.inf": p2inf,
  "m2.task.2": p2task,
};
