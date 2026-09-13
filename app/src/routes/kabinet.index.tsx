import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChildAvatar, FormAction, SiteFooter } from "../components/brand";
import {
  AddChildForm,
  AvatarPicker,
  CabinetHeader,
  CabinetLoading,
  DeleteAccountBlock,
  needsPin,
  PinGate,
  useCabinetAccount,
} from "../components/cabinet-parts";
import { PromoBanner } from "../components/promo-banner";
import { lockParentCabinet, selectChild } from "../lib/api/app.functions";
import { addStudent, createInvite, tutorStudents } from "../lib/api/tutor.functions";
import { FREE_CHILD_LIMIT } from "../lib/billing";
import { capsFor } from "../lib/cabinet";
import { closedHead } from "../lib/seo";

/**
 * Вход в кабинет: кто у этого взрослого есть.
 *
 * Один список на обе роли, разделённый на два раздела. Свои дети и чужие
 * ученики — разные отношения, а не разные кабинеты: у репетитора бывает
 * свой первоклассник, и до этого экрана он был невозможен — всё, что
 * репетитор заводил, становилось учеником, которому он же должен был
 * выслать приглашение самому себе.
 *
 * Разделы выглядят по-разному, и это не украшение. У своего ребёнка видно
 * имя и класс — остальное на его странице. У ученика в списке важно другое:
 * сдана ли домашка, что просело и принял ли родитель приглашение, — потому
 * что учеников десяток и заходить в каждого ради этого невозможно.
 *
 * Семье с единственным ребёнком список не показывается вовсе: экран сразу
 * уходит на его страницу.
 */
