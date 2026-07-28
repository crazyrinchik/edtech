import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { FormAction, SiteFooter, SiteHeader } from "../components/brand";
import {
  addChild, cancelSubscription, logout, me, parentReport, redeemPromo, selectChild, updateChild,
} from "../lib/api/app.functions";

export const Route = createFileRoute("/roditel")({
  head: () => ({ meta: [{ title: "Кабинет родителя, Совёнок" }] }),
  component: ParentPage,
});

type Report = {
  child: { id: string; name: string; grade: number; avatar: string; dailyLimitMin: number; soundOn: boolean; diagnosticsDone: boolean };
  accuracy: number; attempts: number; weekLessons: number; weekMinutes: number; topicsDone: number; stars: number;
  risk: { topic: string; subject: string; percent: number }[];
  history: { started_at: string; seconds: number; correct: number; total: number; topic: string; subject: string }[];
  subscription: string;
};
type Account = {
  user: { id: string; email: string; name: string | null; role: string; subscriptionStatus: string } | null;
  children: { id: string; name: string; grade: number }[];
  activeChildId: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function ParentPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState<"progress" | "history" | "settings" | "billing">("progress");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const acc = await me();
    if (!acc.user) {
      await navigate({ to: "/vhod" });
      return;
    }
    setAccount(acc);
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
        <main className="sov-shell" style={{ paddingTop: 40 }}>
          <p>Загружаем кабинет…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="sov">
      <SiteHeader
        right={
          <>
            {report ? <Link to="/uchenik" className="sov-act-ghost" style={{ textDecoration: "none" }}>Занятия ребёнка</Link> : null}
            {account.user?.role === "admin" ? (
              <Link to="/admin" className="sov-act-ghost" style={{ textDecoration: "none" }}>Админка</Link>
            ) : null}
            <button className="sov-act-ghost" onClick={async () => { await logout(); await navigate({ to: "/" }); }}>
              Выйти
            </button>
          </>
        }
      />
      <main className="sov-shell" style={{ paddingBottom: 60 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginTop: 16 }}>Кабинет родителя</h1>
        <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
          {account.user?.name}, статус подписки: {account.user?.subscriptionStatus === "active" ? "активна" : "бесплатный доступ"}.
        </p>

        <div className="sov-chips">
          {account.children.map((child) => (
            <button
              key={child.id}
              className="sov-chip"
              data-active={report?.child.id === child.id}
              onClick={async () => {
                await selectChild({ data: { childId: child.id } });
                await load();
              }}
            >
              {child.name}, {child.grade} класс
            </button>
          ))}
        </div>

        {notice ? <div className="sov-alert" style={{ marginTop: 16, background: "#e6f4ea", color: "var(--sov-ok)" }}>{notice}</div> : null}

        {!report ? (
          <AddChildForm onAdded={load} />
        ) : (
          <>
            <div className="sov-metrics">
              <div className="sov-metric"><b>{report.topicsDone}</b><span>тем пройдено</span></div>
              <div className="sov-metric"><b>{report.accuracy}%</b><span>верных ответов</span></div>
              <div className="sov-metric"><b>{report.weekMinutes}</b><span>минут за неделю</span></div>
              <div className="sov-metric"><b>{report.weekLessons}</b><span>занятий за неделю</span></div>
            </div>

            <div className="sov-tabs">
              {([["progress","Прогресс"],["history","История"],["settings","Настройки"],["billing","Подписка"]] as const).map(([id,label]) => (
                <button key={id} data-active={tab === id} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>

            {tab === "progress" ? (
              <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>Зоны риска</h2>
                <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: ".95rem" }}>
                  Темы, где ребёнок ошибается чаще всего. Хороший повод разобрать вместе.
                </p>
                <div style={{ marginTop: 16 }}>
                  {report.risk.length === 0 ? (
                    <div className="sov-panel">
                      <h3>Пока всё ровно</h3>
                      <p style={{ marginTop: 8, color: "var(--sov-ink-soft)" }}>
                        Зоны риска появятся, когда наберётся статистика по темам.
                      </p>
                    </div>
                  ) : (
                    report.risk.map((r) => (
                      <div key={r.topic} className="sov-risk">
                        <strong>{r.topic}</strong>
                        <div className="sov-mono" style={{ marginTop: 4 }}>{r.subject} · верных {r.percent} процентов</div>
                      </div>
                    ))
                  )}
                </div>
                {!report.child.diagnosticsDone ? (
                  <div className="sov-panel" style={{ marginTop: 20 }}>
                    <h3>Диагностика не пройдена</h3>
                    <p style={{ marginTop: 8, color: "var(--sov-ink-soft)" }}>
                      Откройте раздел занятий, чтобы ребёнок прошёл короткий стартовый тест.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {tab === "history" ? (
              <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>История занятий</h2>
                {report.history.length === 0 ? (
                  <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>Занятий пока не было.</p>
                ) : (
                  <table className="sov-table">
                    <thead>
                      <tr><th>Дата</th><th>Предмет</th><th>Тема</th><th>Результат</th><th>Минут</th></tr>
                    </thead>
                    <tbody>
                      {report.history.map((h, i) => (
                        <tr key={i}>
                          <td>{fmt(h.started_at)}</td>
                          <td>{h.subject}</td>
                          <td>{h.topic}</td>
                          <td>{h.correct} из {h.total}</td>
                          <td>{Math.max(1, Math.round(h.seconds / 60))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ) : null}

            {tab === "settings" ? (
              <section style={{ marginTop: 24, maxWidth: 520 }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>Настройки занятий</h2>
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
                    <input id="limit" name="limit" type="number" min={5} max={120} defaultValue={report.child.dailyLimitMin} />
                    <span className="sov-field__hint">По достижении лимита ребёнок увидит мягкое напоминание об отдыхе.</span>
                  </div>
                  <label className="sov-check">
                    <input type="checkbox" name="sound" defaultChecked={report.child.soundOn} />
                    <span>Звуковое сопровождение заданий</span>
                  </label>
                  <FormAction pending={pending}>Сохранить</FormAction>
                </form>
                <div style={{ marginTop: 40 }}>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>Добавить ещё ребёнка</h2>
                  <AddChildForm onAdded={load} compact />
                </div>
              </section>
            ) : null}

            {tab === "billing" ? (
              <section style={{ marginTop: 24, maxWidth: 520 }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>Подписка</h2>
                <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
                  Сейчас: {report.subscription === "active" ? "подписка активна, открыты все темы" : "бесплатный доступ, открыта первая тема каждого предмета"}.
                </p>
                {report.subscription === "active" ? (
                  <button className="sov-act-ghost" style={{ marginTop: 20 }} onClick={async () => {
                    await cancelSubscription();
                    setNotice("Подписка отменена");
                    await load();
                  }}>
                    Отменить подписку
                  </button>
                ) : (
                  <form
                    className="sov-form"
                    style={{ marginTop: 20 }}
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
                        На пилоте подписка активируется промокодом. Платёжный шлюз подключается после MVP.
                      </span>
                    </div>
                    <FormAction pending={pending}>Активировать</FormAction>
                  </form>
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

function AddChildForm({ onAdded, compact }: { onAdded: () => Promise<void>; compact?: boolean }) {
  const [pending, setPending] = useState(false);
  return (
    <div style={{ marginTop: compact ? 16 : 32, maxWidth: 520 }}>
      {!compact ? <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }}>Добавьте профиль ребёнка</h2> : null}
      <form
        className="sov-form"
        style={{ marginTop: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          await addChild({
            data: {
              name: String(form.get("name") ?? ""),
              grade: Number(form.get("grade") ?? 1),
              avatar: "owl",
              birthYear: null,
            },
          });
          (e.target as HTMLFormElement).reset();
          setPending(false);
          await onAdded();
        }}
      >
        <div className="sov-field">
          <label htmlFor="childname">Имя ребёнка</label>
          <input id="childname" name="name" required />
        </div>
        <div className="sov-field">
          <label htmlFor="childgrade">Класс</label>
          <select id="childgrade" name="grade" defaultValue="1">
            <option value="1">1 класс</option>
            <option value="2">2 класс</option>
          </select>
        </div>
        <FormAction pending={pending}>Добавить</FormAction>
      </form>
    </div>
  );
}
