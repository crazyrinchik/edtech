import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChildAvatar, QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { HomeworkDesk, type HomeworkCard } from "../components/homework-desk";
import { closedHead } from "../lib/seo";
import { saveStudentNote, studentCard } from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/uchenik/$childId")({
  head: () => closedHead("Ученик, Совёнок"),
  component: StudentPage,
});

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

/**
 * Личная заметка об ученике: «разобрать дроби», «спросить про сотку».
 *
 * Сохраняется кнопкой, а не на каждый символ: заметку правят подряд
 * несколько секунд, и очередь запросов на каждое нажатие ни к чему.
 * Кнопка же говорит, есть ли несохранённое, — отдельного статуса не надо.
 */
function TutorNote({ childId, initial }: { childId: string; initial: string }) {
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = note.trim() !== saved.trim();

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      await saveStudentNote({ data: { childId, note } });
      setSaved(note);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <form
      className="sov-panel sov-form"
      style={{ marginTop: 22 }}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="sov-field">
        <label htmlFor="tutornote">Заметка для себя</label>
        <textarea
          id="tutornote"
          rows={2}
          maxLength={2000}
          placeholder="Например: повторить таблицу на 7, на следующем занятии — диктант"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p style={{ color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
          Видите только вы: родителю и ученику заметка не показывается.
        </p>
      </div>
      {failed ? <div className="sov-alert">Не удалось сохранить — попробуйте ещё раз</div> : null}
      <button type="submit" className="sov-act-ghost" disabled={busy || !dirty}>
        {/* «Сохранено» — только когда есть что: пустой блокнот не рапортует. */}
        {busy ? "Сохраняем…" : dirty || !saved.trim() ? "Сохранить заметку" : "Сохранено"}
      </button>
    </form>
  );
}

function StudentPage() {
  const { childId } = useParams({ from: "/repetitor/uchenik/$childId" });
  const [data, setData] = useState<HomeworkCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setData(await studentCard({ data: { childId } }));
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Не удалось открыть ученика"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  if (error && !data) {
    return (
      <div className="sov">
        <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />
        <main className="sov-narrow">
          <div className="sov-alert">{error}</div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sov">
        <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />
        <main className="sov-narrow">
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
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>{data.child.name}</h1>
            <p style={{ color: "var(--sov-ink-soft)", fontWeight: 600 }}>
              {data.child.grade} класс ·{" "}
              {data.child.parentLinked ? "родитель подключён" : "родитель не подключён"}
            </p>
          </div>
        </div>

        {/* key: страница не размонтируется при переходе между учениками,
            а черновик заметки не должен переезжать в чужую карточку. */}
        <TutorNote key={data.child.id} childId={childId} initial={data.note} />

        {!data.paid ? (
          <div className="sov-save-hint" style={{ marginTop: 22 }}>
            <strong>Ученику открыты не все темы</strong>
            <span>
              Пока подписка не активна, задать можно первую тему каждого предмета и любой тренажёр.
              Остальные темы в форме ниже погашены: задать закрытую тему нельзя — ребёнок упёрся бы
              в неё, ничего не поняв.
            </span>
          </div>
        ) : null}

        {/* Стол домашки общий с кабинетом родителя (components/homework-desk).
            key по ученику: переход по ссылке из списка не размонтирует
            страницу, а отмеченные темы не должны переезжать в чужую
            карточку и выдаваться не тому. */}
        <HomeworkDesk
          key={data.child.id}
          childId={childId}
          card={data}
          audience="tutor"
          onReload={load}
        />

        <section style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: "var(--sov-t-h2)" }}>Последние занятия</h2>
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
