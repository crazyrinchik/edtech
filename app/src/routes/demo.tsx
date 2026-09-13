import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ChildAction, Owl, Wordmark } from "../components/brand";
import { AutoSpeakToggle, SpeakButton, useAutoSpeak } from "../components/speak";
import { AdultBridge, SAVE_NO_ACCOUNT } from "../components/trainers";
import { demoAnswer, demoFinished, demoLesson } from "../lib/api/app.functions";
import { reachGoal } from "../lib/metrika";
import { pageHead } from "../lib/seo";

export const Route = createFileRoute("/demo")({
  head: () => pageHead("/demo"),
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
  const [tasks, setTasks] = useState<DemoTask[] | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [correct, setCorrect] = useState(0);
  const [scored, setScored] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const answerRef = useRef<HTMLInputElement | null>(null);

  // Курсор сам встаёт в поле ответа на каждом задании: autoFocus срабатывает
  // лишь при первом появлении поля, дальше React переиспользует тот же элемент.
  // В нулевом уроке это первое, что видит человек — лишний клик тут дороже всего.
  useEffect(() => {
    if (done || verdict) return;
    answerRef.current?.focus();
  }, [index, verdict, done]);

  /* Упавший запрос больше не притворяется пустым уроком: до этой правки
     `.catch(() => setTasks([]))` отдавал ноль заданий, и нулевой урок —
     первое, что видит пришедший с витрины, — открывался пустой карточкой
     без единого слова о том, что случилось. */
  const [loadError, setLoadError] = useState(false);

  async function loadLesson() {
    setLoadError(false);
    setTasks(null);
    try {
      const data = await demoLesson();
      setTasks(data.tasks as DemoTask[]);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void loadLesson();
  }, []);

  const task = tasks?.[index] ?? null;
  useAutoSpeak(task && !verdict ? task.prompt : null, [index]);

  if (loadError) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card sov-state">
            <Owl size={84} mood="concerned" />
            <h2>Урок не загрузился</h2>
            <p>
              Это сбой на нашей стороне, а не у вас. Нажмите ещё раз — обычно со второй попытки
              открывается.
            </p>
            <ChildAction onClick={() => void loadLesson()}>Попробовать ещё раз</ChildAction>
          </div>
        </div>
      </div>
    );
  }

  if (!tasks) {
    /* Скелетон повторяет форму задания: полоса прогресса, вопрос,
       три варианта ответа. */
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-play__bar" style={{ marginTop: 14 }}>
            <Owl size={40} />
            <span className="sov-skel" style={{ flex: 1, height: 10, borderRadius: 200 }} />
          </div>
          <div className="sov-card" aria-busy="true" aria-label="Готовим задания">
            <span className="sov-skel" style={{ width: "34%", height: 12 }} />
            <span className="sov-skel" style={{ width: "70%", height: 26, marginTop: 16 }} />
            <div className="sov-skel-stack" style={{ marginTop: 24 }}>
              <span className="sov-skel" style={{ height: 68 }} />
              <span className="sov-skel" style={{ height: 68 }} />
              <span className="sov-skel" style={{ height: 68 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card sov-state">
            <Owl size={84} />
            <h2>Урок пока пуст</h2>
            <p>
              Заданий в нулевом уроке ещё нет. Загляните в тренажёры — они открыты без аккаунта.
            </p>
            <Link to="/schet" className="sov-act-child" style={{ textDecoration: "none" }}>
              К устному счёту
            </Link>
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
              Верных ответов: {correct} из {tasks.length}. Это была короткая проба — в занятиях темы
              идут по порядку, а ошибки разбираются так же, как здесь.
            </p>
            {/* Плашка говорит, что случилось, и молчит о том, что с этим
                делать: предложение стоит в мостике для взрослого ниже.
                Раньше здесь был второй такой же уговор, да ещё и обещавший
                регистрацию за минуту, — а посадочные и мостик обещают три.
                Одно и то же время, названное на сайте двумя разными
                числами, дороже любой экономии в тексте. */}
            <div className="sov-save-hint">
              <strong>Результат не сохранён</strong>
              <span>{SAVE_NO_ACCOUNT}</span>
            </div>
            {/* Детская кнопка теперь про то, что делает ребёнок, — пройти
                ещё раз. Здесь стояло «Сохранить прогресс»: самая заметная
                кнопка на экране ребёнка звала его в форму регистрации, где
                он и почты-то своей не имеет. Регистрация переехала в мостик
                для взрослого ниже, вместе с объяснением, зачем она. */}
            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ChildAction
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
              </ChildAction>
            </div>

            <AdultBridge />
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
    // Цель для Директа: нулевой урок пройден целиком. Открывших /demo видно
    // и по хитам; дошедшие до экрана результата видны только здесь. Отметка
    // стоит до запроса demoFinished: она уходит сразу, а ответа сервера
    // человек, закрывший вкладку на последнем задании, дожидаться не обязан.
    reachGoal("demo-done");
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
                ref={answerRef}
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
