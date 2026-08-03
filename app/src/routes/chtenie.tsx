import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ChildAction, Owl, Wordmark } from "../components/brand";
import { SpeakButton } from "../components/speak";
import { me, readingResult, readingTexts } from "../lib/api/app.functions";

export const Route = createFileRoute("/chtenie")({
  head: () => ({ meta: [{ title: "Скорочтение, Совёнок" }] }),
  component: ReadingPage,
});

type TextItem = {
  id: string;
  level: number;
  title: string;
  body: string;
  words: number;
  questions: { index: number; prompt: string; options: string[] }[];
};
type Outcome = {
  correct: number;
  total: number;
  details: { prompt: string; answer: string; correct: boolean }[];
  saved: boolean;
};

/** Скорость показа слов. 80 слов в минуту — темп чтения первоклассника вслух. */
const SPEEDS = [60, 80, 120, 160, 200];
const LEVEL_NAMES = ["", "простой", "средний", "сложный"];

/**
 * Тренировка скорочтения.
 *
 * Текст показывается по одному слову с выбранной скоростью — так глаз не
 * возвращается назад, а внимание держится на строке. После текста идут вопросы:
 * без проверки понимания скорость не значит ничего.
 *
 * Без аккаунта открыт только простой уровень, и результат не сохраняется —
 * об этом сказано прямо на экране, а не мелким шрифтом.
 */
