/**
 * «Тренажёры» отдельным разделом рядом с темами: выдача сразу нескольким
 * с настройками. Один экран и один адрес на обе роли, как и
 * curriculum-screen: слова берутся из SCREEN_WORDS по роли из me().
 *
 * Подписи «что тренирует» и «когда задавать» с карточек убраны: сюда
 * приходят за кнопкой «задать», а не за описанием. Список тренажёров тот
 * же, что у ребёнка в занятиях, и приезжает из того же места
 * (components/trainers.tsx) — своя копия здесь уже была и умела
 * разъехаться с общей. Под названием стоит одна подпись — про другое:
 * «Задать» не выдаёт тренажёр целиком, а открывает форму, где выбирают
 * разрядность, набор действий, таймер, уровень таблицы. Перечень
 * собирается из DRILL_OPTIONS (lib/drills.ts), по которым рисуется сама
 * форма, поэтому соврать ей он не может.
 *
 * Рядом с «Задать» стоит «Открыть»: тренажёр можно пройти самому. Педагог
 * задаёт то, что видел, а не то, о чём прочёл в одной строке настроек, — и
 * первым делом спрашивают именно об этом. Заход при этом помечен пробным
 * (PROBE_SEARCH), и ни в чей отчёт он не ложится: см. lib/drill-search.ts.
 *
 * Список тех, кому задавать, берётся из me(): и у репетитора, и у
 * родителя это всё, к кому у него есть доступ, а тяжёлая сводка
 * tutorStudents с домашкой и зонами риска здесь ни к чему.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AssignDrillPanel } from "./assign-drill";
import { QuietAction, SiteFooter, SiteHeader } from "./brand";
import { TRAINERS } from "./trainers";
import { me } from "../lib/api/app.functions";
import { type Audience, capsFor, SCREEN_WORDS, wrongDoor } from "../lib/cabinet";
import { PROBE_SEARCH } from "../lib/drill-search";
import { drillTuneSummary } from "../lib/drills";

type Students = { id: string; name: string; grade: number }[];

export function TrainersScreen() {
  const [audience, setAudience] = useState<Audience>("parent");
  /* Настройка захода — платная. У родителя, чьего ребёнка оплатил
     репетитор, своей подписки нет, а настраивать он вправе: сервер решает
     это по каждому ребёнку отдельно (assignDrill), здесь же — только
     показывать ли форму. */
  const [canTune, setCanTune] = useState(false);
  const words = SCREEN_WORDS[audience];
  const navigate = useNavigate();
  const [students, setStudents] = useState<Students>([]);
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const account = await me();
        const door = wrongDoor(account);
        if (door) {
          await navigate({ to: door });
          return;
        }
        setAudience(capsFor(account.user?.role).audience);
        setCanTune(account.user?.subscriptionStatus === "active" || account.activeChildPaid);
        setStudents(account.children.map((c) => ({ id: c.id, name: c.name, grade: c.grade })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить список");
      }
    })();
  }, [navigate]);

  return (
    <div className="sov">
      <SiteHeader
        right={
          <>
            <QuietAction to={words.topicsTo}>Повторение</QuietAction>
            <QuietAction to={words.backTo}>{words.back}</QuietAction>
          </>
        }
      />

      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <h1 style={{ fontSize: "var(--sov-t-display)" }}>Тренажёры</h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
          Не привязаны к темам: сами упражнения открыты всем и всегда. По подписке заход
          настраивается и результат сохраняется. Задать можно сразу нескольким — так же, как тему, а
          «Открыть» проходит тренажёр самому: такой заход ни в чей отчёт не попадает.
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
                  {/* «Открыть» — пройти тренажёр самому, на пробу. Тихая
                      плашка того же веса, что «Задать»: слова тут разные
                      настолько, что различать их ещё и оформлением незачем.
                      Ссылка, а не кнопка: это переход на другой экран, и
                      открыть его в соседней вкладке взрослый вправе. */}
                  <Link
                    to={t.to}
                    search={PROBE_SEARCH as never}
                    className="sov-act-ghost"
                    style={{ textDecoration: "none" }}
                  >
                    Открыть
                  </Link>
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
                <AssignDrillPanel
                  kind={t.id}
                  students={students}
                  words={words}
                  canTune={canTune}
                  onDone={() => setOpenFor(null)}
                />
              ) : null}
            </article>
          ))}
        </div>

        {students.length === 0 ? (
          <p style={{ marginTop: 18, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
            {words.noOne}
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
