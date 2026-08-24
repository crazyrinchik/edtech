import { createServerFn } from "@tanstack/react-start";
import type { TaskPayload } from "../content/seed";
import { CATALOG } from "../content/curriculum.data";
import { catalogIndex, isFreeTopic, topicByCode } from "../content/curriculum";
import { DEMO_TASKS, READING_TEXTS } from "../content/seed";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  answersMatch,
  materializeTopic,
  currentUser,
  db,
  endSession,
  ensureSeeded,
  hasParentPin,
  hashPassword,
  isParentUnlocked,
  lockParent,
  nowIso,
  requireAdmin,
  requireChildAccess,
  childHasPaidAccess,
  grantChildAccess,
  requireParentAccess,
  requireUser,
  saveParentPin,
  startSession,
  track,
  uid,
  unlockParent,
  verifyPassword,
} from "../core.server";
import { buyOwlItemFor, equipOwlItemFor, owlState, syncCoins } from "../rewards.server";
import {
  CHANNEL_TITLES,
  channelReady,
  ensureChannel,
  notifyParent,
  type ChannelRow,
  type NotifyChannel,
} from "../notify.server";

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
  if (!user) {
    return { user: null, children: [], activeChildId: null, parentPinSet: false, parentUnlocked: false };
  }
  // Учеников даёт child_access, а не children.parent_id: у ученика
  // может быть и родитель, и репетитор, и видеть его должны оба.
  const children = await db()
    .prepare(
      `SELECT c.* FROM children c
         JOIN child_access a ON a.child_id = c.id
        WHERE a.user_id = ? ORDER BY c.created_at`,
    )
    .bind(user.id)
    .all<ChildRecord>();
  const pinSet = await hasParentPin(user.id);
  // Кука активного ребёнка переживает смену аккаунта в том же браузере:
  // войдя другим взрослым, можно было получить id чужого профиля и упереться
  // в «профиль не найден» на первом же запросе. Отдаём её только если этот
  // ученик действительно доступен текущему пользователю.
  const list = (children.results ?? []) as ChildRecord[];
  const cookieChild = getCookie(CHILD_COOKIE) ?? null;
  const activeChildId = list.some((c) => c.id === cookieChild) ? cookieChild : null;
  return {
    user,
    children: list,
    activeChildId,
    parentPinSet: pinSet,
    parentUnlocked: pinSet ? await isParentUnlocked(user.id) : true,
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
  created_at: string;
};

