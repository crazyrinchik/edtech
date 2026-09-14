import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { AssignDrillPanel } from "../components/assign-drill";
import { ChildAvatar, SiteFooter } from "../components/brand";
import {
  CabinetHeader,
  CabinetLoading,
  needsPin,
  PinGate,
  useCabinetAccount,
} from "../components/cabinet-parts";
import {
  dayStreak,
  Delta,
  PASS_PERCENT,
  Spark,
  WeekStrip,
  weekBuckets,
} from "../components/figures";
import { HomeworkDesk, type HomeworkCard } from "../components/homework-desk";
import { TRAINERS } from "../components/trainers";
import { lockParentCabinet, parentReport, selectChild } from "../lib/api/app.functions";
import { saveStudentNote, studentCard } from "../lib/api/tutor.functions";
import { capsFor, linkCaps } from "../lib/cabinet";
import { PROBE_SEARCH } from "../lib/drill-search";
import { DRILL_ROW_KIND } from "../lib/drills";
import { closedHead } from "../lib/seo";
import { plural } from "../lib/shop";

/**
 * Рабочий экран кабинета: один ребёнок, всё про него.
 *
 * Один на обе роли. Репетитор приходит сюда из списка учеников, родитель —
 * прямо со входа, и делают они одно и то же: смотрят, занимался ли, и
 * задают следующее. Раньше это было два разных экрана — карточка ученика у
 * репетитора и кабинет со вкладками у родителя, — а различались они словами
 * и тем, что у родителя не было половины возможностей.
 *
 * Порядок блоков — это и есть ответ на вопрос, что здесь главное. Сначала
 * строка словами: занимался ли и сколько дней подряд. Потом тренажёры с
 * рекордами и кнопкой «задать» у каждого: тренажёр — то, ради чего ребёнок
 * открывает Совёнка сам, и взрослый должен видеть его первым, а не искать
 * на третьем уровне внутри вкладки «Задания», как было. Потом домашка. И
 * только потом — занятия по темам, история и разбор: это отчёт, за ним
 * приходят реже, чем за «что задать сегодня».
 */
export const Route = createFileRoute("/kabinet/$childId")({
  head: () => closedHead("Кабинет, Совёнок"),
  component: ChildPage,
});

