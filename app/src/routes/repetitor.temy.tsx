import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { me } from "../lib/api/app.functions";
import { assignTopic, curriculum, topicTasks } from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/temy")({
  head: () => ({ meta: [{ title: "Темы и задания, Совёнок" }] }),
  component: CurriculumPage,
});

type Data = Awaited<ReturnType<typeof curriculum>>;
type Tasks = Awaited<ReturnType<typeof topicTasks>>;

function defaultDue(): string {
  return new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
}

/**
 * Программа целиком: репетитор готовится к занятию и решает, что давать
 * дальше, а для этого нужно видеть все темы обоих классов и то, из чего
 * они состоят. Срез под конкретного ученика для этого не годится.
 */
function CurriculumPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [assignTo, setAssignTo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const account = await me();
      if (!account.user) {
        await navigate({ to: "/vhod" });
        return;
      }
      if (account.user.role !== "tutor" && account.user.role !== "admin") {
        await navigate({ to: "/roditel" });
        return;
      }
      try {
        setData(await curriculum());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить программу");
      }
    })();
  }, [navigate]);

  async function toggleTopic(id: string) {
    if (openTopic === id) {
      setOpenTopic(null);
      setTasks(null);
      return;
    }
    setOpenTopic(id);
    setTasks(null);
    setError(null);
    try {
      setTasks(await topicTasks({ data: { topicId: id } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть задания");
    }
  }

  if (!data) {
    return (
      <div className="sov">
        <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />
        <main className="sov-narrow" style={{ paddingTop: 40 }}>
          {error ? <div className="sov-alert">{error}</div> : <p className="sov-mono">Открываем программу…</p>}
        </main>
      </div>
    );
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />

      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <h1 style={{ fontSize: "2.2rem", marginTop: 10 }}>Темы и задания</h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500, maxWidth: "60ch" }}>
          Вся программа 1 и 2 класса. Можно посмотреть, из чего состоит тема, и задать её сразу
          нескольким ученикам — класс ученика при этом ничего не ограничивает.
        </p>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        {!data.paid ? (
          <div className="sov-save-hint" style={{ marginTop: 22 }}>
            <strong>Задания открывает подписка</strong>
            <span>
              Названия тем видны всегда, а содержимое — на бесплатных темах. С подпиской
              открываются задания всех тем, и их можно задавать любому ученику.
            </span>
          </div>
        ) : null}

        {data.subjects.map((subject) => (
          <section key={subject.id} className="sov-quest">
            <header className="sov-quest__head">
              <h2>{subject.name}</h2>
              <span className="sov-quest__count">
                {data.topics.filter((t) => t.subjectId === subject.id).length} тем
              </span>
            </header>

            <div className="sov-prog">
              {data.topics
                .filter((t) => t.subjectId === subject.id)
                .map((topic) => (
                  <article key={topic.id} className="sov-prog__item" data-locked={topic.locked}>
                    <div className="sov-prog__head">
                      <div className="sov-prog__title">
                        <strong>{topic.name}</strong>
                        <span className="sov-prog__meta">
                          {topic.grade} класс · {topic.practice} тренировочных ·{" "}
                          {topic.check} в проверочной
                          {topic.free ? " · открыта всем" : ""}
                        </span>
                      </div>
                      <div className="sov-prog__actions">
                        <button
                          type="button"
                          className="sov-act-ghost"
                          onClick={() => toggleTopic(topic.id)}
                        >
                          {openTopic === topic.id ? "Свернуть" : "Задания"}
                        </button>
                        <button
                          type="button"
                          className="sov-act-ghost"
                          onClick={() => setAssignTo(assignTo === topic.id ? null : topic.id)}
                          disabled={data.students.length === 0}
                        >
                          Задать
                        </button>
                      </div>
                    </div>

                    {topic.summary ? <p className="sov-prog__summary">{topic.summary}</p> : null}

                    {assignTo === topic.id ? (
                      <AssignPanel
                        topicId={topic.id}
                        students={data.students}
                        onDone={() => setAssignTo(null)}
                      />
                    ) : null}

                    {openTopic === topic.id ? (
                      tasks ? (
                        <ol className="sov-tasks">
                          {tasks.tasks.map((task) => (
                            <li key={task.id} data-check={task.check}>
                              <b>
                                {task.check ? "Проверочная" : "Тренировка"}
                                {task.kind === "choice"
                                  ? " · выбор"
                                  : task.kind === "match"
                                    ? " · сопоставление"
                                    : " · ввод ответа"}
                              </b>
                              <span className="sov-tasks__prompt">{task.prompt}</span>
                              {task.options.length ? (
                                <span className="sov-tasks__options">
                                  {task.options.join(" · ")}
                                </span>
                              ) : null}
                              <span className="sov-tasks__answer">Ответ: {task.answer}</span>
                              <span className="sov-tasks__why">{task.explanation}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="sov-mono" style={{ marginTop: 10 }}>
                          Открываем задания…
                        </p>
                      )
                    ) : null}
                  </article>
                ))}
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}

/** Выдача темы группе: на занятии её проходят со всеми сразу. */
function AssignPanel({
  topicId,
  students,
  onDone,
}: {
  topicId: string;
  students: { id: string; name: string; grade: number }[];
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState(defaultDue());
  const [target, setTarget] = useState(70);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done !== null) {
    return (
      <p className="sov-prog__ok">
        Задано ученикам: {done}. Появится у них на экране занятий сразу.
      </p>
    );
  }

  return (
    <div className="sov-prog__assign">
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-chips">
        {students.map((s) => (
          <button
            key={s.id}
            type="button"
            className="sov-chip"
            data-active={picked.includes(s.id)}
            onClick={() =>
              setPicked((prev) =>
                prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
              )
            }
          >
            {s.name}, {s.grade} класс
          </button>
        ))}
      </div>

      <div className="sov-prog__row">
        <label>
          Срок
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>
          Засчитывать от
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
            <option value={50}>50% верных</option>
            <option value={70}>70% верных</option>
            <option value={90}>90% верных</option>
          </select>
        </label>
      </div>

      <div className="sov-prog__row">
        <button
          type="button"
          className="sov-act-child"
          disabled={pending || picked.length === 0}
          onClick={async () => {
            setPending(true);
            setError(null);
            try {
              const res = await assignTopic({
                data: {
                  topicId,
                  childIds: picked,
                  dueAt: due ? new Date(due).toISOString() : null,
                  targetPercent: target,
                },
              });
              setDone(res.count);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не получилось задать");
            }
            setPending(false);
          }}
        >
          {picked.length === 0 ? "Выберите учеников" : `Задать ${picked.length}`}
        </button>
        <button type="button" className="sov-act-ghost" onClick={onDone}>
          Отмена
        </button>
      </div>
    </div>
  );
}