export const registerParent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email("Проверьте адрес почты"),
      password: z.string().min(8, "Пароль от 8 символов"),
      name: z.string().trim().min(1, "Укажите имя"),
      role: z.enum(["parent", "tutor"]).default("parent"),
      consentPd: z.boolean(),
      consentChildPd: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await ensureSeeded();
    if (!data.consentPd) {
      throw new Error("Без согласия на обработку данных регистрация невозможна");
    }
    // Согласие за ребёнка даёт законный представитель. У репетитора на этом
    // шаге ученика ещё нет, и подписываться за чужую семью он не может:
    // это согласие соберёт родитель, когда откроет приглашение.
    if (data.role === "parent" && !data.consentChildPd) {
      throw new Error("Без согласия на обработку данных ребёнка регистрация невозможна");
    }
    const email = data.email.toLowerCase().trim();
    const existing = await db().prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) throw new Error("Такая почта уже зарегистрирована");

    const id = uid("usr");
    // Регистрация всегда заводит родителя. Раньше первый зарегистрировавшийся
    // получал роль admin — на открытом сайте это означало, что администратором
    // становится тот, кто просто оказался первым. Учётная запись администратора
    // теперь создаётся отдельно, при развёртывании (см. ensureAdmin в
    // deploy/db-gateway/server.mjs).
    await db()
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, role, subscription_status, consent_pd, consent_child_pd, consent_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'free', 1, ?, ?, ?)`,
      )
      .bind(
        id,
        email,
        await hashPassword(data.password),
        data.name.trim(),
        data.role,
        data.consentChildPd ? 1 : 0,
        nowIso(),
        nowIso(),
      )
      .run();
    await startSession(id);
    await track("register", { userId: id, props: { role: data.role } });
    return { ok: true };
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

/* ------------------------------------------------- код родителя (4 цифры) */

const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "Код — это четыре цифры")
  .refine((v) => new Set(v).size > 1, "Четыре одинаковые цифры угадываются сразу");

/** Что показать на входе в кабинет: придумать код, ввести код или пустить. */
export const parentGate = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const pinSet = await hasParentPin(user.id);
  return { pinSet, unlocked: pinSet ? await isParentUnlocked(user.id) : true };
});

export const setParentPin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ pin: pinSchema, currentPin: z.string().nullable() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    // Смена кода возможна только из уже открытого кабинета или со старым кодом:
    // иначе ребёнок, добравшийся до вкладки, просто переписал бы код на свой.
    if (await hasParentPin(user.id)) {
      const unlocked = await isParentUnlocked(user.id);
      if (!unlocked) {
        if (!data.currentPin || !(await unlockParent(user.id, data.currentPin))) {
          throw new Error("Не подходит текущий код");
        }
      }
    }
    await saveParentPin(user.id, data.pin);
    await unlockParent(user.id, data.pin);
    await track("parent_pin_set", { userId: user.id });
    return { ok: true };
  });

export const unlockParentCabinet = createServerFn({ method: "POST" })
  .inputValidator(z.object({ pin: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!(await unlockParent(user.id, data.pin))) throw new Error("Не подходит код");
    return { ok: true };
  });

export const lockParentCabinet = createServerFn({ method: "POST" }).handler(async () => {
  await lockParent();
  return { ok: true };
});

/* --------------------------------------------------------------- дети */

export const addChild = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().trim().min(1, "Как зовут ребёнка?"),
      grade: z.number().int().min(1).max(4),
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
    // Роль в child_access, а не parent_id, решает, кто видит ученика.
    // Родитель, заводящий ребёнка сам, получает обе: и владение, и доступ.
    await grantChildAccess(id, user.id, user.role === "tutor" ? "tutor" : "parent");
    setCookie(CHILD_COOKIE, id, { path: "/", sameSite: "lax" });
    await track("child_created", { userId: user.id, childId: id });
    return { id };
  });

export const selectChild = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireChildAccess(data.childId, user.id);
    // Кука выбранного ребёнка живёт до закрытия браузера: если детей несколько,
    // новый сеанс должен начинаться с вопроса «кто сейчас занимается», а не
    // с прошлого выбора недельной давности.
    setCookie(CHILD_COOKIE, data.childId, { path: "/", sameSite: "lax" });
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
    const user = await requireParentAccess();
    await requireChildAccess(data.childId, user.id);
    await db()
      .prepare("UPDATE children SET daily_limit_min = ?, sound_on = ? WHERE id = ?")
      .bind(data.dailyLimitMin, data.soundOn ? 1 : 0, data.childId)
      .run();
    return { ok: true };
  });

/* ------------------------------------------------------ карта навыков */

export const getSkillMap = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const user = await requireUser();
    const child = (await requireChildAccess(data.childId, user.id)) as unknown as ChildRecord;
    // Пёрышки досчитываются лениво: «момента выполнения» у пункта домашки
    // нет, он выводится из занятий. Начисления идемпотентны.
    await syncCoins(data.childId);
    const paid = await childHasPaidAccess(data.childId);

    const subjects = await db()
      .prepare("SELECT * FROM subjects ORDER BY sort_order")
      .all<{ id: string; name: string }>();
    const topics = await db()
      .prepare("SELECT * FROM topics WHERE grade = ? ORDER BY subject_id, sort_order")
      .bind(child.grade)
      .all<TopicRow>();

    /*
     * Каталог дописывается к тому, что уже есть в базе.
     *
     * В базе лежит сид (первый и второй класс) плюс темы каталога, которые
     * кому-то уже открывали. Пока карта строилась только по базе, у ребёнка
     * третьего и четвёртого класса она была пустой: тем его класса в сиде
     * нет, а материализовать их было некому. Строка в базе по-прежнему
     * заводится лениво — в момент, когда тему открывают (см. startTopic).
     */
    const known = new Set((topics.results ?? []).map((t) => t.id));
    const catalogRows: TopicRow[] = CATALOG.filter(
      (t) => t.grade === child.grade && !known.has(t.code),
    ).map((t) => ({
      id: t.code,
      subject_id: t.subject,
      grade: t.grade,
      sort_order: 1000 + catalogIndex(t.code),
      name: t.title,
      summary: t.hours ? `${t.hours} ч по федеральной рабочей программе` : null,
      is_free: isFreeTopic(t.code) ? 1 : 0,
    }));
    const allTopics = [...(topics.results ?? []), ...catalogRows].sort(
      (a, b) => a.subject_id.localeCompare(b.subject_id) || a.sort_order - b.sort_order,
    );
    const progress = await db()
      .prepare("SELECT topic_id, status, stars, best_percent FROM progress WHERE child_id = ?")
      .bind(data.childId)
      .all<{ topic_id: string; status: string; stars: number; best_percent: number }>();

    // Занятия за неделю — для полоски дней в шапке: пропущенный день
    // ребёнок видит сам, без взрослого и без единой строки текста.
    // Отдаются метками времени, а не счётчиком по дням: календарный день
    // считает клиент, у которого есть часовой пояс (см. parentReport).
    const weekRuns = await db()
      .prepare("SELECT started_at FROM lessons WHERE child_id = ? AND started_at > ? ORDER BY started_at")
      .bind(data.childId, new Date(Date.now() - 7 * 864e5).toISOString())
      .all<{ started_at: string }>();

    const byTopic = new Map((progress.results ?? []).map((p) => [p.topic_id, p]));

    const map = (subjects.results ?? []).map((subject) => {
      const list = allTopics.filter((t) => t.subject_id === subject.id);
      let previousDone = true;
      let previousName = "";
      const items = list.map((topic) => {
        const p = byTopic.get(topic.id);
        const locked = !paid && !topic.is_free;
        const available = previousDone && !locked;
        // Причина закрытия важнее самого факта: «жди подписку» и «сначала
        // пройди предыдущую тему» — это разные вещи для ребёнка и родителя.
        const reason = locked ? "paywall" : available ? null : "sequence";
        const item = {
          id: topic.id,
          name: topic.name,
          summary: topic.summary,
          stars: p?.stars ?? 0,
          bestPercent: p?.best_percent ?? 0,
          status: p?.status ?? "locked",
          locked,
          available,
          reason,
          needsTopic: reason === "sequence" ? previousName : "",
        };
        previousDone = p?.status === "completed";
        previousName = topic.name;
        return item;
      });
      return { id: subject.id, name: subject.name, topics: items };
    });

    const totalStars = (progress.results ?? []).reduce((sum, p) => sum + p.stars, 0);
    return {
      child: { id: child.id, name: child.name, avatar: child.avatar, grade: child.grade, soundOn: !!child.sound_on, dailyLimitMin: child.daily_limit_min },
      subjects: map,
      totalStars,
      level: Math.floor(totalStars / 5) + 1,
      weekRuns: (weekRuns.results ?? []).map((r) => r.started_at),
      paid,
      ...(await owlState(data.childId)),
      // Есть ли у ученика педагог: от этого зависит, показывать ли карту
      // тем. У ученика репетитора программу выбирает педагог, у семейного —
      // сам ребёнок.
      hasTutor: !!(await db()
        .prepare("SELECT 1 AS ok FROM child_access WHERE child_id = ? AND role = 'tutor' LIMIT 1")
        .bind(data.childId)
        .first<{ ok: number }>()),
    };
  });

/* ------------------------------------------------------------ занятие */

export const startTopic = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string(), topicId: z.string(), mode: z.enum(["practice", "check"]) }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const user = await requireUser();
    await requireChildAccess(data.childId, user.id);

    // Тема каталога до первого захода в базе не существует — заводим её
    // вместе с заданиями, иначе ребёнку третьего класса открывать нечего.
    if (topicByCode(data.topicId)) await materializeTopic(data.topicId);
    const topic = await db().prepare("SELECT * FROM topics WHERE id = ?").bind(data.topicId).first<TopicRow>();
    if (!topic) throw new Error("Тема не найдена");
    if (!topic.is_free && !(await childHasPaidAccess(data.childId))) {
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
    await requireChildAccess(data.childId, user.id);
    const task = await db().prepare("SELECT * FROM tasks WHERE id = ?").bind(data.taskId).first<TaskRow>();
    if (!task) throw new Error("Задание не найдено");

    const correct = answersMatch(data.value, task.answer);
    await db()
      .prepare(
        "INSERT INTO attempts (id, child_id, task_id, topic_id, is_correct, seconds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(uid("att"), data.childId, data.taskId, task.topic_id, correct ? 1 : 0, data.seconds, nowIso())
      .run();

    // Тема помечается начатой уже на первом ответе. Раньше строка в progress
    // появлялась только на экране «Завершить», и ребёнок, закрывший вкладку
    // посередине, возвращался к карте, где ничего не изменилось — это и
    // читалось как «прогресс не сохраняется». Статус completed здесь не
    // трогается: его ставит только проверочная работа.
    await db()
      .prepare(
        `INSERT INTO progress (child_id, topic_id, status, stars, best_percent, updated_at)
         VALUES (?, ?, 'in_progress', 0, 0, ?)
         ON CONFLICT(child_id, topic_id) DO UPDATE SET updated_at = ?`,
      )
      .bind(data.childId, task.topic_id, nowIso(), nowIso())
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
    const child = (await requireChildAccess(data.childId, user.id)) as unknown as ChildRecord;

    // Число заданий берётся из базы, а не из тела запроса: в проверочной темы
    // «Считаем до 10» их пять, и результат вроде 92% означал бы, что клиент
    // прислал свой знаменатель. Такие проценты уже встречались в базе.
    const counted = await db()
      .prepare("SELECT COUNT(*) AS n FROM tasks WHERE topic_id = ? AND is_check = ?")
      .bind(data.topicId, data.mode === "check" ? 1 : 0)
      .first<{ n: number }>();
    const total = counted?.n && counted.n > 0 ? counted.n : data.total;
    const correct = Math.min(data.correct, total);
    const percent = Math.round((correct / total) * 100);

    await db()
      .prepare("UPDATE lessons SET seconds = ?, correct = ?, total = ? WHERE id = ? AND child_id = ?")
      .bind(data.seconds, correct, total, data.lessonId, data.childId)
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

    // «Следующий уровень не открылся» чаще всего означало не потерянный
    // прогресс, а закрытую подписку: тема пройдена, а следующая платная.
    // Теперь причина возвращается вместе с результатом и видна ребёнку.
    const topic = await db()
      .prepare("SELECT * FROM topics WHERE id = ?")
      .bind(data.topicId)
      .first<TopicRow>();
    let next: { name: string; locked: boolean } | null = null;
    if (topic && status === "completed") {
      const row = await db()
        .prepare(
          `SELECT name, is_free FROM topics
            WHERE subject_id = ? AND grade = ? AND sort_order > ?
            ORDER BY sort_order LIMIT 1`,
        )
        .bind(topic.subject_id, topic.grade, topic.sort_order)
        .first<{ name: string; is_free: number }>();
      if (row) next = { name: row.name, locked: !row.is_free && !(await childHasPaidAccess(data.childId)) };
    }

    // Род ребёнка приложение не спрашивает, поэтому в сообщении нет глаголов
    // прошедшего времени: «занятие окончено», а не «позанимался/позанималась».
    if (data.mode === "check") {
      await notifyParent(
        user.id,
        `Совёнок: у ${child.name} окончена проверочная по теме «${topic?.name ?? "занятие"}».\n` +
          `Верных ответов: ${percent}%. Время: ${Math.max(1, Math.round(data.seconds / 60))} мин.\n` +
          (passed ? "Тема зачтена." : "Для зачёта нужно 70% — тему можно пройти ещё раз."),
      );
    }

    return { percent, passed, stars: bestStars, mode: data.mode, next };
  });

/* -------------------------------------------------- родительский отчёт */

export const parentReport = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    await ensureSeeded();
    const user = await requireParentAccess();
    const child = (await requireChildAccess(data.childId, user.id)) as unknown as ChildRecord;
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

    // Знаменатель для «пройдено тем»: без него число растёт в пустоте и
    // не говорит, много это или мало. Считается по тому же объединению
    // базы и каталога, что и карта тем у ребёнка (см. getSkillMap): иначе
    // «5 из 3» у третьеклассника, которому каталог ещё не материализовали.
    const gradeTopics = await db()
      .prepare("SELECT id FROM topics WHERE grade = ?")
      .bind(child.grade)
      .all<{ id: string }>();
    const topicsTotal = {
      n: new Set([
        ...(gradeTopics.results ?? []).map((r) => r.id),
        ...CATALOG.filter((t) => t.grade === child.grade).map((t) => t.code),
      ]).size,
    };

    // Во всех GROUP BY ниже неагрегированные колонки (t.name, s.name)
    // перечислены явно: SQLite разрешает выбирать их «мимо» GROUP BY,
    // PostgreSQL это запрещает. Имена однозначны для topic_id, поэтому
    // выборка не меняется, и запрос остаётся верным для обоих движков.
    // Вместе с просевшей темой отдаём признак «педагог её задавал».
    //
    // Без него родитель видел процент и не видел вывода: «52%» — это его
    // забота или педагога? Теперь на вопрос отвечает сама строка.
    //
    // Окно — месяц по дате выдачи, а не «срок ещё не прошёл». Срок лежит
    // в базе как полная метка времени от полуночи (`new Date("2026-08-14")
    // .toISOString()`), поэтому домашка «на сегодня» после полуночи уже
    // считалась бы просроченной и тема мгновенно становилась бы «не
    // заданной». Просроченная домашка педагогом всё равно выдана — она
    // висит у него в списке, и родителю в неё лезть незачем. А выдача
    // трёхмесячной давности перестаёт отвечать за сегодняшний провал.
    const risk = await db()
      .prepare(
        `SELECT t.name AS topic, s.name AS subject,
                COUNT(*) AS total, SUM(a.is_correct) AS correct,
                EXISTS (
                  SELECT 1 FROM assignment_items ai
                    JOIN assignments asg ON asg.id = ai.assignment_id
                   WHERE ai.kind = 'topic' AND ai.ref_id = a.topic_id
                     AND asg.child_id = a.child_id
                     AND asg.canceled_at IS NULL
                     AND asg.created_at >= ?
                ) AS assigned
           FROM attempts a
           JOIN topics t ON t.id = a.topic_id
           JOIN subjects s ON s.id = t.subject_id
          WHERE a.child_id = ?
          GROUP BY a.topic_id, t.name, s.name, a.child_id
         HAVING COUNT(*) >= 4 AND (CAST(SUM(a.is_correct) AS REAL) / COUNT(*)) < 0.7
          ORDER BY (CAST(SUM(a.is_correct) AS REAL) / COUNT(*)) ASC
          LIMIT 5`,
      )
      .bind(new Date(Date.now() - 30 * 864e5).toISOString(), data.childId)
      .all<{ topic: string; subject: string; total: number; correct: number; assigned: number }>();

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

    // Тренажёры живут отдельно от тем, но родителю важно видеть и их:
    // «занимался ли ребёнок» — это не только пройденные темы.
    const drills = await db()
      .prepare(
        `SELECT kind, COUNT(*) AS runs, COALESCE(SUM(correct), 0) AS correct,
                COALESCE(SUM(total), 0) AS total, MAX(created_at) AS last_at
           FROM drills WHERE child_id = ? GROUP BY kind`,
      )
      .bind(data.childId)
      .all<{ kind: string; runs: number; correct: number; total: number; last_at: string }>();

    // Доля верных по каждой теме, а не только по проблемным. Раньше здесь
    // был один список «зон риска» и абзац, объясняющий, что это такое;
    // полоса, у которой отмечен порог 70%, объясняет себя сама, но для
    // этого ей нужны все темы, а не только те, что ниже порога.
    const mastery = await db()
      .prepare(
        `SELECT t.name AS topic, s.name AS subject, t.subject_id AS subject_id,
                t.sort_order AS sort_order,
                COUNT(*) AS total, SUM(a.is_correct) AS correct
           FROM attempts a
           JOIN topics t ON t.id = a.topic_id
           JOIN subjects s ON s.id = t.subject_id
          WHERE a.child_id = ?
          GROUP BY a.topic_id, t.name, s.name, t.subject_id, t.sort_order
          ORDER BY t.subject_id, t.sort_order`,
      )
      .bind(data.childId)
      .all<{ topic: string; subject: string; subject_id: string; sort_order: number; total: number; correct: number }>();

    // Точность за прошлую неделю — чтобы у числа была стрелка, а не просто
    // цифра: «78%» ни о чём не говорит, «78%, было 71%» говорит всё.
    const twoWeeksAgo = new Date(Date.now() - 14 * 864e5).toISOString();
    const weekAcc = await db()
      .prepare(
        `SELECT COUNT(*) AS attempts, SUM(is_correct) AS correct
           FROM attempts WHERE child_id = ? AND created_at > ?`,
      )
      .bind(data.childId, weekAgo)
      .first<{ attempts: number; correct: number | null }>();
    const prevAcc = await db()
      .prepare(
        `SELECT COUNT(*) AS attempts, SUM(is_correct) AS correct
           FROM attempts WHERE child_id = ? AND created_at > ? AND created_at <= ?`,
      )
      .bind(data.childId, twoWeeksAgo, weekAgo)
      .first<{ attempts: number; correct: number | null }>();

    // Занятия за неделю отдаются строками, а не сгруппированными по дням:
    // разложить их по календарным дням может только клиент — на сервере
    // нет часового пояса ребёнка, и занятие в девять вечера по Москве
    // ушло бы в следующий день.
    const weekRuns = await db()
      .prepare(
        `SELECT started_at, seconds FROM lessons
          WHERE child_id = ? AND started_at > ? ORDER BY started_at`,
      )
      .bind(data.childId, weekAgo)
      .all<{ started_at: string; seconds: number }>();

    // Последние заходы тренажёров: по одной точке на заход, чтобы было
    // видно направление. Сорок строк с запасом на оба тренажёра.
    const drillRuns = await db()
      .prepare(
        `SELECT kind, correct, total, score, created_at FROM drills
          WHERE child_id = ? ORDER BY created_at DESC LIMIT 40`,
      )
      .bind(data.childId)
      .all<{ kind: string; correct: number; total: number; score: number; created_at: string }>();

    await track("parent_dashboard_opened", { userId: user.id, childId: data.childId });

    const attempts = totals?.attempts ?? 0;
    return {
      child: { id: child.id, name: child.name, grade: child.grade, avatar: child.avatar, dailyLimitMin: child.daily_limit_min, soundOn: !!child.sound_on },
      accuracy: attempts ? Math.round(((totals?.correct ?? 0) / attempts) * 100) : 0,
      attempts,
      weekLessons: week?.lessons ?? 0,
      weekMinutes: Math.round((week?.seconds ?? 0) / 60),
      topicsDone: done?.n ?? 0,
      topicsTotal: topicsTotal?.n ?? 0,
      stars: done?.stars ?? 0,
      risk: (risk.results ?? []).map((r) => ({
        topic: r.topic,
        subject: r.subject,
        percent: Math.round((r.correct / r.total) * 100),
        total: r.total,
        assigned: Number(r.assigned) === 1,
      })),
      mastery: (mastery.results ?? []).map((m) => ({
        topic: m.topic,
        subject: m.subject,
        subjectId: m.subject_id,
        total: m.total,
        percent: Math.round((m.correct / m.total) * 100),
      })),
      weekAccuracy: weekAcc?.attempts ? Math.round(((weekAcc.correct ?? 0) / weekAcc.attempts) * 100) : null,
      prevAccuracy: prevAcc?.attempts ? Math.round(((prevAcc.correct ?? 0) / prevAcc.attempts) * 100) : null,
      weekRuns: (weekRuns.results ?? []).map((r) => ({ startedAt: r.started_at, seconds: r.seconds })),
      drillRuns: (drillRuns.results ?? [])
        .map((r) => ({ kind: r.kind, correct: r.correct, total: r.total, score: r.score, createdAt: r.created_at }))
        .reverse(),
      history: history.results ?? [],
      drills: drills.results ?? [],
      subscription: user.subscriptionStatus,
      // Пока у ребёнка есть наставник, родителю в истории видна сноска о
      // судьбе его заданий — предупреждение до события, а не после: после
      // удаления наставника следов «наставник был» сознательно не остаётся.
      hasTutor: !!(await db()
        .prepare("SELECT 1 AS ok FROM child_access WHERE child_id = ? AND role = 'tutor' LIMIT 1")
        .bind(data.childId)
        .first<{ ok: number }>()),
    };
  });

