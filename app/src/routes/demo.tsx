import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChildAction, Owl, Wordmark } from "../components/brand";
import { AutoSpeakToggle, SpeakButton, useAutoSpeak } from "../components/speak";
import { demoAnswer, demoFinished, demoLesson } from "../lib/api/app.functions";

export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [{ title: "Нулевой урок, Совёнок" }] }),
  component: DemoPage,
});

type DemoTask = { id: string; kind: string; prompt: string; payload: { options?: string[] } };
type Verdict = { correct: boolean; explanation: string | null; answer: string | null } | null;

/**
 * Нулевой урок: семь заданий без регистрации.
 *
 * Смысл экрана — дать попробовать механику до всякой формы: ребёнок отвечает,
 * ошибку ему объясняют словами, в конце взрослому предлагают сохранить
 * результат. Прогресс никуда не пишется, поэтому здесь нет ни ребёнка, ни
 * темы — только задания и счётчик верных ответов.
 */
function DemoPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<DemoTask[] | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [correct, setCorrect] = useState(0);
  const [scored, setScored] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    demoLesson()
      .then((data) => setTasks(data.tasks as DemoTask[]))
      .catch(() => setTasks([]));
  }, []);

  const task = tasks?.[index] ?? null;
  useAutoSpeak(task && !verdict ? task.prompt : null, [index]);

  if (!tasks) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <h2>Готовим задания…</h2>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <Owl size={64} mood="happy" animated />
            <h2 style={{ marginTop: 16 }}>Нулевой урок пройден</h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Верных ответов: {correct} из {tasks.length}. Это была короткая проба — в занятиях
              темы идут по порядку, а ошибки разбираются так же, как здесь.
            </p>
            <div className="sov-save-hint">
              <strong>Сохранить результат?</strong>
              <span>
                Без аккаунта прогресс не сохраняется. Регистрация занимает минуту: нужны только
                почта взрослого, имя ребёнка и класс.
              </span>
            </div>
            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ChildAction onClick={() => navigate({ to: "/registraciya" })}>
                Сохранить прогресс
              </ChildAction>
              <button
                className="sov-act-ghost"
                onClick={() => {
                  setIndex(0);
                  setValue("");
                  setVerdict(null);
                  setCorrect(0);
                  setScored(new Set());
                  setDone(false);
                }}
              >
                Пройти ещё раз
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <h2>Задания не загрузились</h2>
            <div style={{ marginTop: 20 }}>
              <ChildAction onClick={() => location.reload()}>Обновить</ChildAction>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const options = task.payload.options ?? [];

  async function check(answer: string) {
    if (!task || verdict) return;
    setPending(true);
    const res = await demoAnswer({ data: { taskId: task.id, value: answer } });
    if (res.correct && !scored.has(task.id)) {
      setCorrect((n) => n + 1);
      setScored((prev) => new Set(prev).add(task.id));
    }
    setVerdict(res);
    setPending(false);
  }

  async function next() {
    if (!tasks) return;
    if (index + 1 < tasks.length) {
      setIndex((i) => i + 1);
      setValue("");
      setVerdict(null);
      return;
    }
    await demoFinished({ data: { correct, total: tasks.length } }).catch(() => undefined);
    setDone(true);
  }

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        <div className="sov-demo__top">
          <Wordmark compact />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <AutoSpeakToggle />
            <Link to="/vhod" className="sov-act-ghost" style={{ textDecoration: "none" }}>
              Войти
            </Link>
          </div>
        </div>

        <div className="sov-play__bar" style={{ marginTop: 14 }}>
          <Owl size={40} mood={verdict ? (verdict.correct ? "happy" : "concerned") : "idle"} />
          <div className="sov-play__track">
            <div className="sov-play__fill" style={{ width: `${(index / tasks.length) * 100}%` }} />
          </div>
          <span className="sov-mono">
            {index + 1} из {tasks.length}
          </span>
        </div>

        <div className="sov-card">
          <p className="sov-mono" style={{ color: "var(--sov-ink-soft)" }}>
            Нулевой урок · без регистрации
          </p>
          <div className="sov-ask">
            <h2>{task.prompt}</h2>
            <SpeakButton text={task.prompt} />
          </div>

          {task.kind === "choice" ? (
            <div className="sov-options">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="sov-option"
                  disabled={pending || !!verdict}
                  data-state={verdict && value === option ? (verdict.correct ? "right" : "wrong") : undefined}
                  onClick={() => {
                    setValue(option);
                    void check(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (value.trim()) void check(value);
              }}
            >
              <input
                className="sov-answer-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!!verdict}
                autoFocus
                aria-label="Твой ответ"
              />
              {!verdict ? (
                <div style={{ marginTop: 22 }}>
                  <ChildAction type="submit" disabled={pending || !value.trim()}>
                    Проверить
                  </ChildAction>
                </div>
              ) : null}
            </form>
          )}

          {verdict ? (
            <>
              <div className="sov-feedback" data-kind={verdict.correct ? "right" : "wrong"}>
                <div>
                  <strong>{verdict.correct ? "Верно" : "Пока не так"}</strong>
                  {verdict.correct ? (
                    <span>Идём дальше.</span>
                  ) : (
                    <span>
                      Правильный ответ: {verdict.answer}. {verdict.explanation}
                    </span>
                  )}
                </div>
                <SpeakButton
                  compact
                  label="Прочитать разбор"
                  text={
                    verdict.correct
                      ? "Верно. Идём дальше."
                      : `Правильный ответ: ${verdict.answer}. ${verdict.explanation ?? ""}`
                  }
                />
              </div>
              <div style={{ marginTop: 22 }}>
                <ChildAction onClick={next} disabled={pending}>
                  {index + 1 < tasks.length ? "Дальше" : "Завершить"}
                </ChildAction>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
