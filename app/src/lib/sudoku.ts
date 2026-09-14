/*
 * Судоку: раскладка и решение.
 *
 * Лежит отдельно от тренажёра по той же причине, по которой отдельно лежит
 * разбор настроек (lib/drill-search.ts): экран — это разметка и состояние,
 * а здесь перебор с возвратом, который к разметке отношения не имеет и
 * читается сам по себе.
 *
 * Судоку 9×9 первокласснику не по зубам, и дело не в сложности логики, а в
 * размере поля: пятьдесят пустых клеток — это полчаса, а тренажёр открывают
 * на пять минут. Поэтому размеров три, и маленькие здесь не «облегчённый
 * вариант», а основной: 4×4 с квадратами 2×2 проходится за минуту и учит
 * ровно тому же правилу, что и большое, — цифра не повторяется ни в строке,
 * ни в столбце, ни в квадрате.
 */

/** Сторона поля. Между 4 и 9 стоит 6 — прямоугольные квадраты 3×2. */
export type SudokuSize = 4 | 6 | 9;

/** Сколько клеток открыто с самого начала. */
export type SudokuLevel = "easy" | "normal" | "hard";

/*
 * Квадраты не всегда квадратные: у поля 6×6 они 3 клетки в ширину и 2 в
 * высоту, иначе шесть на шесть не разбивается вовсе. Поэтому ширина и
 * высота хранятся порознь, а не одним числом.
 */
const BOXES: Record<SudokuSize, { w: number; h: number }> = {
  4: { w: 2, h: 2 },
  6: { w: 3, h: 2 },
  9: { w: 3, h: 3 },
};

/*
 * Доля открытых клеток. Не число, а доля: одна и та же «двадцатка
 * подсказок» на поле 4×4 не оставляет ребёнку ничего, а на 9×9 делает
 * задачу неподъёмной.
 *
 * Нижняя граница не жёсткая: клетку убирают, только пока решение остаётся
 * единственным, и на трудном уровне поле обычно останавливается чуть выше
 * заказанного. Это лучше, чем выдать судоку с двумя ответами: ребёнок
 * впишет верную по логике цифру, а тренажёр назовёт её ошибкой.
 */
const CLUES: Record<SudokuLevel, number> = { easy: 0.58, normal: 0.46, hard: 0.36 };

export type SudokuPuzzle = {
  size: number;
  /** Ширина и высота квадрата: по ним рисуются толстые линии на поле. */
  boxW: number;
  boxH: number;
  /** Решение целиком — по нему тренажёр проверяет каждую цифру. */
  solution: number[];
  /** Что открыто с самого начала: цифра или 0 на месте пустой клетки. */
  given: number[];
};

/** Перемешивание Фишера — Йетса, как в таблице Шульте. */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Встаёт ли цифра в клетку: ни в строке, ни в столбце, ни в квадрате. */
function fits(
  cells: number[],
  size: number,
  box: { w: number; h: number },
  index: number,
  value: number,
): boolean {
  const row = Math.floor(index / size);
  const col = index % size;
  for (let i = 0; i < size; i += 1) {
    if (cells[row * size + i] === value) return false;
    if (cells[i * size + col] === value) return false;
  }
  const top = Math.floor(row / box.h) * box.h;
  const left = Math.floor(col / box.w) * box.w;
  for (let r = top; r < top + box.h; r += 1) {
    for (let c = left; c < left + box.w; c += 1) {
      if (cells[r * size + c] === value) return false;
    }
  }
  return true;
}

/*
 * Пустая клетка, в которую меньше всего кандидатов, — и они же.
 *
 * Перебор идёт от неё, а не по порядку слева направо: это то самое
 * правило, которым решают судоку люди («где остался один вариант, туда и
 * пиши»), и оно же превращает перебор из секунд в миллисекунды. Считать
 * это важно: единственность решения проверяется после снятия каждой
 * клетки, то есть до восьмидесяти раз за раскладку, и наивный перебор на
 * поле 9×9 успевал подвесить телефон.
 */
function scarcest(
  cells: number[],
  size: number,
  box: { w: number; h: number },
): { index: number; values: number[] } | null {
  let best: { index: number; values: number[] } | null = null;
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index] !== 0) continue;
    const values: number[] = [];
    for (let value = 1; value <= size; value += 1) {
      if (fits(cells, size, box, index, value)) values.push(value);
    }
    // Клетка без единого кандидата — тупик: дальше искать нечего.
    if (values.length <= 1) return { index, values };
    if (!best || values.length < best.values.length) best = { index, values };
  }
  return best;
}

/** Заполнить поле целиком. Порядок цифр случайный — отсюда разные задачи. */
function fill(cells: number[], size: number, box: { w: number; h: number }): boolean {
  const spot = scarcest(cells, size, box);
  if (!spot) return true;
  for (const value of shuffle(spot.values.slice())) {
    cells[spot.index] = value;
    if (fill(cells, size, box)) return true;
    cells[spot.index] = 0;
  }
  return false;
}

/*
 * Сколько у поля решений, но не больше `cap`.
 *
 * Считать все незачем: вопрос всегда один — единственное решение или нет,
 * а перебор ради точного числа на пустом поле не кончится никогда.
 */
function solutions(
  cells: number[],
  size: number,
  box: { w: number; h: number },
  cap: number,
): number {
  const spot = scarcest(cells, size, box);
  if (!spot) return 1;
  let found = 0;
  for (const value of spot.values) {
    cells[spot.index] = value;
    found += solutions(cells, size, box, cap - found);
    cells[spot.index] = 0;
    if (found >= cap) break;
  }
  return found;
}

/**
 * Готовая задача: решение и то, что от него показано ребёнку.
 *
 * Клетки снимаются по одной в случайном порядке, и каждая — только если
 * решение осталось единственным. Возвращённая обратно клетка перебор не
 * останавливает: следующая может сняться, и поле выходит заметно
 * свободнее, чем если бросать на первой неудаче.
 */
export function makeSudoku(size: SudokuSize, level: SudokuLevel): SudokuPuzzle {
  const box = BOXES[size];
  const total = size * size;

  const solution = new Array<number>(total).fill(0);
  fill(solution, size, box);

  const given = solution.slice();
  const target = Math.round(total * CLUES[level]);
  let open = total;
  for (const index of shuffle(Array.from({ length: total }, (_, i) => i))) {
    if (open <= target) break;
    const kept = given[index];
    given[index] = 0;
    if (solutions(given.slice(), size, box, 2) === 1) open -= 1;
    else given[index] = kept;
  }

  return { size, boxW: box.w, boxH: box.h, solution, given };
}

/** Сколько клеток придётся заполнить: столько же и верных ответов в заходе. */
export function blanksOf(puzzle: SudokuPuzzle): number {
  return puzzle.given.filter((value) => value === 0).length;
}