export const redeemPromo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().trim().min(3) }))
  .handler(async ({ data }) => {
    const user = await requireParentAccess();
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
  const user = await requireParentAccess();
  await db().batch([
    db().prepare("UPDATE users SET subscription_status = 'free' WHERE id = ?").bind(user.id),
    db().prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").bind(user.id),
  ]);
  return { ok: true };
});

/* ------------------------------------------------- удаление своих данных */

/**
 * Все следы ребёнка одним заходом. Порядок важен: настройки пунктов домашки
 * и сами пункты уходят раньше assignments, на которые смотрят их подзапросы,
 * — batch выполняется последовательно в одной транзакции.
 *
 * Удаление физическое, а не флагом: колонку deleted_at не добавить
 * (миграции идемпотентные, ADD COLUMN IF NOT EXISTS в SQLite нет), а фильтр
 * по отдельной таблице пришлось бы не забыть в каждом из десятка запросов
 * по child_id. Страховка от ошибочного удаления — ночные дампы
 * (deploy/backup-db.sh, KEEP=30): это и есть «не более 90 дней в составе
 * резервных копий» из п. 9 политики. events не трогаются — это технический
 * журнал со своим сроком хранения.
 */
async function purgeChildData(childId: string): Promise<void> {
  const D = db();
  await D.batch([
    D.prepare(
      `DELETE FROM assignment_item_settings WHERE item_id IN (
         SELECT id FROM assignment_items WHERE assignment_id IN (
           SELECT id FROM assignments WHERE child_id = ?))`,
    ).bind(childId),
    D.prepare(
      "DELETE FROM assignment_items WHERE assignment_id IN (SELECT id FROM assignments WHERE child_id = ?)",
    ).bind(childId),
    D.prepare("DELETE FROM assignments WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM custom_answer_files WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM custom_submissions WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM attempts WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM progress WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM lessons WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM drills WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM coin_grants WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM child_items WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM child_owl WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM invites WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM child_access WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM children WHERE id = ?").bind(childId),
  ]);
}

