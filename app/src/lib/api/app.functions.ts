import { createServerFn } from "@tanstack/react-start";
import type { TaskPayload } from "../content/seed";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  answersMatch,
  currentUser,
  db,
  diagnosticFor,
  endSession,
  ensureSeeded,
  hashPassword,
  nowIso,
  requireAdmin,
  requireOwnChild,
  requireUser,
  startSession,
  track,
  uid,
  verifyPassword,
} from "../core.server";

const CHILD_COOKIE = "sov_child";

type TopicRow = {
  id: string;
  subject_id: string;
  grade: number;
  sort_order: number;
  name: string;
  summary: string | null;
  is_free: number;
};

type AdminTopicRow = {
  id: string; subject_id: string; grade: number; sort_order: number;
  name: string; summary: string | null; is_free: number;
  subject_name: string; task_count: number;
};

type AdminUserRow = {
  id: string; email: string; name: string | null; role: string;
  subscription_status: string; blocked: number; created_at: string;
};

type TaskRow = {
  id: string;
  topic_id: string;
  kind: string;
  sort_order: number;
  prompt: string;
  payload: string;
  answer: string;
  explanation: string;
  is_check: number;
};

/* ------------------------------------------------------------ аккаунт */

export const me = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeeded();
  const user = await currentUser();
  if (!user) return { user: null, children: [], activeChildId: null };
  const children = await db()
    .prepare("SELECT * FROM children WHERE parent_id = ? ORDER BY created_at")
    .bind(user.id)
    .all<ChildRecord>();
  return {
    user,
    children: (children.results ?? []) as ChildRecord[],
    activeChildId: getCookie(CHILD_COOKIE) ?? null,
  };
});

export type ChildRecord = {
  id: string;
  parent_id: string;
  name: string;
  avatar: string;
  grade: number;
  birth_year: number | null;
  daily_limit_min: number;
  sound_on: number;
  diagnostics_done: number;
  created_at: string;
};

export const registerParent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email("Проверьте адрес почты"),
      password: z.string().min(8, "Пароль от 8 символов"),
      name: z.string().trim().min(1, "Укажите имя"),
      consentPd: z.boolean(),
      consentChildPd: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await ensureSeeded();
    if (!data.consentPd || !data.consentChildPd) {
      throw new Error("Без согласия на обработку данных регистрация невозможна");
    }
    const email = data.email.toLowerCase().trim();
    const existing = await db().prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) throw new Error("Такая почта уже зарегистрирована");

    const id = uid("usr");
    const isFirst = ((await db().prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())?.n ?? 0) === 0;
    await db()
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, role, subscription_status, consent_pd, consent_child_pd, consent_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'free', 1, 1, ?, ?)`,
      )
      .bind(id, email, await hashPassword(data.password), data.name.trim(), isFirst ? "admin" : "parent", nowIso(), nowIso())
      .run();
    await startSession(id);
    await track("register", { userId: id });
    return { ok: true, isAdmin: isFirst };
  });

export const loginParent = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const row = await db()
      .prepare("SELECT id, password_hash, blocked FROM users WHERE email = ?")
      .bind(data.email.toLowerCase().trim())
      .first<{ id: string; password_hash: string; blocked: number }>();
    if (!row || !(await verifyPassword(data.password, row.password_hash))) {
      throw new Error("Не подходит почта или пароль");
    }
    if (row.blocked) throw new Error("Аккаунт заблокирован");
    await startSession(row.id);
    await track("login", { userId: row.id });
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await endSession();
  setCookie(CHILD_COOKIE, "", { path: "/", maxAge: 0 });
  return { ok: true };
});

/* --------------------------------------------------------------- дети */

export const addChild = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().trim().min(1, "Как зовут ребёнка?"),
      grade: z.number().int().min(1).max(2),
      avatar: z.string().min(1),
      birthYear: z.number().int().min(2010).max(2025).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const id = uid("chd");
    await db()
      .prepare(
        `INSERT INTO children (id, parent_id, name, avatar, grade, birth_year, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, user.id, data.name.trim(), data.avatar, data.grade, data.birthYear, nowIso())
      .run();
    setCookie(CHILD_COOKIE, id, { path: "/", maxAge: 400 * 86400, sameSite: "lax" });
    await track("child_created", { userId: user.id, childId: id });
    return { id };
  });

