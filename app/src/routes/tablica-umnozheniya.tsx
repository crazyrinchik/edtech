import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ChildAction, Owl } from "../components/brand";
import { SpeakButton } from "../components/speak";
import { TrainerTop } from "../components/trainers";
import { me, saveTableDrill } from "../lib/api/app.functions";

export const Route = createFileRoute("/tablica-umnozheniya")({
  head: () => ({
    meta: [
      { title: "Таблица умножения, Совёнок" },
      {
        name: "description",
        content:
          "Тренажёр таблицы умножения в обе стороны: умножение, деление и поиск множителя. Ответы до 10, до 100 и дальше. Саму таблицу можно открыть на любом примере. Без регистрации.",
      },
    ],
  }),
  component: TablePage,
});

type Level = "ten" | "hundred" | "beyond";
type Direction = "mul" | "div" | "factor";

const LEVELS: { id: Level; label: string; note: string }[] = [
  { id: "ten", label: "До 10", note: "Ответ не больше десяти: 2 × 3, 3 × 3, 2 × 5." },
  { id: "hundred", label: "До 100", note: "Вся таблица: множители от 2 до 10." },
  { id: "beyond", label: "Дальше", note: "Второй десяток: 11–20 умножаем на 2–10." },
];

const DIRECTIONS: { id: Direction; label: string; note: string }[] = [
  { id: "mul", label: "Умножение", note: "7 × 8 = ?" },
  { id: "div", label: "Деление", note: "56 ÷ 8 = ?" },
  { id: "factor", label: "Найти множитель", note: "7 × ? = 56" },
];

const COUNTS = [10, 20, 30];

type Question = {
  a: number;
  b: number;
  dir: Direction;
  text: string;
  spoken: string;
  answer: number;
};