/** Имя при удалении сверяется так же мягко, как ответы ребёнка. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
  return norm(a) === norm(b);
}

export const deleteChild = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string(), confirmName: z.string() }))
  .handler(async ({ data }) => {
    // Кабинет и так за кодом, но право на удаление держит children.parent_id
    // — взрослый, который создал профиль и дал согласие (у непривязанного
    // ученика репетитора это сам репетитор, п. 9.7 оферты). Наставник с
    // доступом, но без владения, чужого ребёнка не удалит.
    const user = await requireParentAccess();
    const child = await db()
      .prepare("SELECT id, parent_id, name FROM children WHERE id = ?")
      .bind(data.childId)
      .first<{ id: string; parent_id: string; name: string }>();
    if (!child) throw new Error("Профиль ученика не найден");
    if (child.parent_id !== user.id) {
      throw new Error("Удалить профиль может только взрослый, который его создал");
    }
    if (!sameName(data.confirmName, child.name)) {
      throw new Error("Имя не совпадает с именем профиля");
    }
    await purgeChildData(child.id);
    if (getCookie(CHILD_COOKIE) === child.id) {
      setCookie(CHILD_COOKIE, "", { path: "/", maxAge: 0 });
    }
    await track("child_deleted", { userId: user.id, childId: child.id });
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().min(1, "Введите пароль") }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    // Учётная запись администратора заводится при развёртывании (ensureAdmin)
    // и удаляется только там же, а не кнопкой в кабинете.
    if (user.role === "admin") throw new Error("Учётную запись администратора так удалить нельзя");
    const row = await db()
      .prepare(
        "SELECT password_hash, consent_pd, consent_child_pd, consent_at, created_at FROM users WHERE id = ?",
      )
      .bind(user.id)
      .first<{
        password_hash: string;
        consent_pd: number;
        consent_child_pd: number;
        consent_at: string | null;
        created_at: string;
      }>();
    if (!row || !(await verifyPassword(data.password, row.password_hash))) {
      throw new Error("Не подходит пароль");
    }

    // Дети, за которых согласие давал этот взрослый. Ученики репетитора,
    // уже привязанные к семьям (parent_id сменился при принятии
    // приглашения), остаются: согласие на них держит родитель.
    const owned = await db()
      .prepare("SELECT id FROM children WHERE parent_id = ?")
      .bind(user.id)
      .all<{ id: string }>();
    for (const child of owned.results ?? []) await purgeChildData(child.id);

    // Факт согласия и его отзыва переживает аккаунт: им подтверждается
    // правомерность прошлой обработки (3 года по п. 9 политики).
    await db()
      .prepare(
        `INSERT INTO deleted_accounts (user_id, email, role, consent_pd, consent_child_pd, consent_at, registered_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id) DO NOTHING`,
      )
      .bind(
        user.id,
        user.email,
        user.role,
        row.consent_pd,
        row.consent_child_pd,
        row.consent_at,
        row.created_at,
        nowIso(),
      )
      .run();

    // Учебный след наставника уходит вместе с ним — на всех учеников,
    // включая уже привязанных к семьям: свои задания с приложенными
    // файлами (base64 в строке custom_tasks), выданные домашки и ответы
    // на них. Без текста задания ответ не открыть, поэтому осиротевших
    // строк не остаётся. Результаты занятий ребёнка (attempts, progress,
    // lessons, награды) привязаны к темам, а не к наставнику, — они
    // остаются семье. У родителя этим запросам совпасть не с чем.
    //
    // Платежи и подписки остаются: чеки и расчёты хранятся 5 лет по
    // налоговому законодательству независимо от отзыва согласия.
    await db().batch([
      db()
        .prepare(
          `DELETE FROM custom_answer_files WHERE item_id IN (
             SELECT id FROM assignment_items WHERE assignment_id IN (
               SELECT id FROM assignments WHERE tutor_id = ?))`,
        )
        .bind(user.id),
      db()
        .prepare(
          `DELETE FROM custom_submissions WHERE item_id IN (
             SELECT id FROM assignment_items WHERE assignment_id IN (
               SELECT id FROM assignments WHERE tutor_id = ?))`,
        )
        .bind(user.id),
      db()
        .prepare(
          `DELETE FROM assignment_item_settings WHERE item_id IN (
             SELECT id FROM assignment_items WHERE assignment_id IN (
               SELECT id FROM assignments WHERE tutor_id = ?))`,
        )
        .bind(user.id),
      db()
        .prepare(
          "DELETE FROM assignment_items WHERE assignment_id IN (SELECT id FROM assignments WHERE tutor_id = ?)",
        )
        .bind(user.id),
      db().prepare("DELETE FROM assignments WHERE tutor_id = ?").bind(user.id),
      db().prepare("DELETE FROM custom_tasks WHERE tutor_id = ?").bind(user.id),
      db().prepare("DELETE FROM invites WHERE tutor_id = ?").bind(user.id),
      db().prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      db().prepare("DELETE FROM parent_pins WHERE user_id = ?").bind(user.id),
      db().prepare("DELETE FROM parent_unlocks WHERE user_id = ?").bind(user.id),
      db().prepare("DELETE FROM notify_channels WHERE user_id = ?").bind(user.id),
      db().prepare("DELETE FROM child_access WHERE user_id = ?").bind(user.id),
      db()
        .prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'")
        .bind(user.id),
      db().prepare("DELETE FROM users WHERE id = ?").bind(user.id),
    ]);
    await track("account_deleted", { userId: user.id, props: { role: user.role } });
    // endSession подчистит куки; строки сессий уже удалены выше.
    await endSession();
    setCookie(CHILD_COOKIE, "", { path: "/", maxAge: 0 });
    return { ok: true };
  });

/* ------------------------------------------ нулевой урок без регистрации */