export const selectChild = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireOwnChild(data.childId, user.id);
    setCookie(CHILD_COOKIE, data.childId, { path: "/", maxAge: 400 * 86400, sameSite: "lax" });
    return { ok: true };
  });

export const updateChild = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string(),
      dailyLimitMin: z.number().int().min(5).max(120),
      soundOn: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireOwnChild(data.childId, user.id);
    await db()
      .prepare("UPDATE children SET daily_limit_min = ?, sound_on = ? WHERE id = ?")
      .bind(data.dailyLimitMin, data.soundOn ? 1 : 0, data.childId)
      .run();
    return { ok: true };
  });

/* -------------------------------------------------------- диагностика */

export const getDiagnostic = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const child = (await requireOwnChild(data.childId, user.id)) as unknown as ChildRecord;
    const blocks = diagnosticFor(child.grade).map((block) => ({
      subjectId: block.subjectId,
      subjectName: block.subjectName,
      tasks: block.tasks.map((task, i) => ({
        id: `${block.subjectId}-d${i}`,
        kind: task.kind,
        prompt: task.prompt,
        payload: task.payload,
        explanation: task.explanation,
      })),
    }));
    return { childName: child.name, grade: child.grade, blocks };
  });

export const submitDiagnostic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string(),
      answers: z.array(z.object({ id: z.string(), value: z.string() })),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const child = (await requireOwnChild(data.childId, user.id)) as unknown as ChildRecord;
    const blocks = diagnosticFor(child.grade);

    const result = blocks.map((block) => {
      let correct = 0;
      block.tasks.forEach((task, i) => {
        const given = data.answers.find((a) => a.id === `${block.subjectId}-d${i}`)?.value ?? "";
        if (answersMatch(given, task.answer)) correct += 1;
      });
      const percent = Math.round((correct / block.tasks.length) * 100);
      return {
        subjectId: block.subjectId,
        subjectName: block.subjectName,
        correct,
        total: block.tasks.length,
        percent,
        level: percent >= 80 ? "уверенный" : percent >= 50 ? "средний" : "начальный",
      };
    });

    await db()
      .prepare("UPDATE children SET diagnostics_done = 1 WHERE id = ?")
      .bind(data.childId)
      .run();
    await track("diagnostic_done", { userId: user.id, childId: data.childId, props: result });
    return { result };
  });

/* ------------------------------------------------------ карта навыков */

export const getSkillMap = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const user = await requireUser();
    const child = (await requireOwnChild(data.childId, user.id)) as unknown as ChildRecord;
    const paid = user.subscriptionStatus === "active";

    const subjects = await db()
      .prepare("SELECT * FROM subjects ORDER BY sort_order")
      .all<{ id: string; name: string }>();
    const topics = await db()
      .prepare("SELECT * FROM topics WHERE grade = ? ORDER BY subject_id, sort_order")
      .bind(child.grade)
      .all<TopicRow>();
    const progress = await db()
      .prepare("SELECT topic_id, status, stars, best_percent FROM progress WHERE child_id = ?")
      .bind(data.childId)
      .all<{ topic_id: string; status: string; stars: number; best_percent: number }>();

    const byTopic = new Map((progress.results ?? []).map((p) => [p.topic_id, p]));

    const map = (subjects.results ?? []).map((subject) => {
      const list = (topics.results ?? []).filter((t) => t.subject_id === subject.id);
      let previousDone = true;
      const items = list.map((topic) => {
        const p = byTopic.get(topic.id);
        const locked = !paid && !topic.is_free;
        const available = previousDone && !locked;
        previousDone = p?.status === "completed";
        return {
          id: topic.id,
          name: topic.name,
          summary: topic.summary,
          stars: p?.stars ?? 0,
          bestPercent: p?.best_percent ?? 0,
          status: p?.status ?? "locked",
          locked,
          available,
        };
      });
      return { id: subject.id, name: subject.name, topics: items };
    });

    const totalStars = (progress.results ?? []).reduce((sum, p) => sum + p.stars, 0);
    return {
      child: { id: child.id, name: child.name, avatar: child.avatar, grade: child.grade, soundOn: !!child.sound_on, dailyLimitMin: child.daily_limit_min, diagnosticsDone: !!child.diagnostics_done },
      subjects: map,
      totalStars,
      level: Math.floor(totalStars / 5) + 1,
      paid,
    };
  });

