import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ArcadeBest,
  ArcadeCombo,
  ArcadeReward,
  ArcadeStage,
  useArcade,
} from "../components/arcade";
import { ChildAction, Owl, SiteFooter } from "../components/brand";
import {
  ResultBridge,
  SAVE_LOCKED,
  SAVE_NO_ACCOUNT,
  SAVE_PROBE,
  TrainerTop,
  TuneLock,
} from "../components/trainers";
import { me, saveSudokuDrill } from "../lib/api/app.functions";
import { drillSearch, drillWho, pickNumber, pickOne } from "../lib/drill-search";
import { pageHead } from "../lib/seo";
import { blanksOf, makeSudoku, type SudokuLevel, type SudokuPuzzle } from "../lib/sudoku";

export const Route = createFileRoute("/sudoku")({
  validateSearch: (search: Record<string, unknown>) =>
    drillSearch(search, ["size", "clues"] as const),
  head: () => pageHead("/sudoku"),
  component: SudokuPage,
});

const SIZES = [4, 6, 9] as const;
const CLUES = ["easy", "normal", "hard"] as const;

/** Подписи те же, что в форме выдачи (lib/drills.ts): называть одно и то же
 *  в кабинете «мало подсказок», а на экране ребёнка «сложно» — значит
 *  завести два словаря, которые разъедутся. */
const CLUE_WORDS: Record<SudokuLevel, string> = {
  easy: "много",
  normal: "поменьше",
  hard: "мало",
};

/**
 * Судоку: цифры без повторов в строке, столбце и квадрате.
 *
 * Проверка идёт на каждой цифре, а не в конце. В настольном судоку ошибку
 * находят сами — через десять ходов, когда где-то перестало сходиться, — и
 * это как раз то, чего первоклассник сделать не может: он не найдёт, откуда
 * пошло расхождение, и бросит поле, в которое вложил двадцать минут.
 * Поэтому неверная цифра не встаёт вовсе: клетка краснеет, промах
 * считается, серия рвётся. Поле от этого всегда остаётся решаемым, а
 * подумать всё равно приходится — за тык наугад платят промахом.
 *
 * Отсюда же и верных ровно столько, сколько было пустых клеток: ошибиться
 * «навсегда» здесь нельзя, и разговор идёт о времени и промахах, как в
 * Шульте.
 */