/**
 * Демо-бандл: семь заданий, доступных до всякой регистрации. Ответы наружу не
 * уходят — проверка всё равно на сервере, чтобы механика была ровно та же, что
 * и в настоящем занятии.
 */
export const demoLesson = createServerFn({ method: "GET" }).handler(async () => {
  await track("demo_started");
  return {
    tasks: DEMO_TASKS.map((task, i) => ({
      id: `demo-${i}`,
      kind: task.kind,
      prompt: task.prompt,
      payload: task.payload as TaskPayload,
    })),
  };
});

export const demoAnswer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ taskId: z.string(), value: z.string() }))
  .handler(async ({ data }) => {
    const index = Number(data.taskId.replace(/^demo-/, ""));
    const task = DEMO_TASKS[index];
    if (!task) throw new Error("Задание не найдено");
    const correct = answersMatch(data.value, task.answer);
    return { correct, explanation: correct ? null : task.explanation, answer: correct ? null : task.answer };
  });

export const demoFinished = createServerFn({ method: "POST" })
  .inputValidator(z.object({ correct: z.number().int().min(0), total: z.number().int().min(1) }))
  .handler(async ({ data }) => {
    await track("demo_finished", { props: data });
    return { ok: true };
  });

/* ----------------------------------------------------------- тренажёры */

