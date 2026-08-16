import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { me } from "../lib/api/app.functions";
import { assignTopic, curriculum, programs, topicTasks } from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/temy")({
  head: () => ({ meta: [{ title: "Темы и задания, Совёнок" }] }),
  component: CurriculumPage,
});

type Data = Awaited<ReturnType<typeof curriculum>>;
type Programs = Awaited<ReturnType<typeof programs>>["programs"];
type Tasks = Awaited<ReturnType<typeof topicTasks>>;

const GRADES = [1, 2, 3, 4];
/** Выбранный учебник меняется редко, а нужен каждое занятие. */
const PROGRAM_KEY = "sov_program";

function defaultDue(): string {
  return new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
}

/**
 * Программа целиком: репетитор готовится к занятию и решает, что давать
 * дальше.
 *
 * Экран устроен как разговор с родителем на первом занятии: сначала класс,
 * потом «а по какому учебнику учитесь». Класс обязателен — тем в начальной
 * школе почти восемьдесят, и показывать их одним списком бессмысленно.
 * Программа необязательна: если учебник неизвестен, открывается общий список
 * в порядке федеральной рабочей программы, а темы в нём те же самые.
 */
function CurriculumPage() {
  const navigate = useNavigate();
  const [grade, setGrade] = useState(1);
  const [programId, setProgramId] = useState<string | null>(null);
  const [programList, setProgramList] = useState<Programs>([]);
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
      const saved = localStorage.getItem(PROGRAM_KEY);
      if (saved) setProgramId(saved);
      try {
        setProgramList((await programs()).programs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить список программ");
      }
    })();
  }, [navigate]);

  const load = useCallback(async () => {
    setOpenTopic(null);
    setTasks(null);
    setAssignTo(null);
    try {
      setData(await curriculum({ data: { programId, grade } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить программу");
    }
  }, [grade, programId]);

  useEffect(() => {
    void load();
  }, [load]);

  function chooseProgram(id: string | null) {
    setProgramId(id);
    if (id) localStorage.setItem(PROGRAM_KEY, id);
    else localStorage.removeItem(PROGRAM_KEY);
  }

  async function toggleTopic(code: string) {
    if (openTopic === code) {
      setOpenTopic(null);
      setTasks(null);
      return;
    }
    setOpenTopic(code);
    setTasks(null);
    setError(null);
    try {
      setTasks(await topicTasks({ data: { topicId: code } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть задания");
    }
  }

  return (
    <div className="sov">
      <SiteHeader
        right={
          <>
            <QuietAction to="/repetitor/trenazhery">Тренажёры</QuietAction>
            <QuietAction to="/repetitor">К ученикам</QuietAction>
          </>
        }
      />

      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <h1 style={{ fontSize: "2.2rem" }}>Темы и задания</h1>
        <p
          style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500, maxWidth: "62ch" }}
        >
          Выберите класс, а при желании и программу школы: набор тем в классе один и тот же для всех
          учебников, программа меняет порядок и названия. На каждую тему готовы 30 тренировочных
          заданий и проверочная.
        </p>

        <section className="sov-course">
          <h2 className="sov-course__label">Класс</h2>
          <div className="sov-chips" style={{ marginTop: 8 }}>
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className="sov-chip"
                data-active={grade === g}
                onClick={() => setGrade(g)}
              >
                {g} класс
              </button>
            ))}
          </div>
        </section>

        <section className="sov-course">
          <h2 className="sov-course__label">Программа школы</h2>
          <div className="sov-course__grid">
            <button
              type="button"
              className="sov-course__card"
              data-active={programId === null}
              onClick={() => chooseProgram(null)}
            >
              <strong>Общий список тем</strong>
              <span>Не знаю учебник — порядок федеральной рабочей программы</span>
            </button>
            {programList.map((p) => (
              <button
                key={p.id}
                type="button"
                className="sov-course__card"
                data-active={programId === p.id}
                onClick={() => chooseProgram(p.id)}
              >
                <strong>{p.short}</strong>
                <span>{p.share ?? p.note}</span>
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        {!data ? (
          <p className="sov-mono" style={{ marginTop: 26 }}>
            Открываем программу…
          </p>
        ) : (
          <>
            {data.program?.warning ? (
              <div className="sov-risk" style={{ marginTop: 20 }}>
                {data.program.warning}
              </div>
            ) : null}

            {data.deltas.length ? (
              <section className="sov-quest">
                <header className="sov-quest__head">
                  <h2>
                    Чем {data.program?.short} отличается в {data.grade} классе
                  </h2>
                </header>
                <div className="sov-diff">
                  {data.deltas.map((d, i) => (
                    <article key={i} className="sov-diff__item" data-kind={d.type}>
                      <b>
                        {d.type === "ahead"
                          ? "Опережение"
                          : d.type === "extra"
                            ? "Своя тема"
                            : d.type === "behind"
                              ? "Отставание"
                              : d.type === "terminology"
                                ? "Другие термины"
                                : "Базовый темп"}
                        {" · "}
                        {d.subject === "math" ? "математика" : "русский язык"}
                      </b>
                      <strong>{d.what}</strong>
                      <span>{d.impact}</span>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {data.missingSubjects.length ? (
              <div className="sov-save-hint" style={{ marginTop: 22 }}>
                <strong>{data.missingSubjects.join(" и ")}: программа не задаёт порядок</strong>
                <span>
                  Этот учебник в каталоге описан только по своим предметам. Остальное открывайте
                  общим списком — темы там те же.
                </span>
              </div>
            ) : null}

            {!data.paid ? (
              <div className="sov-save-hint" style={{ marginTop: 22 }}>
                <strong>Задания открывает подписка</strong>
                <span>
                  Названия тем и порядок видны всегда, а содержимое — на первой теме каждого
                  предмета. С подпиской открываются задания всех тем, и их можно задавать любому
                  ученику.
                </span>
              </div>
            ) : null}

            {data.subjects.map((subject) => (
              <section key={subject.id} className="sov-quest">
                <header className="sov-quest__head">
                  <h2>{subject.name}</h2>
                  <span className="sov-quest__count">
                    {subject.topics.length} тем · {subject.topics.length * 30} заданий
                  </span>
                </header>

                <div className="sov-prog">
                  {subject.topics.map((topic, index) => (
                    <article key={topic.code} className="sov-prog__item" data-locked={topic.locked}>
                      <div className="sov-prog__head">
                        <div className="sov-prog__title">
                          <strong>
                            <span className="sov-prog__no">{index + 1}</span>
                            {topic.title}
                          </strong>
                          <span className="sov-prog__meta">
                            {topic.practice} тренировочных · {topic.check} в проверочной
                            {topic.hours ? ` · ${topic.hours} ч в школе` : ""}
                            {topic.free ? " · открыта всем" : ""}
                          </span>
                        </div>
                        <div className="sov-prog__actions">
                          <button
                            type="button"
                            className="sov-act-ghost"
                            onClick={() => toggleTopic(topic.code)}
                          >
                            {openTopic === topic.code ? "Свернуть" : "Задания"}
                          </button>
                          {/* «Задать» — то, ради чего репетитор сюда пришёл, и
                              в паре одинаковых тихих плашек оно терялось.
                              Обводка отличает действие от «посмотреть». */}
                          <button
                            type="button"
                            className="sov-act-quiet sov-prog__assign"
                            onClick={() => setAssignTo(assignTo === topic.code ? null : topic.code)}
                            disabled={data.students.length === 0}
                          >
                            Задать
                          </button>
                        </div>
                      </div>

                      {topic.chapters.length ? (
                        <p className="sov-prog__chapters">
                          <b>В учебнике:</b> {topic.chapters.join(" · ")}
                        </p>
                      ) : null}

                      {!topic.inProgram && data.program ? (
                        <p className="sov-prog__chapters" data-tone="soft">
                          В оглавлении этого учебника отдельной главы нет — тема идёт внутри других
                          или в повторении.
                        </p>
                      ) : null}

                      {assignTo === topic.code ? (
                        <AssignPanel
                          topicId={topic.code}
                          students={data.students}
                          onDone={() => setAssignTo(null)}
                        />
                      ) : null}

                      {openTopic === topic.code ? (
                        tasks && tasks.topic.id === topic.code ? (
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
          </>
        )}
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
