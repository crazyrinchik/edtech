import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChildAction, Owl, Stars } from "../components/brand";
import { PASS_PERCENT, Ring, Stones, StonesLegend, type StoneState } from "../components/figures";
import { AutoSpeakToggle, SpeakButton, useAutoSpeak } from "../components/speak";
import { answerTask, finishTopic, me, startTopic } from "../lib/api/app.functions";
import { closedHead } from "../lib/seo";

export const Route = createFileRoute("/urok/$topicId")({
  head: () => closedHead("Занятие, Совёнок"),
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
  // Что уже отвечено на каждом шаге. Нужно, чтобы можно было вернуться
  // назад и увидеть свой ответ с разбором, а не пустой экран: ребёнок
  // возвращается именно затем, чтобы перечитать объяснение.
  const [history, setHistory] = useState<Record<number, { value: string; verdict: Verdict }>>({});
  const [done, setDone] = useState<Finish | null>(null);
  // Какой камешек открыт на экране итога. Раньше перечитать разбор можно
  // было только шагом назад по одному вопросу, и после конца работы —
  // никак.
  const [review, setReview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState(false);

  const startedAt = useRef(Date.now());
  const questionAt = useRef(Date.now());
  const answerRef = useRef<HTMLInputElement | null>(null);

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

  // Курсор сам встаёт в поле ответа на каждом задании. Одного autoFocus мало:
  // он срабатывает лишь при первом появлении поля, а дальше React переиспользует
  // тот же элемент — и после «Дальше» ребёнку приходилось тыкать в него мышкой.
  // Хук стоит до ранних возвратов: порядок хуков в React менять нельзя.
  useEffect(() => {
    if (done || verdict) return;
    answerRef.current?.focus();
  }, [index, mode, verdict, done]);

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
    // Камешки по числу заданий: кольцо отвечает «сколько», камешки —
    // «на чём именно». Раньше это была одна строка «Верных ответов: N
    // процентов», из которой ребёнок не мог узнать, где ошибся.
    const stones: { state: StoneState; label: string }[] = session.tasks.map((_, i) => ({
      state: history[i]?.verdict ? (history[i].verdict!.correct ? "right" : "wrong") : "next",
      label: String(i + 1),
    }));
    const rightCount = stones.filter((s) => s.state === "right").length;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const opened = review !== null ? history[review] : null;

    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <div className="sov-result">
              <Ring
                value={done.percent}
                size={170}
                threshold={done.mode === "check" ? PASS_PERCENT : undefined}
                tone={done.mode === "check" && !passed ? "warn" : undefined}
                caption="верных"
                label={`${done.percent} процентов верных ответов`}
              />

              <div>
                <div className="sov-result__title">
                  <Owl size={52} mood={passed ? "happy" : "concerned"} />
                  <h2>
                    {done.mode === "check" ? (passed ? "Проверочная сдана" : "Почти получилось") : "Тренировка окончена"}
                  </h2>
                </div>
                <div className="sov-result__chips">
                  {done.mode === "check" ? <Stars value={done.stars} /> : null}
                  {done.mode === "check" && done.stars > 0 ? (
                    <span className="sov-quest__count">+{done.stars} к звёздам</span>
                  ) : null}
                  <span className="sov-quest__count">{minutes} мин</span>
                  {done.mode === "check" && !passed ? (
                    <span className="sov-quest__count">для зачёта нужно {PASS_PERCENT}%</span>
                  ) : null}
                </div>

                <div style={{ marginTop: 20 }}>
                  <div className="sov-panel__head">
                    <span className="sov-side__cap">Задания</span>
                    <span className="sov-panel__note">
                      {rightCount} из {session.tasks.length}
                    </span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Stones items={stones} onPick={(i) => setReview(review === i ? null : i)} />
                  </div>
                  <StonesLegend hint="нажми, чтобы перечитать разбор" />
                </div>

                {opened?.verdict ? (
                  <div className="sov-feedback" data-kind={opened.verdict.correct ? "right" : "wrong"}>
                    <div>
                      <strong>Задание {(review ?? 0) + 1}</strong>
                      {opened.verdict.explanation ?? (opened.verdict.correct ? "Верно." : "Подумай ещё раз.")}
                      {!opened.verdict.correct && opened.value ? (
                        <div className="sov-mono" style={{ marginTop: 6 }}>Твой ответ: {opened.value}</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Раньше после зачёта экран молчал о том, что дальше, и закрытая
                  по подписке тема читалась как «прогресс не сохранился». */}
              <div className="sov-result__next">
                {done.next ? (
                  <div className="sov-save-hint" data-tone={done.next.locked ? "warn" : "ok"} style={{ marginTop: 0 }}>
                    <strong>
                      {done.next.locked
                        ? `«${done.next.name}» открывается с подпиской`
                        : `Открылась тема «${done.next.name}»`}
                    </strong>
                    {done.next.locked ? (
                      <span>Покажи этот экран взрослому: подписка включается в кабинете родителя.</span>
                    ) : null}
                  </div>
                ) : null}
                {done.mode === "practice" ? (
                  <ChildAction onClick={() => restart("check")}>Пройти проверочную</ChildAction>
                ) : (
                  <ChildAction onClick={() => restart(passed ? "practice" : "check")}>
                    {passed ? "Потренироваться ещё" : "Ещё попытка"}
                  </ChildAction>
                )}
                <button className="sov-act-ghost" onClick={() => navigate({ to: "/uchenik" })}>
                  К карте занятий
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const task = session.tasks[index];
  const options = ((task.payload as { options?: string[] }).options ?? []) as string[];
  const left = ((task.payload as { left?: string[] }).left ?? []) as string[];
  const right = ((task.payload as { right?: string[] }).right ?? []) as string[];
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
    setHistory((prev) => ({ ...prev, [index]: { value: answer, verdict: res } }));
    setPending(false);
  }

  /**
   * Шаг назад. Прогресс не теряется: ответы уже записаны по одному, а
   * счётчик верных считает уникальные задания (scored), поэтому повторный
   * проход по пройденному ничего не удваивает и не обнуляет.
   */
  function back() {
    if (index === 0) return;
    const target = index - 1;
    const past = history[target];
    setIndex(target);
    setValue(past?.value ?? "");
    setVerdict(past?.verdict ?? null);
    questionAt.current = Date.now();
  }

  /**
   * Выход посреди занятия. Ответы уже записаны каждый по отдельности, а вот
   * строка занятия закрывается только в конце — без этого она осталась бы
   * пустой, и в истории у взрослого висело бы «0 из 0».
   *
   * Знаменатель при этом остаётся полным, из базы: если считать процент
   * только от отвеченного, ребёнок закрывал бы домашку одним верным
   * ответом и выходом.
   */
  async function leave() {
    if (!childId || !session) {
      await navigate({ to: "/uchenik" });
      return;
    }
    setPending(true);
    try {
      await finishTopic({
        data: {
          childId,
          lessonId: session.lessonId,
          topicId,
          mode,
          correct: correctCount,
          total: session.tasks.length,
          seconds: Math.min(7200, Math.floor((Date.now() - startedAt.current) / 1000)),
        },
      });
    } catch {
      // Выйти важнее, чем записать: ответы уже сохранены по одному.
    }
    await navigate({ to: "/uchenik" });
  }

  async function next() {
    if (!childId) return;
    if (index + 1 < session!.tasks.length) {
      const target = index + 1;
      const past = history[target];
      setIndex(target);
      setValue(past?.value ?? "");
      setVerdict(past?.verdict ?? null);
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

  // Камешки для боковой панели: тропа показывает, где ребёнок сейчас,
  // камешки — что вышло на пройденных вопросах. Это разные вопросы, и
  // тропа на второй не отвечает.
  const playStones: { state: StoneState; label: string }[] = session.tasks.map((_, i) => ({
    state:
      i === index ? "now" : history[i]?.verdict ? (history[i].verdict!.correct ? "right" : "wrong") : "next",
    label: String(i + 1),
  }));
  const answered = playStones.filter((s) => s.state === "right" || s.state === "wrong").length;
  const runningPercent = answered ? Math.round((correctCount / answered) * 100) : 0;

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        <div className="sov-play__grid">
        <div>
        {/* Тропа занятия: совёнок идёт от камня к камню, в конце — банка мёда,
            которая наполняется по числу верных ответов. Раньше она тянулась
            во всю страницу и разносила камни на метр друг от друга; теперь
            стоит в колонке вопроса и снова читается как тропа. */}
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

          <div className="sov-steps">
            {/* Шаг назад: перечитать разбор предыдущего вопроса. Раньше из
                задания можно было только выйти целиком. */}
            <button type="button" className="sov-leave" disabled={index === 0} onClick={back}>
              ← Предыдущий вопрос
            </button>
            <button
              type="button"
              className="sov-leave"
              disabled={pending}
              onClick={() => void leave()}
            >
              Выйти и сохранить
            </button>
          </div>

          {task.kind === "match" ? (
            <MatchTask
              taskId={task.id}
              left={left}
              right={right}
              locked={pending || !!verdict}
              verdict={verdict}
              onReady={(answer) => {
                setValue(answer);
                void check(answer);
              }}
            />
          ) : task.kind === "choice" ? (
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

        {/* Панель занятия. Контент занял всю ширину, и справа от вопроса
            осталось пустое поле; сюда переехало то, что раньше нигде не
            показывалось: что вышло на пройденных вопросах и сколько
            верных набрано к этой минуте. */}
        <aside className="sov-side">
          <div className="sov-side__block">
            <span className="sov-side__cap">Пройдено</span>
            <Stones items={playStones} small />
            <StonesLegend />
          </div>

          <div className="sov-side__block">
            <div className="sov-side__row">
              <Ring
                value={runningPercent}
                size={92}
                threshold={mode === "check" ? PASS_PERCENT : undefined}
                label={`${runningPercent} процентов верных к этой минуте`}
              >
                {`${correctCount}/${answered || 0}`}
              </Ring>
              <div>
                <span className="sov-side__cap">Верных пока</span>
                <p className="sov-side__big">{answered ? `${runningPercent}%` : "—"}</p>
                {mode === "check" ? (
                  <p className="sov-panel__note">до зачёта нужно {PASS_PERCENT}%</p>
                ) : (
                  <p className="sov-panel__note">это тренировка, звёзды не считаются</p>
                )}
              </div>
            </div>
          </div>

          <div className="sov-side__block">
            <div className="sov-panel__head">
              <span className="sov-side__cap">Время</span>
              <span className="sov-mono">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} из 20:00
              </span>
            </div>
            <span className="sov-bar sov-bar--plain">
              <i style={{ width: `${Math.min(100, (elapsed / SOFT_LIMIT_SEC) * 100)}%` }} />
            </span>
          </div>
        </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * Сопоставление: «соедини число и количество».
 *
 * Раньше такие задания проваливались в ветку ввода ответа — на экране не
 * было ни пар, ни вариантов, только пустое поле. Здесь пары показываются
 * столбиком, а варианты справа перемешаны: в payload они лежат в том же
 * порядке, что и левая колонка, и без перемешивания ответ был бы виден.
 *
 * Взаимодействие сделано последовательным, а не «перетащи к нужному»:
 * подсвечена текущая строка, ребёнок жмёт вариант — он встаёт на место и
 * подсветка уходит к следующей. Это работает пальцем на телефоне и не
 * требует объяснять, что куда тянуть.
 */
function MatchTask({
  taskId,
  left,
  right,
  locked,
  verdict,
  onReady,
}: {
  taskId: string;
  left: string[];
  right: string[];
  locked: boolean;
  verdict: { correct: boolean } | null;
  onReady: (answer: string) => void;
}) {
  const [chosen, setChosen] = useState<(string | null)[]>(() => left.map(() => null));

  // Порядок вариантов фиксируется на задание: пересборка компонента не
  // должна перетасовывать кнопки под пальцем.
  const shuffled = useMemo(() => {
    // Ключ считается от самого значения, а не от его позиции: на трёх
    // вариантах позиционная формула слишком часто возвращала исходный
    // порядок, то есть готовый ответ.
    const hash = (str: string) => {
      let h = 2166136261;
      for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };
    return right
      .map((value) => ({ value, key: hash(`${taskId}|${value}`) }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.value);
  }, [taskId, right]);

  useEffect(() => {
    setChosen(left.map(() => null));
  }, [taskId, left]);

  const nextEmpty = chosen.findIndex((c) => c === null);
  const used = new Set(chosen.filter(Boolean) as string[]);

  function pick(value: string) {
    if (locked || nextEmpty === -1) return;
    const next = [...chosen];
    next[nextEmpty] = value;
    setChosen(next);
    if (!next.includes(null)) onReady(next.join("|"));
  }

  return (
    <div className="sov-match">
      <ol className="sov-match__rows">
        {left.map((item, i) => (
          <li
            key={item}
            className="sov-match__row"
            data-active={i === nextEmpty && !locked}
            data-filled={chosen[i] !== null}
            data-state={verdict ? (verdict.correct ? "right" : "wrong") : undefined}
          >
            <span className="sov-match__left">{item}</span>
            <span className="sov-match__dots" aria-hidden="true" />
            <span className="sov-match__right">{chosen[i] ?? "?"}</span>
          </li>
        ))}
      </ol>

      <div className="sov-match__pool">
        {shuffled.map((value) => (
          <button
            key={value}
            type="button"
            className="sov-match__chip"
            disabled={locked || used.has(value)}
            onClick={() => pick(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {chosen.some((c) => c !== null) && !verdict ? (
        <button
          type="button"
          className="sov-act-ghost"
          onClick={() => setChosen(left.map(() => null))}
        >
          Начать заново
        </button>
      ) : null}
    </div>
  );
}
