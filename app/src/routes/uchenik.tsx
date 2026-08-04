import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  ChildAction,
  ChildAvatar,
  currentOwlItem,
  Owl,
  OWL_UNLOCKS,
  owlStage,
  Stars,
  Wordmark,
} from "../components/brand";
import { AutoSpeakToggle, SpeakButton } from "../components/speak";
import { getDiagnostic, getSkillMap, me, submitDiagnostic } from "../lib/api/app.functions";
import { childAssignments } from "../lib/api/tutor.functions";

/** Уровень считается на сервере как звёзды/5 + 1 — держим шаг тем же. */
const STARS_PER_LEVEL = 5;

/** «к четвергу» ребёнку понятнее даты: он живёт неделей, а не числами. */
function dueLabel(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);
  if (days < 0) return "срок прошёл";
  if (days === 0) return "на сегодня";
  if (days === 1) return "на завтра";
  return `осталось ${days} дн.`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const Route = createFileRoute("/uchenik")({
  head: () => ({ meta: [{ title: "Занятия, Совёнок" }] }),
  component: PupilPage,
});

type TopicItem = {
  id: string; name: string; summary: string | null; stars: number; bestPercent: number;
  status: string; locked: boolean; available: boolean;
  reason: string | null; needsTopic: string;
};
type MapData = {
  child: { id: string; name: string; avatar: string; grade: number; soundOn: boolean; dailyLimitMin: number; diagnosticsDone: boolean };
  subjects: { id: string; name: string; topics: TopicItem[] }[];
  totalStars: number; level: number; paid: boolean; hasTutor: boolean;
};
type DiagData = {
  childName: string; grade: number;
  blocks: { subjectId: string; subjectName: string; tasks: { id: string; kind: string; prompt: string; payload: Record<string, unknown>; explanation: string }[] }[];
};
type Homework = Awaited<ReturnType<typeof childAssignments>>["assignments"];

type DiagResult = { subjectId: string; subjectName: string; correct: number; total: number; percent: number; level: string }[];