/**
 * Скорочтение. Без аккаунта открыт только первый уровень: тренажёр должно быть
 * видно до регистрации, но не целиком. Правильные ответы уходят только вместе
 * с результатом (readingResult), в списке текстов их нет.
 */
export const readingTexts = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  const texts = READING_TEXTS.filter((t) => (user ? true : t.level === 1));
  return {
    signedIn: !!user,
    lockedLevels: user ? 0 : READING_TEXTS.filter((t) => t.level > 1).length,
    texts: texts.map((t) => ({
      id: t.id,
      level: t.level,
      title: t.title,
      body: t.body,
      words: t.body.trim().split(/\s+/).length,
      questions: t.questions.map((q, i) => ({ index: i, prompt: q.prompt, options: q.options })),
    })),
  };
});

export const readingResult = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      textId: z.string(),
      answers: z.array(z.object({ index: z.number().int().min(0), value: z.string() })),
      seconds: z.number().int().min(0).max(3600),
      wpm: z.number().int().min(0).max(3000),
      childId: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const text = READING_TEXTS.find((t) => t.id === data.textId);
    if (!text) throw new Error("Текст не найден");

    const details = text.questions.map((q, i) => {
      const given = data.answers.find((a) => a.index === i)?.value ?? "";
      return { prompt: q.prompt, answer: q.answer, correct: answersMatch(given, q.answer) };
    });
    const correct = details.filter((d) => d.correct).length;

    const saved = await saveDrillRow({
      childId: data.childId,
      kind: "reading",
      settings: { textId: text.id, level: text.level },
      correct,
      total: details.length,
      seconds: data.seconds,
      score: data.wpm,
    });

    return { correct, total: details.length, details, saved };
  });