export const Route = createFileRoute("/kabinet/")({
  head: () => closedHead("Кабинет, Совёнок"),
  component: CabinetIndex,
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

function CabinetIndex() {
  const navigate = useNavigate();
  const { account, reload } = useCabinetAccount();
  const [students, setStudents] = useState<Students | null>(null);
  const [error, setError] = useState<string | null>(null);

  const caps = capsFor(account?.user?.role);
  const locked = account ? needsPin(account) : true;
  /* Свои дети — из me(): там их немного и вся нужная строка уже есть.
     Ученики — отдельным запросом: домашка, зоны риска и коды приглашения
     стоят дороже, и семье, у которой учеников нет, их считать незачем. */
  const mine = (account?.children ?? []).filter((c) => c.access !== "tutor");
  const only = account && !caps.canTakeStudents && mine.length === 1 ? mine[0].id : null;

  useEffect(() => {
    if (!account || locked || !caps.canTakeStudents) return;
    tutorStudents()
      .then(setStudents)
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить учеников"));
  }, [account, locked, caps.canTakeStudents]);

  useEffect(() => {
    if (!account || locked || !only) return;
    void navigate({ to: "/kabinet/$childId", params: { childId: only } });
  }, [account, locked, only, navigate]);

  if (!account) return <CabinetLoading />;
  if (needsPin(account)) {
    return <PinGate creating={!account.parentPinSet} onDone={reload} />;
  }

  /* Место занято: подписки нет, а профиль уже заведён. Считается по тому же
     account, который и так пришёл, — лишнего запроса не нужно. Свои дети и
     ученики считаются отдельно: это разные связи и разные ограничения. */
  const paid = account.user?.subscriptionStatus === "active";
  const childLimit = !paid && mine.length >= FREE_CHILD_LIMIT;

  return (
    <div className="sov">
      <CabinetHeader
        account={account}
        onLock={async () => {
          await lockParentCabinet();
          await reload();
        }}
      />
      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <h1 style={{ fontSize: "var(--sov-t-h1)", fontWeight: 700, marginTop: 16 }}>Кабинет</h1>
        <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
          {account.user?.name}, статус подписки: {paid ? "активна" : "бесплатный доступ"}.
        </p>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        {/* Разовая акция для тех, кто был зарегистрирован к её запуску.
            Стоит выше списков: живёт один день и должна читаться первой. */}
        <PromoBanner
          onPay={(code) =>
            navigate({
              to: caps.canTakeStudents ? "/repetitor/podpiska" : "/kabinet/podpiska",
              search: { promo: code },
            })
          }
        />

        {caps.canTakeStudents ? (
          <StudentsSection
            data={students}
            onReload={async () => setStudents(await tutorStudents())}
          />
        ) : null}

        <section style={{ marginTop: caps.canTakeStudents ? 44 : 24 }}>
          {caps.canTakeStudents ? <h2 className="sov-kabinet__h">Свои дети</h2> : null}

          {mine.length ? (
            <div className="sov-students" style={{ marginTop: 16 }}>
              {mine.map((child) => (
                <article key={child.id} className="sov-student">
                  <Link
                    to="/kabinet/$childId"
                    params={{ childId: child.id }}
                    className="sov-student__head"
                    onClick={() => {
                      // Активный ребёнок нужен занятиям и тренажёрам: они
                      // берут его из куки, а не из адреса.
                      void selectChild({ data: { childId: child.id } });
                    }}
                  >
                    <ChildAvatar avatar={child.avatar} size={52} />
                    <span className="sov-student__who">
                      <strong>{child.name}</strong>
                      <span>{child.grade} класс</span>
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          ) : null}

          <AddChildForm
            onAdded={reload}
            limited={childLimit}
            compact={caps.canTakeStudents}
            needsConsent={account.needsChildConsent}
          />
        </section>

        {/* Без этого блока взрослый, удаливший единственный профиль, не смог
            бы отозвать согласие целиком: остальные настройки живут на
            странице ребёнка, а её без ребёнка нет. */}
        {account.children.length === 0 ? (
          <div style={{ marginTop: 48 }}>
            <DeleteAccountBlock />
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Ученики: список с домашкой, зонами риска и кодами приглашения.
 *
 * Переехал сюда со страницы /repetitor целиком — вместе с причинами, по
 * которым он так устроен: код приглашения показывается прямо в списке (его
 * диктуют по телефону), срок автоудаления назван заранее, а кнопка
 * «добавить» гаснет, когда без подписки место занято.
 */
function StudentsSection({
  data,
  onReload,
}: {
  data: Students | null;
  onReload: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [avatar, setAvatar] = useState("owl");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limitReached = !!data && !data.paid && data.students.length >= FREE_CHILD_LIMIT;

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
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось добавить ученика");
    }
    setPending(false);
  }

  return (
    <section style={{ marginTop: 28 }}>
      <div className="sov-quest__head">
        <h2 className="sov-kabinet__h" style={{ marginTop: 0 }}>
          Ученики
        </h2>
        {/* Кнопка гаснет, когда без подписки уже есть ученик. Сервер откажет
            в любом случае (addStudent), но узнавать об этом после того, как
            заполнил имя, класс и аватар, — обидно и незачем. */}
        <button
          type="button"
          className="sov-act-child"
          disabled={limitReached && !adding}
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? "Отмена" : "Добавить ученика"}
        </button>
      </div>

      {error ? (
        <div className="sov-alert" style={{ marginTop: 18 }}>
          {error}
        </div>
      ) : null}

      {/* Одна плашка на два случая, а не две подряд. Пока ученик один,
          подписка ограничивает темы и настройку тренажёров, и текст про
          это. Как только место занято, главным становится другое: второго
          ученика не завести, — и говорить надо сперва об этом. */}
      {data && !data.paid ? (
        <div className="sov-save-hint" style={{ marginTop: 18 }}>
          <strong>{limitReached ? "Место ученика занято" : "Подписка не активна"}</strong>
          <span>
            {limitReached
              ? "Без подписки можно вести одного ученика. Подписка открывает остальных, а вместе с ними темы, настройку тренажёров и сохранение результатов — сразу для всех, семьям платить не нужно."
              : "Ученикам открыты первые темы каждого предмета и тренажёры в базовой настройке. Подписка открывает темы, настройку захода и сохранение результатов — сразу для всех, семьям платить не нужно."}
          </span>
          <p style={{ marginTop: 12 }}>
            <Link
              to="/repetitor/podpiska"
              className="sov-act-ghost"
              style={{ textDecoration: "none" }}
            >
              Оформить подписку
            </Link>
          </p>
        </div>
      ) : null}

      {adding ? (
        <form className="sov-panel sov-form" style={{ marginTop: 24 }} onSubmit={submitStudent}>
          <h3>Новый ученик</h3>
          <p style={{ color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
            Достаточно имени и класса — заниматься можно сразу. Затем подключите родителя кодом
            приглашения: он подтвердит согласие на обработку данных и будет видеть занятия.
          </p>
          <div className="sov-field">
            <label htmlFor="name">Имя ученика</label>
            {/* Пробел не вводится и не вставляется: одно поле — одно имя.
                Фамилию Совёнок не собирает, и сервер её тоже не пропустит
                (addStudent в tutor.functions.ts). */}
            <input
              id="name"
              name="name"
              required
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.replace(/\s+/g, "");
              }}
            />
          </div>
          <div className="sov-field">
            <label htmlFor="grade">Класс</label>
            <select id="grade" name="grade" defaultValue="1">
              <option value="1">1 класс</option>
              <option value="2">2 класс</option>
              <option value="3">3 класс</option>
              <option value="4">4 класс</option>
            </select>
          </div>
          <div className="sov-field">
            <label>Аватар</label>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
          <FormAction pending={pending}>Добавить</FormAction>
        </form>
      ) : null}

      {data && data.students.length === 0 && !adding ? (
        <div className="sov-panel" style={{ marginTop: 22 }}>
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
              to="/kabinet/$childId"
              params={{ childId: s.id }}
              className="sov-student__head"
              onClick={() => void selectChild({ data: { childId: s.id } })}
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
                <>
                  <InviteRow childId={s.id} code={s.inviteCode} onDone={onReload} />
                  {/* Срок называется заранее: профиль без согласия родителя
                      живёт десять дней (retention.server.ts), и педагог не
                      должен обнаружить пропажу ученика задним числом. */}
                  {s.autoDeleteAt ? (
                    <p className="sov-student__risk">
                      Профиль удалится {DUE_LABEL.format(new Date(s.autoDeleteAt))}, если родитель
                      не примет приглашение
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="sov-student__note">Родитель подключён</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
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