/* ------------------------------------------------------------ занятие */

export const startTopic = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string(), topicId: z.string(), mode: z.enum(["practice", "check"]) }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const user = await requireUser();
    await requireOwnChild(data.childId, user.id);

    const topic = await db().prepare("SELECT * FROM topics WHERE id = ?").bind(data.topicId).first<TopicRow>();
    if (!topic) throw new Error("Тема не найдена");
    if (!topic.is_free && user.subscriptionStatus !== "active") {
      throw new Error("Эта тема доступна по подписке");
    }

    const rows = await db()
      .prepare("SELECT * FROM tasks WHERE topic_id = ? AND is_check = ? ORDER BY sort_order")
      .bind(data.topicId, data.mode === "check" ? 1 : 0)
      .all<TaskRow>();

    const lessonId = uid("les");
    await db()
      .prepare(
        "INSERT INTO lessons (id, child_id, topic_id, subject_id, started_at, total) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(lessonId, data.childId, data.topicId, topic.subject_id, nowIso(), (rows.results ?? []).length)
      .run();
    await track("lesson_started", { userId: user.id, childId: data.childId, props: { topicId: data.topicId, mode: data.mode } });

    return {
      lessonId,
      topic: { id: topic.id, name: topic.name, subjectId: topic.subject_id },
      mode: data.mode,
      tasks: (rows.results ?? []).map((t) => ({
        id: t.id,
        kind: t.kind,
        prompt: t.prompt,
        payload: JSON.parse(t.payload || "{}") as TaskPayload,
      })),
    };
  });

export const answerTask = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string(),
      taskId: z.string(),
      value: z.string(),
      seconds: z.number().int().min(0).max(3600),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireOwnChild(data.childId, user.id);
    const task = await db().prepare("SELECT * FROM tasks WHERE id = ?").bind(data.taskId).first<TaskRow>();
    if (!task) throw new Error("Задание не найдено");

    const correct = answersMatch(data.value, task.answer);
    await db()
      .prepare(
        "INSERT INTO attempts (id, child_id, task_id, topic_id, is_correct, seconds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(uid("att"), data.childId, data.taskId, task.topic_id, correct ? 1 : 0, data.seconds, nowIso())
      .run();

    return { correct, explanation: correct ? null : task.explanation, answer: correct ? null : task.answer };
  });

export const finishTopic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string(),
      lessonId: z.string(),
      topicId: z.string(),
      mode: z.enum(["practice", "check"]),
      correct: z.number().int().min(0),
      total: z.number().int().min(1),
      seconds: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireOwnChild(data.childId, user.id);
    const percent = Math.round((data.correct / data.total) * 100);

    await db()
      .prepare("UPDATE lessons SET seconds = ?, correct = ?, total = ? WHERE id = ? AND child_id = ?")
      .bind(data.seconds, data.correct, data.total, data.lessonId, data.childId)
      .run();

    const existing = await db()
      .prepare("SELECT status, stars, best_percent FROM progress WHERE child_id = ? AND topic_id = ?")
      .bind(data.childId, data.topicId)
      .first<{ status: string; stars: number; best_percent: number }>();

    const passed = data.mode === "check" && percent >= 70;
    const stars = data.mode === "check" ? (percent >= 90 ? 3 : percent >= 80 ? 2 : percent >= 70 ? 1 : 0) : 0;
    const status = passed ? "completed" : existing?.status === "completed" ? "completed" : "in_progress";
    const bestStars = Math.max(stars, existing?.stars ?? 0);
    const bestPercent = Math.max(percent, existing?.best_percent ?? 0);

    await db()
      .prepare(
        `INSERT INTO progress (child_id, topic_id, status, stars, best_percent, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(child_id, topic_id) DO UPDATE SET status = ?, stars = ?, best_percent = ?, updated_at = ?`,
      )
      .bind(
        data.childId, data.topicId, status, bestStars, bestPercent, nowIso(),
        status, bestStars, bestPercent, nowIso(),
      )
      .run();

    await track("lesson_finished", {
      userId: user.id,
      childId: data.childId,
      props: { topicId: data.topicId, mode: data.mode, percent },
    });

    return { percent, passed, stars: bestStars, mode: data.mode };
  });

