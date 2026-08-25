import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { AbacusIcon, BookIcon, GridIcon, MultiplyIcon, PencilIcon } from "../components/icons";
import { me } from "../lib/api/app.functions";
import type { DrillId, DrillSettings } from "../lib/drills";
import {
  defaultDrillSettings,
  DRILL_OPTIONS,
  drillTuneSummary,
  trimDrillSettings,
} from "../lib/drills";
import { assignDrill, tutorStudents } from "../lib/api/tutor.functions";
import { closedHead } from "../lib/seo";

export const Route = createFileRoute("/repetitor/trenazhery")({
  head: () => closedHead("Тренажёры, Совёнок"),
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
 * темами. Здесь они выдаются сразу группе, как и темы: на занятии тренажёр
 * назначают всем, а не по одному.
 *
 * Подписи «что тренирует» и «когда задавать» с карточек убраны: педагог
 * знает свои тренажёры и приходит сюда за кнопкой «задать», а не за
 * описанием. Порядок тот же, что у ребёнка в занятиях: сначала счёт и
 * таблица, потом русский, потом чтение.
 *
 * А вот одна подпись под названием всё-таки нужна, и она про другое.
 * Список из одних заголовков не показывал главного: «Задать» не выдаёт
 * тренажёр целиком, а открывает форму, где выбирают разрядность, набор
 * действий, таймер, уровень таблицы. Педагог этого не видел и просил
 * ребёнка словами — «поставь двузначные и без таймера», — что, конечно,
 * не выполнялось. Перечень собирается из DRILL_OPTIONS (lib/drills.ts),
 * по которым рисуется сама форма, поэтому соврать ей он не может.
 */
const TRAINERS = [
  {
    id: "schet" as const,
    Icon: AbacusIcon,
    title: "Устный счёт",
  },
  {
    id: "tablica" as const,
    Icon: MultiplyIcon,
    title: "Таблица умножения",
  },
  {
    id: "pravopisanie" as const,
    Icon: PencilIcon,
    title: "Правописание",
  },
  {
    id: "chtenie" as const,
    Icon: BookIcon,
    title: "Скорочтение",
  },
  {
    id: "shulte" as const,
    Icon: GridIcon,
    title: "Таблица Шульте",
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
        <h1 style={{ fontSize: "var(--sov-t-display)" }}>Тренажёры</h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
          Не привязаны к темам и работают без подписки. Задать можно сразу нескольким ученикам — так
          же, как тему.
        </p>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        <div className="sov-prog" style={{ marginTop: 24 }}>
          {TRAINERS.map((t) => (
            <article key={t.id} className="sov-prog__item">
              <div className="sov-prog__head sov-prog__head--center">
                <div className="sov-prog__title">
                  <strong className="sov-prog__name">
                    <t.Icon size={20} />
                    {t.title}
                  </strong>
                  <span className="sov-prog__tune">Настроите: {drillTuneSummary(t.id)}</span>
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
  kind: DrillId;
  students: Students;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState(defaultDue());
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Настройки те же, что внутри тренажёра: педагог задаёт не «скорочтение
  // вообще», а конкретный заход — 120 слов в минуту, тридцать примеров.
  const [settings, setSettings] = useState<DrillSettings>(() => defaultDrillSettings(kind));

  function setValue(key: string, value: string, multi: boolean) {
    setSettings((prev) => {
      if (!multi) return { ...prev, [key]: value };
      const chosen = (prev[key] ?? "").split(",").filter(Boolean);
      const next = chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value];
      // Последнюю галочку не снимаем: без единого действия тренажёру нечего
      // показывать, и он просто не запустится.
      if (next.length === 0) return prev;
      return { ...prev, [key]: next.join(",") };
    });
  }

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

      <div className="sov-drill-setup">
        {DRILL_OPTIONS[kind].map((option) => {
          const chosen = (settings[option.key] ?? "").split(",");
          return (
            <div key={option.key} className="sov-drill-setup__row">
              <span className="sov-drill-setup__label">{option.label}</span>
              <div className="sov-chips">
                {option.values.map((value) => (
                  <button
                    key={value.value}
                    type="button"
                    className="sov-chip"
                    data-active={chosen.includes(value.value)}
                    onClick={() => setValue(option.key, value.value, option.multi)}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
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
                data: {
                  kind,
                  childIds: picked,
                  dueAt: due ? new Date(due).toISOString() : null,
                  settings: trimDrillSettings(kind, settings),
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