function rnd(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Пары множителей уровня.
 *
 * «До 10» — это не первая строка таблицы, а всё, что помещается в первый
 * десяток: 2 × 4 и 3 × 3 ребёнок осваивает раньше, чем всю строку двойки.
 * «До 100» — привычная таблица без умножения на единицу: 6 × 1 не
 * тренирует ничего.
 */
function pairs(level: Level): [number, number][] {
  const out: [number, number][] = [];
  if (level === "ten") {
    for (let a = 2; a <= 10; a += 1) {
      for (let b = 2; b <= 10; b += 1) if (a * b <= 10) out.push([a, b]);
    }
    return out;
  }
  if (level === "hundred") {
    for (let a = 2; a <= 10; a += 1) for (let b = 2; b <= 10; b += 1) out.push([a, b]);
    return out;
  }
  for (let a = 11; a <= 20; a += 1) for (let b = 2; b <= 10; b += 1) out.push([a, b]);
  return out;
}

function makeQuestion(level: Level, directions: Direction[]): Question {
  const list = pairs(level);
  const [a, b] = list[rnd(0, list.length - 1)];
  const dir = directions[rnd(0, directions.length - 1)];
  const product = a * b;

  if (dir === "mul") {
    return {
      a,
      b,
      dir,
      text: `${a} × ${b} = ?`,
      spoken: `Сколько будет ${a} умножить на ${b}?`,
      answer: product,
    };
  }
  if (dir === "div") {
    // Делим то на один множитель, то на другой: иначе ребёнок привыкает,
    // что делитель всегда из таблицы, которую он сейчас учит.
    const divisor = Math.random() < 0.5 ? a : b;
    return {
      a,
      b,
      dir,
      text: `${product} ÷ ${divisor} = ?`,
      spoken: `Сколько будет ${product} разделить на ${divisor}?`,
      answer: product / divisor,
    };
  }
  const known = Math.random() < 0.5;
  return {
    a,
    b,
    dir,
    text: known ? `${a} × ? = ${product}` : `? × ${b} = ${product}`,
    spoken: known
      ? `На сколько надо умножить ${a}, чтобы получилось ${product}?`
      : `Какое число надо умножить на ${b}, чтобы получилось ${product}?`,
    answer: known ? b : a,
  };
}

/**
 * Таблица умножения в обе стороны.
 *
 * Таблицу учат не для того, чтобы отвечать на «семью восемь», а чтобы
 * узнавать 56 как семь восьмёрок: поэтому кроме умножения тренажёр
 * спрашивает деление и пропущенный множитель. Сама таблица при этом не
 * спрятана — её открывают прямо на примере, и нужная клетка подсвечена.
 * Подсмотреть в таблицу полезнее, чем угадать: угаданное не запоминается.
 */
function TablePage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"setup" | "play" | "done">("setup");
  const [level, setLevel] = useState<Level>("hundred");
  const [directions, setDirections] = useState<Direction[]>(["mul", "div"]);
  const [count, setCount] = useState(10);

  const [question, setQuestion] = useState<Question | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<{ ok: boolean; answer: number } | null>(null);
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState<Question[]>([]);
  const [openTable, setOpenTable] = useState(false);

  const [childId, setChildId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const startedAt = useRef(Date.now());
  const answerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    me()
      .then((account) => {
        setSignedIn(!!account.user);
        setChildId(account.activeChildId ?? account.children[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (verdict) return;
    answerRef.current?.focus();
  }, [index, verdict, question]);

  function start() {
    if (!directions.length) return;
    setQuestion(makeQuestion(level, directions));
    setIndex(0);
    setValue("");
    setVerdict(null);
    setCorrect(0);
    setMisses([]);
    setOpenTable(false);
    setSaved(false);
    startedAt.current = Date.now();
    setStage("play");
  }

  function check() {
    if (!question || verdict) return;
    const ok = value.trim() !== "" && Number(value.trim()) === question.answer;
    if (ok) setCorrect((n) => n + 1);
    else {
      setMisses((prev) => [...prev, question]);
      // После ошибки таблица открывается сама на нужной клетке: правильный
      // ответ цифрой ребёнок прочитает и забудет, место в таблице — нет.
      setOpenTable(true);
    }
    setVerdict({ ok, answer: question.answer });
  }

  async function next() {
    if (index + 1 >= count) {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setStage("done");
      const res = await saveTableDrill({
        data: {
          childId: signedIn ? childId : null,
          correct,
          total: count,
          seconds,
          level,
          directions,
        },
      }).catch(() => ({ saved: false }));
      setSaved(res.saved);
      return;
    }
    setIndex((i) => i + 1);
    setQuestion(makeQuestion(level, directions));
    setValue("");
    setVerdict(null);
    setOpenTable(false);
  }

  if (stage === "setup") {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <TrainerTop current="tablica" />
          <div className="sov-card">
            <h2>Таблица умножения</h2>
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Примеры идут в обе стороны: и «семью восемь», и «пятьдесят шесть разделить на восемь».
              Таблица открывается на любом примере — подсматривать в неё можно, за это ничего не
              снимается.
            </p>

            <div className="sov-setup">
              <div className="sov-setup__row">
                <span className="sov-setup__label">Докуда</span>
                <div className="sov-chips" style={{ marginTop: 0 }}>
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="sov-chip"
                      data-active={level === l.id}
                      onClick={() => setLevel(l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <span className="sov-setup__note">{LEVELS.find((l) => l.id === level)!.note}</span>
              </div>

              <div className="sov-setup__row">
                <span className="sov-setup__label">Что спрашивать</span>
                <div className="sov-chips" style={{ marginTop: 0 }}>
                  {DIRECTIONS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="sov-chip"
                      data-active={directions.includes(d.id)}
                      onClick={() =>
                        setDirections((prev) =>
                          prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                        )
                      }
                    >
                      {d.label} · {d.note}
                    </button>
                  ))}
                </div>
                {!directions.length ? (
                  <span className="sov-field__error">Выберите хотя бы одно</span>
                ) : null}
              </div>

              <div className="sov-setup__row">
                <span className="sov-setup__label">Сколько примеров</span>
                <div className="sov-chips" style={{ marginTop: 0 }}>
                  {COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="sov-chip"
                      data-active={count === n}
                      onClick={() => setCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 26 }}>
              <ChildAction onClick={start} disabled={!directions.length}>
                Начать
              </ChildAction>
            </div>

            {!signedIn ? (
              <div className="sov-save-hint" style={{ marginTop: 22 }}>
                <strong>Можно тренироваться без аккаунта</strong>
                <span>Результат тогда не сохранится и не попадёт в отчёт родителя.</span>
              </div>
            ) : null}
          </div>
          {/* Отдельной карточки «Сама таблица» здесь больше нет: та же
              таблица открывается прямо на примере и после ошибки встаёт на
              нужной клетке. На стартовом экране она отвечала на вопрос,
              которого ребёнок ещё не задал, и отодвигала кнопку «Начать». */}
        </div>
      </div>
    );
  }

  if (stage === "done") {
    const percent = Math.round((correct / count) * 100);
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <TrainerTop current="tablica" />
          <div className="sov-card">
            <Owl size={64} mood={percent >= 70 ? "happy" : "concerned"} animated />
            <h2 style={{ marginTop: 16 }}>Готово</h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Верных ответов: {correct} из {count} ({percent}%).
            </p>

            {misses.length ? (
              <div className="sov-missed">
                <h3>Примеры, которые стоит повторить</h3>
                <div className="sov-missed__grid">
                  {misses.map((m, i) => (
                    <span key={`${m.text}-${i}`} className="sov-mono">
                      {m.text.replace("?", String(m.answer))}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {!saved ? (
              <div className="sov-save-hint">
                <strong>Результат не сохранён</strong>
                <span>
                  {signedIn
                    ? "Выберите профиль ребёнка, чтобы тренировки попадали в отчёт родителя."
                    : "Заведите аккаунт: тренировки будут копиться, а родитель увидит скорость и точность в кабинете."}
                </span>
              </div>
            ) : (
              <p className="sov-mono" style={{ marginTop: 14, color: "var(--sov-ok)" }}>
                Результат сохранён в отчёте родителя.
              </p>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ChildAction onClick={start}>Ещё раз</ChildAction>
              <button type="button" className="sov-act-ghost" onClick={() => setStage("setup")}>
                Изменить настройки
              </button>
              {!signedIn ? (
                <button
                  type="button"
                  className="sov-act-ghost"
                  onClick={() => navigate({ to: "/registraciya" })}
                >
                  Сохранить прогресс
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        <TrainerTop current="tablica" />

        <div className="sov-play__bar" style={{ marginTop: 14 }}>
          <Owl size={40} mood={verdict ? (verdict.ok ? "happy" : "concerned") : "idle"} />
          <div className="sov-play__track">
            <div className="sov-play__fill" style={{ width: `${(index / count) * 100}%` }} />
          </div>
          <span className="sov-mono">
            {index + 1} из {count}
          </span>
        </div>

        <div className="sov-card">
          <div className="sov-ask">
            <h2 className="sov-example">{question?.text}</h2>
            {question ? <SpeakButton text={question.spoken} /> : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            <input
              ref={answerRef}
              className="sov-answer-input"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
              disabled={!!verdict}
              inputMode="numeric"
              autoFocus
              aria-label="Ответ"
            />
            {!verdict ? (
              <div style={{ marginTop: 22 }}>
                <ChildAction type="submit" disabled={!value.trim()}>
                  Проверить
                </ChildAction>
              </div>
            ) : null}
          </form>

          {/* Порядок тот же, что в правописании: сначала разбор, потом то,
              куда в нём смотреть, и только потом «дальше». Таблица после
              ошибки разворачивается сама и занимает пол-экрана — стой она
              выше, разбор оказался бы под ней и его бы не читали. */}
          {verdict ? (
            <div className="sov-feedback" data-kind={verdict.ok ? "right" : "wrong"}>
              <div>
                <strong>{verdict.ok ? "Верно" : "Пока не так"}</strong>
                <span>
                  {verdict.ok
                    ? "Идём дальше."
                    : `Правильный ответ: ${verdict.answer}. В таблице это клетка ${question?.a} × ${question?.b}.`}
                </span>
              </div>
            </div>
          ) : null}

          <div className="sov-reveal" data-open={openTable}>
            <button
              type="button"
              className="sov-reveal__btn"
              aria-expanded={openTable}
              onClick={() => setOpenTable((o) => !o)}
            >
              <span>Таблица умножения</span>
              <span className="sov-reveal__sign" aria-hidden="true">
                {openTable ? "Свернуть" : "Открыть"}
              </span>
            </button>
            {openTable ? (
              <div className="sov-reveal__body">
                <PythagorasTable
                  level={level}
                  hit={question ? { a: question.a, b: question.b } : null}
                />
              </div>
            ) : null}
          </div>

          {verdict ? (
            <div style={{ marginTop: 22 }}>
              <ChildAction onClick={() => void next()}>
                {index + 1 < count ? "Дальше" : "Завершить"}
              </ChildAction>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Таблица Пифагора для выбранного уровня.
 *
 * Строки берутся из уровня: до сотни это привычные 2–10, дальше — второй
 * десяток. Клетки, которых на уровне «до 10» быть не может, приглушены —
 * ребёнок видит границу того, что от него сейчас спрашивают, а не пустоту.
 */
function PythagorasTable({ level, hit }: { level: Level; hit?: { a: number; b: number } | null }) {
  const rows = level === "beyond" ? range(11, 20) : range(2, 10);
  const cols = range(2, 10);
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div className="sov-pifagor">
      <div className="sov-pifagor__scroll">
        <table>
          <thead>
            <tr>
              <th aria-hidden="true">×</th>
              {cols.map((b) => (
                <th key={b}>
                  <button type="button" onClick={() => setPicked(picked === b ? null : b)}>
                    {b}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a}>
                <th>
                  <button type="button" onClick={() => setPicked(picked === a ? null : a)}>
                    {a}
                  </button>
                </th>
                {cols.map((b) => (
                  <td
                    key={b}
                    data-lit={picked !== null && (a === picked || b === picked)}
                    data-hit={
                      !!hit && ((hit.a === a && hit.b === b) || (hit.a === b && hit.b === a))
                    }
                    data-off={level === "ten" && a * b > 10}
                  >
                    {a * b}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {picked !== null ? (
        <div className="sov-pifagor__column">
          <strong>Столбик {picked}</strong>
          <div className="sov-pifagor__list">
            {range(1, 10).map((b) => (
              <span key={b} className="sov-mono">
                {picked} × {b} = {picked * b}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