function SudokuPage() {
  // Размер и подсказки задаёт педагог — см. lib/drill-search.ts.
  const given = Route.useSearch();
  // Заход взрослого «на пробу» из кабинета: не пишется никому.
  const probe = given.proba === "1";
  const [size, setSize] = useState<(typeof SIZES)[number]>(() => pickNumber(given.size, SIZES, 4));
  const [clues, setClues] = useState<SudokuLevel>(() => pickOne(given.clues, CLUES, "easy"));

  const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null);
  /* Что стоит на поле прямо сейчас: открытые цифры и уже вписанные.
     Неверные сюда не попадают — см. put(). */
  const [cells, setCells] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [childId, setChildId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [coins, setCoins] = useState(0);
  const [record, setRecord] = useState(false);
  /* Размер поля, количество подсказок и сохранение результата — платные,
     см. components/trainers.tsx. */
  const [paid, setPaid] = useState(false);
  const [locked, setLocked] = useState(false);
  const startedAt = useRef(0);
  /* Клетки поля: из них вылетают искры на верной цифре. Нажимают при этом
     кнопку в ряду цифр, а не саму клетку, поэтому e.currentTarget здесь не
     годится — нужен элемент той клетки, в которую цифра встала. */
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /* То же поле, что в cells, но для обработчика клавиш: без него стрелки
     пришлось бы переподписывать после каждой цифры. */
  const cellsRef = useRef<number[]>([]);
  /* Серия, ночь и звук — общий слой тренажёров, см. components/arcade.tsx.
     Здесь серия считается по цифрам, вставшим подряд без промаха. */
  const arcade = useArcade();

  useEffect(() => {
    me()
      .then((a) => {
        setSignedIn(!!a.user);
        const who = drillWho(a, probe);
        setChildId(who.childId);
        setPaid(who.paid);
        // Настройка из адреса без подписки не действует — см. schet.tsx.
        if (!who.paid) {
          setSize(4);
          setClues("easy");
        }
      })
      .catch(() => setChildId(null));
  }, [probe]);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  const blanks = useMemo(() => (puzzle ? blanksOf(puzzle) : 0), [puzzle]);
  const left = useMemo(() => cells.filter((value) => value === 0).length, [cells]);
  const done = puzzle !== null && left === 0;

  useEffect(() => {
    if (!puzzle || done) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [puzzle, done]);

  useEffect(() => {
    if (!done || saved !== null) return;
    const seconds = Math.max(1, Math.floor((Date.now() - startedAt.current) / 1000));
    saveSudokuDrill({
      data: { childId, size, clues, blanks, seconds, mistakes, streak: arcade.best },
    })
      .then((r) => {
        setSaved(r.saved);
        setCoins(r.coins);
        setRecord(r.record);
        setLocked(r.locked);
      })
      .catch(() => setSaved(false));
  }, [done, saved, childId, size, clues, blanks, mistakes, arcade.best]);

  /* Салют на экране итога — по появлению итога, а не из put(): там он
     совпал бы с искрами последней цифры. */
  useEffect(() => {
    if (done) arcade.finale();
  }, [done, arcade.finale]);

  function start() {
    const next = makeSudoku(size, clues);
    setPuzzle(next);
    setCells(next.given.slice());
    // Первая пустая клетка выбрана заранее: без этого ребёнок видит поле,
    // ряд цифр под ним — и ни одна из цифр не нажимается, потому что
    // клетка не выбрана. Молчащая клавиатура читается как поломка.
    setPicked(next.given.indexOf(0));
    setWrong(null);
    setMistakes(0);
    setElapsed(0);
    setSaved(null);
    setRecord(false);
    startedAt.current = Date.now();
    arcade.reset();
  }

  /*
   * Цифра в выбранную клетку.
   *
   * Следующая клетка сама не выбирается. Соседняя по чтению может стоять в
   * другом конце поля, и ребёнок, нажавший цифру «туда, куда только что
   * смотрел», получил бы промах за чужой ход. Выбирает он сам — это один
   * лишний тык на клетку и ни одного несправедливого промаха.
   */
  const put = useCallback(
    (value: number) => {
      if (!puzzle || picked === null || done) return;
      if (cells[picked] !== 0) return;
      const cell = cellRefs.current[picked];
      if (puzzle.solution[picked] === value) {
        setCells((prev) => {
          const next = prev.slice();
          next[picked] = value;
          return next;
        });
        setWrong(null);
        setPicked(null);
        // Искры вылетают из заполненной клетки: взгляд ребёнка уже там.
        arcade.hit(true, cell);
        return;
      }
      setMistakes((m) => m + 1);
      setWrong(picked);
      // На промахе элемент не передаём: искры летят только на верном
      // ответе, а гасит серию hit и без него (см. components/arcade.tsx).
      arcade.hit(false);
      window.setTimeout(() => setWrong((w) => (w === picked ? null : w)), 350);
    },
    [puzzle, picked, done, cells, arcade],
  );

  /* Клавиатура для тех, кто за ноутбуком: цифра ставится в выбранную
     клетку, стрелки двигают выбор. Тыкать мышью в цифру под полем, когда
     под рукой цифровой ряд, — лишняя работа, а тренажёр про скорость. */
  useEffect(() => {
    if (!puzzle || done) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= size) {
        e.preventDefault();
        put(digit);
        return;
      }
      const steps: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: size,
        ArrowUp: -size,
      };
      const step = steps[e.key];
      if (!step) return;
      e.preventDefault();
      /* Стрелка перескакивает занятые клетки и останавливается на первой
         пустой. Вставать на заполненную незачем: менять в ней нечего, а
         выбор, из которого не работает ни одна цифра, читается как
         зависшая страница. */
      setPicked((prev) => {
        let next = (prev ?? -step) + step;
        while (next >= 0 && next < size * size) {
          if (cellsRef.current[next] === 0) return next;
          next += step;
        }
        return prev;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [puzzle, done, size, put]);

  /* Цифра, которой на поле больше не осталось места, гаснет: считать по
     клеткам, сколько семёрок уже стоит, ребёнок не обязан. */
  const spent = useMemo(() => {
    const counts = new Array<number>(size + 1).fill(0);
    for (const value of cells) if (value) counts[value] += 1;
    return counts;
  }, [cells, size]);

  const perCell = useMemo(
    () => (done && elapsed > 0 && blanks > 0 ? (elapsed / blanks).toFixed(1) : null),
    [done, elapsed, blanks],
  );

  const body = (
    <div className="sov-shell">
      <div style={{ padding: "18px 0" }}>
        <TrainerTop current="sudoku" />
      </div>

      <div className="sov-play">
        {puzzle === null ? (
          <div className="sov-card">
            <h2>Судоку</h2>
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Расставь цифры так, чтобы в каждой строке, в каждом столбце и в каждом квадрате,
              обведённом жирной линией, они не повторялись. Выбери клетку и нажми цифру: неверная не
              встанет — подумай ещё раз.
            </p>

            <fieldset className="sov-setup" disabled={!paid} style={{ marginTop: 22 }}>
              <div className="sov-setup__row">
                <span className="sov-setup__label">Размер</span>
                <div className="sov-chips">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="sov-chip"
                      data-active={size === s}
                      onClick={() => setSize(s)}
                    >
                      {s} × {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sov-setup__row">
                <span className="sov-setup__label">Подсказки</span>
                <div className="sov-chips">
                  {CLUES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="sov-chip"
                      data-active={clues === c}
                      onClick={() => setClues(c)}
                    >
                      {CLUE_WORDS[c]}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>

            {!paid ? <TuneLock /> : null}

            <div style={{ marginTop: 26 }}>
              <ChildAction onClick={start}>Начать</ChildAction>
            </div>
          </div>
        ) : done ? (
          <div className="sov-card">
            <Owl size={64} mood="happy" />
            <h2 style={{ marginTop: 14 }}>Готово за {elapsed} сек</h2>
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              {perCell} секунды на клетку
              {mistakes > 0 ? `, промахов: ${mistakes}` : ", ни одного промаха"}.
            </p>
            <ArcadeBest best={arcade.best} record={record} />
            <ArcadeReward coins={coins} />
            {saved === false ? (
              <div className="sov-save-hint" style={{ marginTop: 20 }}>
                <strong>Результат не сохранён</strong>
                <span>{probe ? SAVE_PROBE : locked ? SAVE_LOCKED : SAVE_NO_ACCOUNT}</span>
              </div>
            ) : null}
            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ChildAction onClick={start}>Ещё раз</ChildAction>
              <button type="button" className="sov-act-ghost" onClick={() => setPuzzle(null)}>
                Другое поле
              </button>
            </div>

            <ResultBridge signedIn={signedIn} saved={saved} locked={locked} streak={arcade.best} />
          </div>
        ) : (
          <>
            <div className="sov-play__bar">
              <Owl size={40} />
              <div className="sov-sudoku__status">
                <strong>Осталось {left}</strong>
                <span className="sov-mono">
                  {elapsed} сек · поле {size} × {size}
                </span>
              </div>
              <ArcadeCombo arcade={arcade} />
            </div>

            <div
              className="sov-sudoku"
              style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
              data-size={size}
            >
              {cells.map((value, index) => {
                const row = Math.floor(index / size);
                const col = index % size;
                /* Толстая линия там, где кончается квадрат, тонкая между
                   клетками, ничего — по краю поля: рамку рисует сам блок,
                   и вторая полоса рядом с ней читалась бы как двойная. */
                const edge = (n: number, step: number) =>
                  n + 1 === size ? "none" : (n + 1) % step === 0 ? "box" : "cell";
                const fixed = puzzle.given[index] !== 0;
                return (
                  <button
                    key={index}
                    ref={(el) => {
                      cellRefs.current[index] = el;
                    }}
                    type="button"
                    className="sov-sudoku__cell"
                    data-right={edge(col, puzzle.boxW)}
                    data-bottom={edge(row, puzzle.boxH)}
                    data-given={fixed}
                    data-filled={!fixed && value !== 0}
                    data-picked={picked === index}
                    data-wrong={wrong === index}
                    /* Заполненную клетку выбрать нельзя: менять в ней
                       нечего — всё, что стоит на поле, уже верно. */
                    disabled={value !== 0}
                    onClick={() => setPicked(index)}
                  >
                    {value || ""}
                  </button>
                );
              })}
            </div>

            {/* Цифры отдельным рядом, а не вводом с клавиатуры: тренажёр
                открывают с телефона, и системная клавиатура закрыла бы
                нижнюю половину поля — ровно ту, в которую смотрят. */}
            <div
              className="sov-sudoku__pad"
              style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
              role="group"
              aria-label="Цифры"
            >
              {Array.from({ length: size }, (_, i) => i + 1).map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className="sov-sudoku__key"
                  data-spent={spent[digit] >= size}
                  disabled={picked === null}
                  onClick={() => put(digit)}
                >
                  {digit}
                </button>
              ))}
            </div>

            <button type="button" className="sov-leave" onClick={() => setPuzzle(null)}>
              Закончить
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="sov sov-kid">
      {puzzle === null ? body : <ArcadeStage arcade={arcade}>{body}</ArcadeStage>}
      <SiteFooter />
    </div>
  );
}