function ReadingPage() {
  const navigate = useNavigate();
  const [texts, setTexts] = useState<TextItem[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [lockedLevels, setLockedLevels] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);

  const [stage, setStage] = useState<"setup" | "read" | "quiz" | "done">("setup");
  const [textId, setTextId] = useState<string | null>(null);
  const [wpm, setWpm] = useState(80);
  const [wordIndex, setWordIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState(false);

  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const [list, account] = await Promise.all([readingTexts(), me().catch(() => null)]);
      setTexts(list.texts as TextItem[]);
      setSignedIn(list.signedIn);
      setLockedLevels(list.lockedLevels);
      setTextId(list.texts[0]?.id ?? null);
      if (account?.user) setChildId(account.activeChildId ?? account.children[0]?.id ?? null);
    })().catch(() => setTexts([]));
  }, []);

  const text = texts?.find((t) => t.id === textId) ?? null;
  const words = text ? text.body.trim().split(/\s+/) : [];

  // Показ слов: интервал считается из скорости в словах в минуту.
  useEffect(() => {
    if (stage !== "read" || !words.length) return;
    const step = Math.max(120, Math.round(60_000 / wpm));
    const timer = window.setInterval(() => {
      setWordIndex((i) => {
        if (i + 1 >= words.length) {
          window.clearInterval(timer);
          setStage("quiz");
          return i;
        }
        return i + 1;
      });
    }, step);
    return () => window.clearInterval(timer);
  }, [stage, wpm, words.length]);

  function startReading() {
    if (!text) return;
    setWordIndex(0);
    setAnswers({});
    setOutcome(null);
    startedAt.current = Date.now();
    setStage("read");
  }

  async function submitQuiz() {
    if (!text) return;
    setPending(true);
    const seconds = Math.max(1, Math.floor((Date.now() - startedAt.current) / 1000));
    const res = await readingResult({
      data: {
        textId: text.id,
        answers: Object.entries(answers).map(([index, value]) => ({ index: Number(index), value })),
        seconds,
        wpm,
        childId: signedIn ? childId : null,
      },
    });
    setOutcome(res as Outcome);
    setStage("done");
    setPending(false);
  }

  if (!texts) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <h2>Готовим тексты…</h2>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "read" && text) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-flash">
            <span className="sov-flash__word">{words[wordIndex]}</span>
          </div>
          <div className="sov-play__track" style={{ marginTop: 20 }}>
            <div className="sov-play__fill" style={{ width: `${((wordIndex + 1) / words.length) * 100}%` }} />
          </div>
          <p className="sov-mono" style={{ marginTop: 14, color: "var(--sov-ink-soft)", textAlign: "center" }}>
            {wpm} слов в минуту · {wordIndex + 1} из {words.length}
          </p>
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button className="sov-act-ghost" onClick={() => setStage("quiz")}>
              Хватит, перейти к вопросам
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "quiz" && text) {
    const ready = text.questions.every((q) => answers[q.index]);
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <ReadingTop />
          <div className="sov-card">
            <h2>Что запомнилось?</h2>
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
              Два вопроса по тексту «{text.title}».
            </p>
            {text.questions.map((q) => (
              <div key={q.index} style={{ marginTop: 24 }}>
                <div className="sov-ask">
                  <p style={{ fontWeight: 600 }}>{q.prompt}</p>
                  <SpeakButton compact text={q.prompt} />
                </div>
                <div className="sov-options">
                  {q.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="sov-option"
                      data-state={answers[q.index] === option ? "right" : undefined}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.index]: option }))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 26 }}>
              <ChildAction onClick={() => void submitQuiz()} disabled={!ready || pending}>
                Проверить
              </ChildAction>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "done" && outcome && text) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <ReadingTop />
          <div className="sov-card">
            <Owl size={64} mood={outcome.correct === outcome.total ? "happy" : "concerned"} animated />
            <h2 style={{ marginTop: 16 }}>Прочитано</h2>
            <div className="sov-metrics" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <div className="sov-metric">
                <b>{wpm}</b>
                <span>слов в минуту</span>
              </div>
              <div className="sov-metric">
                <b>
                  {outcome.correct} из {outcome.total}
                </b>
                <span>вопросов понято</span>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              {outcome.details.map((d) => (
                <div key={d.prompt} className="sov-risk" style={{ borderLeftColor: d.correct ? "var(--sov-ok)" : "var(--sov-warn)" }}>
                  <strong>{d.prompt}</strong>
                  <div className="sov-mono" style={{ marginTop: 4 }}>
                    {d.correct ? "верно" : `правильный ответ: ${d.answer}`}
                  </div>
                </div>
              ))}
            </div>

            {!outcome.saved ? (
              <div className="sov-save-hint">
                <strong>Результат не сохранён</strong>
                <span>
                  {signedIn
                    ? "Выберите профиль ребёнка, чтобы скорость чтения попадала в отчёт родителя."
                    : "С аккаунтом видно, как скорость растёт от недели к неделе, а родитель получает отчёт."}
                </span>
              </div>
            ) : (
              <p className="sov-mono" style={{ marginTop: 14, color: "var(--sov-ok)" }}>
                Результат сохранён в отчёте родителя.
              </p>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ChildAction onClick={() => setStage("setup")}>Другой текст</ChildAction>
              {!signedIn ? (
                <button className="sov-act-ghost" onClick={() => navigate({ to: "/registraciya" })}>
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
        <ReadingTop />
        <div className="sov-card">
          <h2>Скорочтение</h2>
          <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
            Слова появляются по одному с выбранной скоростью. После текста — два вопроса: важно не
            только быстро, но и понять.
          </p>

          <div className="sov-setup">
            <div className="sov-setup__row">
              <span className="sov-setup__label">Скорость</span>
              <div className="sov-chips" style={{ marginTop: 0 }}>
                {SPEEDS.map((s) => (
                  <button key={s} type="button" className="sov-chip" data-active={wpm === s} onClick={() => setWpm(s)}>
                    {s} сл/мин
                  </button>
                ))}
              </div>
            </div>

            <div className="sov-setup__row">
              <span className="sov-setup__label">Текст</span>
              <div className="sov-reading-list">
                {texts.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="sov-reading-item"
                    data-active={textId === t.id}
                    onClick={() => setTextId(t.id)}
                  >
                    <strong>{t.title}</strong>
                    <span>
                      {LEVEL_NAMES[t.level]} · {t.words} слов
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <ChildAction onClick={startReading} disabled={!text}>
              Начать чтение
            </ChildAction>
          </div>

          {lockedLevels > 0 ? (
            <div className="sov-save-hint" style={{ marginTop: 22 }}>
              <strong>Ещё {lockedLevels} текста посложнее — в аккаунте</strong>
              <span>
                Без регистрации открыт простой уровень: этого хватит, чтобы понять механику.
                С аккаунтом добавляются средний и сложный тексты, а результаты сохраняются.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReadingTop() {
  return (
    <div className="sov-demo__top">
      <Wordmark compact />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/schet" className="sov-act-ghost" style={{ textDecoration: "none" }}>
          Устный счёт
        </Link>
        <Link to="/uchenik" className="sov-act-ghost" style={{ textDecoration: "none" }}>
          Занятия
        </Link>
      </div>
    </div>
  );
}