function PupilPage() {
  const navigate = useNavigate();
  const [childId, setChildId] = useState<string | null>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [manyChildren, setManyChildren] = useState(false);
  const [adultRole, setAdultRole] = useState<string>("parent");
  const [homework, setHomework] = useState<Homework>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const account = await me();
        if (!account.user) {
          await navigate({ to: "/vhod" });
          return;
        }
        // Детей несколько, а кто сейчас за столом — неизвестно: спрашиваем
        // на отдельном экране, аватарами, а не выпадающим списком.
        if (account.children.length > 1 && !account.activeChildId) {
          await navigate({ to: "/kto" });
          return;
        }
        const first = account.activeChildId ?? account.children[0]?.id ?? null;
        if (!first) {
          await navigate({ to: "/roditel" });
          return;
        }
        if (alive) {
          setManyChildren(account.children.length > 1);
          setAdultRole(account.user.role);
        }
        const map = await getSkillMap({ data: { childId: first } });
        if (!alive) return;
        setChildId(first);
        setData(map);
        // Домашка грузится отдельно: без репетитора её просто нет, и
        // задерживать из-за неё карту тем незачем.
        childAssignments({ data: { childId: first } })
          .then((hw) => alive && setHomework(hw.assignments))
          .catch(() => undefined);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Не удалось загрузить занятия");
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="sov sov-kid">
        <div className="sov-shell" style={{ paddingTop: 40 }}>
          <div className="sov-alert">{error}</div>
        </div>
      </div>
    );
  }

  if (!data || !childId) {
    return (
      <div className="sov sov-kid">
        <div className="sov-shell" style={{ paddingTop: 60 }}>
          <div className="sov-node" style={{ maxWidth: 420 }}>
            <div className="sov-node__badge">…</div>
            <div className="sov-node__body">
              <strong>Готовим задания</strong>
              <span>Пара секунд</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data.child.diagnosticsDone) {
    return <Diagnostic childId={childId} onDone={() => location.reload()} />;
  }

  // Темы из активной домашки помечаются прямо на тропе: ребёнок, который
  // пролистал задание и пошёл выбирать сам, всё равно видит, что задано.
  const assignedTopics = new Set(
    homework.flatMap((hw) => hw.items.filter((i) => i.kind === "topic").map((i) => i.refId)),
  );

  const stage = owlStage(data.level);
  const item = currentOwlItem(data.level);
  const starsInLevel = data.totalStars % STARS_PER_LEVEL;
  const toNextLevel = stage >= 5 ? 0 : STARS_PER_LEVEL - starsInLevel;

  return (
    <div className="sov sov-kid">
      <div className="sov-shell">
        <div className="sov-header" style={{ padding: "18px 0" }}>
          <Wordmark compact />
          <div className="sov-header__right">
            <AutoSpeakToggle />
            {manyChildren ? (
              <Link to="/kto" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                <ChildAvatar avatar={data.child.avatar} size={22} /> Сменить
              </Link>
            ) : null}
            {/* Взрослый рядом с ребёнком теперь не обязательно родитель:
                репетитору нужен список учеников, а не родительский кабинет. */}
            {adultRole === "tutor" ? (
              <Link to="/repetitor" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                К ученикам
              </Link>
            ) : (
              <Link to="/roditel" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                Кабинет родителя
              </Link>
            )}
          </div>
        </div>

        {/* Приветствие ужато в строку, и синей заливки на нём больше нет.
            Раньше это была самая заметная плашка экрана, хотя отвечала на
            вопрос «как меня зовут». Цвет действия отдан домашке — теперь
            ребёнок первым делом видит, что задал педагог. */}
        <div className="sov-hollow">
          <div className="sov-hollow__owl">
            <Owl size={52} stage={stage} item={item} mood="happy" animated />
            <span className="sov-hollow__badge">{data.level}</span>
          </div>

          <div className="sov-hollow__info">
            <strong className="sov-hollow__hi">Привет, {data.child.name}</strong>
            <span className="sov-hollow__grade">{data.child.grade} класс</span>
          </div>

          <div className="sov-hollow__xp">
            <div className="sov-xp">
              <div className="sov-xp__row">
                <span>Уровень {data.level}</span>
                {/* Эмодзи-звезда была здесь единственным жёлтым пятном в
                    интерфейсе — счёт словом держит экран одноцветным. */}
                <span className="sov-mono">
                  {starsInLevel} / {STARS_PER_LEVEL} звёзд
                </span>
              </div>
              <div className="sov-xp__track">
                <div className="sov-xp__fill" style={{ width: `${(starsInLevel / STARS_PER_LEVEL) * 100}%` }} />
              </div>
              <span className="sov-xp__hint">
                {toNextLevel === 0
                  ? "Совёнок вырос до предела — ты молодец!"
                  : `Ещё ${toNextLevel} ${plural(toNextLevel, "звезда", "звезды", "звёзд")} — и совёнок подрастёт`}
              </span>
            </div>
          </div>
        </div>

        {/* Домашка стоит над всем остальным: это то, о чём договорились с
            педагогом, и искать её среди тем ребёнок не должен. */}
        {homework.length === 0 ? (
          <p className="sov-kid__free">
            {data.hasTutor
              ? "Задания сейчас нет. Можно потренироваться в устном счёте или скорочтении."
              : "Задания от педагога сейчас нет — выбирай тему сам или загляни в тренажёры."}
          </p>
        ) : null}

        {homework.map((hw) => (
          <section key={hw.id} className="sov-homework">
            <div className="sov-homework__head">
              <strong>{hw.title}</strong>
              <span className="sov-homework__due">
                {hw.dueAt ? dueLabel(hw.dueAt) : "без срока"}
              </span>
            </div>
            {/* Счёт сделанного словами: «1 из 3» ребёнок читает быстрее,
                чем считает галочки в списке. */}
            <span className="sov-homework__count">
              Сделано {hw.doneCount} из {hw.total}
            </span>
            <div className="sov-homework__items">
              {hw.items.map((item) =>
                item.kind === "topic" ? (
                  <div key={item.id} className="sov-homework__row">
                    <Link
                      to="/urok/$topicId"
                      params={{ topicId: item.refId }}
                      search={{ mode: "practice" }}
                      className="sov-homework__item"
                      data-done={item.done}
                    >
                      <span className="sov-homework__mark">{item.done ? "✓" : "•"}</span>
                      {item.name}
                    </Link>
                    {/* Тему засчитывает только проверочная. Пока у ученика была
                        карта тем, вход в неё жил там; без карты второй двери
                        не остаётся, поэтому она стоит прямо в задании. */}
                    <Link
                      to="/urok/$topicId"
                      params={{ topicId: item.refId }}
                      search={{ mode: "check" }}
                      className="sov-homework__check"
                    >
                      Проверочная
                    </Link>
                  </div>
                ) : (
                  <Link
                    key={item.id}
                    to={item.refId === "chtenie" ? "/chtenie" : "/schet"}
                    className="sov-homework__item"
                    data-done={item.done}
                  >
                    <span className="sov-homework__mark">{item.done ? "✓" : "•"}</span>
                    {item.name}
                  </Link>
                ),
              )}
            </div>
            {hw.comment ? <p className="sov-homework__comment">{hw.comment}</p> : null}
          </section>
        ))}

        {/* Тренажёры стоят до тем: в них заходят «на пять минут», и искать их
            в конце длинной карты неудобно. */}
        <div className="sov-trainers">
          <Link to="/schet" className="sov-trainer">
            <span className="sov-trainer__icon" aria-hidden="true">🧮</span>
            <span>
              <strong>Устный счёт</strong>
              <em>Примеры на время, скорость и точность</em>
            </span>
          </Link>
          <Link to="/chtenie" className="sov-trainer">
            <span className="sov-trainer__icon" aria-hidden="true">📖</span>
            <span>
              <strong>Скорочтение</strong>
              <em>Слова по одному и вопросы по тексту</em>
            </span>
          </Link>
        </div>

        {/* Карта тем видна только ученику без педагога. Когда занятия ведёт
            репетитор, программу выбирает он: свободная карта рядом с
            заданием предлагала ребёнку заняться чем-то другим, а темы
            вперёд плана ломали последовательность, которую держит педагог. */}
        {data.hasTutor
          ? null
          : data.subjects.map((subject) => {
          const passed = subject.topics.filter((t) => t.status === "completed").length;
          return (
            <section key={subject.id} className="sov-quest">
              <header className="sov-quest__head">
                <h2>{subject.name}</h2>
                <span className="sov-quest__count">
                  {passed} из {subject.topics.length}
                </span>
              </header>

              <ol className="sov-trail">
                {subject.topics.map((topic, index) => {
                  const open = topic.available || topic.status !== "locked";
                  const done = topic.status === "completed";
                  const started = topic.status === "in_progress";
                  const state = done ? "done" : topic.locked ? "locked" : open ? "current" : "wait";
                  // Почему тема закрыта, ребёнку важнее самого замка: подписку
                  // открывает взрослый, а предыдущую тему он проходит сам.
                  const note = topic.locked
                    ? "Откроется с подпиской"
                    : done
                      ? `Пройдено на ${topic.bestPercent}%`
                      : topic.reason === "sequence"
                        ? `Сначала пройди «${topic.needsTopic}»`
                        : started
                          ? `Начато, лучший результат ${topic.bestPercent}%`
                          : topic.summary;
                  const assigned = assignedTopics.has(topic.id);
                  const body = (
                    <>
                      <span className="sov-level__num">{done ? "✓" : index + 1}</span>
                      <span className="sov-level__text">
                        <strong>
                          {topic.name}
                          {assigned ? <em className="sov-level__tag">задано</em> : null}
                        </strong>
                        <span>{note}</span>
                      </span>
                      <Stars value={topic.stars} />
                    </>
                  );
                  return (
                    <li
                      key={topic.id}
                      className="sov-trail__item"
                      data-side={index % 2 === 0 ? "left" : "right"}
                      data-state={state}
                    >
                      <span className="sov-trail__dot" aria-hidden="true" />
                      {open ? (
                        <Link
                          to="/urok/$topicId"
                          params={{ topicId: topic.id }}
                          search={{ mode: "practice" }}
                          className="sov-level"
                          data-state={state}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="sov-level" data-state={state}>
                          {body}
                        </div>
                      )}
                      {/* Тему засчитывает только проверочная работа, поэтому
                          вход в неё есть прямо с карты: раньше до неё можно
                          было добраться лишь дойдя до конца тренировки. */}
                      {open ? (
                        <Link
                          to="/urok/$topicId"
                          params={{ topicId: topic.id }}
                          search={{ mode: "check" }}
                          className="sov-level__check"
                        >
                          {done ? "Пройти проверочную ещё раз" : "Сразу проверочная работа"}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              </section>
            );
          })}

        {/* Полка наград уехала под темы. Пять сов занимали первый экран
            целиком, хотя отвечают на вопрос «что будет потом», а не «что
            делать сейчас». */}
        <section className="sov-quest">
          <header className="sov-quest__head">
            <h2>Награды</h2>
            <span className="sov-quest__count">уровень {data.level}</span>
          </header>
          <div className="sov-shelf">
            {OWL_UNLOCKS.map((u) => {
              const open = data.level >= u.level;
              return (
                <div key={u.level} className="sov-shelf__item" data-open={open}>
                  <Owl size={44} stage={u.level} item={u.item} mood={open ? "happy" : "sleepy"} />
                  <strong>{u.title}</strong>
                  <span>{open ? u.note : `Уровень ${u.level}`}</span>
                </div>
              );
            })}
          </div>
        </section>

        {!data.paid && !data.hasTutor ? (
          <div className="sov-panel" style={{ marginTop: 40, marginBottom: 40 }}>
            <h3>Остальные темы пока закрыты</h3>
            <p style={{ marginTop: 8, color: "var(--sov-ink-soft)" }}>
              Их откроет твой взрослый — педагог или родитель. Пока в каждом предмете открыта
              первая тема, а тренажёры работают целиком.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Diagnostic({ childId, onDone }: { childId: string; onDone: () => void }) {
  const [diag, setDiag] = useState<DiagData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DiagResult | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getDiagnostic({ data: { childId } }).then(setDiag).catch(() => setDiag(null));
  }, [childId]);

  if (!diag) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <p>Готовим короткий тест…</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <Owl size={56} />
            <h2 style={{ marginTop: 16 }}>Готово, {diag.childName}</h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Мы поняли, с чего начать. Вот твой стартовый уровень.
            </p>
            <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
              {result.map((r) => (
                <div key={r.subjectId} className="sov-save-hint">
                  <strong>{r.subjectName}</strong>
                  <div className="sov-mono" style={{ marginTop: 4 }}>
                    {r.correct} из {r.total} верно, уровень {r.level}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28 }}>
              <ChildAction onClick={onDone}>К занятиям</ChildAction>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = diag.blocks.reduce((n, b) => n + b.tasks.length, 0);
  const filled = Object.keys(answers).length;

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        <div className="sov-play__bar">
          <Owl size={40} />
          <div className="sov-play__track">
            <div className="sov-play__fill" style={{ width: `${(filled / total) * 100}%` }} />
          </div>
        </div>
        <div className="sov-card">
          <h2>Короткий тест, чтобы не начинать со скучного</h2>
          <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
            Если не знаешь ответ, пропусти. Это не оценка. Не читаешь — нажми ушко, вопрос
            прочитают вслух.
          </p>
          {diag.blocks.map((block) => (
            <div key={block.subjectId} style={{ marginTop: 30 }}>
              <h3 style={{ fontSize: "1.2rem" }}>{block.subjectName}</h3>
              {block.tasks.map((task) => (
                <div key={task.id} style={{ marginTop: 18 }}>
                  <div className="sov-ask">
                    <p style={{ fontWeight: 700 }}>{task.prompt}</p>
                    <SpeakButton compact text={task.prompt} />
                  </div>
                  {task.kind === "choice" ? (
                    <div className="sov-chips">
                      {((task.payload as { options?: string[] }).options ?? []).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className="sov-chip"
                          data-active={answers[task.id] === option}
                          onClick={() => setAnswers((prev) => ({ ...prev, [task.id]: option }))}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="sov-field__input"
                      style={{ marginTop: 8, padding: "12px 15px", border: "2px solid var(--sov-line)", borderRadius: 12, fontSize: "1rem", fontWeight: 600, fontFamily: "var(--sov-font)" }}
                      value={answers[task.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      inputMode="text"
                      aria-label={task.prompt}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 32 }}>
            <ChildAction
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const payload = Object.entries(answers).map(([id, value]) => ({ id, value }));
                const res = await submitDiagnostic({ data: { childId, answers: payload } });
                setResult(res.result);
                setPending(false);
              }}
            >
              Показать результат
            </ChildAction>
          </div>
        </div>
      </div>
    </div>
  );
}
