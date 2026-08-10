/*
 * Тренировочные задания по математике, 1-4 класс.
 *
 * Ключ — код темы каталога (curriculum.data.ts). Каждая тема отдаёт ровно
 * тридцать карточек: значения считаются в коде, поэтому ответ и разбор не
 * могут разойтись с условием.
 */

import type { Rng, SeedTask } from "./practice.core";
import { NAMES, choice, input, pickOne, plural } from "./practice.core";

const WORDS = [
  "ноль",
  "один",
  "два",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
  "десять",
];

const THINGS: [string, string, string, string][] = [
  ["яблоко", "яблока", "яблок", "яблоки"],
  ["карандаш", "карандаша", "карандашей", "карандаши"],
  ["наклейка", "наклейки", "наклеек", "наклейки"],
  ["шишка", "шишки", "шишек", "шишки"],
  ["конфета", "конфеты", "конфет", "конфеты"],
  ["марка", "марки", "марок", "марки"],
];

/** «7 карандашей» — счётная форма нужна почти каждой текстовой задаче. */
function count(n: number, thing: [string, string, string, string]): string {
  return `${n} ${plural(n, thing[0], thing[1], thing[2])}`;
}

const cmpSign = (a: number, b: number) => (a > b ? ">" : a < b ? "<" : "=");

/* ------------------------------------------------------------- 1 класс */

