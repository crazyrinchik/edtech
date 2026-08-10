import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { AbacusIcon, BookIcon, GridIcon, MultiplyIcon, PencilIcon } from "../components/icons";
import { me } from "../lib/api/app.functions";
import { assignDrill, tutorStudents } from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/trenazhery")({
  head: () => ({ meta: [{ title: "Тренажёры, Совёнок" }] }),
  component: TrainersPage,
});

type Students = Awaited<ReturnType<typeof tutorStudents>>["students"];

function defaultDue(): string {
  return new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
}

/**
 * Тренажёры отдельным разделом рядом с темами.
 *
 * Раньше задать их можно было только из карточки ученика, вперемешку с
 * темами, и что именно тренирует каждый — нигде не написано. Здесь они
 * описаны и выдаются сразу группе, как и темы: на занятии тренажёр
 * назначают всем, а не по одному. Порядок тот же, что у ребёнка в
 * занятиях: сначала счёт и таблица, потом русский, потом чтение.
 */
const TRAINERS = [
  {
    id: "schet" as const,
    Icon: AbacusIcon,
    title: "Устный счёт",
    what: "Скорость и точность вычислений",
    detail:
      "Примеры по одному, с таймером на ответ от пяти секунд до «без ограничения». Числа однозначные, двузначные или трёхзначные, действия выбираются отдельно.",
    when: "Когда счёт правильный, но медленный, и на задачах ребёнок теряет мысль, пока считает.",
  },
  {
    id: "tablica" as const,
    Icon: MultiplyIcon,
    title: "Таблица умножения",
    what: "Таблица в обе стороны",
    detail:
      "Спрашивается и умножение, и деление, и пропущенный множитель. Три уровня: ответы до десяти, вся таблица до сотни и второй десяток. Саму таблицу ученик открывает прямо на примере, нужная клетка подсвечена.",
    when: "Когда таблица выучена строчками и «пятью восемь» ребёнок считает от начала строки, а деление не узнаёт вовсе.",
  },
  {
    id: "pravopisanie" as const,
    Icon: PencilIcon,
    title: "Правописание",
    what: "Орфография с правилом под рукой",
    detail:
      "Тринадцать правил 1–4 класса: безударные гласные, парные согласные, жи-ши, разделительные знаки, -тся и -ться, словарные слова. Правило раскрывается рядом с упражнением, а после ошибки открывается само.",
    when: "Когда в диктанте ошибки на правило, которое ребёнок «знает»: назвать может, а применить в слове — нет.",
  },
  {
    id: "chtenie" as const,
    Icon: BookIcon,
    title: "Скорочтение",
    what: "Скорость чтения и понимание",
    detail:
      "Слова показываются по одному с выбранной скоростью, от 60 до 200 слов в минуту, после текста — вопросы на понимание. Три уровня сложности текстов.",
    when: "Когда ребёнок читает по слогам и к концу предложения забывает начало.",
  },
  {
    id: "shulte" as const,
    Icon: GridIcon,
    title: "Таблица Шульте",
    what: "Поле зрения и внимание",
    detail:
      "Числа расставлены вразнобой, находить их надо по порядку. Размер 3×3, 4×4 или 5×5. Считается время и промахи.",
    when: "Основа для скорочтения: широкое поле зрения позволяет схватывать слово целиком.",
  },
];

function TrainersPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Students>([]);
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);

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
        setStudents((await tutorStudents()).students);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить учеников");
      }
    })();
  }, [navigate]);

  return (
    <div className="sov">
      <SiteHeader
        right={
          <>
            <QuietAction to="/repetitor/temy">Темы и задания</QuietAction>
            <QuietAction to="/repetitor">К ученикам</QuietAction>
          </>
        }
      />

      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <h1 style={{ fontSize: "2.2rem", marginTop: 10 }}>Тренажёры</h1>
        <p
          style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500, maxWidth: "62ch" }}
        >
          Пять тренажёров поверх программы: они не привязаны к темам и работают без подписки.
          Задать можно сразу нескольким ученикам — так же, как тему.
        </p>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        <div className="sov-prog" style={{ marginTop: 24 }}>
          {TRAINERS.map((t) => (
            <article key={t.id} className="sov-prog__item">
              <div className="sov-prog__head">
                <div className="sov-prog__title">
                  <strong className="sov-prog__name">
                    <t.Icon size={20} />
                    {t.title}
                  </strong>
                  <span className="sov-prog__meta">{t.what} · без подписки</span>
                </div>
                <div className="sov-prog__actions">
                  <button
                    type="button"
                    className="sov-act-ghost"
                    disabled={students.length === 0}
                    onClick={() => setOpenFor(openFor === t.id ? null : t.id)}
                  >
                    Задать
                  </button>
                </div>
              </div>

              <p className="sov-prog__summary">{t.detail}</p>
              <p className="sov-prog__summary">
                <b>Когда назначать.</b> {t.when}
              </p>

              {openFor === t.id ? (
                <AssignDrillPanel kind={t.id} students={students} onDone={() => setOpenFor(null)} />
              ) : null}
            </article>
          ))}
        </div>

        {students.length === 0 ? (
          <p style={{ marginTop: 18, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
            Учеников пока нет — добавьте первого в списке учеников, и тренажёры можно будет
            задавать.
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function AssignDrillPanel({
  kind,
  students,
  onDone,
}: {
  kind: "schet" | "tablica" | "pravopisanie" | "chtenie" | "shulte";
  students: Students;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState(defaultDue());
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (done !== null) {
    return <p className="sov-prog__ok">Задано ученикам: {done}.</p>;
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
              const res = await assignDrill({
                data: { kind, childIds: picked, dueAt: due ? new Date(due).toISOString() : null },
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
