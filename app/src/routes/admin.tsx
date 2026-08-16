import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { FormAction, SiteHeader } from "../components/brand";
import {
  adminContent, adminDeleteTask, adminOverview, adminSaveTask, adminSaveTopic, adminUpdateUser,
} from "../lib/api/app.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Админка, Совёнок" }] }),
  component: AdminPage,
});

type Overview = {
  dau: number; wau: number; users: number; paid: number;
  activationRate: number; parentRate: number; payRate: number;
  hard: { topic: string; percent: number }[];
  popular: { topic: string; lessons: number }[];
  usersList: { id: string; email: string; name: string | null; role: string; subscription_status: string; blocked: number }[];
};
type Content = { topics: TopicRow[]; tasks: TaskRow[] };
type TopicRow = { id: string; name: string; grade: number; subject_id: string; subject_name: string; summary: string | null; is_free: number; task_count: number };
type TaskRow = { id: string; kind: string; prompt: string; payload: string; answer: string; explanation: string; is_check: number };

/** Варианты для формы: в базе они лежат в payload, а правятся строкой «а|б|в». */
function optionsOf(task: TaskRow): string {
  try {
    const payload = JSON.parse(task.payload || "{}") as { options?: string[]; left?: string[] };
    if (task.kind === "choice") return (payload.options ?? []).join("|");
    if (task.kind === "match") return (payload.left ?? []).join("|");
  } catch {
    // битый payload правится руками — не роняем всю страницу
  }
  return "";
}

