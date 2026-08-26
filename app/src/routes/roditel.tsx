import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  CHILD_AVATARS,
  ChildAvatar,
  FormAction,
  Owl,
  QuietAction,
  SiteFooter,
  SiteHeader,
} from "../components/brand";
import {
  Bar,
  DayBars,
  Delta,
  PASS_PERCENT,
  Ring,
  Spark,
  WeekStrip,
  weekBuckets,
} from "../components/figures";
import { PayForm } from "../components/pay-form";
import {
  addChild,
  cancelSubscription,
  deleteAccount,
  deleteChild,
  lockParentCabinet,
  logout,
  me,
  notifyConnect,
  notifyDisconnect,
  notifySettings,
  notifyToggle,
  parentReport,
  redeemPromo,
  selectChild,
  setParentPin,
  unlockParentCabinet,
  updateChild,
} from "../lib/api/app.functions";
import { closedHead } from "../lib/seo";
import { plural } from "../lib/shop";
import { FREE_CHILD_LIMIT } from "../lib/billing";

export const Route = createFileRoute("/roditel")({
  head: () => closedHead("Кабинет родителя, Совёнок"),
  component: ParentPage,
});

type Report = {
  child: {
    id: string;
    name: string;
    grade: number;
    avatar: string;
    dailyLimitMin: number;
    soundOn: boolean;
  };
  accuracy: number;
  attempts: number;
  weekLessons: number;
  weekMinutes: number;
  topicsDone: number;
  topicsTotal: number;
  stars: number;
  risk: { topic: string; subject: string; percent: number; total: number; assigned: boolean }[];
  mastery: { topic: string; subject: string; subjectId: string; total: number; percent: number }[];
  weekAccuracy: number | null;
  prevAccuracy: number | null;
  weekRuns: { startedAt: string; seconds: number }[];
  drillRuns: { kind: string; correct: number; total: number; score: number; createdAt: string }[];
  history: {
    started_at: string;
    seconds: number;
    correct: number;
    total: number;
    topic: string;
    subject: string;
  }[];
  drills: { kind: string; runs: number; correct: number; total: number; last_at: string }[];
  subscription: string;
  hasTutor: boolean;
};
type Account = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    subscriptionStatus: string;
  } | null;
  children: { id: string; name: string; grade: number; avatar: string }[];
  activeChildId: string | null;
  parentPinSet: boolean;
  parentUnlocked: boolean;
};
type Channel = {
  channel: "tg" | "max";
  title: string;
  ready: boolean;
  connected: boolean;
  enabled: boolean;
  code: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ParentPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState<"progress" | "history" | "settings" | "billing" | "notify">(
    "progress",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /* Место занято: подписки нет, а профиль уже заведён. Считается по
     тому же account, который и так пришёл, — лишнего запроса не нужно. */
  const childLimitReached =
    !!account &&
    account.user?.subscriptionStatus !== "active" &&
    account.children.length >= FREE_CHILD_LIMIT;

  const load = useCallback(async () => {
    const acc = (await me()) as unknown as Account;
    if (!acc.user) {
      await navigate({ to: "/vhod" });
      return;
    }
    setAccount(acc);
    // Отчёт запрашивается только за открытой дверью: сервер всё равно
    // ответит отказом, а лишняя ошибка в консоли путает.
    if (acc.parentPinSet && !acc.parentUnlocked) {
      setReport(null);
      return;
    }
    const active = acc.activeChildId ?? acc.children[0]?.id;
    if (active) setReport(await parentReport({ data: { childId: active } }));
    else setReport(null);
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!account) {
    return (
      <div className="sov">
        <SiteHeader />
        <main className="sov-shell">
          <p>Загружаем кабинет…</p>
        </main>
      </div>
    );
  }

  // Вход в приложение один на семью, поэтому дверь в кабинет своя: без кода
  // ребёнок в два касания снял бы себе лимит времени и выдал подписку.
  if (!account.parentPinSet || !account.parentUnlocked) {
    return <PinGate creating={!account.parentPinSet} onDone={load} />;
  }

  return (
    <div className="sov">
      <SiteHeader
        right={
          <>
            {report ? (
              <Link to="/uchenik" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                Занятия ребёнка
              </Link>
            ) : null}
            {account.user?.role === "admin" ? (
              <Link to="/admin" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                Админка
              </Link>
            ) : null}
            <button
              className="sov-act-ghost"
              onClick={async () => {
                await lockParentCabinet();
                await load();
              }}
            >
              Закрыть кабинет
            </button>
            <button
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
        <h1 style={{ fontSize: "var(--sov-t-h1)", fontWeight: 700, marginTop: 16 }}>
          Кабинет родителя
        </h1>
        <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
          {account.user?.name}, статус подписки:{" "}
          {account.user?.subscriptionStatus === "active" ? "активна" : "бесплатный доступ"}.
        </p>

        <div className="sov-chips">
          {account.children.map((child) => (
            <button
              key={child.id}
              className="sov-chip sov-chip--child"
              data-active={report?.child.id === child.id}
              onClick={async () => {
                await selectChild({ data: { childId: child.id } });
                await load();
              }}
            >
              <ChildAvatar avatar={child.avatar} size={24} />
              {child.name}, {child.grade} класс
            </button>
          ))}
        </div>

        {notice ? (
          <div
            className="sov-alert"
            style={{ marginTop: 16, background: "#e6f4ea", color: "var(--sov-ok)" }}
          >
            {notice}
          </div>
        ) : null}

        {!report ? (
          <>
            <AddChildForm onAdded={load} limited={childLimitReached} />
            {/* Без этого блока родитель, удаливший единственный профиль,
                не смог бы отозвать согласие целиком: вкладка настроек
                открывается только при выбранном ребёнке. */}
            <div style={{ marginTop: 48 }}>
              <DeleteAccountBlock />
            </div>
          </>
        ) : (
          <>
            <Verdict report={report} />
            <ReportTiles report={report} />

            <div className="sov-tabs">
              {(
                [
                  ["progress", "Прогресс"],
                  ["history", "История"],
                  ["notify", "Напоминания"],
                  ["settings", "Настройки"],
                  ["billing", "Подписка"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} data-active={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "progress" ? (
              <ProgressTab report={report} onHistory={() => setTab("history")} />
            ) : null}

            {tab === "history" ? (
              <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>История занятий</h2>
                {report.hasTutor ? (
                  <p
                    style={{
                      marginTop: 8,
                      color: "var(--sov-ink-soft)",
                      fontSize: "var(--sov-t-cap)",
                    }}
                  >
                    Задания наставника хранятся, пока существует его учётная запись: если он удалит
                    её, они исчезнут, а результаты занятий и прогресс ребёнка останутся.
                  </p>
                ) : null}
                {report.history.length === 0 ? (
                  <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
                    Занятий пока не было.
                  </p>
                ) : (
                  /* Пять колонок и телефон.

                     На 375 px таблица уезжала за правый край и тянула за
                     собой всю страницу — горизонтальная прокрутка всего
                     кабинета из-за одной вкладки. Обёртка со скроллом
                     оставляет это внутри самой таблицы, а ниже 640 px
                     строка разворачивается в карточку: подпись колонки
                     берётся из data-label, поэтому разметка одна и
                     заголовок с ячейкой не могут разойтись. */
                  <div className="sov-tablewrap">
                    <table className="sov-table sov-table--cards">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Предмет</th>
                          <th>Тема</th>
                          <th>Результат</th>
                          <th>Минут</th>
                        </tr>
                      </thead>
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
                )}
              </section>
            ) : null}

            {tab === "notify" ? <NotifyTab onNotice={setNotice} /> : null}

            {tab === "settings" ? (
              <section style={{ marginTop: 24, maxWidth: 520 }}>
                <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Настройки занятий</h2>
                <form
                  className="sov-form"
                  style={{ marginTop: 18 }}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    setPending(true);
                    await updateChild({
                      data: {
                        childId: report.child.id,
                        dailyLimitMin: Number(form.get("limit")),
                        soundOn: form.get("sound") === "on",
                      },
                    });
                    setNotice("Настройки сохранены");
                    setPending(false);
                    await load();
                  }}
                >
                  <div className="sov-field">
                    <label htmlFor="limit">Рекомендованное время занятия, минут</label>
                    <input
                      id="limit"
                      name="limit"
                      type="number"
                      min={5}
                      max={120}
                      defaultValue={report.child.dailyLimitMin}
                    />
                    <span className="sov-field__hint">
                      По достижении лимита ребёнок увидит мягкое напоминание об отдыхе.
                    </span>
                  </div>
                  <label className="sov-check">
                    <input type="checkbox" name="sound" defaultChecked={report.child.soundOn} />
                    <span>Звуковое сопровождение заданий</span>
                  </label>
                  <FormAction pending={pending}>Сохранить</FormAction>
                </form>
                <div style={{ marginTop: 40 }}>
                  <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Код родителя</h2>
                  <p
                    style={{
                      marginTop: 8,
                      color: "var(--sov-ink-soft)",
                      fontSize: "var(--sov-t-cap)",
                    }}
                  >
                    Четыре цифры, которые спрашивают на входе в кабинет. Занятия ребёнка кодом не
                    закрываются — он открывает их сам.
                  </p>
                  <ChangePinForm onNotice={setNotice} />
                </div>

                <div style={{ marginTop: 40 }}>
                  <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>
                    Добавить ещё ребёнка
                  </h2>
                  <AddChildForm onAdded={load} compact limited={childLimitReached} />
                </div>

                <div style={{ marginTop: 40 }}>
                  <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Удаление</h2>
                  <DeleteChildBlock
                    child={report.child}
                    onDeleted={async () => {
                      setNotice("Профиль удалён");
                      setTab("progress");
                      await load();
                    }}
                  />
                  <DeleteAccountBlock />
                </div>
              </section>
            ) : null}

            {tab === "billing" ? (
              <section style={{ marginTop: 24, maxWidth: 520 }}>
                <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Подписка</h2>
                <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
                  Сейчас:{" "}
                  {report.subscription === "active"
                    ? "подписка активна, открыты все темы"
                    : "бесплатный доступ, открыта первая тема каждого предмета"}
                  .
                </p>
                {report.subscription === "active" ? (
                  <>
                    {/* Продлить можно, не дожидаясь конца срока: остаток
                        оплаченного периода прибавляется к новому. */}
                    <PayForm onDone={load} />
                    <button
                      className="sov-act-ghost"
                      style={{ marginTop: 28 }}
                      onClick={async () => {
                        await cancelSubscription();
                        setNotice("Подписка отменена");
                        await load();
                      }}
                    >
                      Отменить подписку
                    </button>
                  </>
                ) : (
                  <>
                    <PayForm onDone={load} />
                    <form
                      className="sov-form"
                      style={{ marginTop: 34 }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const code = String(new FormData(e.currentTarget).get("code") ?? "");
                        setPending(true);
                        try {
                          await redeemPromo({ data: { code } });
                          setNotice("Подписка активирована");
                          await load();
                        } catch (err) {
                          setNotice(err instanceof Error ? err.message : "Не удалось активировать");
                        }
                        setPending(false);
                      }}
                    >
                      <div className="sov-field">
                        <label htmlFor="code">Промокод</label>
                        <input id="code" name="code" placeholder="SOVENOK" required />
                        <span className="sov-field__hint">
                          Если подписку выдали промокодом, введите его здесь — платить не нужно.
                        </span>
                      </div>
                      <FormAction pending={pending}>Активировать</FormAction>
                    </form>
                  </>
                )}
              </section>
            ) : null}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

const DRILL_NAMES: Record<string, string> = {
  mental: "Устный счёт",
  reading: "Скорочтение",
  shulte: "Таблица Шульте",
  spelling: "Правописание",
  table: "Таблица умножения",
};

/**
 * Плитки над вкладками.
 *
 * Раньше здесь стояли четыре голых числа. «78%» не отвечает на
 * единственный вопрос родителя — лучше стало или хуже; «96 минут за
 * неделю» не отличает четверть часа каждый день от одного длинного
 * воскресенья. Числа остались, но у каждого появилась фигура, которая
 * показывает то, чего число не показывает.
 */
/**
 * Вывод словами над цифрами.
 *
 * Родитель приходит в кабинет с одним вопросом — «всё нормально или надо
 * вмешаться». Раньше на него отвечали четыре плитки и таблица, из которых
 * вывод нужно было собрать самому: 74%, 86 минут, 5 занятий, 3 темы — а
 * дальше думайте. Здесь тот же отчёт произносится двумя строками, и ни
 * одной новой цифры для этого не понадобилось.
 *
 * Первая строка — про занятия: сколько раз и растёт ли доля верных.
 * Вторая — про то, что просело, и чья это забота. Если всё выше порога,
 * второй строки нет: хорошая новость не нуждается в абзаце.
 */
function Verdict({ report }: { report: Report }) {
  const name = report.child.name;

  if (report.weekLessons === 0) {
    return (
      <div className="sov-verdict" data-tone="warn">
        <strong>{name} не занимался на этой неделе.</strong>
        <span>
          {report.history.length === 0
            ? "Занятий пока не было совсем — начните с любой темы или тренажёра."
            : "Прошлые занятия сохранены, прогресс не потерян."}
        </span>
      </div>
    );
  }

  const lessons = `${report.weekLessons} ${plural(report.weekLessons, "раз", "раза", "раз")}`;
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
  const tone = unassigned.length > 0 ? "warn" : "ok";

  return (
    <div className="sov-verdict" data-tone={tone}>
      <strong>
        {name} занимался {lessons} за неделю, {trend}.
      </strong>
      <span>
        {report.risk.length === 0
          ? "Ни одна тема не просела ниже порога."
          : unassigned.length === 0
            ? `Все просевшие темы (${report.risk.length}) педагог уже задавал — вмешиваться не нужно.`
            : `Ниже порога ${report.risk.length} ${plural(report.risk.length, "тема", "темы", "тем")}, и «${unassigned[0].topic}» педагог пока не задавал.`}
      </span>
    </div>
  );
}

function ReportTiles({ report }: { report: Report }) {
  const week = weekBuckets(report.weekRuns, (r) => r.startedAt);
  const days = week.map((d) => ({
    label: d.label,
    minutes: Math.round(d.rows.reduce((sum, r) => sum + r.seconds, 0) / 60),
    count: d.rows.length,
    today: d.today,
  }));
  const accuracy = report.weekAccuracy ?? report.accuracy;
  const delta =
    report.weekAccuracy !== null && report.prevAccuracy !== null
      ? report.weekAccuracy - report.prevAccuracy
      : null;

  return (
    <div className="sov-metrics">
      <div className="sov-tile">
        <span className="sov-tile__cap">Верных за неделю</span>
        <div className="sov-tile__row">
          <Ring
            value={accuracy}
            size={96}
            threshold={PASS_PERCENT}
            label={`${accuracy} процентов верных ответов за неделю`}
          />
          <div>
            {delta !== null ? <Delta value={delta} /> : null}
            <div className="sov-tile__sub">
              {report.prevAccuracy !== null ? `было ${report.prevAccuracy}%` : "первая неделя"}
            </div>
          </div>
        </div>
      </div>

      <div className="sov-tile">
        <span className="sov-tile__cap">Минуты по дням</span>
        <div style={{ marginTop: 14 }}>
          <DayBars days={days} />
        </div>
        <div className="sov-tile__sub">
          всего {report.weekMinutes} · в среднем {Math.round(report.weekMinutes / 7)} в день
        </div>
      </div>

      <div className="sov-tile">
        <span className="sov-tile__cap">Занятий за неделю</span>
        <div className="sov-tile__big">{report.weekLessons}</div>
        <div style={{ marginTop: 12 }}>
          <WeekStrip days={days} />
        </div>
      </div>

      <div className="sov-tile">
        <span className="sov-tile__cap">Темы</span>
        <div className="sov-tile__big">
          {report.topicsDone}{" "}
          <span style={{ color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-h2)" }}>
            / {report.topicsTotal}
          </span>
        </div>
        <div style={{ marginTop: 14 }}>
          <Bar
            percent={report.topicsTotal ? (report.topicsDone / report.topicsTotal) * 100 : 0}
            threshold={false}
            label={`Пройдено ${report.topicsDone} тем из ${report.topicsTotal}`}
          />
        </div>
        <div className="sov-tile__sub">
          {report.stars} звёзд · осталось {Math.max(0, report.topicsTotal - report.topicsDone)}
        </div>
      </div>
    </div>
  );
}

/**
 * Вкладка «Прогресс» в три колонки.
 *
 * Абзаца «Темы, где ребёнок ошибается чаще всего» больше нет: полоса,
 * которая не дотянулась до засечки порога, говорит это сама. Таблица
 * тренажёров из четырёх колонок свернулась в две линии — в таблице
 * стояло одно среднее за всё время, и падение скорости чтения в ней
 * было невидимо.
 */
function ProgressTab({ report, onHistory }: { report: Report; onHistory: () => void }) {
  const drillSeries = (kind: string) =>
    report.drillRuns
      .filter((r) => r.kind === kind)
      .slice(-8)
      .map((r) =>
        kind === "reading" ? r.score : r.total ? Math.round((r.correct / r.total) * 100) : 0,
      );

  return (
    <section className="sov-progress">
      {report.mastery.length === 0 ? (
        <div className="sov-panel" style={{ marginTop: 24 }}>
          <h3>Занятий пока не было</h3>
          <p style={{ marginTop: 8, color: "var(--sov-ink-soft)" }}>
            Освоение тем и зоны риска появятся после первых заданий.
          </p>
        </div>
      ) : (
        <div className="sov-progress__grid">
          <div className="sov-panel">
            <div className="sov-panel__head">
              <h3>Освоение тем</h3>
              <span className="sov-panel__note">риска — ниже {PASS_PERCENT}%</span>
            </div>
            <div className="sov-mastery">
              {report.mastery.map((m) => (
                <div key={`${m.subjectId}-${m.topic}`} className="sov-mastery__row">
                  <div>
                    <strong>{m.topic}</strong>
                    <Bar percent={m.percent} label={`${m.topic}: ${m.percent} процентов верных`} />
                  </div>
                  <span className="sov-mastery__val" data-risk={m.percent < PASS_PERCENT}>
                    {m.percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="sov-progress__stack">
            <div className="sov-panel">
              <div className="sov-panel__head">
                <h3>
                  {report.risk.length ? `Ниже порога: ${report.risk.length}` : "Всё выше порога"}
                </h3>
              </div>
              {report.risk.length === 0 ? (
                <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
                  Ни одна тема не просела ниже {PASS_PERCENT}%.
                </p>
              ) : (
                <div className="sov-risks">
                  {report.risk.map((r) => (
                    <div key={r.topic} className="sov-risks__row">
                      <Ring
                        value={r.percent}
                        size={66}
                        tone="warn"
                        label={`${r.topic}: ${r.percent} процентов верных`}
                      />
                      <div>
                        <strong>{r.topic}</strong>
                        <span>
                          {r.subject} · {r.total} {plural(r.total, "задание", "задания", "заданий")}
                        </span>
                      </div>
                      {/* Чья это забота. Процент без ответа на этот вопрос
                          заставляет родителя гадать: писать педагогу или он
                          уже занимается. Тема в работе — метка спокойная,
                          зелёная; не задана — охряная, как и сама зона. */}
                      <span className="sov-risks__state" data-tone={r.assigned ? "ok" : "warn"}>
                        {r.assigned ? "задана" : "не задана"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sov-panel">
              <div className="sov-panel__head">
                <h3>Последние занятия</h3>
                <button type="button" className="sov-act-ghost" onClick={onHistory}>
                  Вся история
                </button>
              </div>
              {report.history.length === 0 ? (
                <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
                  Занятий пока не было.
                </p>
              ) : (
                <table className="sov-table sov-table--tight">
                  <tbody>
                    {report.history.slice(0, 4).map((h, i) => (
                      <tr key={i}>
                        <td>{fmt(h.started_at)}</td>
                        <td>{h.topic}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color:
                              h.total && (h.correct / h.total) * 100 < PASS_PERCENT
                                ? "var(--sov-warn)"
                                : "var(--sov-ink)",
                          }}
                        >
                          {h.total ? Math.round((h.correct / h.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="sov-progress__stack">
            {report.drills.length === 0 ? (
              <div className="sov-panel">
                <h3>Тренажёры</h3>
                <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
                  Устный счёт и скорочтение открываются с карты занятий.
                </p>
              </div>
            ) : (
              report.drills.map((d) => {
                const series = drillSeries(d.kind);
                const percent = d.total ? Math.round((d.correct / d.total) * 100) : 0;
                const change = series.length > 1 ? series[series.length - 1] - series[0] : null;
                return (
                  <div key={d.kind} className="sov-panel">
                    <div className="sov-panel__head">
                      <h3 style={{ fontSize: "var(--sov-t-body)" }}>
                        {DRILL_NAMES[d.kind] ?? d.kind}
                      </h3>
                      <span className="sov-panel__note">{d.runs} заходов</span>
                    </div>
                    <Spark
                      points={series}
                      label={`${DRILL_NAMES[d.kind] ?? d.kind}: последние заходы`}
                    />
                    <div className="sov-panel__head">
                      <span className="sov-panel__note">
                        {d.kind === "reading"
                          ? `${series[series.length - 1] ?? 0} слов в минуту`
                          : `верных ${percent}%`}
                      </span>
                      {change !== null ? <Delta value={change} /> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Профиль ребёнка. Без подписки его можно завести один.
 *
 * Когда место занято, формы здесь нет вовсе — вместо неё объяснение и
 * два выхода. Показывать форму, которая заведомо получит отказ, значит
 * заставить человека набрать имя, выбрать класс и аватар ради сообщения
 * об ошибке; про ограничение честнее сказать до того, как он начал.
 *
 * Второй выход — код репетитора — здесь важнее первого: у семьи, чей
 * ребёнок занимается с репетитором, платит репетитор, и предлагать ей
 * подписку первой было бы продажей того, что уже оплачено.
 */
function AddChildForm({
  onAdded,
  compact,
  limited,
}: {
  onAdded: () => Promise<void>;
  compact?: boolean;
  limited?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [avatar, setAvatar] = useState("owl");
  const [error, setError] = useState<string | null>(null);

  if (limited) {
    return (
      <div className="sov-save-hint" style={{ marginTop: compact ? 16 : 32, maxWidth: 520 }}>
        <strong>Без подписки можно завести одного ребёнка</strong>
        <span>
          Если с ребёнком занимается репетитор, попросите у него код приглашения — тогда платить не
          нужно вовсе. Если занимаетесь сами, второй профиль откроет подписка.
        </span>
        <p style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <QuietAction to="/priglashenie">Ввести код репетитора</QuietAction>
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: compact ? 16 : 32, maxWidth: 520 }}>
      {!compact ? (
        <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Добавьте профиль ребёнка</h2>
      ) : null}
      <form
        className="sov-form"
        style={{ marginTop: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          setError(null);
          // Отказ сервера здесь раньше был необработанным: форма молча
          // ничего не делала. Теперь у неё есть ветка на «нет».
          try {
            await addChild({
              data: {
                name: String(form.get("name") ?? ""),
                grade: Number(form.get("grade") ?? 1),
                avatar,
                birthYear: null,
              },
            });
            (e.target as HTMLFormElement).reset();
            await onAdded();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Не получилось добавить профиль");
          } finally {
            setPending(false);
          }
        }}
      >
        {error ? <div className="sov-alert">{error}</div> : null}
        <div className="sov-field">
          <label htmlFor="childname">Имя ребёнка</label>
          {/* Пробел не вводится и не вставляется: одно поле — одно имя.
              Фамилию Совёнок не собирает, и сервер её тоже не пропустит
              (addChild в app.functions.ts). */}
          <input
            id="childname"
            name="name"
            required
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(/\s+/g, "");
            }}
          />
        </div>
        <div className="sov-field">
          <label htmlFor="childgrade">Класс</label>
          <select id="childgrade" name="grade" defaultValue="1">
            <option value="1">1 класс</option>
            <option value="2">2 класс</option>
            <option value="3">3 класс</option>
            <option value="4">4 класс</option>
          </select>
        </div>
        {/* Аватар нужен не для красоты: по нему ребёнок находит себя на экране
            выбора профиля, ещё не умея читать имена. */}
        <div className="sov-field">
          <label>Аватар</label>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
        <FormAction pending={pending}>Добавить</FormAction>
      </form>
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="sov-avatar-pick">
      {CHILD_AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          className="sov-avatar-pick__item"
          data-active={value === a.id}
          aria-label={a.label}
          aria-pressed={value === a.id}
          onClick={() => onChange(a.id)}
        >
          <ChildAvatar avatar={a.id} size={44} />
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Дверь в кабинет: придумать код или ввести его. Пока кода нет, кабинет
 * открыт — иначе родитель, заведённый до появления этой проверки, оказался бы
 * заперт снаружи; поэтому первый экран не пропускает дальше без кода.
 */
function PinGate({ creating, onDone }: { creating: boolean; onDone: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (creating) {
        if (pin !== repeat) throw new Error("Коды не совпали");
        await setParentPin({ data: { pin, currentPin: null } });
      } else {
        await unlockParentCabinet({ data: { pin } });
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось");
      setPin("");
      setRepeat("");
    }
    setPending(false);
  }

  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        <Owl size={64} />
        <h1 style={{ fontSize: "var(--sov-t-h1)", fontWeight: 700, marginTop: 18 }}>
          {creating ? "Придумайте код родителя" : "Кабинет родителя закрыт"}
        </h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
          {creating
            ? "Четыре цифры, которые знает только взрослый. Занятия ребёнка кодом не закрываются — он заходит в них сам."
            : "Введите четыре цифры, чтобы открыть отчёты, настройки и подписку."}
        </p>
        <form className="sov-form" style={{ marginTop: 30 }} onSubmit={submit}>
          {error ? <div className="sov-alert">{error}</div> : null}
          <div className="sov-field">
            <label htmlFor="pin">{creating ? "Новый код" : "Код"}</label>
            <input
              id="pin"
              className="sov-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
            />
          </div>
          {creating ? (
            <div className="sov-field">
              <label htmlFor="pin2">Повторите код</label>
              <input
                id="pin2"
                className="sov-pin"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                required
              />
              <span className="sov-field__hint">
                Не ставьте дату рождения ребёнка и четыре одинаковые цифры.
              </span>
            </div>
          ) : null}
          <FormAction pending={pending}>
            {creating ? "Сохранить код" : "Открыть кабинет"}
          </FormAction>
        </form>
        <div style={{ marginTop: 24 }}>
          <Link to="/uchenik" className="sov-act-ghost" style={{ textDecoration: "none" }}>
            Вернуться к занятиям
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ChangePinForm({ onNotice }: { onNotice: (text: string) => void }) {
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="sov-form"
      style={{ marginTop: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await setParentPin({ data: { pin, currentPin: null } });
          onNotice("Код обновлён");
          setPin("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Не получилось");
        }
        setPending(false);
      }}
    >
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-field">
        <label htmlFor="newpin">Новый код</label>
        <input
          id="newpin"
          className="sov-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          required
        />
      </div>
      <FormAction pending={pending}>Сменить код</FormAction>
    </form>
  );
}

/**
 * Напоминания в мессенджер.
 *
 * Родитель редко открывает кабинет каждый день, но хочет знать, что ребёнок
 * сел заниматься. Привязка идёт кодом: он пишет боту короткое слово, бот
 * запоминает чат. Логин мессенджера мы не спрашиваем и не храним.
 */
function NotifyTab({ onNotice }: { onNotice: (text: string) => void }) {
  const [channels, setChannels] = useState<Channel[] | null>(null);

  const load = useCallback(async () => {
    const data = await notifySettings();
    setChannels(data.channels as Channel[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!channels) {
    return <p style={{ marginTop: 24, color: "var(--sov-ink-soft)" }}>Загружаем…</p>;
  }

  return (
    <section style={{ marginTop: 24, maxWidth: 640 }}>
      <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Напоминания</h2>
      <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
        Короткое сообщение после каждой проверочной работы и тренажёра: тема, доля верных ответов и
        время. Ничего, кроме этого, бот не присылает.
      </p>

      {channels.map((ch) => (
        <div key={ch.channel} className="sov-panel" style={{ marginTop: 18 }}>
          <h3>{ch.title}</h3>
          {!ch.ready ? (
            <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
              Канал пока не подключён на сервере: администратору нужно задать токен бота.
            </p>
          ) : ch.connected ? (
            <>
              <p style={{ marginTop: 8, color: "var(--sov-ok)", fontSize: "var(--sov-t-cap)" }}>
                Подключено. Сообщения {ch.enabled ? "приходят" : "поставлены на паузу"}.
              </p>
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="sov-act-ghost"
                  onClick={async () => {
                    await notifyToggle({ data: { channel: ch.channel, enabled: !ch.enabled } });
                    await load();
                  }}
                >
                  {ch.enabled ? "Поставить на паузу" : "Включить снова"}
                </button>
                <button
                  className="sov-act-ghost"
                  onClick={async () => {
                    await notifyDisconnect({ data: { channel: ch.channel } });
                    onNotice(`${ch.title} отключён`);
                    await load();
                  }}
                >
                  Отключить
                </button>
              </div>
            </>
          ) : ch.code ? (
            <>
              <p
                style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}
              >
                Напишите боту «Совёнок» в {ch.title} этот код:
              </p>
              <div className="sov-code">{ch.code}</div>
              <button
                className="sov-act-ghost"
                style={{ marginTop: 14 }}
                onClick={() => void load()}
              >
                Я отправил код, проверить
              </button>
            </>
          ) : (
            <button
              className="sov-act-ghost"
              style={{ marginTop: 12 }}
              onClick={async () => {
                await notifyConnect({ data: { channel: ch.channel } });
                await load();
              }}
            >
              Получить код привязки
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * Самое необратимое действие в продукте, поэтому кнопка ничего не удаляет:
 * она раскрывает объяснение, что именно пропадёт, и просит набрать имя
 * ребёнка руками (сервер сверяет ещё раз, так же мягко, как ответы ребёнка,
 * — регистр и «ё» не мешают). Про восстановление сказано прямо: только из
 * ночной резервной копии по письму, занятия после последней копии не
 * вернутся.
 */
function DeleteChildBlock({
  child,
  onDeleted,
}: {
  child: { id: string; name: string };
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");
  const ready = norm(typed) === norm(child.name);

  if (!open) {
    return (
      <button className="sov-act-ghost" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
        Удалить профиль: {child.name}…
      </button>
    );
  }
  return (
    <form
      className="sov-form"
      style={{ marginTop: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await deleteChild({ data: { childId: child.id, confirmName: typed } });
          await onDeleted();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Не получилось удалить");
          setPending(false);
        }
      }}
    >
      <div className="sov-alert">
        Пропадут все занятия, история, звёзды, награды и загруженные фотографии. Отменить это
        нельзя: восстановление возможно только из ночной резервной копии по письму на
        ekaterinazyub@gmail.com, и занятия после последней копии не вернутся.
      </div>
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-field">
        <label htmlFor="delchild">Чтобы удалить, наберите имя ребёнка: {child.name}</label>
        <input
          id="delchild"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="sov-act-ghost"
          disabled={!ready || pending}
          style={{ borderColor: "var(--sov-warn)", color: "var(--sov-warn)" }}
        >
          {pending ? "Удаляем…" : "Удалить профиль навсегда"}
        </button>
        <button type="button" className="sov-act-ghost" onClick={() => setOpen(false)}>
          Передумал
        </button>
      </div>
    </form>
  );
}

/** Полный отзыв согласия: подтверждается паролем, а не кодом из четырёх цифр. */
function DeleteAccountBlock() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button className="sov-act-ghost" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
        Удалить учётную запись…
      </button>
    );
  }
  return (
    <form
      className="sov-form"
      style={{ marginTop: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await deleteAccount({ data: { password } });
          await navigate({ to: "/" });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Не получилось удалить");
          setPending(false);
        }
      }}
    >
      <div className="sov-alert">
        Будут удалены все профили детей со всеми занятиями и фотографиями, настройки и сама учётная
        запись — без возможности восстановления. Сведения о платежах и чеки мы обязаны хранить 5
        лет, они остаются. Активная подписка закроется; за возвратом остатка напишите на
        ekaterinazyub@gmail.com (раздел 7 оферты).
      </div>
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-field">
        <label htmlFor="delaccpwd">Пароль от учётной записи</label>
        <input
          id="delaccpwd"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="sov-act-ghost"
          disabled={pending || password.length === 0}
          style={{ borderColor: "var(--sov-warn)", color: "var(--sov-warn)" }}
        >
          {pending ? "Удаляем…" : "Удалить учётную запись навсегда"}
        </button>
        <button type="button" className="sov-act-ghost" onClick={() => setOpen(false)}>
          Передумал
        </button>
      </div>
    </form>
  );
}