/**
 * Общая запись результата тренажёра. Без аккаунта или без выбранного ребёнка
 * возвращает false — интерфейс на это показывает предложение зарегистрироваться.
 */
async function saveDrillRow(opts: {
  childId: string | null;
  kind: "mental" | "reading" | "shulte" | "spelling" | "table";
  settings: unknown;
  correct: number;
  total: number;
  seconds: number;
  score: number;
}): Promise<boolean> {
  if (!opts.childId) return false;
  const user = await currentUser();
  if (!user) return false;
  try {
    await requireChildAccess(opts.childId, user.id);
  } catch {
    return false;
  }
  await db()
    .prepare(
      `INSERT INTO drills (id, child_id, kind, settings, correct, total, seconds, score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      uid("drl"),
      opts.childId,
      opts.kind,
      JSON.stringify(opts.settings),
      opts.correct,
      opts.total,
      opts.seconds,
      opts.score,
      nowIso(),
    )
    .run();
  await track(`drill_${opts.kind}`, {
    userId: user.id,
    childId: opts.childId,
    props: { correct: opts.correct, total: opts.total, score: opts.score },
  });
  return true;
}

/** Итог тренажёра устного счёта: задания генерирует клиент, счёт хранится здесь. */
export const saveMentalDrill = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string().nullable(),
      correct: z.number().int().min(0),
      total: z.number().int().min(1),
      seconds: z.number().int().min(0).max(7200),
      digits: z.number().int().min(1).max(3),
      operations: z.array(z.enum(["add", "sub", "mul", "div"])).min(1),
      limitSec: z.number().int().min(0).max(120),
    }),
  )
  .handler(async ({ data }) => {
    const saved = await saveDrillRow({
      childId: data.childId,
      kind: "mental",
      settings: { digits: data.digits, operations: data.operations, limitSec: data.limitSec },
      correct: data.correct,
      total: data.total,
      seconds: data.seconds,
      score: Math.round((data.correct / data.total) * 100),
    });

    if (saved && data.childId) {
      const user = await currentUser();
      const child = await db()
        .prepare("SELECT name FROM children WHERE id = ?")
        .bind(data.childId)
        .first<{ name: string }>();
      if (user && child) {
        await notifyParent(
          user.id,
          `Совёнок: у ${child.name} окончен устный счёт.\n` +
            `Верных ответов: ${data.correct} из ${data.total}. Время: ${Math.max(1, Math.round(data.seconds / 60))} мин.`,
        );
      }
    }
    return { saved };
  });

/* --------------------------------------------- напоминания в мессенджер */

export const notifySettings = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireParentAccess();
  const rows = await db()
    .prepare("SELECT * FROM notify_channels WHERE user_id = ?")
    .bind(user.id)
    .all<ChannelRow>();
  const byChannel = new Map((rows.results ?? []).map((r) => [r.channel, r]));
  return {
    channels: (["tg", "max"] as NotifyChannel[]).map((channel) => {
      const row = byChannel.get(channel);
      return {
        channel,
        title: CHANNEL_TITLES[channel],
        ready: channelReady(channel),
        connected: !!row?.chat_id,
        enabled: row ? !!row.enabled : true,
        code: row?.chat_id ? null : (row?.link_code ?? null),
      };
    }),
  };
});

export const notifyConnect = createServerFn({ method: "POST" })
  .inputValidator(z.object({ channel: z.enum(["tg", "max"]) }))
  .handler(async ({ data }) => {
    const user = await requireParentAccess();
    const row = await ensureChannel(user.id, data.channel);
    return { code: row.chat_id ? null : row.link_code };
  });

export const notifyToggle = createServerFn({ method: "POST" })
  .inputValidator(z.object({ channel: z.enum(["tg", "max"]), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await requireParentAccess();
    await db()
      .prepare("UPDATE notify_channels SET enabled = ? WHERE user_id = ? AND channel = ?")
      .bind(data.enabled ? 1 : 0, user.id, data.channel)
      .run();
    return { ok: true };
  });

export const notifyDisconnect = createServerFn({ method: "POST" })
  .inputValidator(z.object({ channel: z.enum(["tg", "max"]) }))
  .handler(async ({ data }) => {
    const user = await requireParentAccess();
    await db()
      .prepare("DELETE FROM notify_channels WHERE user_id = ? AND channel = ?")
      .bind(user.id, data.channel)
      .run();
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
        GROUP BY a.topic_id, t.name HAVING COUNT(*) >= 5
        ORDER BY (CAST(SUM(a.is_correct) AS REAL) / COUNT(*)) ASC LIMIT 6`,
    )
    .all<{ topic: string; total: number; correct: number }>();

  const popular = await db()
    .prepare(
      `SELECT t.name AS topic, COUNT(*) AS lessons FROM lessons l
         JOIN topics t ON t.id = l.topic_id GROUP BY l.topic_id, t.name ORDER BY lessons DESC LIMIT 6`,
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

/* ------------------------------------------------------- лавка совёнка */

export const buyOwlItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string(), item: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireChildAccess(data.childId, user.id);
    const stars = await db()
      .prepare("SELECT COALESCE(SUM(stars), 0) AS n FROM progress WHERE child_id = ?")
      .bind(data.childId)
      .first<{ n: number }>();
    const level = Math.floor(Number(stars?.n ?? 0) / 5) + 1;
    await buyOwlItemFor(data.childId, data.item, level);
    await track("owl_item_bought", { childId: data.childId, props: { item: data.item } });
    // Возвращаем состояние лавки целиком, а не { ok: true }: экран ребёнка
    // раньше отвечал на покупку перезагрузкой страницы — она гасила экран
    // и уносила прокрутку наверх, хотя менялись три числа. Пересчитывать
    // их на клиенте нельзя: пёрышки капают и за домашку тоже.
    return await owlState(data.childId);
  });