function AdminPage() {
  const [tab, setTab] = useState<"stats" | "content" | "users">("stats");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [editingTopic, setEditingTopic] = useState<TopicRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loadContent = useCallback(async (id: string | null) => {
    setContent(await adminContent({ data: { topicId: id } }));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setOverview(await adminOverview());
        await loadContent(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Нет доступа");
      }
    })();
  }, [loadContent]);

  if (error) {
    return (
      <div className="sov">
        <SiteHeader />
        <main className="sov-shell">
          <div className="sov-alert">{error}</div>
        </main>
      </div>
    );
  }

  const topics: TopicRow[] = content?.topics ?? [];
  const tasks: TaskRow[] = content?.tasks ?? [];

  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-shell" style={{ paddingBottom: 80 }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginTop: 16 }}>Администрирование</h1>
        <div className="sov-tabs">
          {([["stats","Аналитика"],["content","Контент"],["users","Пользователи"]] as const).map(([id,label]) => (
            <button key={id} data-active={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "stats" && overview ? (
          <section style={{ marginTop: 24 }}>
            <div className="sov-metrics">
              <div className="sov-metric"><b>{overview.dau}</b><span>DAU, дети за сутки</span></div>
              <div className="sov-metric"><b>{overview.wau}</b><span>WAU, дети за неделю</span></div>
              <div className="sov-metric"><b>{overview.users}</b><span>родителей всего</span></div>
              <div className="sov-metric"><b>{overview.paid}</b><span>с подпиской</span></div>
            </div>
            <div className="sov-metrics">
              <div className="sov-metric"><b>{overview.activationRate}%</b><span>регистрация в первое занятие</span></div>
              <div className="sov-metric"><b>{overview.parentRate}%</b><span>открыли кабинет</span></div>
              <div className="sov-metric"><b>{overview.payRate}%</b><span>конверсия в оплату</span></div>
              <div className="sov-metric"><b>{overview.popular.length}</b><span>тем со статистикой</span></div>
            </div>
            <div className="sov-split" style={{ marginTop: 36 }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Проблемные темы</h2>
                <table className="sov-table">
                  <thead><tr><th>Тема</th><th>Верных</th></tr></thead>
                  <tbody>
                    {overview.hard.map((h) => (<tr key={h.topic}><td>{h.topic}</td><td>{h.percent}%</td></tr>))}
                    {overview.hard.length === 0 ? <tr><td colSpan={2}>Данных пока нет</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Популярные темы</h2>
                <table className="sov-table">
                  <thead><tr><th>Тема</th><th>Занятий</th></tr></thead>
                  <tbody>
                    {overview.popular.map((p) => (<tr key={p.topic}><td>{p.topic}</td><td>{p.lessons}</td></tr>))}
                    {overview.popular.length === 0 ? <tr><td colSpan={2}>Данных пока нет</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "content" ? (
          <section style={{ marginTop: 24 }}>
            <div className="sov-split" style={{ alignItems: "start" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Темы</h2>
                <table className="sov-table">
                  <thead><tr><th>Название</th><th>Класс</th><th>Заданий</th><th></th></tr></thead>
                  <tbody>
                    {topics.map((t) => (
                      <tr key={t.id} style={{ cursor: "pointer", background: topicId === t.id ? "var(--sov-cobalt-soft)" : undefined }} onClick={() => { setTopicId(t.id); setEditingTask(null); void loadContent(t.id); }}>
                        <td>{t.name} <span className="sov-mono" style={{ color: "var(--sov-ink-soft)" }}>{t.subject_name}</span></td>
                        <td>{t.grade}</td>
                        <td>{t.task_count}</td>
                        <td>
                          <button
                            className="sov-act-ghost"
                            onClick={(e) => { e.stopPropagation(); setEditingTopic(t); }}
                          >
                            Изменить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Правка существующей темы и создание новой — одна форма:
                    поля совпадают, а раздвоение кода расходится по мелочам. */}
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginTop: 32 }}>
                  {editingTopic ? `Тема: ${editingTopic.name}` : "Новая тема"}
                </h3>
                <TopicForm
                  key={editingTopic?.id ?? "new-topic"}
                  topic={editingTopic}
                  pending={pending}
                  onCancel={() => setEditingTopic(null)}
                  onSubmit={async (values) => {
                    setPending(true);
                    await adminSaveTopic({ data: { ...values, id: editingTopic?.id ?? null } });
                    setPending(false);
                    setEditingTopic(null);
                    await loadContent(topicId);
                  }}
                />
              </div>

              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>
                  {topicId ? "Задания темы" : "Выберите тему слева"}
                </h2>
                {topicId ? (
                  <>
                    <table className="sov-table">
                      <thead><tr><th>Вопрос</th><th>Тип</th><th></th></tr></thead>
                      <tbody>
                        {tasks.map((t) => (
                          <tr key={t.id} style={{ background: editingTask?.id === t.id ? "var(--sov-cobalt-soft)" : undefined }}>
                            <td>{t.prompt}{t.is_check ? " ·  проверочная" : ""}</td>
                            <td>{t.kind}</td>
                            <td style={{ display: "flex", gap: 8 }}>
                              <button className="sov-act-ghost" onClick={() => setEditingTask(t)}>
                                Изменить
                              </button>
                              <button className="sov-act-ghost" onClick={async () => {
                                await adminDeleteTask({ data: { id: t.id } });
                                if (editingTask?.id === t.id) setEditingTask(null);
                                await loadContent(topicId);
                              }}>
                                Удалить
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Раньше задание можно было только создать и удалить:
                        опечатку в объяснении приходилось «править» удалением. */}
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginTop: 32 }}>
                      {editingTask ? "Правка задания" : "Новое задание"}
                    </h3>
                    <TaskForm
                      key={editingTask?.id ?? "new-task"}
                      task={editingTask}
                      pending={pending}
                      onCancel={() => setEditingTask(null)}
                      onSubmit={async (values) => {
                        setPending(true);
                        await adminSaveTask({ data: { ...values, id: editingTask?.id ?? null, topicId } });
                        setPending(false);
                        setEditingTask(null);
                        await loadContent(topicId);
                      }}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "users" && overview ? (
          <section style={{ marginTop: 24 }}>
            <table className="sov-table">
              <thead><tr><th>Почта</th><th>Роль</th><th>Подписка</th><th>Статус</th><th>Действия</th></tr></thead>
              <tbody>
                {overview.usersList.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.subscription_status}</td>
                    <td>{u.blocked ? "заблокирован" : "активен"}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button className="sov-act-ghost" onClick={async () => {
                        await adminUpdateUser({ data: { userId: u.id, blocked: !u.blocked, subscription: null } });
                        setOverview(await adminOverview());
                      }}>{u.blocked ? "Разблокировать" : "Заблокировать"}</button>
                      <button className="sov-act-ghost" onClick={async () => {
                        await adminUpdateUser({ data: { userId: u.id, blocked: null, subscription: u.subscription_status === "active" ? "free" : "active" } });
                        setOverview(await adminOverview());
                      }}>{u.subscription_status === "active" ? "Снять подписку" : "Выдать подписку"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </main>
    </div>
  );
}

type TopicValues = { subjectId: string; grade: number; name: string; summary: string; isFree: boolean };

function TopicForm({
  topic,
  pending,
  onSubmit,
  onCancel,
}: {
  topic: TopicRow | null;
  pending: boolean;
  onSubmit: (values: TopicValues) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="sov-form"
      style={{ marginTop: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSubmit({
          subjectId: String(f.get("subject")),
          grade: Number(f.get("grade")),
          name: String(f.get("name")),
          summary: String(f.get("summary") ?? ""),
          isFree: f.get("free") === "on",
        });
      }}
    >
      <div className="sov-field">
        <label htmlFor="tname">Название</label>
        <input id="tname" name="name" defaultValue={topic?.name ?? ""} required />
      </div>
      <div className="sov-field">
        <label htmlFor="tsubject">Предмет</label>
        <select id="tsubject" name="subject" defaultValue={topic?.subject_id ?? "math"}>
          <option value="math">Математика</option>
          <option value="rus">Русский язык</option>
        </select>
      </div>
      <div className="sov-field">
        <label htmlFor="tgrade">Класс</label>
        <select id="tgrade" name="grade" defaultValue={String(topic?.grade ?? 1)}>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </div>
      <div className="sov-field">
        <label htmlFor="tsum">Описание</label>
        <input id="tsum" name="summary" defaultValue={topic?.summary ?? ""} />
      </div>
      <label className="sov-check">
        <input type="checkbox" name="free" defaultChecked={!!topic?.is_free} />
        <span>Доступна бесплатно</span>
      </label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <FormAction pending={pending}>{topic ? "Сохранить тему" : "Создать тему"}</FormAction>
        {topic ? (
          <button type="button" className="sov-act-ghost" onClick={onCancel}>
            Отменить правку
          </button>
        ) : null}
      </div>
    </form>
  );
}

type TaskValues = {
  kind: "choice" | "input" | "match";
  prompt: string;
  options: string;
  answer: string;
  explanation: string;
  isCheck: boolean;
};

function TaskForm({
  task,
  pending,
  onSubmit,
  onCancel,
}: {
  task: TaskRow | null;
  pending: boolean;
  onSubmit: (values: TaskValues) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="sov-form"
      style={{ marginTop: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSubmit({
          kind: String(f.get("kind")) as TaskValues["kind"],
          prompt: String(f.get("prompt")),
          options: String(f.get("options") ?? ""),
          answer: String(f.get("answer")),
          explanation: String(f.get("explanation")),
          isCheck: f.get("check") === "on",
        });
      }}
    >
      <div className="sov-field">
        <label htmlFor="kind">Тип</label>
        <select id="kind" name="kind" defaultValue={task?.kind ?? "input"}>
          <option value="input">Ввод ответа</option>
          <option value="choice">Выбор варианта</option>
          <option value="match">Сопоставление</option>
        </select>
      </div>
      <div className="sov-field">
        <label htmlFor="prompt">Вопрос</label>
        <input id="prompt" name="prompt" defaultValue={task?.prompt ?? ""} required />
      </div>
      <div className="sov-field">
        <label htmlFor="options">Варианты через вертикальную черту</label>
        <input id="options" name="options" placeholder="5|7|9" defaultValue={task ? optionsOf(task) : ""} />
        <span className="sov-field__hint">Заполняется для выбора и сопоставления.</span>
      </div>
      <div className="sov-field">
        <label htmlFor="answer">Правильный ответ</label>
        <input id="answer" name="answer" defaultValue={task?.answer ?? ""} required />
      </div>
      <div className="sov-field">
        <label htmlFor="explanation">Объяснение при ошибке</label>
        <textarea id="explanation" name="explanation" rows={3} defaultValue={task?.explanation ?? ""} required />
      </div>
      <label className="sov-check">
        <input type="checkbox" name="check" defaultChecked={!!task?.is_check} />
        <span>Входит в проверочную работу</span>
      </label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <FormAction pending={pending}>{task ? "Сохранить задание" : "Добавить задание"}</FormAction>
        {task ? (
          <button type="button" className="sov-act-ghost" onClick={onCancel}>
            Отменить правку
          </button>
        ) : null}
      </div>
    </form>
  );
}