/* -------------------------------------------------- родительский отчёт */

export const parentReport = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const user = await requireUser();
    const child = (await requireOwnChild(data.childId, user.id)) as unknown as ChildRecord;
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

    const totals = await db()
      .prepare(
        `SELECT COUNT(*) AS attempts, SUM(is_correct) AS correct
           FROM attempts WHERE child_id = ?`,
      )
      .bind(data.childId)
      .first<{ attempts: number; correct: number | null }>();

    const week = await db()
      .prepare(
        `SELECT COUNT(*) AS lessons, COALESCE(SUM(seconds), 0) AS seconds
           FROM lessons WHERE child_id = ? AND started_at > ?`,
      )
      .bind(data.childId, weekAgo)
      .first<{ lessons: number; seconds: number }>();

    const done = await db()
      .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(stars), 0) AS stars FROM progress WHERE child_id = ? AND status = 'completed'")
      .bind(data.childId)
      .first<{ n: number; stars: number }>();

    const risk = await db()
      .prepare(
        `SELECT t.name AS topic, s.name AS subject,
                COUNT(*) AS total, SUM(a.is_correct) AS correct
           FROM attempts a
           JOIN topics t ON t.id = a.topic_id
           JOIN subjects s ON s.id = t.subject_id
          WHERE a.child_id = ?
          GROUP BY a.topic_id
         HAVING COUNT(*) >= 4 AND (CAST(SUM(a.is_correct) AS REAL) / COUNT(*)) < 0.7
          ORDER BY (CAST(SUM(a.is_correct) AS REAL) / COUNT(*)) ASC
          LIMIT 5`,
      )
      .bind(data.childId)
      .all<{ topic: string; subject: string; total: number; correct: number }>();

    const history = await db()
      .prepare(
        `SELECT l.started_at, l.seconds, l.correct, l.total, t.name AS topic, s.name AS subject
           FROM lessons l
           JOIN topics t ON t.id = l.topic_id
           JOIN subjects s ON s.id = l.subject_id
          WHERE l.child_id = ?
          ORDER BY l.started_at DESC LIMIT 15`,
      )
      .bind(data.childId)
      .all<{ started_at: string; seconds: number; correct: number; total: number; topic: string; subject: string }>();

    await track("parent_dashboard_opened", { userId: user.id, childId: data.childId });

    const attempts = totals?.attempts ?? 0;
    return {
      child: { id: child.id, name: child.name, grade: child.grade, avatar: child.avatar, dailyLimitMin: child.daily_limit_min, soundOn: !!child.sound_on, diagnosticsDone: !!child.diagnostics_done },
      accuracy: attempts ? Math.round(((totals?.correct ?? 0) / attempts) * 100) : 0,
      attempts,
      weekLessons: week?.lessons ?? 0,
      weekMinutes: Math.round((week?.seconds ?? 0) / 60),
      topicsDone: done?.n ?? 0,
      stars: done?.stars ?? 0,
      risk: (risk.results ?? []).map((r) => ({
        topic: r.topic,
        subject: r.subject,
        percent: Math.round((r.correct / r.total) * 100),
      })),
      history: history.results ?? [],
      subscription: user.subscriptionStatus,
    };
  });

