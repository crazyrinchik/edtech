import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ChildAction, Owl, Wordmark } from "../components/brand";
import { SpeakButton } from "../components/speak";
import { me, saveMentalDrill } from "../lib/api/app.functions";

export const Route = createFileRoute("/schet")({
  head: () => ({ meta: [{ title: "Устный счёт, Совёнок" }] }),
  component: MentalPage,
});

type Operation = "add" | "sub" | "mul" | "div";

const OPERATIONS: { id: Operation; label: string; sign: string; word: string }[] = [
  { id: "add", label: "Сложение", sign: "+", word: "плюс" },
  { id: "sub", label: "Вычитание", sign: "−", word: "минус" },
  { id: "mul", label: "Умножение", sign: "×", word: "умножить на" },
  { id: "div", label: "Деление", sign: "÷", word: "разделить на" },
];

/** Значения по умолчанию: то, с чего начинает второклассник без настройки. */
const DEFAULTS = { digits: 1 as 1 | 2 | 3, operations: ["add", "sub"] as Operation[], limitSec: 10, count: 10 };

const LIMITS = [5, 10, 15, 20, 0];
const COUNTS = [10, 20, 30];

type Example = { a: number; b: number; op: Operation; answer: number };

function rnd(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Диапазон разрядности: 1 → 2..9, 2 → 10..99, 3 → 100..999. */
function range(digits: number): [number, number] {
  if (digits <= 1) return [2, 9];
  return [10 ** (digits - 1), 10 ** digits - 1];
}

/**
 * Пример генерируется так, чтобы его можно было решить в уме и без
 * отрицательных чисел: вычитание всегда идёт от большего, умножение берёт
 * второй множитель однозначным, а деление строится обратным ходом от
 * умножения — тогда результат всегда целый.
 */
function makeExample(digits: number, operations: Operation[]): Example {
  const op = operations[rnd(0, operations.length - 1)];
  const [lo, hi] = range(digits);

  if (op === "add") {
    const a = rnd(lo, hi);
    const b = rnd(lo, hi);
    return { a, b, op, answer: a + b };
  }
  if (op === "sub") {
    const x = rnd(lo, hi);
    const y = rnd(lo, hi);
    const a = Math.max(x, y);
    const b = Math.min(x, y);
    return { a, b, op, answer: a - b };
  }
  if (op === "mul") {
    // Второй множитель всегда однозначный: 24 × 7 держится в голове,
    // 24 × 37 — уже нет.
    const a = rnd(lo, hi);
    const b = rnd(2, 9);
    return { a, b, op, answer: a * b };
  }
  // Деление строится обратным ходом от умножения — остаток невозможен.
  const b = rnd(2, 9);
  const lowQ = Math.max(2, Math.ceil(lo / b));
  const highQ = Math.max(lowQ, Math.floor(hi / b));
  const result = rnd(lowQ, highQ);
  return { a: b * result, b, op, answer: result };
}

function sign(op: Operation): string {
  return OPERATIONS.find((o) => o.id === op)!.sign;
}

function spoken(example: Example): string {
  const word = OPERATIONS.find((o) => o.id === example.op)!.word;
  return `Сколько будет ${example.a} ${word} ${example.b}?`;
}

/**
 * Тренажёр устного счёта.
 *
 * Работает без аккаунта: считать можно сразу, но результат тогда никуда не
 * ложится — об этом честно сказано на экране итога. Таймер на каждый ответ
 * настраивается отдельно от количества примеров: скорость и объём — разные
 * вещи, и родители просят крутить их по отдельности.
 */
function MentalPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"setup" | "play" | "done">("setup");
  const [digits, setDigits] = useState<1 | 2 | 3>(DEFAULTS.digits);
  const [operations, setOperations] = useState<Operation[]>(DEFAULTS.operations);
  const [limitSec, setLimitSec] = useState(DEFAULTS.limitSec);
  const [count, setCount] = useState(DEFAULTS.count);

  const [childId, setChildId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState(false);

  const [example, setExample] = useState<Example | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [correct, setCorrect] = useState(0);
  const [verdict, setVerdict] = useState<{ ok: boolean; answer: number } | null>(null);
  const [left, setLeft] = useState(0);

  const startedAt = useRef(Date.now());

  useEffect(() => {
    me()
      .then((account) => {
        setSignedIn(!!account.user);
        setChildId(account.activeChildId ?? account.children[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  // Таймер ответа. Ноль означает «без ограничения» — тогда обратный отсчёт
  // не запускается вовсе, а не крутится вхолостую.
  useEffect(() => {
    if (stage !== "play" || !limitSec || verdict) return;
    setLeft(limitSec);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const rest = limitSec - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, rest));
      if (rest <= 0) {
        window.clearInterval(timer);
        setVerdict({ ok: false, answer: example?.answer ?? 0 });
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [stage, limitSec, index, verdict, example]);

  function start() {
    if (!operations.length) return;
    setExample(makeExample(digits, operations));
    setIndex(0);
    setCorrect(0);
    setValue("");
    setVerdict(null);
    setSaved(false);
    startedAt.current = Date.now();
    setStage("play");
  }

  function answer() {
    if (!example || verdict) return;
    const ok = value.trim() !== "" && Number(value.trim()) === example.answer;
    if (ok) setCorrect((n) => n + 1);
    setVerdict({ ok, answer: example.answer });
  }

  async function next() {
    if (index + 1 >= count) {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setStage("done");
      const res = await saveMentalDrill({
        data: {
          childId: signedIn ? childId : null,
          correct,
          total: count,
          seconds,
          digits,
          operations,
          limitSec,
        },
      }).catch(() => ({ saved: false }));
      setSaved(res.saved);
      return;
    }
    setIndex((i) => i + 1);
    setExample(makeExample(digits, operations));
    setValue("");
    setVerdict(null);
  }

  if (stage === "setup") {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <TrainerTop />
          <div className="sov-card">
            <h2>Устный счёт</h2>
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
              Примеры появляются по одному. На каждый ответ даётся время — его можно увеличить
              или убрать совсем.
            </p>

            <div className="sov-setup">
              <div className="sov-setup__row">
                <span className="sov-setup__label">Числа</span>
                <div className="sov-chips" style={{ marginTop: 0 }}>
                  {([1, 2, 3] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="sov-chip"
                      data-active={digits === d}
                      onClick={() => setDigits(d)}
                    >
                      {d === 1 ? "однозначные" : d === 2 ? "двузначные" : "трёхзначные"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sov-setup__row">
                <span className="sov-setup__label">Действия</span>
                <div className="sov-chips" style={{ marginTop: 0 }}>
                  {OPERATIONS.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      className="sov-chip"
                      data-active={operations.includes(op.id)}
                      onClick={() =>
                        setOperations((prev) =>
                          prev.includes(op.id) ? prev.filter((o) => o !== op.id) : [...prev, op.id],
                        )
                      }
                    >
                      {op.sign} {op.label}
                    </button>
                  ))}
                </div>
                {!operations.length ? (
                  <span className="sov-field__error">Выберите хотя бы одно действие</span>
                ) : null}
              </div>

              <div className="sov-setup__row">
                <span className="sov-setup__label">Время на ответ</span>
                <div className="sov-chips" style={{ marginTop: 0 }}>
                  {LIMITS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      className="sov-chip"
                      data-active={limitSec === sec}
                      onClick={() => setLimitSec(sec)}
                    >
                      {sec === 0 ? "без таймера" : `${sec} сек`}
                    </button>
                  ))}
                </div>
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
              <ChildAction onClick={start} disabled={!operations.length}>
                Начать
              </ChildAction>
            </div>

            {!signedIn ? (
              <div className="sov-save-hint" style={{ marginTop: 22 }}>
                <strong>Можно считать без аккаунта</strong>
                <span>Результат тогда не сохранится и не попадёт в отчёт родителя.</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (stage === "done") {
    const percent = Math.round((correct / count) * 100);
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <TrainerTop />
          <div className="sov-card">
            <Owl size={64} mood={percent >= 70 ? "happy" : "concerned"} animated />
            <h2 style={{ marginTop: 16 }}>Готово</h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Верных ответов: {correct} из {count} ({percent}%).
            </p>
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
              <ChildAction onClick={() => setStage("setup")}>Ещё раз</ChildAction>
              {!signedIn ? (
                <button className="sov-act-ghost" onClick={() => navigate({ to: "/registraciya" })}>
                  Сохранить прогресс
                </button>
              ) : (
                <button className="sov-act-ghost" onClick={() => navigate({ to: "/uchenik" })}>
                  К занятиям
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        <TrainerTop />
        <div className="sov-play__bar" style={{ marginTop: 14 }}>
          <Owl size={40} mood={verdict ? (verdict.ok ? "happy" : "concerned") : "idle"} />
          <div className="sov-play__track">
            <div className="sov-play__fill" style={{ width: `${(index / count) * 100}%` }} />
          </div>
          <span className="sov-mono">
            {index + 1} из {count}
          </span>
        </div>

        {limitSec && !verdict ? (
          <div className="sov-timer" data-hot={left <= 3}>
            <div className="sov-timer__fill" style={{ width: `${(left / limitSec) * 100}%` }} />
            <span className="sov-timer__count">{left}</span>
          </div>
        ) : null}

        <div className="sov-card">
          <div className="sov-ask">
            <h2 className="sov-example">
              {example?.a} {example ? sign(example.op) : ""} {example?.b} = ?
            </h2>
            {example ? <SpeakButton text={spoken(example)} /> : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              answer();
            }}
          >
            <input
              className="sov-answer-input"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d-]/g, ""))}
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

          {verdict ? (
            <>
              <div className="sov-feedback" data-kind={verdict.ok ? "right" : "wrong"}>
                <div>
                  <strong>{verdict.ok ? "Верно" : "Пока не так"}</strong>
                  <span>
                    {verdict.ok
                      ? "Идём дальше."
                      : `Правильный ответ: ${verdict.answer}.${value.trim() ? "" : " Время вышло — попробуй следующий пример."}`}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 22 }}>
                <ChildAction onClick={() => void next()}>
                  {index + 1 < count ? "Дальше" : "Завершить"}
                </ChildAction>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TrainerTop() {
  return (
    <div className="sov-demo__top">
      <Wordmark compact />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/chtenie" className="sov-act-ghost" style={{ textDecoration: "none" }}>
          Скорочтение
        </Link>
        <Link to="/uchenik" className="sov-act-ghost" style={{ textDecoration: "none" }}>
          Занятия
        </Link>
      </div>
    </div>
  );
}
