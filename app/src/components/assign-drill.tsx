/**
 * Форма выдачи тренажёра: кому, с какими настройками и до какого числа.
 *
 * Живёт отдельным файлом, потому что открывается из двух мест: из раздела
 * «Тренажёры», где задают сразу нескольким, и из карточки ребёнка, где
 * адресат один и выбирать некого. Во втором случае чипы с именами не
 * рисуются вовсе — выбор из одного элемента это не выбор, а лишний шаг.
 *
 * Настройки — те же, что внутри самого тренажёра: задают не «скорочтение
 * вообще», а конкретный заход — 120 слов в минуту, тридцать примеров.
 * Перечень собирается из DRILL_OPTIONS (lib/drills.ts), по которым рисуется
 * и форма настройки у ребёнка, поэтому разойтись они не могут.
 */

import { useState } from "react";

import { assignDrill } from "../lib/api/tutor.functions";
import type { DrillId, DrillSettings } from "../lib/drills";
import { defaultDrillSettings, DRILL_OPTIONS, trimDrillSettings } from "../lib/drills";

export type AssignTargets = { id: string; name: string; grade: number }[];

function defaultDue(): string {
  return new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
}

/** Базовая настройка словами: «однозначные, + сложение, − вычитание, 10 сек, 10». */
function baseNote(kind: DrillId): string {
  return DRILL_OPTIONS[kind]
    .map((option) =>
      option.fallback
        .split(",")
        .map((v) => option.values.find((o) => o.value === v)?.label ?? v)
        .join(", "),
    )
    .join(" · ");
}

export function AssignDrillPanel({
  kind,
  students,
  words,
  canTune = true,
  onDone,
  onAssigned,
}: {
  kind: DrillId;
  students: AssignTargets;
  /** Два слова, которые зависят от того, чей это кабинет. */
  words: { pick: string; assigned: string };
  /** Открыта ли настройка захода: она платная, как и сохранение результата. */
  canTune?: boolean;
  onDone: () => void;
  /** Задание выдано: список домашки рядом надо перечитать. */
  onAssigned?: () => Promise<void> | void;
}) {
  // Один адресат отмечается сам: на карточке ребёнка выбирать не из кого.
  const single = students.length === 1;
  const [picked, setPicked] = useState<string[]>(single ? [students[0].id] : []);
  const [due, setDue] = useState(defaultDue());
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Настройки те же, что внутри тренажёра: задают не «скорочтение вообще»,
  // а конкретный заход — 120 слов в минуту, тридцать примеров.
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
    return (
      <p className="sov-prog__ok">
        {words.assigned}: {done}.
      </p>
    );
  }

  return (
    <div className="sov-prog__assign">
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-chips" hidden={single}>
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

      {/* Без подписки настройки не показываются вовсе, а не гаснут: выбрать
          в них всё равно нечего, а сервер выданное всё равно не примет
          (assignDrill проверяет доступ каждого ребёнка отдельно). Задание
          при этом уходит — просто в той настройке, с которой тренажёр
          открывается сам. */}
      {!canTune ? (
        <p className="sov-setup__lock">
          Настройки захода — по подписке. Задание уйдёт в базовой настройке: {baseNote(kind)}.
        </p>
      ) : null}

      <div className="sov-drill-setup" hidden={!canTune}>
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
                  settings: canTune ? trimDrillSettings(kind, settings) : null,
                },
              });
              setDone(res.count);
              // Домашка лежит на том же экране: без этого выданный тренажёр
              // появлялся бы в ней только после перезагрузки страницы.
              await onAssigned?.();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не получилось задать");
            }
            setPending(false);
          }}
        >
          {/* «Задать 1» там, где адресат один, звучит как счёт — считать
              нечего, поэтому кнопка просто «Задать». */}
          {picked.length === 0 ? words.pick : single ? "Задать" : `Задать ${picked.length}`}
        </button>
        <button type="button" className="sov-act-ghost" onClick={onDone}>
          Отмена
        </button>
      </div>
    </div>
  );
}