type Report = Awaited<ReturnType<typeof parentReport>>;

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ChildPage() {
  const { childId } = useParams({ from: "/kabinet/$childId" });
  const navigate = useNavigate();
  const { account, reload } = useCabinetAccount();
  const [report, setReport] = useState<Report | null>(null);
  const [card, setCard] = useState<HomeworkCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = account ? !needsPin(account) : false;

  const load = useCallback(async () => {
    if (!open) return;
    try {
      // Два запроса, а не один: отчёт про занятия, карточка — про домашку,
      // и обновлять их приходится по отдельности. Выдача задания не должна
      // перезагружать недельную статистику.
      const [rep, hw] = await Promise.all([
        parentReport({ data: { childId } }),
        studentCard({ data: { childId } }),
      ]);
      setReport(rep);
      setCard(hw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть кабинет");
    }
  }, [childId, open]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadCard = useCallback(async () => {
    setCard(await studentCard({ data: { childId } }));
  }, [childId]);

  if (!account) return <CabinetLoading />;
  if (needsPin(account)) {
    return <PinGate creating={!account.parentPinSet} onDone={reload} />;
  }

  /* Что можно с этим ребёнком, решает связь с ним, а не роль учётной
     записи: у репетитора бывает и свой первоклассник, и тогда на его
     странице нужны лимит времени и звук, а не заметка и приглашение. */
  const caps = capsFor(account.user?.role);
  const link = linkCaps(card?.access);
  const mine = account.children.filter((c) => c.access !== "tutor");

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
        {error ? <div className="sov-alert">{error}</div> : null}

        {report ? (
          <div className="sov-student__title">
            <ChildAvatar avatar={report.child.avatar} size={56} />
            <div>
              <h1 style={{ fontSize: "var(--sov-t-h1)" }}>{report.child.name}</h1>
              <p style={{ color: "var(--sov-ink-soft)", fontWeight: 600 }}>
                {report.child.grade} класс
                {link.invite && card
                  ? card.child.parentLinked
                    ? " · родитель подключён"
                    : " · родитель не подключён"
                  : null}
              </p>
            </div>
          </div>
        ) : null}

        {/* Другие дети — прямо здесь, а не отдельным экраном: у семьи их
            обычно двое, и переключаться между ними надо чаще, чем ходить в
            список. Репетитору чипы не рисуются: учеников у него десяток. */}
        {link.access === "parent" && mine.length > 1 ? (
          <div className="sov-chips" style={{ marginTop: 14 }}>
            {mine.map((child) => (
              <button
                key={child.id}
                className="sov-chip sov-chip--child"
                data-active={child.id === childId}
                onClick={async () => {
                  await selectChild({ data: { childId: child.id } });
                  await navigate({ to: "/kabinet/$childId", params: { childId: child.id } });
                }}
              >
                <ChildAvatar avatar={child.avatar} size={24} />
                {child.name}
              </button>
            ))}
          </div>
        ) : null}

        {report ? <Verdict report={report} /> : null}

        {report && report.subscription !== "active" && card && !card.paid ? (
          <PaywallHint to={caps.canTakeStudents ? "/repetitor/podpiska" : "/kabinet/podpiska"} />
        ) : null}

        <h2 className="sov-kabinet__h">Тренажёры</h2>
        <p className="sov-kabinet__sub">
          Сами упражнения открыты всегда; по подписке заход настраивается, а результат и рекорд
          серии сохраняются. «Задать» ставит тренажёр в домашку.
        </p>
        {report ? (
          <Trainers report={report} onAssigned={reloadCard} canTune={!!card?.paid} />
        ) : null}

        {card ? (
          <HomeworkDesk
            key={childId}
            childId={childId}
            card={card}
            audience={link.access}
            onReload={reloadCard}
          />
        ) : null}

        {report ? <Lessons report={report} /> : null}

        {link.note && card ? (
          <TutorNote key={childId} childId={childId} initial={card.note} />
        ) : null}

        <p style={{ marginTop: 30 }}>
          <Link to="/kabinet" className="sov-act-quiet">
            {link.access === "tutor" ? "К списку учеников" : "Ко всем детям"}
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Вывод словами над всем остальным.
 *
 * Взрослый приходит с одним вопросом — «всё нормально или надо вмешаться», —
 * и раньше на него отвечали четыре плитки и таблица, из которых вывод
 * нужно было собрать самому. Здесь тот же отчёт произносится двумя
 * строками, и ни одной новой цифры для этого не понадобилось.
 *
 * Тренажёр в этих строках равен теме. Пока неделя считалась по одним
 * занятиям, ребёнок, который каждый день решал примеры на время, получал
 * «не занимался на этой неделе».
 */
function Verdict({ report }: { report: Report }) {
  const name = report.child.name;
  const streak = dayStreak(report.activeAt);
  const days = streak >= 2 ? `, ${streak} ${plural(streak, "день", "дня", "дней")} подряд` : "";
  /* Точки недели считаются по всей активности, а не по одним занятиям:
     иначе у ребёнка, который всю неделю заходил в тренажёры, неделя стоит
     пустой — ровно то же враньё, что и «не занимался» в строке выше. */
  const week = weekBuckets(
    report.activeAt.map((at) => ({ at })),
    (r) => r.at,
  );
  const days7 = week.map((d) => ({ label: d.label, count: d.rows.length, today: d.today }));
  const weekAgo = Date.now() - 7 * 864e5;
  const runs = report.activeAt.filter((at) => new Date(at).getTime() > weekAgo).length;
  const drillRuns = Math.max(0, runs - report.weekLessons);

  const delta =
    report.weekAccuracy !== null && report.prevAccuracy !== null
      ? report.weekAccuracy - report.prevAccuracy
      : null;
  const trend =
    delta === null
      ? "первая неделя занятий"
      : delta >= 5
        ? `доля верных выросла на ${delta} пунктов`
        : delta <= -5
          ? `доля верных упала на ${-delta} пунктов`
          : "доля верных держится на месте";

  const unassigned = report.risk.filter((r) => !r.assigned);

  let head: string;
  let note: string;
  let tone: "ok" | "warn";
  if (runs === 0) {
    head = `${name} не занимался на этой неделе.`;
    note =
      report.history.length === 0 && report.drills.length === 0
        ? "Занятий пока не было совсем — начните с любого тренажёра: они открыты и без подписки."
        : "Прошлые занятия сохранены, прогресс не потерян.";
    tone = "warn";
  } else if (report.weekLessons === 0) {
    head = `${name} занимался тренажёрами: ${drillRuns} ${plural(drillRuns, "заход", "захода", "заходов")} за неделю${days}.`;
    note = "Тем на этой неделе не было — их можно задать в домашке ниже.";
    tone = "ok";
  } else {
    const lessons = `${report.weekLessons} ${plural(report.weekLessons, "раз", "раза", "раз")}`;
    head = `${name} занимался ${lessons} за неделю${days}, ${trend}.`;
    note =
      report.risk.length === 0
        ? "Ни одна тема не просела ниже порога."
        : unassigned.length === 0
          ? `Все просевшие темы (${report.risk.length}) уже заданы — вмешиваться не нужно.`
          : `Ниже порога ${report.risk.length} ${plural(report.risk.length, "тема", "темы", "тем")}, и «${unassigned[0].topic}» пока никто не задавал.`;
    tone = unassigned.length > 0 ? "warn" : "ok";
  }

  return (
    <div className="sov-verdict" data-tone={tone}>
      <strong>{head}</strong>
      <span>{note}</span>
      {/* Неделя точками: пропущенный день видно без единого числа. Минуты
          и доля верных — только когда на неделе были темы: и то и другое
          считается по занятиям, а у захода в тренажёр ни темы, ни разбора
          ошибок нет. */}
      <div className="sov-verdict__week">
        <WeekStrip days={days7} />
        {report.weekLessons > 0 ? (
          <span>
            {report.weekMinutes} мин по темам · верных {report.weekAccuracy ?? report.accuracy}%
            {delta !== null ? <Delta value={delta} /> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Плашка про подписку. Что именно она открывает — по новой границе. */
function PaywallHint({ to }: { to: string }) {
  return (
    <div className="sov-save-hint" style={{ marginTop: 22 }}>
      <strong>Подписка не активна</strong>
      <span>
        Все шесть тренажёров работают и так, в базовой настройке. Подписка сохраняет результаты и
        рекорды, разрешает настраивать заход — разрядность, таймер, уровень, набор правил — и
        открывает темы всех классов.
      </span>
      <p style={{ marginTop: 12 }}>
        <Link to={to} className="sov-act-ghost" style={{ textDecoration: "none" }}>
          Оформить подписку
        </Link>
      </p>
    </div>
  );
}

/**
 * Пять карточек тренажёров: рекорд, последние заходы, «открыть» и «задать».
 *
 * Рекорд стоит первым числом. Доля верных отвечает на вопрос взрослого
 * («справляется?»), а рекорд серии — на вопрос ребёнка («получилось!»), и
 * именно за ним он возвращается в тренажёр. Взрослому он нужен затем же,
 * зачем родителю нужен счёт в игре: чтобы было о чём спросить за ужином.
 *
 * Порядок карточек тот же, что у ребёнка на экране занятий: список один
 * (components/trainers.tsx), и переставлять его здесь значит заставить
 * взрослого и ребёнка говорить о разных вторых пунктах.
 */
function Trainers({
  report,
  onAssigned,
  canTune,
}: {
  report: Report;
  onAssigned: () => Promise<void>;
  canTune: boolean;
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const targets = [{ id: report.child.id, name: report.child.name, grade: report.child.grade }];

  return (
    <div className="sov-prog" style={{ marginTop: 18 }}>
      {TRAINERS.map((trainer) => {
        const kind = DRILL_ROW_KIND[trainer.id];
        const row = report.drills.find((d) => d.kind === kind);
        const series = report.drillRuns
          .filter((r) => r.kind === kind)
          .slice(-8)
          .map((r) =>
            kind === "reading" ? r.score : r.total ? Math.round((r.correct / r.total) * 100) : 0,
          );
        const percent = row && row.total ? Math.round((row.correct / row.total) * 100) : 0;
        const change = series.length > 1 ? series[series.length - 1] - series[0] : null;

        return (
          <article key={trainer.id} className="sov-prog__item">
            <div className="sov-prog__head sov-prog__head--center">
              <div className="sov-prog__title">
                <strong className="sov-prog__name">
                  <trainer.Icon size={20} />
                  {trainer.title}
                </strong>
                <span className="sov-prog__tune">
                  {!row ? (
                    "заходов пока не было"
                  ) : (
                    <>
                      {row.best_streak >= 2 ? (
                        <b className="sov-record">рекорд {row.best_streak} подряд</b>
                      ) : null}
                      {kind === "reading"
                        ? `${series[series.length - 1] ?? 0} слов в минуту`
                        : `верных ${percent}%`}
                      {" · "}
                      {row.runs} {plural(row.runs, "заход", "захода", "заходов")}
                      {row.last_at ? `, последний ${DATE.format(new Date(row.last_at))}` : ""}
                    </>
                  )}
                </span>
              </div>
              <div className="sov-prog__actions">
                {change !== null ? <Delta value={change} /> : null}
                {/* «Открыть» — пройти тренажёр самому: прежде чем задать его
                    ребёнку, полезно увидеть, что там на экране. Заход помечен
                    пробным и не ложится ни в чей отчёт — в том числе в этот,
                    открытый рядом (см. drillWho в lib/drill-search.ts). */}
                <Link
                  to={trainer.to}
                  search={PROBE_SEARCH as never}
                  className="sov-act-ghost"
                  style={{ textDecoration: "none" }}
                >
                  Открыть
                </Link>
                <button
                  type="button"
                  className="sov-act-ghost"
                  onClick={() => setOpenFor(openFor === trainer.id ? null : trainer.id)}
                >
                  Задать
                </button>
              </div>
            </div>

            {series.length > 1 ? (
              <Spark points={series} label={`${trainer.title}: последние заходы`} />
            ) : null}

            {openFor === trainer.id ? (
              <AssignDrillPanel
                kind={trainer.id}
                students={targets}
                words={{ pick: "Выберите, кому", assigned: "Задано" }}
                canTune={canTune}
                onDone={() => setOpenFor(null)}
                onAssigned={onAssigned}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

/**
 * Занятия по темам: последние пять на виду, остальное — под раскрытием.
 *
 * Полная таблица занимала целую вкладку и повторяла то же, что видно в
 * пяти строках. Вкладки больше нет, а история никуда не делась — просто
 * лежит свёрнутой, как и разбор по темам.
 */
function Lessons({ report }: { report: Report }) {
  if (report.history.length === 0 && report.mastery.length === 0) return null;

  return (
    <section style={{ marginTop: 34 }}>
      <h2 className="sov-kabinet__h">Занятия по темам</h2>

      {report.history.length === 0 ? (
        <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
          По темам ребёнок пока не занимался.
        </p>
      ) : (
        <div className="sov-tablewrap" style={{ marginTop: 12 }}>
          <table className="sov-table sov-table--cards sov-table--tight">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Предмет</th>
                <th>Тема</th>
                <th>Результат</th>
              </tr>
            </thead>
            <tbody>
              {report.history.slice(0, 5).map((h, i) => (
                <tr key={i}>
                  <td data-label="Дата">{fmt(h.started_at)}</td>
                  <td data-label="Предмет">{h.subject}</td>
                  <td data-label="Тема">{h.topic}</td>
                  <td data-label="Результат">
                    {h.correct} из {h.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.history.length > 5 ? (
        <details className="sov-more">
          <summary>Вся история занятий</summary>
          <div className="sov-tablewrap">
            <table className="sov-table sov-table--cards">
              <tbody>
                {report.history.map((h, i) => (
                  <tr key={i}>
                    <td data-label="Дата">{fmt(h.started_at)}</td>
                    <td data-label="Предмет">{h.subject}</td>
                    <td data-label="Тема">{h.topic}</td>
                    <td data-label="Результат">
                      {h.correct} из {h.total}
                    </td>
                    <td data-label="Минут">{Math.max(1, Math.round(h.seconds / 60))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {report.mastery.length > 0 ? (
        <details className="sov-more">
          <summary>Доля верных по каждой теме</summary>
          <div className="sov-mastery">
            {report.mastery.map((m) => (
              <div key={`${m.subjectId}-${m.topic}`} className="sov-mastery__row">
                <div>
                  <strong>{m.topic}</strong>
                </div>
                <span className="sov-mastery__val" data-risk={m.percent < PASS_PERCENT}>
                  {m.percent}%
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {report.hasTutor ? (
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
          Задания наставника хранятся, пока существует его учётная запись: если он удалит её, они
          исчезнут, а результаты занятий и прогресс ребёнка останутся.
        </p>
      ) : null}
    </section>
  );
}

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
      style={{ marginTop: 30 }}
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
        {busy ? "Сохраняем…" : dirty || !saved.trim() ? "Сохранить заметку" : "Сохранено"}
      </button>
    </form>
  );
}