const m1num19 = [
  (r: Rng) => {
    const n = r.int(1, 8);
    return input(
      `Какое число идёт сразу после ${n}?`,
      String(n + 1),
      `При счёте после ${n} называют ${n + 1}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Какое число идёт перед ${n}?`,
      String(n - 1),
      `Перед ${n} при счёте называют ${n - 1}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(1, 7);
    return input(
      `Какое число стоит между ${a} и ${a + 2}?`,
      String(a + 1),
      `Между ${a} и ${a + 2} только одно число — ${a + 1}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(1, 9);
    const b = r.int(1, 9);
    const sign = cmpSign(a, b);
    return choice(
      `Какой знак поставить: ${a} … ${b}?`,
      [">", "<", "="],
      sign,
      sign === "="
        ? "Числа одинаковые, значит между ними знак равенства."
        : `${a} ${sign} ${b}: клювик знака смотрит на меньшее число.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Запиши цифрой число «${WORDS[n]}».`,
      String(n),
      `Слово «${WORDS[n]}» записывают цифрой ${n}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(3, 9);
    return input(
      `Посчитай, сколько здесь звёздочек: ${"★".repeat(n)}`,
      String(n),
      `Считаем по одной, не пропуская: получилось ${n}.`,
    );
  },
];

const m1num010 = [
  (r: Rng) => {
    const n = r.int(3, 9);
    return input(
      `У ${r.pick(NAMES)} было ${n} шариков, и все они улетели. Сколько шариков осталось?`,
      "0",
      "Когда не осталось ничего, пишут цифру 0.",
    );
  },
  (r: Rng) => {
    const n = r.int(1, 9);
    return input(`Сколько будет ${n} + 0?`, String(n), "Прибавили ноль — число не изменилось.");
  },
  (r: Rng) => {
    const n = r.int(1, 9);
    return input(
      `Сколько будет ${n} − 0?`,
      String(n),
      "Ничего не убрали, значит число осталось прежним.",
    );
  },
  (r: Rng) => {
    const n = r.int(1, 9);
    return input(
      `Сколько нужно прибавить к ${n}, чтобы получился десяток?`,
      String(10 - n),
      `${n} и ${10 - n} вместе дают 10.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько единиц в числе ${n}?`,
      String(n),
      `Число ${n} состоит из ${n} единиц: считаем по одной.`,
    );
  },
  (r: Rng) => {
    const a = r.int(1, 5);
    const b = r.int(1, 4);
    const thing = r.pick(THINGS);
    return input(
      `На столе ${count(a, thing)}, на полке ещё ${b}. Сколько всего?`,
      String(a + b),
      `Считаем всё вместе: ${a} и ещё ${b} — это ${a + b}.`,
    );
  },
];

const m1num1120 = [
  (r: Rng) => {
    const n = r.int(11, 19);
    return input(
      `Сколько единиц в числе ${n}? (Десяток и сколько единиц?)`,
      String(n - 10),
      `${n} — это десяток и ещё ${n - 10} единиц.`,
    );
  },
  (r: Rng) => {
    const n = r.int(11, 19);
    return input(
      `Из чего состоит число ${n}: 10 и сколько?`,
      String(n - 10),
      `${n} = 10 + ${n - 10}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(11, 20);
    const b = r.int(11, 20);
    const sign = cmpSign(a, b);
    return choice(
      `Какой знак поставить: ${a} … ${b}?`,
      [">", "<", "="],
      sign,
      sign === "="
        ? "Числа одинаковые."
        : `Ближе к 20 стоит большее число, поэтому ${a} ${sign} ${b}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(12, 19);
    return input(
      `Назови соседей числа ${n} через запятую (сначала меньший).`,
      `${n - 1}, ${n + 1}`,
      `Перед ${n} идёт ${n - 1}, после — ${n + 1}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(11, 19);
    return pickOne(
      r,
      `Число ${n} однозначное или двузначное?`,
      "двузначное",
      ["однозначное", "трёхзначное"],
      `В записи ${n} две цифры, значит число двузначное.`,
    );
  },
  (r: Rng) => {
    const n = r.int(11, 19);
    return input(
      `Сколько десятков в числе ${n}?`,
      "1",
      `В числе ${n} один десяток и ${n - 10} единиц.`,
    );
  },
];

const m1valLength = [
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько сантиметров в ${n} дм?`,
      String(n * 10),
      `В одном дециметре 10 см, поэтому ${n} дм = ${n * 10} см.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Вырази ${n * 10} см в дециметрах.`,
      String(n),
      `${n * 10} см — это ${n} раз по 10 см, то есть ${n} дм.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const b = r.int(1, a - 1);
    return input(
      `Один отрезок ${a} см, другой ${b} см. На сколько первый длиннее?`,
      String(a - b),
      `${a} − ${b} = ${a - b} см.`,
    );
  },
  (r: Rng) => {
    const cm = r.int(4, 9);
    return pickOne(
      r,
      `Что длиннее: 1 дм или ${cm} см?`,
      "1 дм",
      [`${cm} см`, "одинаково"],
      `1 дм = 10 см, а 10 больше ${cm}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 6);
    const b = r.int(2, 4);
    return input(
      `Отрезок ${a} см продолжили ещё на ${b} см. Какой длины он стал?`,
      String(a + b),
      `${a} + ${b} = ${a + b} см.`,
    );
  },
  (r: Rng) => {
    const dm = r.int(1, 4);
    const cm = r.int(1, 9);
    return input(
      `Сколько сантиметров в ${dm} дм ${cm} см?`,
      String(dm * 10 + cm),
      `${dm} дм — это ${dm * 10} см, и ещё ${cm} см: всего ${dm * 10 + cm} см.`,
    );
  },
];

const m1ar10 = [
  (r: Rng) => {
    const a = r.int(1, 8);
    const b = r.int(1, 9 - a);
    return input(
      `Сколько будет ${a} + ${b}?`,
      String(a + b),
      `К ${a} прибавляем ${b} — получается ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 10);
    const b = r.int(1, a - 1);
    return input(
      `Сколько будет ${a} − ${b}?`,
      String(a - b),
      `Из ${a} убираем ${b}, остаётся ${a - b}. Проверка: ${a - b} + ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const sum = r.int(5, 10);
    const a = r.int(1, sum - 1);
    return input(
      `Вставь пропущенное число: ${a} + … = ${sum}`,
      String(sum - a),
      `До ${sum} от ${a} не хватает ${sum - a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(4, 9);
    const b = r.int(1, a - 2);
    return input(
      `На сколько ${a} больше, чем ${b}?`,
      String(a - b),
      `Чтобы узнать, на сколько больше, вычитаем: ${a} − ${b} = ${a - b}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "Как называется результат сложения?",
      "сумма",
      ["разность", "слагаемое", "уменьшаемое"],
      "Числа при сложении — слагаемые, а результат — сумма.",
    ),
  (r: Rng) =>
    pickOne(
      r,
      "Как называется число, из которого вычитают?",
      "уменьшаемое",
      ["вычитаемое", "разность", "сумма"],
      "Уменьшаемое − вычитаемое = разность.",
    ),
];

const m1ar20 = [
  (r: Rng) => {
    const a = r.int(6, 9);
    const b = r.int(11 - a, 9);
    return input(
      `Сколько будет ${a} + ${b}?`,
      String(a + b),
      `Дополняем ${a} до десятка: ${a} + ${10 - a} = 10, остаётся прибавить ${b - (10 - a)}. Получается ${a + b}.`,
    );
  },
  (r: Rng) => {
    const total = r.int(11, 18);
    const b = r.int(total - 9, 9);
    return input(
      `Сколько будет ${total} − ${b}?`,
      String(total - b),
      `Сначала вычитаем до десятка: ${total} − ${total - 10} = 10, потом 10 − ${b - (total - 10)} = ${total - b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(11, 19);
    const b = r.int(1, 20 - a);
    return input(
      `Сколько будет ${a} + ${b}?`,
      String(a + b),
      `Единицы складываем с единицами: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const sum = r.int(12, 18);
    const a = r.int(3, 9);
    return input(
      `Вставь пропущенное число: ${a} + … = ${sum}`,
      String(sum - a),
      `От ${a} до ${sum} не хватает ${sum - a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(11, 19);
    const b = r.int(1, 9);
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    return input(
      `На сколько ${big} больше, чем ${small}?`,
      String(big - small),
      `${big} − ${small} = ${big - small}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(11, 18);
    return input(
      `Сколько будет ${a} − 10?`,
      String(a - 10),
      `Убираем целый десяток, остаются единицы: ${a - 10}.`,
    );
  },
];

const m1task1 = [
  (r: Rng) => {
    const thing = r.pick(THINGS);
    const a = r.int(4, 12);
    const b = r.int(2, 6);
    return input(
      `У ${r.pick(NAMES)} было ${count(a, thing)}, ей подарили ещё ${b}. Сколько стало?`,
      String(a + b),
      `Стало больше, значит складываем: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const thing = r.pick(THINGS);
    const a = r.int(8, 18);
    const b = r.int(2, 7);
    return input(
      `В коробке было ${count(a, thing)}, ${b} забрали. Сколько осталось?`,
      String(a - b),
      `Забрали — значит вычитаем: ${a} − ${b} = ${a - b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(5, 12);
    const b = r.int(2, 5);
    return input(
      `На ветке сидело ${a} птиц, это на ${b} больше, чем на заборе. Сколько птиц на заборе?`,
      String(a - b),
      `«На ${b} больше» у ветки — значит на заборе на ${b} меньше: ${a} − ${b} = ${a - b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const b = r.int(2, 8);
    return input(
      `У ${r.pick(NAMES)} ${a} машинок, а у брата ${b}. Сколько машинок у них вместе?`,
      String(a + b),
      `«Вместе» — это сложение: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "Из чего состоит задача?",
      "из условия и вопроса",
      ["только из вопроса", "из условия и ответа", "из вопроса и решения"],
      "Сначала условие — что известно, потом вопрос — что нужно узнать.",
    ),
  (r: Rng) => {
    const a = r.int(6, 14);
    const b = r.int(2, 5);
    return pickOne(
      r,
      `Задача: «Было ${a} шаров, лопнуло ${b}. Сколько осталось?» Каким действием решается?`,
      "вычитанием",
      ["сложением", "сравнением", "делением"],
      `Стало меньше, значит вычитание: ${a} − ${b} = ${a - b}.`,
    );
  },
];

const ROW_ITEMS = ["заяц", "ёж", "лиса", "волк", "белка", "бобр"];

const m1geoSpace = [
  (r: Rng) => {
    const row = r.shuffle(ROW_ITEMS).slice(0, 3);
    return pickOne(
      r,
      `В ряду стоят: ${row.join(", ")}. Кто стоит между ними?`,
      row[1],
      [row[0], row[2]],
      `Между ${row[0]} и ${row[2]} стоит ${row[1]}.`,
    );
  },
  (r: Rng) => {
    const row = r.shuffle(ROW_ITEMS).slice(0, 3);
    return pickOne(
      r,
      `В ряду слева направо: ${row.join(", ")}. Кто крайний справа?`,
      row[2],
      [row[0], row[1]],
      `Справа — тот, кого назвали последним: ${row[2]}.`,
    );
  },
  (r: Rng) => {
    const row = r.shuffle(ROW_ITEMS).slice(0, 3);
    return pickOne(
      r,
      `В ряду слева направо: ${row.join(", ")}. Кто стоит слева от «${row[2]}»?`,
      row[1],
      [row[0], row[2]],
      `Сразу слева от «${row[2]}» находится «${row[1]}».`,
    );
  },
  (r: Rng) => {
    const n = r.int(4, 7);
    const k = r.int(2, n - 1);
    return input(
      `В очереди ${n} детей. ${r.pick(NAMES)} стоит ${k}-й с начала. Сколько человек стоит перед ней?`,
      String(k - 1),
      `Перед ${k}-м местом стоят ${k - 1} человек.`,
    );
  },
  (r: Rng) => {
    const n = r.int(4, 8);
    const k = r.int(2, n - 1);
    return input(
      `В ряду ${n} шариков. ${k}-й закрасили. Сколько шариков после него?`,
      String(n - k),
      `После ${k}-го осталось ${n} − ${k} = ${n - k}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "Книга лежит на столе, а мяч под столом. Что находится выше?",
      "книга",
      ["мяч", "они на одной высоте"],
      "На столе — выше, под столом — ниже.",
    ),
];

const FIGURES: [string, number][] = [
  ["треугольник", 3],
  ["квадрат", 4],
  ["прямоугольник", 4],
  ["пятиугольник", 5],
];

const m1geoFig = [
  (r: Rng) => {
    const [name, sides] = r.pick(FIGURES);
    return input(
      `Сколько сторон у фигуры «${name}»?`,
      String(sides),
      `У фигуры «${name}» ${sides} стороны.`,
    );
  },
  (r: Rng) => {
    const [name, sides] = r.pick(FIGURES);
    return input(
      `Сколько углов у фигуры «${name}»?`,
      String(sides),
      `Сколько сторон, столько и углов: ${sides}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "У какой фигуры нет углов?",
      "круг",
      ["треугольник", "квадрат", "прямоугольник"],
      "Круг ограничен линией без углов.",
    ),
  (r: Rng) =>
    pickOne(
      r,
      "Чем отрезок отличается от прямой?",
      "у отрезка есть начало и конец",
      ["отрезок всегда короче", "отрезок всегда кривой", "ничем не отличается"],
      "Прямую можно продолжать бесконечно, а у отрезка два конца.",
    ),
  (r: Rng) =>
    pickOne(
      r,
      "Чем чертят отрезок заданной длины?",
      "линейкой",
      ["циркулем", "угольником", "от руки"],
      "Длину откладывают по шкале линейки от нуля.",
    ),
  (r: Rng) => {
    const n = r.int(2, 4);
    return input(
      `${r.pick(NAMES)} нарисовала ${n} треугольника. Сколько всего сторон она начертила?`,
      String(n * 3),
      `У каждого треугольника 3 стороны: ${n} × 3 = ${n * 3}.`,
    );
  },
];

const m1infGroup = [
  (r: Rng) => {
    const step = r.pick([2, 3, 5]);
    const start = r.int(1, 4);
    const row = [start, start + step, start + 2 * step, start + 3 * step];
    return input(
      `Продолжи ряд: ${row.join(", ")}, …`,
      String(start + 4 * step),
      `Каждое следующее число больше на ${step}.`,
    );
  },
  (r: Rng) => {
    const start = r.int(15, 20);
    const step = r.pick([2, 3]);
    const row = [start, start - step, start - 2 * step];
    return input(
      `Продолжи ряд: ${row.join(", ")}, …`,
      String(start - 3 * step),
      `Каждый раз убавляем на ${step}.`,
    );
  },
  (r: Rng) => {
    const odd = r.pick(["кубик", "мяч", "кукла"]);
    return pickOne(
      r,
      `Найди лишнее: круг, квадрат, треугольник, ${odd}.`,
      odd,
      ["круг", "квадрат", "треугольник"],
      `Круг, квадрат и треугольник — фигуры, а ${odd} — игрушка.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const shown = r.int(0, 1) === 1 ? a + b : a + b + r.int(1, 2);
    const ok = shown === a + b;
    return pickOne(
      r,
      `Верно ли равенство: ${a} + ${b} = ${shown}?`,
      ok ? "верно" : "неверно",
      ["верно", "неверно"],
      `${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(3, 6);
    return input(
      `В группе ${n} красных и ${n + 1} синих фишек. Каких больше и на сколько? Введи только число.`,
      "1",
      `Синих больше на ${n + 1} − ${n} = 1.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "По какому признаку можно разложить кубики: красный, синий, красный, синий?",
      "по цвету",
      ["по размеру", "по форме", "по весу"],
      "Отличается только цвет, значит признак — цвет.",
    ),
];

const m1infTable = [
  (r: Rng) => {
    const [a, b, c] = [r.int(2, 9), r.int(2, 9), r.int(2, 9)];
    const names = r.shuffle(NAMES).slice(0, 3);
    const values = [a, b, c];
    const maxIdx = values.indexOf(Math.max(...values));
    return pickOne(
      r,
      `В таблице: ${names[0]} — ${a}, ${names[1]} — ${b}, ${names[2]} — ${c} наклеек. У кого наклеек больше всех?`,
      names[maxIdx],
      [...names],
      `Самое большое число в таблице — ${Math.max(...values)}.`,
    );
  },
  (r: Rng) => {
    const [a, b] = [r.int(3, 9), r.int(3, 9)];
    const names = r.shuffle(NAMES).slice(0, 2);
    return input(
      `В таблице: ${names[0]} — ${a} марок, ${names[1]} — ${b} марок. Сколько марок у них вместе?`,
      String(a + b),
      `Складываем данные из двух строк: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const [a, b] = [r.int(5, 12), r.int(2, 4)];
    const names = r.shuffle(NAMES).slice(0, 2);
    return input(
      `В таблице: ${names[0]} — ${a} очков, ${names[1]} — ${b} очков. На сколько очков больше у ${names[0]}?`,
      String(a - b),
      `Разница читается вычитанием: ${a} − ${b} = ${a - b}.`,
    );
  },
  (r: Rng) => {
    const days = ["понедельник", "вторник", "среда"];
    const vals = [r.int(2, 8), r.int(2, 8), r.int(2, 8)];
    const minIdx = vals.indexOf(Math.min(...vals));
    return pickOne(
      r,
      `Прочитай таблицу: ${days.map((d, i) => `${d} — ${vals[i]}`).join(", ")}. В какой день значение самое маленькое?`,
      days[minIdx],
      [...days],
      `Наименьшее число — ${Math.min(...vals)}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(3, 6);
    return input(
      `На схеме: целое — ${n + 4}, одна часть — ${n}. Чему равна вторая часть?`,
      "4",
      `Из целого вычитаем известную часть: ${n + 4} − ${n} = 4.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 6);
    const b = r.int(2, 6);
    return input(
      `На схеме два отрезка: первый ${a} см, второй на ${b} см длиннее. Какой длины второй отрезок?`,
      String(a + b),
      `«Длиннее на ${b}» — значит прибавляем: ${a} + ${b} = ${a + b}.`,
    );
  },
];

/* ------------------------------------------------------------- 2 класс */

const m2num100 = [
  (r: Rng) => {
    const n = r.int(21, 99);
    return input(
      `Сколько десятков в числе ${n}?`,
      String(Math.floor(n / 10)),
      `${n} — это ${Math.floor(n / 10)} дес. и ${n % 10} ед.`,
    );
  },
  (r: Rng) => {
    const n = r.int(21, 99);
    return input(
      `Сколько единиц в числе ${n}? (Не считая десятков.)`,
      String(n % 10),
      `В разряде единиц числа ${n} стоит цифра ${n % 10}.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 9);
    const u = r.int(1, 9);
    return input(
      `Запиши число, в котором ${d} дес. и ${u} ед.`,
      String(d * 10 + u),
      `${d} дес. — это ${d * 10}, и ещё ${u}: ${d * 10 + u}.`,
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
      sign === "=" ? "Числа равны." : "Сначала сравниваем десятки, при равных десятках — единицы.",
    );
  },
  (r: Rng) => {
    const n = r.int(20, 98);
    return input(
      `Назови число, следующее за ${n}.`,
      String(n + 1),
      `За ${n} при счёте идёт ${n + 1}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(20, 80);
    const b = r.int(1, 19);
    const truth = a > b;
    return pickOne(
      r,
      `Верно ли неравенство: ${a} > ${b}?`,
      truth ? "верно" : "неверно",
      ["верно", "неверно"],
      `${a} и ${b}: больше то число, у которого больше десятков.`,
    );
  },
];

const m2val = [
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько сантиметров в ${n} дм?`,
      String(n * 10),
      `1 дм = 10 см, значит ${n} дм = ${n * 10} см.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько миллиметров в ${n} см?`,
      String(n * 10),
      `1 см = 10 мм, поэтому ${n} см = ${n * 10} мм.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько дециметров в ${n} м?`,
      String(n * 10),
      `1 м = 10 дм, значит ${n} м = ${n * 10} дм.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько минут в ${n} ч?`,
      String(n * 60),
      `В часе 60 минут: ${n} × 60 = ${n * 60}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Мешок весит ${a} кг, ящик ${b} кг. Сколько весят вместе?`,
      String(a + b),
      `${a} + ${b} = ${a + b} кг.`,
    );
  },
  (r: Rng) => {
    const cm = r.int(11, 99);
    return input(
      `Вырази ${cm} см в дециметрах и сантиметрах: сколько получится дециметров?`,
      String(Math.floor(cm / 10)),
      `${cm} см = ${Math.floor(cm / 10)} дм ${cm % 10} см.`,
    );
  },
];

const m2arAddsub = [
  (r: Rng) => {
    const a = r.int(21, 79);
    const b = r.int(11, 99 - a);
    return input(
      `Сколько будет ${a} + ${b}?`,
      String(a + b),
      `Складываем десятки и единицы отдельно: получается ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(31, 99);
    const b = r.int(11, a - 10);
    return input(
      `Сколько будет ${a} − ${b}?`,
      String(a - b),
      `Проверка сложением: ${a - b} + ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(23, 68);
    const b = r.int(10, 30);
    return input(
      `Вычисли столбиком: ${a} + ${b}`,
      String(a + b),
      `Единицы под единицами, десятки под десятками: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(41, 95);
    const b = r.int(12, 39);
    return input(
      `Вычисли столбиком: ${a} − ${b}`,
      String(a - b),
      `Если единиц не хватает, занимаем десяток. Ответ ${a - b}.`,
    );
  },
  (r: Rng) => {
    const total = r.int(40, 90);
    const a = r.int(10, total - 10);
    return input(
      `Вставь пропущенное число: ${a} + … = ${total}`,
      String(total - a),
      `${total} − ${a} = ${total - a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(30, 90);
    const b = r.int(1, 9);
    return input(
      `Сколько будет ${a} − ${b}?`,
      String(a - b),
      `Занимаем один десяток: ${a} − ${b} = ${a - b}.`,
    );
  },
];

const m2arMuldiv = [
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, Math.min(9, Math.floor(50 / a)));
    return input(
      `Сколько будет ${a} × ${b}?`,
      String(a * b),
      `${a} повторили ${b} ${plural(b, "раз", "раза", "раз")}: ${a * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, Math.min(9, Math.floor(50 / a)));
    return input(
      `Сколько будет ${a * b} : ${a}?`,
      String(b),
      `Проверка умножением: ${a} × ${b} = ${a * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 6);
    const b = r.int(2, 6);
    return input(
      `Замени сложение умножением и вычисли: ${Array(b).fill(a).join(" + ")}`,
      String(a * b),
      `${a} взяли ${b} ${plural(b, "раз", "раза", "раз")}: ${a} × ${b} = ${a * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 8);
    const b = r.int(2, 6);
    return input(
      `В ${b} коробках по ${a} карандашей. Сколько карандашей всего?`,
      String(a * b),
      `По ${a} взяли ${b} ${plural(b, "раз", "раза", "раз")}: ${a} × ${b} = ${a * b}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(2, 6);
    const a = r.int(2, 8);
    return input(
      `${a * b} конфет разделили поровну между ${b} детьми. Сколько конфет получил каждый?`,
      String(a),
      `${a * b} : ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    return pickOne(
      r,
      `Как называются числа, которые перемножают в записи ${a} × 4?`,
      "множители",
      ["слагаемые", "делители", "разности"],
      "Множитель × множитель = произведение.",
    );
  },
];

const m2arExpr = [
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 6);
    const c = r.int(2, 6);
    return input(
      `Вычисли: ${a} + ${b} × ${c}`,
      String(a + b * c),
      `Сначала умножение: ${b} × ${c} = ${b * c}, потом ${a} + ${b * c} = ${a + b * c}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 8);
    const c = r.int(2, 5);
    return input(
      `Вычисли: (${a} + ${b}) × ${c}`,
      String((a + b) * c),
      `Скобки первые: ${a} + ${b} = ${a + b}, затем ${a + b} × ${c} = ${(a + b) * c}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(5, 40);
    const b = r.int(5, 40);
    return input(
      `Реши уравнение: x + ${b} = ${x + b}`,
      String(x),
      `Чтобы найти неизвестное слагаемое, из суммы вычитают известное: ${x + b} − ${b} = ${x}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(20, 90);
    const b = r.int(5, 19);
    return input(
      `Реши уравнение: x − ${b} = ${x - b}`,
      String(x),
      `Неизвестное уменьшаемое: к разности прибавляют вычитаемое: ${x - b} + ${b} = ${x}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(30, 90);
    const b = r.int(5, 20);
    const c = r.int(5, 20);
    return input(
      `Вычисли: ${a} − ${b} − ${c}`,
      String(a - b - c),
      `Действия по порядку слева направо: ${a} − ${b} = ${a - b}, ${a - b} − ${c} = ${a - b - c}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 6);
    const b = r.int(2, 6);
    const c = r.int(2, 9);
    return pickOne(
      r,
      `Какое действие в выражении ${a} × ${b} + ${c} выполняют первым?`,
      "умножение",
      ["сложение", "любое", "то, что записано правее"],
      "Умножение и деление выполняют раньше сложения и вычитания.",
    );
  },
];

const m2task2 = [
  (r: Rng) => {
    const a = r.int(10, 40);
    const b = r.int(5, 20);
    const c = r.int(3, 15);
    return input(
      `В вазе было ${a} конфет. Съели ${b}, потом положили ещё ${c}. Сколько конфет стало?`,
      String(a - b + c),
      `Действуем по шагам: ${a} − ${b} = ${a - b}, затем ${a - b} + ${c} = ${a - b + c}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const k = r.int(2, 5);
    return input(
      `У ${r.pick(NAMES)} ${a} марок, а у брата в ${k} раза больше. Сколько марок у брата?`,
      String(a * k),
      `«В ${k} раза больше» — умножаем: ${a} × ${k} = ${a * k}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(2, 5);
    const a = r.int(2, 9) * b;
    return input(
      `В первом ряду ${a} стульев, во втором в ${b} раза меньше. Сколько стульев во втором ряду?`,
      String(a / b),
      `«В ${b} раза меньше» — делим: ${a} : ${b} = ${a / b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(4, 9);
    const k = r.int(2, 4);
    return input(
      `В коробке ${a} синих шаров, красных в ${k} раза больше. Сколько шаров всего?`,
      String(a + a * k),
      `Красных ${a} × ${k} = ${a * k}, всего ${a} + ${a * k} = ${a + a * k}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(20, 60);
    const b = r.int(5, 15);
    return input(
      `На парковке было ${a} машин, уехало ${b}, потом ещё ${b}. Сколько машин осталось?`,
      String(a - 2 * b),
      `Уехало всего ${b} + ${b} = ${2 * b}, значит осталось ${a} − ${2 * b} = ${a - 2 * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 8);
    const b = r.int(2, 6);
    const c = r.int(2, 5);
    return input(
      `В ${b} пакетах по ${a} яблок, ещё ${c} яблока лежат отдельно. Сколько яблок всего?`,
      String(a * b + c),
      `Сначала ${a} × ${b} = ${a * b}, потом ${a * b} + ${c} = ${a * b + c}.`,
    );
  },
];

const m2geoFig = [
  (r: Rng) =>
    pickOne(
      r,
      "Сколько прямых углов у прямоугольника?",
      "4",
      ["2", "3", "1"],
      "Все четыре угла прямоугольника прямые.",
    ),
  (r: Rng) => {
    const n = r.int(2, 12);
    return input(
      `Сколько звеньев у ломаной, если у неё ${n + 1} вершина считая концы?`,
      String(n),
      `Звеньев всегда на одно меньше, чем точек: ${n + 1} − 1 = ${n}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(3, 12);
    return input(
      `Сколько сторон у ${n}-угольника?`,
      String(n),
      `Название говорит о числе углов, а сторон столько же: ${n}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(3, 12);
    return input(
      `Сколько углов у ${n}-угольника?`,
      String(n),
      `Углов у многоугольника столько же, сколько сторон: ${n}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько всего прямых углов у ${n} квадратов?`,
      String(n * 4),
      `У квадрата 4 прямых угла: ${n} × 4 = ${n * 4}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "Чем луч отличается от отрезка?",
      "у луча есть начало, но нет конца",
      ["луч всегда короче", "у луча два конца", "ничем"],
      "Луч выходит из точки и продолжается бесконечно.",
    ),
  (r: Rng) =>
    pickOne(
      r,
      "Каким инструментом удобно проверить, прямой ли угол?",
      "угольником",
      ["линейкой", "циркулем", "карандашом"],
      "У угольника есть готовый прямой угол.",
    ),
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько всего вершин у ${n} треугольников?`,
      String(n * 3),
      `У треугольника 3 вершины: ${n} × 3 = ${n * 3}.`,
    );
  },
];

const m2geoVal = [
  (r: Rng) => {
    const a = r.int(3, 15);
    const b = r.int(3, 15);
    return input(
      `Найди периметр прямоугольника со сторонами ${a} см и ${b} см.`,
      String(2 * (a + b)),
      `P = (${a} + ${b}) × 2 = ${2 * (a + b)} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 20);
    return input(
      `Найди периметр квадрата со стороной ${a} см.`,
      String(4 * a),
      `P = ${a} × 4 = ${4 * a} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const c = r.int(2, 9);
    return input(
      `Ломаная состоит из звеньев ${a} см, ${b} см и ${c} см. Какова её длина?`,
      String(a + b + c),
      `Длина ломаной — сумма звеньев: ${a} + ${b} + ${c} = ${a + b + c} см.`,
    );
  },
  (r: Rng) => {
    const p = r.int(4, 20) * 4;
    return input(
      `Периметр квадрата ${p} см. Чему равна его сторона?`,
      String(p / 4),
      `Сторона = ${p} : 4 = ${p / 4} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 12);
    const b = r.int(3, 12);
    return input(
      `Сколько сантиметров проволоки нужно на рамку ${a} см на ${b} см?`,
      String(2 * (a + b)),
      `Это периметр: (${a} + ${b}) × 2 = ${2 * (a + b)} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 10);
    const p = r.int(12, 30);
    const rest = p - 2 * a;
    return input(
      `Периметр прямоугольника ${2 * a + rest} см, две противоположные стороны по ${a} см. Чему равна сумма двух других сторон?`,
      String(rest),
      `Из периметра вычитаем известные стороны: ${2 * a + rest} − ${2 * a} = ${rest} см.`,
    );
  },
];

const m2inf = [
  (r: Rng) => {
    const step = r.pick([4, 5, 10]);
    const start = r.int(2, 9);
    return input(
      `Продолжи ряд: ${[start, start + step, start + 2 * step].join(", ")}, …`,
      String(start + 3 * step),
      `Каждое число больше предыдущего на ${step}.`,
    );
  },
  (r: Rng) => {
    const k = r.pick([2, 3]);
    const start = r.int(2, 4);
    return input(
      `Продолжи ряд: ${[start, start * k, start * k * k].join(", ")}, …`,
      String(start * k * k * k),
      `Каждое следующее число в ${k} раза больше предыдущего.`,
    );
  },
  (r: Rng) => {
    const odd = r.int(2, 9) * 2 + 1;
    const evens = [r.int(1, 9) * 2, r.int(1, 9) * 2, r.int(1, 9) * 2];
    return pickOne(
      r,
      `Найди лишнее число: ${[...evens, odd].join(", ")}.`,
      String(odd),
      evens.map(String),
      `Все числа чётные, кроме ${odd}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(3, 8);
    return pickOne(
      r,
      `В классе все ${n} учеников решили задачу. Верно ли утверждение «каждый ученик решил задачу»?`,
      "верно",
      ["верно", "неверно"],
      "«Все» и «каждый» здесь значат одно и то же.",
    );
  },
  (r: Rng) => {
    const a = r.int(3, 9);
    const b = r.int(3, 9);
    return input(
      `В таблице два столбца: «мальчики — ${a}», «девочки — ${b}». Сколько всего детей?`,
      String(a + b),
      `Складываем значения столбцов: ${a} + ${b} = ${a + b}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "По какому признаку можно разделить на группы: 2, 4, 6, 7, 9, 11?",
      "чётные и нечётные",
      ["большие и маленькие", "однозначные и двузначные", "по цвету"],
      "2, 4, 6 делятся на 2, а 7, 9, 11 — нет.",
    ),
];

/* ------------------------------------------------------------- 3 класс */

const m3num1000 = [
  (r: Rng) => {
    const n = r.int(101, 999);
    return input(
      `Сколько сотен в числе ${n}?`,
      String(Math.floor(n / 100)),
      `${n} — это ${Math.floor(n / 100)} сот. ${Math.floor((n % 100) / 10)} дес. ${n % 10} ед.`,
    );
  },
  (r: Rng) => {
    const h = r.int(1, 9);
    const t = r.int(0, 9);
    const u = r.int(1, 9);
    const n = h * 100 + t * 10 + u;
    return input(
      `Запиши число суммой разрядных слагаемых через плюс: ${n}`,
      `${h * 100} + ${t * 10} + ${u}`.replace(" + 0", ""),
      `${n} = ${h * 100} + ${t * 10} + ${u}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(100, 999);
    const b = r.int(100, 999);
    const sign = cmpSign(a, b);
    return choice(
      `Какой знак поставить: ${a} … ${b}?`,
      [">", "<", "="],
      sign,
      "Сравниваем по разрядам, начиная с сотен.",
    );
  },
  (r: Rng) => {
    const b = r.int(2, 9);
    const k = r.int(2, 9);
    return input(
      `Во сколько раз ${b * k} больше, чем ${b}?`,
      String(k),
      `Кратное сравнение — это деление: ${b * k} : ${b} = ${k}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(100, 998);
    return input(`Назови число, следующее за ${n}.`, String(n + 1), `За ${n} идёт ${n + 1}.`);
  },
  (r: Rng) => {
    const h = r.int(1, 9);
    const t = r.int(1, 9);
    const u = r.int(1, 9);
    return input(
      `Запиши число, в котором ${h} сот., ${t} дес. и ${u} ед.`,
      String(h * 100 + t * 10 + u),
      `${h * 100} + ${t * 10} + ${u} = ${h * 100 + t * 10 + u}.`,
    );
  },
];

const m3val = [
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько граммов в ${n} кг?`,
      String(n * 1000),
      `1 кг = 1000 г, значит ${n} кг = ${n * 1000} г.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько копеек в ${n} р.?`,
      String(n * 100),
      `1 рубль = 100 копеек: ${n} × 100 = ${n * 100}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько секунд в ${n} мин?`,
      String(n * 60),
      `В минуте 60 секунд: ${n} × 60 = ${n * 60}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько метров в ${n} км?`,
      String(n * 1000),
      `1 км = 1000 м, поэтому ${n} км = ${n * 1000} м.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 12);
    const b = r.int(2, 12);
    return input(
      `Найди площадь прямоугольника ${a} см на ${b} см (в кв. см).`,
      String(a * b),
      `S = ${a} × ${b} = ${a * b} кв. см.`,
    );
  },
  (r: Rng) => {
    const g = r.int(1100, 4900);
    return input(
      `Сколько полных килограммов в ${g} г?`,
      String(Math.floor(g / 1000)),
      `${g} г = ${Math.floor(g / 1000)} кг ${g % 1000} г.`,
    );
  },
];

const m3arCalc = [
  (r: Rng) => {
    const a = r.int(12, 39);
    const b = r.int(2, 4);
    return input(
      `Вычисли: ${a} × ${b}`,
      String(a * b),
      `Умножаем по частям: ${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b}, ${a % 10} × ${b} = ${(a % 10) * b}, вместе ${a * b}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(2, 6);
    const q = r.int(11, 33);
    return input(
      `Вычисли: ${q * b} : ${b}`,
      String(q),
      `Делим по частям, проверка умножением: ${q} × ${b} = ${q * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(120, 700);
    const b = r.int(80, 290);
    return input(
      `Вычисли столбиком: ${a} + ${b}`,
      String(a + b),
      `Складываем разряд за разрядом справа налево: ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(300, 950);
    const b = r.int(120, 290);
    return input(
      `Вычисли столбиком: ${a} − ${b}`,
      String(a - b),
      `Проверка: ${a - b} + ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(2, 8);
    const q = r.int(20, 120);
    return input(
      `Вычисли уголком: ${q * b} : ${b}`,
      String(q),
      `${q * b} : ${b} = ${q}, проверка: ${q} × ${b} = ${q * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(100, 400);
    const b = r.int(2, 3);
    return input(
      `Вычисли столбиком: ${a} × ${b}`,
      String(a * b),
      `Умножаем каждый разряд и переносим десятки: ${a * b}.`,
    );
  },
];

const m3arExpr = [
  (r: Rng) => {
    const a = r.int(100, 500);
    const b = r.int(10, 90);
    const c = r.int(2, 9);
    return input(
      `Вычисли: ${a} − ${b} × ${c}`,
      String(a - b * c),
      `Сначала ${b} × ${c} = ${b * c}, потом ${a} − ${b * c} = ${a - b * c}.`,
    );
  },
  (r: Rng) => {
    const c = r.int(2, 5);
    const q = r.int(8, 40);
    const a = r.int(10, c * q - 10);
    const b = c * q - a;
    return input(
      `Вычисли: (${a} + ${b}) : ${c}`,
      String(q),
      `Скобки первые: ${a} + ${b} = ${a + b}, затем ${a + b} : ${c} = ${q}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(50, 400);
    const b = r.int(20, 150);
    return input(
      `Реши уравнение: x − ${b} = ${x - b}`,
      String(x),
      `Неизвестное уменьшаемое: ${x - b} + ${b} = ${x}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(3, 12);
    const b = r.int(3, 9);
    return input(
      `Реши уравнение: x × ${b} = ${x * b}`,
      String(x),
      `Неизвестный множитель находят делением: ${x * b} : ${b} = ${x}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(200, 800);
    const b = r.int(20, 90);
    const c = r.int(20, 90);
    return input(
      `Вычисли: ${a} − (${b} + ${c})`,
      String(a - (b + c)),
      `В скобках ${b} + ${c} = ${b + c}, затем ${a} − ${b + c} = ${a - (b + c)}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const c = r.int(2, 9);
    return input(
      `Вычисли: ${a} × ${b} + ${c} × ${b}`,
      String(a * b + c * b),
      `Можно вынести общий множитель: (${a} + ${c}) × ${b} = ${(a + c) * b}.`,
    );
  },
];

const m3taskWork = [
  (r: Rng) => {
    const price = r.int(20, 90);
    const n = r.int(3, 9);
    return input(
      `Тетрадь стоит ${price} р. Сколько стоят ${n} таких тетрадей?`,
      String(price * n),
      `Стоимость = цена × количество: ${price} × ${n} = ${price * n} р.`,
    );
  },
  (r: Rng) => {
    const a = r.int(30, 90);
    const b = r.int(10, 29);
    return input(
      `В первый день собрали ${a} кг яблок, во второй на ${b} кг меньше. Сколько кг собрали за два дня?`,
      String(a + (a - b)),
      `Второй день: ${a} − ${b} = ${a - b}. Всего: ${a} + ${a - b} = ${a + (a - b)}.`,
    );
  },
  (r: Rng) => {
    const k = r.int(2, 6);
    const a = r.int(4, 12);
    return input(
      `Запиши выражением и вычисли: ${a} увеличить в ${k} раз и прибавить ${a}.`,
      String(a * k + a),
      `${a} × ${k} + ${a} = ${a * k} + ${a} = ${a * k + a}.`,
    );
  },
  (r: Rng) => {
    const total = r.int(60, 200);
    const part = r.int(20, 50);
    return input(
      `В библиотеке ${total} книг, из них ${part} детских. Сколько книг не детских?`,
      String(total - part),
      `Из целого вычитаем часть: ${total} − ${part} = ${total - part}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(3, 8);
    const q = r.int(4, 12);
    return input(
      `${q * b} тетрадей разложили в ${b} стопок поровну. Сколько тетрадей в каждой стопке?`,
      String(q),
      `Делим на равные части: ${q * b} : ${b} = ${q}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "С чего начинают работу над задачей?",
      "с разбора условия и вопроса",
      ["с записи ответа", "с проверки", "с выбора числа побольше"],
      "Сначала понимают, что известно и что нужно найти, и только потом выбирают действие.",
    ),
];

const m3taskSolve = [
  (r: Rng) => {
    const b = r.int(3, 9);
    const q = r.int(2, 9);
    const rest = r.int(1, b - 1);
    return input(
      `Вычисли остаток: ${q * b + rest} : ${b}. Введи только остаток.`,
      String(rest),
      `${q * b + rest} = ${b} × ${q} + ${rest}, остаток ${rest}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(3, 9);
    const q = r.int(2, 9);
    const rest = r.int(1, b - 1);
    return input(
      `Вычисли неполное частное: ${q * b + rest} : ${b}. Введи только частное.`,
      String(q),
      `По ${b} получилось взять ${q} раз, остаток ${rest}.`,
    );
  },
  (r: Rng) => {
    const price = r.int(15, 60);
    const n = r.int(3, 8);
    const paid = price * n + r.int(10, 90);
    return input(
      `Купили ${n} ручек по ${price} р. и отдали ${paid} р. Сколько сдачи?`,
      String(paid - price * n),
      `Стоимость ${price} × ${n} = ${price * n}, сдача ${paid} − ${price * n} = ${paid - price * n} р.`,
    );
  },
  (r: Rng) => {
    const part = r.pick([2, 3, 4, 5]);
    const value = r.int(2, 12) * part;
    return input(
      `Найди ${part === 2 ? "половину" : `1/${part}`} числа ${value}.`,
      String(value / part),
      `Чтобы найти долю, делим: ${value} : ${part} = ${value / part}.`,
    );
  },
  (r: Rng) => {
    const part = r.pick([2, 3, 4]);
    const one = r.int(3, 15);
    return input(
      `Одна ${part === 2 ? "вторая" : part === 3 ? "третья" : "четвёртая"} часть отрезка равна ${one} см. Какова длина всего отрезка?`,
      String(one * part),
      `Целое = доля × ${part}: ${one} × ${part} = ${one * part} см.`,
    );
  },
  (r: Rng) => {
    const b = r.int(4, 9);
    return pickOne(
      r,
      `Каким может быть остаток при делении на ${b}?`,
      `меньше ${b}`,
      [`больше ${b}`, `равен ${b}`, "любым"],
      `Остаток всегда меньше делителя, иначе можно было бы взять ещё одну часть по ${b}.`,
    );
  },
];

const m3geoFig = [
  (r: Rng) => {
    const n = r.int(4, 12);
    return input(
      `Сколько треугольников получится, если ${n}-угольник разрезать по диагоналям из одной вершины?`,
      String(n - 2),
      `Из одной вершины проводят ${n - 3} диагонали, они делят фигуру на ${n - 2} треугольника.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "Из каких фигур можно сложить прямоугольник без остатка?",
      "из двух одинаковых прямоугольных треугольников",
      ["из трёх кругов", "из двух кругов", "из пяти отрезков"],
      "Прямоугольник делится диагональю ровно на два равных треугольника.",
    ),
  (r: Rng) => {
    const a = r.int(2, 12);
    return input(
      `Квадрат со стороной ${a * 2} см разрезали на квадраты со стороной ${a} см. Сколько их получилось?`,
      "4",
      "По каждой стороне помещается 2 квадрата: 2 × 2 = 4.",
    );
  },
  (r: Rng) => {
    const n = r.int(2, 12);
    return input(
      `Сколько отрезков получится, если на прямой отметить ${n + 1} точку и соединить соседние?`,
      String(n),
      `Между ${n + 1} точками ${n} промежутков.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 6);
    return input(
      `Прямоугольник ${a * b} см на ${a} см разрезали на квадраты со стороной ${a} см. Сколько квадратов получилось?`,
      String(b),
      `По длинной стороне помещается ${a * b} : ${a} = ${b} квадратов.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "Как проверить, равны ли две фигуры?",
      "наложить одну на другую",
      ["сравнить цвет", "измерить только одну сторону", "посчитать вершины"],
      "Равные фигуры полностью совпадают при наложении.",
    ),
  (r: Rng) => {
    const a = r.int(3, 15);
    return input(
      `Прямоугольник ${a} см на ${a * 2} см разделили на два квадрата. Какова сторона каждого квадрата?`,
      String(a),
      `Длинную сторону делим пополам: ${a * 2} : 2 = ${a} см.`,
    );
  },
];

const m3geoVal = [
  (r: Rng) => {
    const a = r.int(3, 20);
    const b = r.int(3, 20);
    return input(
      `Найди площадь прямоугольника ${a} см на ${b} см (в кв. см).`,
      String(a * b),
      `S = ${a} × ${b} = ${a * b} кв. см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 15);
    return input(
      `Найди площадь квадрата со стороной ${a} см (в кв. см).`,
      String(a * a),
      `S = ${a} × ${a} = ${a * a} кв. см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const c = r.int(2, 9);
    const d = r.int(2, 9);
    return input(
      `Найди периметр четырёхугольника со сторонами ${a}, ${b}, ${c} и ${d} см.`,
      String(a + b + c + d),
      `Периметр — сумма всех сторон: ${a + b + c + d} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 12);
    const s = a * r.int(2, 12);
    return input(
      `Площадь прямоугольника ${s} кв. см, одна сторона ${a} см. Чему равна вторая сторона?`,
      String(s / a),
      `Вторая сторона = ${s} : ${a} = ${s / a} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 12);
    const b = r.int(3, 12);
    return input(
      `Сколько плиток 1 кв. дм нужно на пол ${a} дм на ${b} дм?`,
      String(a * b),
      `Это площадь: ${a} × ${b} = ${a * b} плиток.`,
    );
  },
  (r: Rng) => {
    const a = r.int(4, 15);
    const b = r.int(4, 15);
    return input(
      `У прямоугольника ${a} см и ${b} см. Найди периметр.`,
      String(2 * (a + b)),
      `P = (${a} + ${b}) × 2 = ${2 * (a + b)} см.`,
    );
  },
];

const m3inf = [
  (r: Rng) => {
    const a = r.int(3, 12);
    const b = r.int(3, 12);
    const c = r.int(3, 12);
    const maxV = Math.max(a, b, c);
    const labels = ["Аня", "Боря", "Витя"];
    const idx = [a, b, c].indexOf(maxV);
    return pickOne(
      r,
      `На столбчатой диаграмме: Аня — ${a}, Боря — ${b}, Витя — ${c}. У кого самый высокий столбик?`,
      labels[idx],
      labels,
      `Самый высокий столбик у наибольшего значения — ${maxV}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(5, 20);
    const b = r.int(5, 20);
    return input(
      `На диаграмме два столбика: ${a} и ${b}. На сколько один больше другого?`,
      String(Math.abs(a - b)),
      `Разница столбиков: ${Math.max(a, b)} − ${Math.min(a, b)} = ${Math.abs(a - b)}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(10, 40);
    return pickOne(
      r,
      `Если число делится на 10, то оно делится и на 5. Число ${n * 10} делится на 10. Делится ли оно на 5?`,
      "да",
      ["да", "нет", "нельзя узнать"],
      "Правило «если... то» применяем к нашему числу: раз делится на 10, значит делится и на 5.",
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "По двум признакам сразу — цвет и форма — как разложить: красный круг, красный квадрат, синий круг, синий квадрат?",
      "на четыре группы",
      ["на две группы", "на три группы", "нельзя разложить"],
      "Каждое сочетание цвета и формы даёт свою группу: 2 × 2 = 4.",
    ),
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `В таблице умножения на пересечении строки ${a} и столбца ${b} стоит число. Какое?`,
      String(a * b),
      `${a} × ${b} = ${a * b}.`,
    );
  },
  (r: Rng) => {
    const vals = [r.int(4, 9), r.int(4, 9), r.int(4, 9)];
    return input(
      `На диаграмме три столбика: ${vals.join(", ")}. Чему равна их сумма?`,
      String(vals[0] + vals[1] + vals[2]),
      `Складываем значения: ${vals.join(" + ")} = ${vals[0] + vals[1] + vals[2]}.`,
    );
  },
];

/* ------------------------------------------------------------- 4 класс */

const m4numMln = [
  (r: Rng) => {
    const n = r.int(100000, 999999);
    return input(
      `Сколько всего тысяч в числе ${n}?`,
      String(Math.floor(n / 1000)),
      `Класс тысяч числа ${n} — это ${Math.floor(n / 1000)}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(10000, 999999);
    return input(
      `Какая цифра стоит в разряде десятков числа ${n}?`,
      String(Math.floor(n / 10) % 10),
      `Разряды считают справа: единицы, десятки. В числе ${n} это ${Math.floor(n / 10) % 10}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(10000, 999999);
    const b = r.int(10000, 999999);
    const sign = cmpSign(a, b);
    return choice(
      `Какой знак поставить: ${a} … ${b}?`,
      [">", "<", "="],
      sign,
      "Сначала сравниваем количество цифр, затем разряды слева направо.",
    );
  },
  (r: Rng) => {
    const th = r.int(2, 99);
    const rest = r.int(1, 999);
    return input(
      `Запиши число: ${th} тыс. ${rest}.`,
      String(th * 1000 + rest),
      `${th} × 1000 + ${rest} = ${th * 1000 + rest}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(1000, 99999);
    return input(
      `Увеличь число ${n} в 10 раз.`,
      String(n * 10),
      `При умножении на 10 приписываем ноль: ${n * 10}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(1000, 99999);
    return input(
      `Уменьши число ${n * 100} в 100 раз.`,
      String(n),
      `Убираем два нуля: ${n * 100} : 100 = ${n}.`,
    );
  },
];

const m4val = [
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько килограммов в ${n} ц?`,
      String(n * 100),
      `1 центнер = 100 кг: ${n} × 100 = ${n * 100}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько килограммов в ${n} т?`,
      String(n * 1000),
      `1 тонна = 1000 кг: ${n} × 1000 = ${n * 1000}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(2, 9);
    return input(
      `Сколько лет в ${n} веках?`,
      String(n * 100),
      `1 век = 100 лет: ${n} × 100 = ${n * 100}.`,
    );
  },
  (r: Rng) => {
    const v = r.int(4, 12);
    const t = r.int(2, 6);
    return input(
      `Скорость ${v} км/ч, время ${t} ч. Найди расстояние (км).`,
      String(v * t),
      `s = v × t = ${v} × ${t} = ${v * t} км.`,
    );
  },
  (r: Rng) => {
    const part = r.pick([2, 4, 5]);
    const value = r.int(4, 30) * part;
    return input(
      `Найди 1/${part} от ${value}.`,
      String(value / part),
      `Долю находят делением: ${value} : ${part} = ${value / part}.`,
    );
  },
  (r: Rng) => {
    const part = r.pick([3, 4, 5]);
    const one = r.int(4, 25);
    return input(
      `1/${part} величины равна ${one}. Чему равна вся величина?`,
      String(one * part),
      `Целое = ${one} × ${part} = ${one * part}.`,
    );
  },
];

const m4arCalc = [
  (r: Rng) => {
    const a = r.int(1200, 8900);
    const b = r.int(900, 4500);
    return input(
      `Вычисли столбиком: ${a} + ${b}`,
      String(a + b),
      `Складываем поразрядно справа налево: ${a + b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(4000, 9500);
    const b = r.int(1200, 3800);
    return input(
      `Вычисли столбиком: ${a} − ${b}`,
      String(a - b),
      `Проверка: ${a - b} + ${b} = ${a}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(120, 890);
    const b = r.int(11, 39);
    return input(
      `Вычисли: ${a} × ${b}`,
      String(a * b),
      `Умножаем на десятки и единицы: ${a} × ${Math.floor(b / 10) * 10} + ${a} × ${b % 10} = ${a * b}.`,
    );
  },
  (r: Rng) => {
    const b = r.int(12, 45);
    const q = r.int(12, 90);
    return input(
      `Вычисли: ${q * b} : ${b}`,
      String(q),
      `Проверка умножением: ${q} × ${b} = ${q * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(200, 900);
    const b = r.int(3, 9);
    return input(`Вычисли: ${a} × ${b}`, String(a * b), `${a} × ${b} = ${a * b}.`);
  },
  (r: Rng) => {
    const b = r.int(3, 9);
    const q = r.int(100, 800);
    return input(`Вычисли уголком: ${q * b} : ${b}`, String(q), `${q * b} : ${b} = ${q}.`);
  },
];

const m4arExpr = [
  (r: Rng) => {
    const a = r.int(100, 900);
    const b = r.int(10, 90);
    const c = r.int(2, 9);
    const d = r.int(10, 90);
    return input(
      `Вычисли: ${a} + ${b} × ${c} − ${d}`,
      String(a + b * c - d),
      `Сначала ${b} × ${c} = ${b * c}, потом ${a} + ${b * c} = ${a + b * c}, затем −${d} = ${a + b * c - d}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(100, 500);
    const b = r.int(50, 200);
    const c = r.int(2, 9);
    return input(
      `Вычисли: (${a} − ${b}) × ${c}`,
      String((a - b) * c),
      `В скобках ${a} − ${b} = ${a - b}, затем × ${c} = ${(a - b) * c}.`,
    );
  },
  (r: Rng) => {
    const q = r.int(20, 300);
    const b = r.int(3, 9);
    return input(
      `Реши уравнение: x : ${b} = ${q}`,
      String(q * b),
      `Неизвестное делимое находят умножением: ${q} × ${b} = ${q * b}.`,
    );
  },
  (r: Rng) => {
    const x = r.int(100, 900);
    const b = r.int(50, 400);
    return input(`Реши уравнение: x + ${b} = ${x + b}`, String(x), `${x + b} − ${b} = ${x}.`);
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    const c = r.int(2, 9);
    return input(
      `Вычисли: ${a} × ${b} × ${c}`,
      String(a * b * c),
      `${a} × ${b} = ${a * b}, затем ${a * b} × ${c} = ${a * b * c}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(400, 900);
    const b = r.int(2, 9);
    const c = r.int(10, 90);
    return input(
      `Вычисли: ${a * b} : ${b} + ${c}`,
      String(a + c),
      `Сначала деление: ${a * b} : ${b} = ${a}, потом ${a} + ${c} = ${a + c}.`,
    );
  },
];

const m4task = [
  (r: Rng) => {
    const v = r.int(40, 90);
    const t = r.int(2, 6);
    return input(
      `Поезд идёт со скоростью ${v} км/ч. Какой путь он пройдёт за ${t} ч?`,
      String(v * t),
      `s = v × t = ${v} × ${t} = ${v * t} км.`,
    );
  },
  (r: Rng) => {
    const v = r.int(10, 60);
    const t = r.int(2, 8);
    return input(
      `Велосипедист проехал ${v * t} км за ${t} ч. Какова его скорость (км/ч)?`,
      String(v),
      `v = s : t = ${v * t} : ${t} = ${v}.`,
    );
  },
  (r: Rng) => {
    const v = r.int(20, 80);
    const t = r.int(2, 7);
    return input(
      `Расстояние ${v * t} км, скорость ${v} км/ч. За сколько часов пройдут этот путь?`,
      String(t),
      `t = s : v = ${v * t} : ${v} = ${t} ч.`,
    );
  },
  (r: Rng) => {
    const perHour = r.int(6, 30);
    const hours = r.int(3, 8);
    return input(
      `Рабочий делает ${perHour} деталей в час. Сколько деталей он сделает за ${hours} ч?`,
      String(perHour * hours),
      `Производительность × время: ${perHour} × ${hours} = ${perHour * hours}.`,
    );
  },
  (r: Rng) => {
    const price = r.int(30, 250);
    const n = r.int(3, 12);
    return input(
      `Цена товара ${price} р., купили ${n} шт. Какова стоимость покупки?`,
      String(price * n),
      `${price} × ${n} = ${price * n} р.`,
    );
  },
  (r: Rng) => {
    const part = r.pick([3, 4, 5]);
    const whole = r.int(6, 40) * part;
    return input(
      `В саду ${whole} деревьев, 1/${part} из них — яблони. Сколько яблонь?`,
      String(whole / part),
      `${whole} : ${part} = ${whole / part}.`,
    );
  },
];

const m4geoFig = [
  (r: Rng) =>
    pickOne(
      r,
      "Сколько осей симметрии у квадрата?",
      "4",
      ["2", "1", "0"],
      "Две оси через середины сторон и две по диагоналям.",
    ),
  (r: Rng) =>
    pickOne(
      r,
      "Сколько осей симметрии у прямоугольника, который не является квадратом?",
      "2",
      ["4", "1", "0"],
      "Только две оси — через середины противоположных сторон.",
    ),
  (r: Rng) => {
    const d = r.int(2, 20);
    return input(
      `Радиус окружности ${d} см. Чему равен её диаметр?`,
      String(d * 2),
      `Диаметр вдвое больше радиуса: ${d} × 2 = ${d * 2} см.`,
    );
  },
  (r: Rng) => {
    const d = r.int(2, 20) * 2;
    return input(
      `Диаметр окружности ${d} см. Чему равен радиус?`,
      String(d / 2),
      `Радиус — половина диаметра: ${d} : 2 = ${d / 2} см.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "У какого тела все грани — квадраты?",
      "куб",
      ["цилиндр", "конус", "пирамида"],
      "У куба шесть одинаковых квадратных граней.",
    ),
  (r: Rng) =>
    pickOne(
      r,
      "У какого тела есть одна вершина и круглое основание?",
      "конус",
      ["куб", "шар", "цилиндр"],
      "Конус похож на колпачок: круг в основании и вершина.",
    ),
];

const m4geoVal = [
  (r: Rng) => {
    const a = r.int(3, 12);
    const b = r.int(3, 12);
    const c = r.int(2, 8);
    return input(
      `Фигуру сложили из двух прямоугольников: ${a} на ${b} см и ${c} на ${b} см. Найди её площадь (кв. см).`,
      String(a * b + c * b),
      `Складываем площади частей: ${a * b} + ${c * b} = ${a * b + c * b}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(6, 20);
    const b = r.int(6, 20);
    const cut = r.int(2, 5);
    return input(
      `Из прямоугольника ${a} на ${b} см вырезали квадрат со стороной ${cut} см. Какова площадь оставшейся фигуры (кв. см)?`,
      String(a * b - cut * cut),
      `${a * b} − ${cut * cut} = ${a * b - cut * cut}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(3, 15);
    const b = r.int(3, 15);
    return input(
      `Найди периметр прямоугольника ${a} на ${b} см.`,
      String(2 * (a + b)),
      `P = (${a} + ${b}) × 2 = ${2 * (a + b)} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    return input(
      `Площадь квадрата ${a * a} кв. см. Чему равна его сторона?`,
      String(a),
      `${a} × ${a} = ${a * a}, значит сторона ${a} см.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 9);
    const b = r.int(2, 9);
    return input(
      `Сколько квадратных дециметров в прямоугольнике ${a} дм на ${b} дм?`,
      String(a * b),
      `S = ${a} × ${b} = ${a * b} кв. дм.`,
    );
  },
  (r: Rng) => {
    const a = r.int(10, 40);
    const b = r.int(10, 40);
    return input(
      `Участок ${a} м на ${b} м обносят забором. Сколько метров забора нужно?`,
      String(2 * (a + b)),
      `Это периметр: (${a} + ${b}) × 2 = ${2 * (a + b)} м.`,
    );
  },
];

const m4inf = [
  (r: Rng) => {
    const n = r.int(2, 9) * 2;
    return pickOne(
      r,
      `Утверждение: «все чётные числа делятся на 4». Проверь на числе ${n % 4 === 0 ? n + 2 : n}.`,
      "утверждение неверно",
      ["утверждение верно", "нельзя проверить"],
      `${n % 4 === 0 ? n + 2 : n} — чётное, но на 4 не делится: это контрпример.`,
    );
  },
  (r: Rng) => {
    const a = r.int(10, 60);
    const b = r.int(10, 60);
    const c = r.int(10, 60);
    return input(
      `На диаграмме три столбика: ${a}, ${b}, ${c}. Найди самое большое значение.`,
      String(Math.max(a, b, c)),
      `Наибольшее из ${a}, ${b} и ${c} — ${Math.max(a, b, c)}.`,
    );
  },
  (r: Rng) => {
    const start = r.int(2, 9);
    const step = r.int(3, 9);
    return input(
      `Алгоритм: взять ${start}, прибавить ${step}, результат умножить на 2. Что получится?`,
      String((start + step) * 2),
      `${start} + ${step} = ${start + step}, затем × 2 = ${(start + step) * 2}.`,
    );
  },
  (r: Rng) => {
    const n = r.int(3, 9);
    return pickOne(
      r,
      `Верно ли: «если число делится на ${n * 2}, то оно делится на ${n}»?`,
      "верно",
      ["верно", "неверно"],
      `${n * 2} само делится на ${n}, поэтому любое кратное ${n * 2} кратно и ${n}.`,
    );
  },
  (r: Rng) => {
    const a = r.int(2, 5);
    const b = r.int(2, 5);
    return input(
      `Сколько разных пар можно составить из ${a} шапок и ${b} шарфов?`,
      String(a * b),
      `Каждую шапку сочетаем с каждым шарфом: ${a} × ${b} = ${a * b}.`,
    );
  },
  (r: Rng) =>
    pickOne(
      r,
      "Что такое контрпример?",
      "пример, который опровергает утверждение",
      [
        "пример, который подтверждает утверждение",
        "самый сложный пример",
        "пример с ошибкой в счёте",
      ],
      "Достаточно одного случая, где утверждение не выполняется, чтобы признать его неверным.",
    ),
];

/* ------------------------------------------------------------- регистр */

/** Семьи генераторов по коду темы каталога. Сборку делает practice.ts. */
export const MATH_FAMILIES: Record<string, ((r: Rng) => SeedTask)[]> = {
  "m1.num.1_9": m1num19,
  "m1.num.0_10": m1num010,
  "m1.num.11_20": m1num1120,
  "m1.val.length": m1valLength,
  "m1.ar.10": m1ar10,
  "m1.ar.20": m1ar20,
  "m1.task.1": m1task1,
  "m1.geo.space": m1geoSpace,
  "m1.geo.fig": m1geoFig,
  "m1.inf.group": m1infGroup,
  "m1.inf.table": m1infTable,
  "m2.num.100": m2num100,
  "m2.val": m2val,
  "m2.ar.addsub": m2arAddsub,
  "m2.ar.muldiv": m2arMuldiv,
  "m2.ar.expr": m2arExpr,
  "m2.task.2": m2task2,
  "m2.geo.fig": m2geoFig,
  "m2.geo.val": m2geoVal,
  "m2.inf": m2inf,
  "m3.num.1000": m3num1000,
  "m3.val": m3val,
  "m3.ar.calc": m3arCalc,
  "m3.ar.expr": m3arExpr,
  "m3.task.work": m3taskWork,
  "m3.task.solve": m3taskSolve,
  "m3.geo.fig": m3geoFig,
  "m3.geo.val": m3geoVal,
  "m3.inf": m3inf,
  "m4.num.mln": m4numMln,
  "m4.val": m4val,
  "m4.ar.calc": m4arCalc,
  "m4.ar.expr": m4arExpr,
  "m4.task": m4task,
  "m4.geo.fig": m4geoFig,
  "m4.geo.val": m4geoVal,
  "m4.inf": m4inf,
};