export const redeemPromo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().trim().min(3) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const code = data.code.trim().toUpperCase();
    const promo = await db()
      .prepare("SELECT code, months, used_by FROM promo_codes WHERE code = ?")
      .bind(code)
      .first<{ code: string; months: number; used_by: string | null }>();
    if (!promo) throw new Error("Такого промокода нет");
    if (promo.used_by && promo.used_by !== user.id) throw new Error("Промокод уже использован");

    const end = new Date(Date.now() + promo.months * 30 * 864e5).toISOString();
    await db().batch([
      db().prepare("UPDATE users SET subscription_status = 'active' WHERE id = ?").bind(user.id),
      db().prepare("UPDATE promo_codes SET used_by = ?, used_at = ? WHERE code = ?").bind(user.id, nowIso(), code),
      db()
        .prepare("INSERT INTO subscriptions (id, user_id, plan, status, start_date, end_date) VALUES (?, ?, ?, 'active', ?, ?)")
        .bind(uid("sub"), user.id, `promo_${promo.months}m`, nowIso(), end),
    ]);
    await track("subscription_activated", { userId: user.id, props: { code } });
    return { ok: true, until: end };
  });

export const cancelSubscription = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();
  await db().batch([
    db().prepare("UPDATE users SET subscription_status = 'free' WHERE id = ?").bind(user.id),
    db().prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").bind(user.id),
  ]);
  return { ok: true };
});

/* ------------------------------------------------------------ админка */

export const adminOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const day = new Date(Date.now() - 864e5).toISOString();
  const week = new Date(Date.now() - 7 * 864e5).toISOString();

  const dau = await db().prepare("SELECT COUNT(DISTINCT child_id) AS n FROM lessons WHERE started_at > ?").bind(day).first<{ n: number }>();
  const wau = await db().prepare("SELECT COUNT(DISTINCT child_id) AS n FROM lessons WHERE started_at > ?").bind(week).first<{ n: number }>();
  const users = await db().prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  const paid = await db().prepare("SELECT COUNT(*) AS n FROM users WHERE subscription_status = 'active'").first<{ n: number }>();
  const registered = await db().prepare("SELECT COUNT(*) AS n FROM events WHERE name = 'register'").first<{ n: number }>();
  const firstLesson = await db().prepare("SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE name = 'lesson_started'").first<{ n: number }>();
  const dashboards = await db().prepare("SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE name = 'parent_dashboard_opened'").first<{ n: number }>();

  const hard = await db()
    .prepare(
      `SELECT t.name AS topic, COUNT(*) AS total, SUM(a.is_correct) AS correct
         FROM attempts a JOIN topics t ON t.id = a.topic_id
        GROUP BY a.topic_id HAVING COUNT(*) >= 5
        ORDER BY (CAST(SUM(a.is_correct) AS REAL) / COUNT(*)) ASC LIMIT 6`,
    )
    .all<{ topic: string; total: number; correct: number }>();

  const popular = await db()
    .prepare(
      `SELECT t.name AS topic, COUNT(*) AS lessons FROM lessons l
         JOIN topics t ON t.id = l.topic_id GROUP BY l.topic_id ORDER BY lessons DESC LIMIT 6`,
    )
    .all<{ topic: string; lessons: number }>();

  const usersList = await db()
    .prepare("SELECT id, email, name, role, subscription_status, blocked, created_at FROM users ORDER BY created_at DESC LIMIT 50")
    .all<AdminUserRow>();

  const regCount = registered?.n ?? 0;
  return {
    dau: dau?.n ?? 0,
    wau: wau?.n ?? 0,
    users: users?.n ?? 0,
    paid: paid?.n ?? 0,
    activationRate: regCount ? Math.round(((firstLesson?.n ?? 0) / regCount) * 100) : 0,
    parentRate: regCount ? Math.round(((dashboards?.n ?? 0) / regCount) * 100) : 0,
    payRate: (users?.n ?? 0) ? Math.round(((paid?.n ?? 0) / (users?.n ?? 1)) * 100) : 0,
    hard: (hard.results ?? []).map((h) => ({ topic: h.topic, percent: Math.round((h.correct / h.total) * 100) })),
    popular: popular.results ?? [],
    usersList: (usersList.results ?? []) as AdminUserRow[],
  };
});

