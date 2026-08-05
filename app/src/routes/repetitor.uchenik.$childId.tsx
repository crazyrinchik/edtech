import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChildAvatar, QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import {
  cancelAssignment,
  createAssignment,
  createCustomAssignment,
  customTaskFile,
  gradeCustomAnswer,
  studentCard,
} from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/uchenik/$childId")({
  head: () => ({ meta: [{ title: "Ученик, Совёнок" }] }),
  component: StudentPage,
});

type Card = Awaited<ReturnType<typeof studentCard>>;

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

const STATUS_LABEL: Record<string, string> = {
  done: "выполнено",
  overdue: "просрочено",
  in_progress: "в работе",
  new: "не начато",
};

/** Срок по умолчанию — неделя: типичный шаг между занятиями с репетитором. */
function defaultDue(): string {
  return new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
}

function StudentPage() {
  const { childId } = useParams({ from: "/repetitor/uchenik/$childId" });
  const navigate = useNavigate();
  const [data, setData] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [drills, setDrills] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function load() {
    setData(await studentCard({ data: { childId } }));
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Не удалось открыть ученика"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const chosen = picked.length + drills.length;
  const empty = chosen === 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await createAssignment({
        data: {
          childId,
          title: String(form.get("title") ?? "").trim() || "Домашняя работа",
          comment: String(form.get("comment") ?? "").trim() || null,
          dueAt: form.get("due") ? new Date(String(form.get("due"))).toISOString() : null,
          items: [
            ...picked.map((id) => ({
              kind: "topic" as const,
              refId: id,
              targetPercent: Number(form.get("target") ?? 70),
            })),
            ...drills.map((kind) => ({ kind: "drill" as const, refId: kind, targetPercent: 0 })),
          ],
        },
      });
      setPicked([]);
      setDrills([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось выдать задание");
    }
    setPending(false);
  }

  if (error && !data) {
    return (
      <div className="sov">
        <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />
        <main className="sov-narrow" style={{ paddingTop: 40 }}>
          <div className="sov-alert">{error}</div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sov">
        <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />
        <main className="sov-narrow" style={{ paddingTop: 40 }}>
          <p className="sov-mono">Открываем карточку…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />

      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <div className="sov-student__title">
          <ChildAvatar avatar={data.child.avatar} size={56} />
          <div>
            <h1 style={{ fontSize: "2rem" }}>{data.child.name}</h1>
            <p style={{ color: "var(--sov-ink-soft)", fontWeight: 600 }}>
              {data.child.grade} класс ·{" "}
              {data.child.parentLinked ? "родитель подключён" : "родитель не подключён"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        {!data.paid ? (
          <div className="sov-save-hint" style={{ marginTop: 22 }}>
            <strong>Ученику открыты не все темы</strong>
            <span>
              Пока подписка не активна, доступна первая тема каждого предмета. Задать можно любую,
              но ребёнок откроет только доступные.
            </span>
          </div>
        ) : null}

        {/* Своё задание стоит над списком выданного: в самом низу страницы,
            под длинным перечнем тем, кнопку просто не находили. */}
        <CustomForm childId={childId} onDone={load} />

        <section style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: "1.5rem" }}>Домашняя работа</h2>
          {data.assignments.length === 0 ? (
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Пока ничего не задано.
            </p>
          ) : (
            <div className="sov-hw-list">
              {data.assignments.map((a) => (
                <article key={a.id} className="sov-hw-card" data-status={a.status}>
                  <header>
                    <strong>{a.title}</strong>
                    <span className="sov-hw-card__status">{STATUS_LABEL[a.status]}</span>
                  </header>
                  <p className="sov-mono">
                    {a.doneCount} из {a.total}
                    {a.dueAt ? ` · срок ${DATE.format(new Date(a.dueAt))}` : " · без срока"}
                  </p>
                  <ul>
                    {a.items.map((item) => (
                      <li key={item.id} data-done={item.done}>
                        {item.done ? "✓" : "•"} {item.name}
                        {item.kind === "topic" ? (
                          <em>
                            {item.bestPercent === null
                              ? " — не начато"
                              : ` — ${item.bestPercent}% из ${item.targetPercent}%`}
                          </em>
                        ) : null}
                        {item.kind === "custom" ? (
                          <CustomAnswer item={item} onDone={load} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {a.comment ? <p className="sov-hw-card__comment">{a.comment}</p> : null}
                  <button
                    type="button"
                    className="sov-act-ghost"
                    onClick={async () => {
                      await cancelAssignment({ data: { id: a.id } });
                      await load();
                    }}
                  >
                    Снять задание
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <form className="sov-panel sov-form" style={{ marginTop: 30 }} onSubmit={submit}>
          <h3>Задать на дом</h3>
          <div className="sov-field">
            <label htmlFor="title">Название</label>
            <input id="title" name="title" defaultValue="Домашняя работа" required />
          </div>

          <div className="sov-field">
            <label>Темы</label>
            <span className="sov-field__hint">
              Доступны темы обоих классов: программу выбираете вы, а не поле в профиле ученика.
              Весь список с заданиями — в разделе «Темы и задания».
            </span>
            {data.subjects.map((subject) => (
              <div key={subject.id} style={{ marginTop: 10 }}>
                <b className="sov-mono">{subject.name}</b>
                <div className="sov-chips">
                  {data.topics
                    .filter((t) => t.subject_id === subject.id)
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="sov-chip"
                        data-active={picked.includes(t.id)}
                        onClick={() =>
                          setPicked((prev) =>
                            prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                          )
                        }
                      >
                        {t.name}
                        <em style={{ fontStyle: "normal", opacity: 0.6 }}> · {t.grade} кл.</em>
                        {t.status === "completed" ? " ✓" : ""}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="sov-field">
            <label>Тренажёры</label>
            <div className="sov-chips">
              {[
                { id: "schet", name: "Устный счёт" },
                { id: "chtenie", name: "Скорочтение" },
                { id: "shulte", name: "Таблица Шульте" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="sov-chip"
                  data-active={drills.includes(d.id)}
                  onClick={() =>
                    setDrills((prev) =>
                      prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                    )
                  }
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sov-field">
            <label htmlFor="target">Засчитывать тему от</label>
            <select id="target" name="target" defaultValue="70">
              <option value="50">50% верных</option>
              <option value="70">70% верных</option>
              <option value="90">90% верных</option>
            </select>
            <span className="sov-field__hint">
              Пункт закрывается, когда после выдачи задания было занятие с такой долей верных.
            </span>
          </div>

          <div className="sov-field">
            <label htmlFor="due">Срок</label>
            <input id="due" name="due" type="date" defaultValue={defaultDue()} />
          </div>

          <div className="sov-field">
            <label htmlFor="comment">Комментарий ребёнку, по желанию</label>
            <input id="comment" name="comment" placeholder="Начни со счёта, потом темы" />
          </div>

          {/* Своя кнопка, а не FormAction: тот подменяет подпись на «Секунду…»
              по признаку pending, и пустой выбор выглядел бы как отправка. */}
          <button type="submit" className="sov-act-child" disabled={pending || empty}>
            {pending ? "Секунду…" : empty ? "Выберите хотя бы один пункт" : `Задать: ${chosen}`}
          </button>
        </form>

        <section style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: "1.5rem" }}>Последние занятия</h2>
          {data.lessons.length === 0 ? (
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Занятий пока не было.
            </p>
          ) : (
            <table className="sov-table">
              <thead>
                <tr>
                  <th>Тема</th>
                  <th>Результат</th>
                  <th>Когда</th>
                </tr>
              </thead>
              <tbody>
                {data.lessons.map((l, i) => (
                  <tr key={i}>
                    <td>{l.topic}</td>
                    <td>
                      {l.correct} из {l.total}
                    </td>
                    <td>{DATE.format(new Date(l.started_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p style={{ marginTop: 30 }}>
          <Link to="/repetitor" className="sov-act-quiet">
            К списку учеников
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Своё задание: текст руками и, если нужно, файл.
 *
 * Файл уходит в base64 вместе с формой — объектного хранилища на своём
 * сервере нет, а приложение живёт в workerd и не имеет файловой системы.
 * Отсюда и жёсткий предел размера: вложения лежат в базе, которую дампят.
 */
function CustomForm({ childId, onDone }: { childId: string; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (!open) {
    return (
      <div style={{ marginTop: 30 }}>
        <button type="button" className="sov-act-ghost" onClick={() => setOpen(true)}>
          Своё задание: текст или файл
        </button>
        {ok ? <p className="sov-prog__ok" style={{ marginTop: 10 }}>Задание отправлено ученику.</p> : null}
      </div>
    );
  }

  return (
    <form
      className="sov-panel sov-form"
      style={{ marginTop: 30 }}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        try {
          await createCustomAssignment({
            data: {
              childIds: [childId],
              title: String(form.get("title") ?? "").trim(),
              body: String(form.get("body") ?? "").trim() || null,
              dueAt: form.get("due") ? new Date(String(form.get("due"))).toISOString() : null,
              file,
            },
          });
          setOk(true);
          setOpen(false);
          setFile(null);
          await onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не получилось отправить");
        }
        setPending(false);
      }}
    >
      <h3>Своё задание</h3>
      <p style={{ color: "var(--sov-ink-soft)", fontSize: ".95rem" }}>
        Ученик увидит его в домашке и ответит текстом, а вы поставите оценку. Платформа такие
        задания не проверяет.
      </p>

      {error ? <div className="sov-alert">{error}</div> : null}

      <div className="sov-field">
        <label htmlFor="ctitle">Название</label>
        <input id="ctitle" name="title" required placeholder="Прописи, страница 14" />
      </div>

      <div className="sov-field">
        <label htmlFor="cbody">Что сделать</label>
        <textarea id="cbody" name="body" rows={4} placeholder="Спиши слова и подчеркни гласные" />
      </div>

      <div className="sov-field">
        <label htmlFor="cfile">Файл, по желанию</label>
        <input
          id="cfile"
          type="file"
          accept=".pdf,image/*"
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            if (!picked) {
              setFile(null);
              return;
            }
            if (picked.size > 1_500_000) {
              setError("Файл больше 1,5 МБ — приложите файл поменьше");
              e.target.value = "";
              return;
            }
            const buffer = await picked.arrayBuffer();
            let binary = "";
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
            setFile({ name: picked.name, type: picked.type, data: btoa(binary) });
            setError(null);
          }}
        />
        <span className="sov-field__hint">PDF или картинка, до 1,5 МБ.</span>
      </div>

      <div className="sov-field">
        <label htmlFor="cdue">Срок</label>
        <input id="cdue" name="due" type="date" defaultValue={defaultDue()} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="sov-act-child" disabled={pending}>
          {pending ? "Отправляем…" : "Отправить ученику"}
        </button>
        <button type="button" className="sov-act-ghost" onClick={() => setOpen(false)}>
          Отмена
        </button>
      </div>
    </form>
  );
}

/** Ответ ученика на своё задание и оценка за него. */
function CustomAnswer({
  item,
  onDone,
}: {
  item: {
    id: string;
    answer?: string | null;
    submittedAt?: string | null;
    grade?: number | null;
    comment?: string | null;
    fileName?: string | null;
    answerFile?: string | null;
  };
  onDone: () => Promise<void>;
}) {
  const [grade, setGrade] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);

  if (!item.submittedAt) {
    return (
      <div className="sov-custom">
        <span className="sov-custom__meta">
          Ответа пока нет{item.fileName ? ` · приложен файл ${item.fileName}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="sov-custom">
      <span className="sov-custom__meta">Ответ ученика</span>
      {item.answer ? <p className="sov-custom__answer">{item.answer}</p> : null}
      {item.answerFile ? (
        <button
          type="button"
          className="sov-homework__file"
          onClick={async () => {
            const got = await customTaskFile({ data: { itemId: item.id, which: "answer" } });
            const bytes = Uint8Array.from(atob(got.data), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(
              new Blob([bytes], { type: got.type ?? "application/octet-stream" }),
            );
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          }}
        >
          Открыть {item.answerFile}
        </button>
      ) : null}

      {item.grade ? (
        <span className="sov-custom__grade">
          Оценка {item.grade}
          {item.comment ? ` · ${item.comment}` : ""}
        </span>
      ) : (
        <div className="sov-custom__grade-form">
          <div className="sov-chips">
            {[5, 4, 3, 2].map((g) => (
              <button
                key={g}
                type="button"
                className="sov-chip"
                data-active={grade === g}
                onClick={() => setGrade(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий, по желанию"
          />
          <button
            type="button"
            className="sov-act-ghost"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await gradeCustomAnswer({ data: { itemId: item.id, grade, comment: comment || null } });
              await onDone();
              setPending(false);
            }}
          >
            Поставить оценку
          </button>
        </div>
      )}
    </div>
  );
}
