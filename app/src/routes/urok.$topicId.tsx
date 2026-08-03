import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ChildAction, Owl, Stars } from "../components/brand";
import { AutoSpeakToggle, SpeakButton, useAutoSpeak } from "../components/speak";
import { answerTask, finishTopic, me, startTopic } from "../lib/api/app.functions";

export const Route = createFileRoute("/urok/$topicId")({
  head: () => ({ meta: [{ title: "Занятие, Совёнок" }] }),
  // Режим приходит из адреса: с карты можно зайти и сразу в проверочную,
  // не проходя тренировку заново.
  validateSearch: (search: Record<string, unknown>): { mode: "practice" | "check" } => ({
    mode: search.mode === "check" ? "check" : "practice",
  }),
  component: LessonPage,
});

type Session = {
  lessonId: string;
  topic: { id: string; name: string; subjectId: string };
  mode: "practice" | "check";
  tasks: { id: string; kind: string; prompt: string; payload: Record<string, unknown> }[];
};
type Finish = {
  percent: number; passed: boolean; stars: number; mode: "practice" | "check";
  next: { name: string; locked: boolean } | null;
};
type Verdict = { correct: boolean; explanation: string | null; answer: string | null } | null;

const SOFT_LIMIT_SEC = 20 * 60;

function LessonPage() {
  const { topicId } = useParams({ from: "/urok/$topicId" });
  const search = useSearch({ from: "/urok/$topicId" });
  const navigate = useNavigate();

  const [childId, setChildId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"practice" | "check">(search.mode);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [scored, setScored] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Finish | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState(false);

  const startedAt = useRef(Date.now());
  const questionAt = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const account = await me();
        if (!account.user) {
          await navigate({ to: "/vhod" });
          return;
        }
        const id = account.activeChildId ?? account.children[0]?.id ?? null;
        if (!id) {
          await navigate({ to: "/roditel" });
          return;
        }
        const data = await startTopic({ data: { childId: id, topicId, mode: search.mode } });
        if (!alive) return;
        setChildId(id);
        setSession(data);
        setMode(search.mode);
        questionAt.current = Date.now();
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Не удалось открыть тему");
      }
    })();
    return () => {
      alive = false;
    };
  }, [topicId, navigate, search.mode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Вопрос читается вслух сам, если включён режим «читать вслух». Хук стоит
  // до всех ранних возвратов: порядок хуков в React менять нельзя.
  const currentPrompt = !done && session && !verdict ? (session.tasks[index]?.prompt ?? null) : null;
  useAutoSpeak(currentPrompt, [index, mode]);

  if (error) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <h2>Тема пока закрыта</h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>{error}</p>
            <div style={{ marginTop: 24 }}>
              <ChildAction onClick={() => navigate({ to: "/uchenik" })}>Вернуться к темам</ChildAction>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !childId) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <h2>Открываем тему…</h2>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const passed = done.passed;
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <Owl size={64} />
            <h2 style={{ marginTop: 16 }}>
              {done.mode === "check"
                ? passed
                  ? "Проверочная сдана"
                  : "Почти получилось"
                : "Тренировка окончена"}
            </h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Верных ответов: {done.percent} процентов.
              {done.mode === "check" && !passed ? " Для зачёта нужно 70. Попробуй ещё раз." : ""}
            </p>
            {done.mode === "check" ? (
              <div style={{ marginTop: 16 }}>
                <Stars value={done.stars} />
              </div>
            ) : null}
            {/* Раньше после зачёта экран молчал о том, что дальше, и закрытая
                по подписке тема читалась как «прогресс не сохранился». */}
            {done.next ? (
              <div className="sov-save-hint" data-tone={done.next.locked ? "warn" : "ok"}>
                <strong>
                  {done.next.locked
                    ? `Следующая тема «${done.next.name}» открывается с подпиской`
                    : `Открылась следующая тема: «${done.next.name}»`}
                </strong>
                <span>
                  {done.next.locked
                    ? "Покажи этот экран взрослому: подписка включается в кабинете родителя."
                    : "Она уже ждёт на карте занятий."}
                </span>
              </div>
            ) : null}
            <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {done.mode === "practice" ? (
                <ChildAction onClick={() => restart("check")}>Пройти проверочную</ChildAction>
              ) : (
                <ChildAction onClick={() => restart(passed ? "practice" : "check")}>
                  {passed ? "Потренироваться ещё" : "Ещё попытка"}
                </ChildAction>
              )}
              <button className="sov-act-ghost" onClick={() => navigate({ to: "/uchenik" })}>
                К списку тем
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const task = session.tasks[index];
  const options = ((task.payload as { options?: string[] }).options ?? []) as string[];
  const overtime = elapsed > SOFT_LIMIT_SEC;
  // Совёнок реагирует на ответ: радуется верному и сочувствует неверному.
  const owlMood = verdict ? (verdict.correct ? "happy" : "concerned") : "idle";

  async function restart(nextMode: "practice" | "check") {
    if (!childId) return;
    setPending(true);
    const data = await startTopic({ data: { childId, topicId, mode: nextMode } });
    setSession(data);
    setMode(nextMode);
    setIndex(0);
    setValue("");
    setVerdict(null);
    setCorrectCount(0);
    setScored(new Set());
    setDone(null);
    startedAt.current = Date.now();
    questionAt.current = Date.now();
    setElapsed(0);
    setPending(false);
  }

  async function check(answer: string) {
    if (!childId || verdict) return;
    setPending(true);
    const seconds = Math.min(3600, Math.floor((Date.now() - questionAt.current) / 1000));
    const res = await answerTask({ data: { childId, taskId: task.id, value: answer, seconds } });
    if (res.correct && !scored.has(task.id)) {
      setCorrectCount((n) => n + 1);
      setScored((prev) => new Set(prev).add(task.id));
    }
    setVerdict(res);
    setPending(false);
  }

  async function next() {
    if (!childId) return;
    if (index + 1 < session!.tasks.length) {
      setIndex((i) => i + 1);
      setValue("");
      setVerdict(null);
      questionAt.current = Date.now();
      return;
    }
    setPending(true);
    const result = await finishTopic({
      data: {
        childId,
        lessonId: session!.lessonId,
        topicId,
        mode,
        correct: correctCount,
        total: session!.tasks.length,
        seconds: Math.floor((Date.now() - startedAt.current) / 1000),
      },
    });
    setDone(result);
    setPending(false);
  }

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        {/* Тропа занятия: совёнок идёт от камня к камню, в конце — банка мёда,
            которая наполняется по числу верных ответов. */}
        <div className="sov-track">
          <div className="sov-track__line" aria-hidden="true" />
          <div className="sov-track__stones" aria-hidden="true">
            {session.tasks.map((t, i) => (
              <span
                key={t.id}
                className="sov-track__stone"
                data-state={i < index ? "past" : i === index ? "now" : "next"}
              />
            ))}
          </div>
          <div
            className="sov-track__walker"
            style={{ left: `${(index / Math.max(1, session.tasks.length - 1)) * 100}%` }}
          >
            <Owl size={54} stage={4} mood={owlMood} animated={!verdict} />
          </div>
          <div className="sov-track__jar" title={`${correctCount} верных`}>
            <span className="sov-track__jar-fill" style={{ height: `${(correctCount / session.tasks.length) * 100}%` }} />
            <span className="sov-track__jar-count">{correctCount}</span>
          </div>
        </div>

        <div className="sov-card">
          <div className="sov-card__head">
            <p className="sov-mono" style={{ color: "var(--sov-ink-soft)" }}>
              {session.topic.name} · {mode === "check" ? "проверочная работа" : "тренировка"} ·{" "}
              {index + 1} из {session.tasks.length}
            </p>
            <AutoSpeakToggle />
          </div>
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
                  data-state={
                    verdict && value === option ? (verdict.correct ? "right" : "wrong") : undefined
                  }
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
                {!verdict.correct ? (
                  <SpeakButton
                    compact
                    label="Прочитать разбор"
                    text={`Правильный ответ: ${verdict.answer}. ${verdict.explanation ?? ""}`}
                  />
                ) : null}
              </div>
              <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ChildAction onClick={next} disabled={pending}>
                  {index + 1 < session.tasks.length ? "Дальше" : "Завершить"}
                </ChildAction>
                {!verdict.correct ? (
                  <button
                    className="sov-act-ghost"
                    onClick={() => {
                      setVerdict(null);
                      setValue("");
                      questionAt.current = Date.now();
                    }}
                  >
                    Попробовать снова
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {overtime ? (
          <div className="sov-timeup">
            Ты занимаешься уже 20 минут. Это хорошее время, чтобы отдохнуть и размяться. Задания
            никуда не денутся.
          </div>
        ) : null}
      </div>
    </div>
  );
}