export const adminContent = createServerFn({ method: "GET" })
  .inputValidator(z.object({ topicId: z.string().nullable() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    await ensureSeeded();
    const topics = await db()
      .prepare(
        `SELECT t.*, s.name AS subject_name, (SELECT COUNT(*) FROM tasks WHERE topic_id = t.id) AS task_count
           FROM topics t JOIN subjects s ON s.id = t.subject_id
          ORDER BY s.sort_order, t.grade, t.sort_order`,
      )
      .all<AdminTopicRow>();
    let tasks: TaskRow[] = [];
    if (data.topicId) {
      const rows = await db()
        .prepare("SELECT * FROM tasks WHERE topic_id = ? ORDER BY sort_order")
        .bind(data.topicId)
        .all<TaskRow>();
      tasks = (rows.results ?? []) as TaskRow[];
    }
    return { topics: (topics.results ?? []) as AdminTopicRow[], tasks };
  });

export const adminSaveTopic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().nullable(),
      subjectId: z.string(),
      grade: z.number().int().min(1).max(4),
      name: z.string().trim().min(1),
      summary: z.string(),
      isFree: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.id) {
      await db()
        .prepare("UPDATE topics SET subject_id = ?, grade = ?, name = ?, summary = ?, is_free = ? WHERE id = ?")
        .bind(data.subjectId, data.grade, data.name, data.summary, data.isFree ? 1 : 0, data.id)
        .run();
      return { id: data.id };
    }
    const id = uid("top");
    const max = await db()
      .prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM topics WHERE subject_id = ?")
      .bind(data.subjectId)
      .first<{ n: number }>();
    await db()
      .prepare("INSERT INTO topics (id, subject_id, grade, sort_order, name, summary, is_free) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, data.subjectId, data.grade, (max?.n ?? 0) + 1, data.name, data.summary, data.isFree ? 1 : 0)
      .run();
    return { id };
  });

export const adminSaveTask = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().nullable(),
      topicId: z.string(),
      kind: z.enum(["choice", "input", "match"]),
      prompt: z.string().trim().min(1),
      options: z.string(),
      answer: z.string().trim().min(1),
      explanation: z.string().trim().min(1),
      isCheck: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const payload = JSON.stringify(
      data.kind === "choice"
        ? { options: data.options.split("|").map((s) => s.trim()).filter(Boolean) }
        : data.kind === "match"
          ? { left: data.options.split("|").map((s) => s.trim()), right: data.answer.split("|").map((s) => s.trim()) }
          : {},
    );
    if (data.id) {
      await db()
        .prepare("UPDATE tasks SET kind = ?, prompt = ?, payload = ?, answer = ?, explanation = ?, is_check = ? WHERE id = ?")
        .bind(data.kind, data.prompt, payload, data.answer, data.explanation, data.isCheck ? 1 : 0, data.id)
        .run();
      return { id: data.id };
    }
    const id = uid("tsk");
    const max = await db()
      .prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM tasks WHERE topic_id = ?")
      .bind(data.topicId)
      .first<{ n: number }>();
    await db()
      .prepare(
        "INSERT INTO tasks (id, topic_id, kind, sort_order, prompt, payload, answer, explanation, is_check) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, data.topicId, data.kind, (max?.n ?? 0) + 1, data.prompt, payload, data.answer, data.explanation, data.isCheck ? 1 : 0)
      .run();
    return { id };
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    await db().prepare("DELETE FROM tasks WHERE id = ?").bind(data.id).run();
    return { ok: true };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string(), blocked: z.boolean().nullable(), subscription: z.string().nullable() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.blocked !== null) {
      await db().prepare("UPDATE users SET blocked = ? WHERE id = ?").bind(data.blocked ? 1 : 0, data.userId).run();
    }
    if (data.subscription !== null) {
      await db().prepare("UPDATE users SET subscription_status = ? WHERE id = ?").bind(data.subscription, data.userId).run();
    }
    return { ok: true };
  });