export const equipOwlItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string(), item: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireChildAccess(data.childId, user.id);
    await equipOwlItemFor(data.childId, data.item);
    return await owlState(data.childId);
  });

/**
 * Таблица Шульте: ребёнок находит числа по порядку, тренируя поле зрения.
 * Правильных и неправильных ответов тут нет — есть время, поэтому в
 * drills пишется оно, а score это среднее число секунд на клетку ×10:
 * целые числа сравнивать между заходами проще, чем дробные.
 */
export const saveShulteDrill = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string().nullable(),
      size: z.number().int().min(3).max(5),
      seconds: z.number().int().min(1).max(3600),
      misses: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    const cells = data.size * data.size;
    const saved = await saveDrillRow({
      childId: data.childId,
      kind: "shulte",
      settings: { size: data.size, misses: data.misses },
      correct: cells,
      total: cells + data.misses,
      seconds: data.seconds,
      score: Math.round((data.seconds / cells) * 10),
    });
    return { saved, cells };
  });

/**
 * Правописание: какие правила брали, столько и верных. Список правил
 * ложится в settings — по нему в кабинете видно не «78% за русский», а
 * что просело именно правописание безударных гласных.
 */
export const saveSpellingDrill = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string().nullable(),
      correct: z.number().int().min(0),
      total: z.number().int().min(1).max(200),
      seconds: z.number().int().min(0).max(7200),
      rules: z.array(z.string().max(40)).min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const saved = await saveDrillRow({
      childId: data.childId,
      kind: "spelling",
      settings: { rules: data.rules },
      correct: data.correct,
      total: data.total,
      seconds: data.seconds,
      score: Math.round((data.correct / data.total) * 100),
    });
    return { saved };
  });

/** Таблица умножения: уровень и то, в какую сторону спрашивали. */
export const saveTableDrill = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string().nullable(),
      correct: z.number().int().min(0),
      total: z.number().int().min(1).max(200),
      seconds: z.number().int().min(0).max(7200),
      level: z.enum(["ten", "hundred", "beyond"]),
      directions: z.array(z.enum(["mul", "div", "factor"])).min(1),
    }),
  )
  .handler(async ({ data }) => {
    const saved = await saveDrillRow({
      childId: data.childId,
      kind: "table",
      settings: { level: data.level, directions: data.directions },
      correct: data.correct,
      total: data.total,
      seconds: data.seconds,
      score: Math.round((data.correct / data.total) * 100),
    });
    return { saved };
  });
