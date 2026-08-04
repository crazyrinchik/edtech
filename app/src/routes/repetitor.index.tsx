import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  ChildAvatar,
  CHILD_AVATARS,
  FormAction,
  QuietAction,
  SiteFooter,
  SiteHeader,
} from "../components/brand";
import { logout, me } from "../lib/api/app.functions";
import { addStudent, createInvite, tutorStudents } from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/")({
  head: () => ({ meta: [{ title: "Ученики, Совёнок" }] }),
  component: TutorPage,
});

type Students = Awaited<ReturnType<typeof tutorStudents>>;

const DUE_LABEL = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

function dueText(dueAt: string | null): string {
  if (!dueAt) return "без срока";
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 864e5);
  if (days < 0) return `просрочено на ${-days} дн.`;
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `к ${DUE_LABEL.format(new Date(dueAt))}`;
}

function sinceText(iso: string | null): string {
  if (!iso) return "ещё не занимался";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days === 0) return "занимался сегодня";
  if (days === 1) return "занимался вчера";
  return `не занимался ${days} дн.`;
}

function TutorPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Students | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [avatar, setAvatar] = useState("owl");
  const [pending, setPending] = useState(false);

  async function load() {
    setData(await tutorStudents());
  }

  useEffect(() => {
    (async () => {
      const account = await me();
      if (!account.user) {
        await navigate({ to: "/vhod" });
        return;
      }
      // Родителя, попавшего сюда по ссылке, отправляем в его кабинет, а не
      // показываем пустой список: раздел ему просто не принадлежит.
      if (account.user.role !== "tutor" && account.user.role !== "admin") {
        await navigate({ to: "/roditel" });
        return;
      }
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить учеников");
      }
    })();
  }, [navigate]);

  async function submitStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await addStudent({
        data: {
          name: String(form.get("name") ?? ""),
          grade: Number(form.get("grade") ?? 1),
          avatar,
        },
      });
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось добавить ученика");
    }
    setPending(false);
  }

  return (
    <div className="sov">
      <SiteHeader
        right={
          <>
            <QuietAction to="/roditel">Подписка</QuietAction>
            <button
              type="button"
              className="sov-act-ghost"
              onClick={async () => {
                await logout();
                await navigate({ to: "/" });
              }}
            >
              Выйти
            </button>
          </>
        }
      />

      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <div className="sov-quest__head" style={{ marginTop: 10 }}>
          <h1 style={{ fontSize: "2.2rem" }}>Ученики</h1>
          <button type="button" className="sov-act-child" onClick={() => setAdding((v) => !v)}>
            {adding ? "Отмена" : "Добавить ученика"}
          </button>
        </div>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 20 }}>
            {error}
          </div>
        ) : null}

        {data && !data.paid ? (
          <div className="sov-save-hint" style={{ marginTop: 22 }}>
            <strong>Подписка не активна</strong>
            <span>
              Ученикам открыты только первые темы каждого предмета. Подписка репетитора снимает
              ограничение сразу для всех — семьям платить не нужно.
            </span>
          </div>
        ) : null}

        {adding ? (
          <form className="sov-panel sov-form" style={{ marginTop: 24 }} onSubmit={submitStudent}>
            <h3>Новый ученик</h3>
            <p style={{ color: "var(--sov-ink-soft)", fontSize: ".95rem" }}>
              Достаточно имени и класса — заниматься можно сразу. Родителя подключите кодом
              приглашения, когда будет удобно.
            </p>
            <div className="sov-field">
              <label htmlFor="name">Имя ученика</label>
              <input id="name" name="name" required />
            </div>
            <div className="sov-field">
              <label htmlFor="grade">Класс</label>
              <select id="grade" name="grade" defaultValue="1">
                <option value="1">1 класс</option>
                <option value="2">2 класс</option>
              </select>
            </div>
            <div className="sov-field">
              <label>Аватар</label>
              <div className="sov-avatar-pick">
                {CHILD_AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="sov-avatar-pick__item"
                    data-active={avatar === a.id}
                    aria-pressed={avatar === a.id}
                    aria-label={a.label}
                    onClick={() => setAvatar(a.id)}
                  >
                    <ChildAvatar avatar={a.id} size={40} />
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <FormAction pending={pending}>Добавить</FormAction>
          </form>
        ) : null}

        {data && data.students.length === 0 && !adding ? (
          <div className="sov-panel" style={{ marginTop: 26 }}>
            <h3>Пока никого нет</h3>
            <p style={{ marginTop: 8, color: "var(--sov-ink-soft)" }}>
              Добавьте первого ученика — на это уходит меньше минуты, а домашку можно выдать сразу
              после первого занятия.
            </p>
          </div>
        ) : null}

        <div className="sov-students">
          {(data?.students ?? []).map((s) => (
            <article key={s.id} className="sov-student">
              <Link
                to="/repetitor/uchenik/$childId"
                params={{ childId: s.id }}
                className="sov-student__head"
              >
                <ChildAvatar avatar={s.avatar} size={52} />
                <span className="sov-student__who">
                  <strong>{s.name}</strong>
                  <span>
                    {s.grade} класс · {sinceText(s.lastLessonAt)}
                  </span>
                </span>
              </Link>

              <div className="sov-student__body">
                {s.assignment ? (
                  <div className="sov-hw" data-status={s.assignment.status}>
                    <b>{s.assignment.title}</b>
                    <span>
                      {s.assignment.doneCount} из {s.assignment.total} · {dueText(s.assignment.dueAt)}
                    </span>
                  </div>
                ) : (
                  <div className="sov-hw" data-status="none">
                    <b>Домашки нет</b>
                    <span>Задать можно в карточке ученика</span>
                  </div>
                )}

                {s.risk ? (
                  <p className="sov-student__risk">
                    Зона риска: «{s.risk.name}» — {s.risk.percent}% верных
                  </p>
                ) : null}

                {!s.parentLinked ? (
                  <InviteRow childId={s.id} code={s.inviteCode} onDone={load} />
                ) : (
                  <p className="sov-student__note">Родитель подключён</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Код приглашения показывается прямо в списке: его чаще всего диктуют по
 * телефону или пересылают в мессенджер, и лишний переход в карточку ради
 * шести цифр только мешает.
 */
function InviteRow({
  childId,
  code,
  onDone,
}: {
  childId: string;
  code: string | null;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (code) {
    return (
      <p className="sov-student__note">
        Код приглашения: <span className="sov-code">{code}</span>
      </p>
    );
  }
  return (
    <button
      type="button"
      className="sov-act-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createInvite({ data: { childId } });
        await onDone();
        setBusy(false);
      }}
    >
      Пригласить родителя
    </button>
  );
}
