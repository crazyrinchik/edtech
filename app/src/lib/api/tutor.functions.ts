/**
 * Кабинет репетитора: ученики, приглашение родителя, домашняя работа.
 *
 * Отдельный модуль, а не продолжение app.functions.ts: там девятьсот строк
 * родительского и детского сценария, и смешивать с ними чужую роль незачем.
 *
 * Выполнение домашки нигде не хранится. Оно считается из lessons и drills за
 * окно с момента выдачи: занятия и заходы в тренажёр пишутся и так, а
 * отдельное поле «сдано» немедленно разошлось бы с фактическими попытками.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  childHasPaidAccess,
  db,
  grantChildAccess,
  hashPassword,
  nowIso,
  requireChildAccess,
  requireUser,
  startSession,
  track,
  uid,
} from "../core.server";

const INVITE_DAYS = 14;
const INVITE_DIGITS = 6;

/**
 * Код приглашения диктуют по телефону, поэтому он из одних цифр: буквы
 * приходится диктовать по алфавиту («эс как доллар»), а раскладку на
 * телефоне ещё и переключать. Шесть цифр набираются с цифровой клавиатуры
 * и не путаются с четырёхзначным кодом кабинета — тот заметно короче.
 *
 * Код — первичный ключ, поэтому проверяем занятость: миллион вариантов
 * при живых приглашениях на две недели сталкивается редко, но молча
 * падать на вставке нельзя.
 */
async function freshInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** INVITE_DIGITS;
    const code = String(n).padStart(INVITE_DIGITS, "0");
    const taken = await db()
      .prepare("SELECT code FROM invites WHERE code = ?")
      .bind(code)
      .first<{ code: string }>();
    if (!taken) return code;
  }
  throw new Error("Не удалось выдать код, попробуйте ещё раз");
}

async function requireTutor() {
  const user = await requireUser();
  if (user.role !== "tutor" && user.role !== "admin") {
    throw new Error("Раздел только для репетиторов");
  }
  return user;
}

/** Доступ к ученику именно как репетитора: родителю сюда нельзя. */
async function requireStudent(childId: string, userId: string) {
  const child = await requireChildAccess(childId, userId);
  const row = await db()
    .prepare("SELECT role FROM child_access WHERE child_id = ? AND user_id = ?")
    .bind(childId, userId)
    .first<{ role: string }>();
  if (row?.role !== "tutor") throw new Error("Ученик не ваш");
  return child;
}

type ItemRow = {
  id: string;
  assignment_id: string;
  kind: string;
  ref_id: string;
  target_percent: number;
  sort_order: number;
};

type AssignmentRow = {
  id: string;
  child_id: string;
  tutor_id: string;
  title: string;
  comment: string | null;
  due_at: string | null;
  created_at: string;
};

export type AssignmentItemView = {
  id: string;
  kind: string;
  refId: string;
  name: string;
  targetPercent: number;
  done: boolean;
  bestPercent: number | null;
};

export type AssignmentView = {
  id: string;
  title: string;
  comment: string | null;
  dueAt: string | null;
  createdAt: string;
  items: AssignmentItemView[];
  doneCount: number;
  total: number;
  status: "done" | "overdue" | "in_progress" | "new";
};

/**
 * Состояние домашки на момент запроса.
 *
 * Пункт закрыт, если после выдачи задания было занятие по этой теме с долей
 * верных не ниже целевой. Берётся лучший результат в окне, а не последний:
 * ребёнок, который со второго раза сделал на 90%, задание выполнил.
 */
async function buildAssignments(childId: string, rows: AssignmentRow[]): Promise<AssignmentView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(", ");

  const items = await db()
    .prepare(
      `SELECT * FROM assignment_items WHERE assignment_id IN (${placeholders}) ORDER BY sort_order`,
    )
    .bind(...ids)
    .all<ItemRow>();

  const topicIds = [...new Set((items.results ?? []).filter((i) => i.kind === "topic").map((i) => i.ref_id))];
  const names = new Map<string, string>();
  if (topicIds.length) {
    const topics = await db()
      .prepare(`SELECT id, name FROM topics WHERE id IN (${topicIds.map(() => "?").join(", ")})`)
      .bind(...topicIds)
      .all<{ id: string; name: string }>();
    for (const t of topics.results ?? []) names.set(t.id, t.name);
  }

  const lessons = await db()
    .prepare(
      `SELECT topic_id, started_at, correct, total FROM lessons
        WHERE child_id = ? AND total > 0 ORDER BY started_at`,
    )
    .bind(childId)
    .all<{ topic_id: string; started_at: string; correct: number; total: number }>();

  const drills = await db()
    .prepare("SELECT kind, created_at FROM drills WHERE child_id = ? ORDER BY created_at")
    .bind(childId)
    .all<{ kind: string; created_at: string }>();

  const now = nowIso();
  return rows.map((row) => {
    const own = (items.results ?? []).filter((i) => i.assignment_id === row.id);
    const views: AssignmentItemView[] = own.map((item) => {
      if (item.kind === "drill") {
        const hit = (drills.results ?? []).some(
          (d) => d.kind === item.ref_id && d.created_at >= row.created_at,
        );
        return {
          id: item.id,
          kind: item.kind,
          refId: item.ref_id,
          name: item.ref_id === "chtenie" ? "Скорочтение" : "Устный счёт",
          targetPercent: item.target_percent,
          done: hit,
          bestPercent: null,
        };
      }
      const best = (lessons.results ?? [])
        .filter((l) => l.topic_id === item.ref_id && l.started_at >= row.created_at)
        .reduce<number | null>((acc, l) => {
          const percent = Math.round((l.correct / l.total) * 100);
          return acc === null || percent > acc ? percent : acc;
        }, null);
      return {
        id: item.id,
        kind: item.kind,
        refId: item.ref_id,
        name: names.get(item.ref_id) ?? "Тема",
        targetPercent: item.target_percent,
        done: best !== null && best >= item.target_percent,
        bestPercent: best,
      };
    });

    const doneCount = views.filter((v) => v.done).length;
    const overdue = !!row.due_at && row.due_at < now;
    const status: AssignmentView["status"] =
      doneCount === views.length && views.length > 0
        ? "done"
        : overdue
          ? "overdue"
          : doneCount > 0
            ? "in_progress"
            : "new";

    return {
      id: row.id,
      title: row.title,
      comment: row.comment,
      dueAt: row.due_at,
      createdAt: row.created_at,
      items: views,
      doneCount,
      total: views.length,
      status,
    };
  });
}

async function activeAssignments(childId: string): Promise<AssignmentRow[]> {
  const rows = await db()
    .prepare(
      `SELECT * FROM assignments WHERE child_id = ? AND canceled_at IS NULL
        ORDER BY created_at DESC LIMIT 20`,
    )
    .bind(childId)
    .all<AssignmentRow>();
  return (rows.results ?? []) as AssignmentRow[];
}

/* ------------------------------------------------------------- ученики */

export const tutorStudents = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireTutor();
  const children = await db()
    .prepare(
      `SELECT c.id, c.name, c.avatar, c.grade, c.diagnostics_done,
              EXISTS (SELECT 1 FROM child_access p
                       WHERE p.child_id = c.id AND p.role = 'parent') AS parent_linked
         FROM children c JOIN child_access a ON a.child_id = c.id
        WHERE a.user_id = ? AND a.role = 'tutor'
        ORDER BY c.created_at`,
    )
    .bind(user.id)
    .all<{
      id: string;
      name: string;
      avatar: string;
      grade: number;
      parent_linked: number;
      diagnostics_done: number;
    }>();

  const students = [];
  for (const child of children.results ?? []) {
    const assignments = await buildAssignments(child.id, await activeAssignments(child.id));
    const current = assignments[0] ?? null;

    // Зона риска — та же метрика, что в кабинете родителя: доля верных
    // ниже 70% на теме, где было хотя бы пять попыток.
    const risk = await db()
      .prepare(
        `SELECT t.name AS name,
                ROUND(100.0 * SUM(a.is_correct) / COUNT(*)) AS percent,
                COUNT(*) AS tries
           FROM attempts a JOIN topics t ON t.id = a.topic_id
          WHERE a.child_id = ?
          GROUP BY a.topic_id, t.name
         HAVING COUNT(*) >= 5 AND ROUND(100.0 * SUM(a.is_correct) / COUNT(*)) < 70
          ORDER BY percent LIMIT 1`,
      )
      .bind(child.id)
      .first<{ name: string; percent: number }>();

    const last = await db()
      .prepare("SELECT started_at FROM lessons WHERE child_id = ? ORDER BY started_at DESC LIMIT 1")
      .bind(child.id)
      .first<{ started_at: string }>();

    // Родитель мог быть приглашён, но ещё не открыть код — это разные
    // состояния, и репетитору важно видеть, какое из них у него на руках.
    const invite = child.parent_linked
      ? null
      : await db()
          .prepare(
            // ORDER BY обязателен: без него при двух живых приглашениях
            // кабинет показывал произвольное из них, и репетитор мог
            // продиктовать код, который сам уже считал заменённым.
            `SELECT code FROM invites WHERE child_id = ? AND used_at IS NULL AND expires_at > ?
              ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(child.id, nowIso())
          .first<{ code: string }>();

    students.push({
      id: child.id,
      name: child.name,
      avatar: child.avatar,
      grade: child.grade,
      diagnosticsDone: !!child.diagnostics_done,
      parentLinked: !!child.parent_linked,
      inviteCode: invite?.code ?? null,
      lastLessonAt: last?.started_at ?? null,
      risk: risk ? { name: risk.name, percent: risk.percent } : null,
      assignment: current,
    });
  }

  return { students, paid: user.subscriptionStatus === "active" };
});

export const addStudent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().trim().min(1, "Как зовут ученика?"),
      grade: z.number().int().min(1).max(2),
      avatar: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const id = uid("chd");
    // parent_id — владелец записи, и он NOT NULL с самой первой миграции:
    // снять это ограничение одинаково в SQLite и PostgreSQL нельзя. Поэтому
    // до прихода родителя владельцем числится репетитор, а «родитель
    // подключён» определяется строкой в child_access с ролью parent —
    // там же, где живут все остальные роли.
    await db()
      .prepare(
        `INSERT INTO children (id, parent_id, name, avatar, grade, birth_year, diagnostics_done, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, 0, ?)`,
      )
      .bind(id, user.id, data.name.trim(), data.avatar, data.grade, nowIso())
      .run();
    await grantChildAccess(id, user.id, "tutor");
    await track("student_created", { userId: user.id, childId: id });
    return { id };
  });

/* --------------------------------------------------- приглашение родителя */

export const createInvite = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireTutor();
    await requireStudent(data.childId, user.id);
    const code = await freshInviteCode();
    await db()
      .prepare(
        `INSERT INTO invites (code, child_id, tutor_id, role, created_at, expires_at)
         VALUES (?, ?, ?, 'parent', ?, ?)`,
      )
      .bind(
        code,
        data.childId,
        user.id,
        nowIso(),
        new Date(Date.now() + INVITE_DAYS * 864e5).toISOString(),
      )
      .run();
    await track("invite_created", { userId: user.id, childId: data.childId });
    return { code };
  });

/** Что показать на экране приглашения до регистрации: имя ученика и педагога. */
export const inviteInfo = createServerFn({ method: "GET" })
  .inputValidator(z.object({ code: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const row = await db()
      .prepare(
        `SELECT i.code, c.name AS child_name, c.grade AS grade, u.name AS tutor_name
           FROM invites i
           JOIN children c ON c.id = i.child_id
           JOIN users u ON u.id = i.tutor_id
          WHERE i.code = ? AND i.used_at IS NULL AND i.expires_at > ?`,
      )
      .bind(data.code.replace(/\D/g, ""), nowIso())
      .first<{ child_name: string; grade: number; tutor_name: string | null }>();
    if (!row) return { ok: false as const };
    return {
      ok: true as const,
      childName: row.child_name,
      grade: row.grade,
      tutorName: row.tutor_name,
    };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().trim().min(1),
      email: z.string().email("Проверьте адрес почты"),
      password: z.string().min(8, "Пароль от 8 символов"),
      name: z.string().trim().min(1, "Укажите имя"),
      consentPd: z.boolean(),
      consentChildPd: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.consentPd || !data.consentChildPd) {
      throw new Error("Без согласия на обработку данных подключиться нельзя");
    }
    const code = data.code.replace(/\D/g, "");
    const invite = await db()
      .prepare("SELECT * FROM invites WHERE code = ? AND used_at IS NULL AND expires_at > ?")
      .bind(code, nowIso())
      .first<{ code: string; child_id: string; tutor_id: string }>();
    if (!invite) throw new Error("Приглашение не найдено или уже использовано");

    const email = data.email.toLowerCase().trim();
    const existing = await db()
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();

    let userId = existing?.id ?? null;
    if (!userId) {
      userId = uid("usr");
      await db()
        .prepare(
          `INSERT INTO users (id, email, password_hash, name, role, subscription_status, consent_pd, consent_child_pd, consent_at, created_at)
           VALUES (?, ?, ?, ?, 'parent', 'free', 1, 1, ?, ?)`,
        )
        .bind(userId, email, await hashPassword(data.password), data.name.trim(), nowIso(), nowIso())
        .run();
    }

    // Владельцем записи становится родитель: с этого момента согласие на
    // обработку данных ребёнка подписано им, и именно оно лежит в
    // users.consent_child_pd этого пользователя, а не репетитора.
    await db()
      .prepare("UPDATE children SET parent_id = ? WHERE id = ?")
      .bind(userId, invite.child_id)
      .run();
    await grantChildAccess(invite.child_id, userId, "parent");
    await db()
      .prepare("UPDATE invites SET used_at = ?, used_by = ? WHERE code = ?")
      .bind(nowIso(), userId, code)
      .run();

    await startSession(userId);
    await track("invite_accepted", { userId, childId: invite.child_id });
    return { ok: true };
  });

/* ------------------------------------------------------------- домашка */

export const studentCard = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const child = (await requireStudent(data.childId, user.id)) as unknown as {
      id: string;
      name: string;
      avatar: string;
      grade: number;
    };
    const parent = await db()
      .prepare("SELECT 1 AS ok FROM child_access WHERE child_id = ? AND role = 'parent' LIMIT 1")
      .bind(child.id)
      .first<{ ok: number }>();

    const subjects = await db()
      .prepare("SELECT id, name FROM subjects ORDER BY sort_order")
      .all<{ id: string; name: string }>();

    // Раньше здесь стояло WHERE t.grade <= ?: репетитору были видны только
    // темы до класса ученика. Программу выбирает педагог, а не поле в
    // профиле — второклассник может добирать первый класс, а сильный
    // первоклассник уходить вперёд. Класс темы теперь просто подписан.
    const topics = await db()
      .prepare(
        `SELECT t.id, t.subject_id, t.name, t.summary, t.grade, t.is_free,
                COALESCE(p.status, 'new') AS status,
                COALESCE(p.best_percent, 0) AS best_percent
           FROM topics t
           LEFT JOIN progress p ON p.topic_id = t.id AND p.child_id = ?
          ORDER BY t.subject_id, t.grade, t.sort_order`,
      )
      .bind(child.id)
      .all<{
        id: string;
        subject_id: string;
        name: string;
        summary: string | null;
        grade: number;
        is_free: number;
        status: string;
        best_percent: number;
      }>();

    const lessons = await db()
      .prepare(
        `SELECT l.started_at, l.correct, l.total, l.seconds, t.name AS topic
           FROM lessons l JOIN topics t ON t.id = l.topic_id
          WHERE l.child_id = ? ORDER BY l.started_at DESC LIMIT 10`,
      )
      .bind(child.id)
      .all<{ started_at: string; correct: number; total: number; seconds: number; topic: string }>();

    return {
      child: {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        grade: child.grade,
        parentLinked: !!parent,
      },
      paid: await childHasPaidAccess(child.id),
      subjects: subjects.results ?? [],
      topics: topics.results ?? [],
      lessons: lessons.results ?? [],
      assignments: await buildAssignments(child.id, await activeAssignments(child.id)),
    };
  });

export const createAssignment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string(),
      title: z.string().trim().min(1, "Назовите задание"),
      comment: z.string().trim().nullable(),
      dueAt: z.string().nullable(),
      items: z
        .array(
          z.object({
            kind: z.enum(["topic", "drill"]),
            refId: z.string().min(1),
            targetPercent: z.number().int().min(0).max(100).default(70),
          }),
        )
        .min(1, "Добавьте хотя бы один пункт"),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    await requireStudent(data.childId, user.id);

    const id = uid("asg");
    const statements = [
      db()
        .prepare(
          `INSERT INTO assignments (id, child_id, tutor_id, title, comment, due_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          data.childId,
          user.id,
          data.title.trim(),
          data.comment?.trim() || null,
          data.dueAt,
          nowIso(),
        ),
      ...data.items.map((item, index) =>
        db()
          .prepare(
            `INSERT INTO assignment_items (id, assignment_id, kind, ref_id, target_percent, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(uid("ai"), id, item.kind, item.refId, item.targetPercent, index),
      ),
    ];
    await db().batch(statements);
    await track("assignment_created", {
      userId: user.id,
      childId: data.childId,
      props: { items: data.items.length },
    });
    return { id };
  });

export const cancelAssignment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const row = await db()
      .prepare("SELECT child_id FROM assignments WHERE id = ?")
      .bind(data.id)
      .first<{ child_id: string }>();
    if (!row) throw new Error("Задание не найдено");
    await requireStudent(row.child_id, user.id);
    await db()
      .prepare("UPDATE assignments SET canceled_at = ? WHERE id = ?")
      .bind(nowIso(), data.id)
      .run();
    return { ok: true };
  });

/** Домашка глазами ребёнка и родителя: доступ проверяется по child_access. */
export const childAssignments = createServerFn({ method: "GET" })
  .inputValidator(z.object({ childId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireChildAccess(data.childId, user.id);
    // Выполненное задание не прячем. Раньше оно исчезало с экрана в тот
    // момент, когда ребёнок его дорешал, — то есть ровно тогда, когда он
    // должен был увидеть, что справился.
    const all = await buildAssignments(data.childId, await activeAssignments(data.childId));
    return { assignments: all.slice(0, 3) };
  });

/* ------------------------------------------------------- обзор программы

   Репетитору нужно видеть всю программу целиком, а не срез под одного
   ученика: он готовится к занятию, сверяется с учебником и решает, что
   давать дальше. Содержимое заданий открывает подписка — это и есть то,
   за что он платит; без неё видны названия тем и бесплатные темы. */

export const curriculum = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireTutor();
  const paid = user.subscriptionStatus === "active";

  const subjects = await db()
    .prepare("SELECT id, name FROM subjects ORDER BY sort_order")
    .all<{ id: string; name: string }>();

  const topics = await db()
    .prepare(
      `SELECT t.id, t.subject_id, t.grade, t.name, t.summary, t.is_free,
              (SELECT COUNT(*) FROM tasks k WHERE k.topic_id = t.id AND k.is_check = 0) AS practice,
              (SELECT COUNT(*) FROM tasks k WHERE k.topic_id = t.id AND k.is_check = 1) AS check_tasks
         FROM topics t
        ORDER BY t.subject_id, t.grade, t.sort_order`,
    )
    .all<{
      id: string;
      subject_id: string;
      grade: number;
      name: string;
      summary: string | null;
      is_free: number;
      practice: number;
      check_tasks: number;
    }>();

  const students = await db()
    .prepare(
      `SELECT c.id, c.name, c.grade FROM children c
         JOIN child_access a ON a.child_id = c.id
        WHERE a.user_id = ? AND a.role = 'tutor'
        ORDER BY c.created_at`,
    )
    .bind(user.id)
    .all<{ id: string; name: string; grade: number }>();

  return {
    paid,
    subjects: subjects.results ?? [],
    topics: (topics.results ?? []).map((t) => ({
      id: t.id,
      subjectId: t.subject_id,
      grade: t.grade,
      name: t.name,
      summary: t.summary,
      free: !!t.is_free,
      practice: Number(t.practice),
      check: Number(t.check_tasks),
      // Без подписки открыты только бесплатные темы — ровно то же правило,
      // по которому тема открывается ученику.
      locked: !paid && !t.is_free,
    })),
    students: students.results ?? [],
  };
});

/** Задания темы целиком: тренировка, проверочная, ответы и разборы. */
export const topicTasks = createServerFn({ method: "GET" })
  .inputValidator(z.object({ topicId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const topic = await db()
      .prepare("SELECT id, name, is_free FROM topics WHERE id = ?")
      .bind(data.topicId)
      .first<{ id: string; name: string; is_free: number }>();
    if (!topic) throw new Error("Тема не найдена");
    if (!topic.is_free && user.subscriptionStatus !== "active") {
      throw new Error("Задания этой темы открывает подписка");
    }

    const tasks = await db()
      .prepare(
        `SELECT id, kind, prompt, payload, answer, explanation, is_check
           FROM tasks WHERE topic_id = ? ORDER BY is_check, sort_order`,
      )
      .bind(data.topicId)
      .all<{
        id: string;
        kind: string;
        prompt: string;
        payload: string;
        answer: string;
        explanation: string;
        is_check: number;
      }>();

    return {
      topic: { id: topic.id, name: topic.name },
      tasks: (tasks.results ?? []).map((t) => ({
        id: t.id,
        kind: t.kind,
        prompt: t.prompt,
        options: ((): string[] => {
          try {
            return (JSON.parse(t.payload) as { options?: string[] }).options ?? [];
          } catch {
            return [];
          }
        })(),
        answer: t.answer,
        explanation: t.explanation,
        check: !!t.is_check,
      })),
    };
  });

/**
 * Выдать тему сразу нескольким ученикам: на занятии тему проходят с
 * группой, и заходить в каждую карточку отдельно значит повторять одно и
 * то же действие столько раз, сколько учеников.
 */
export const assignTopic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      topicId: z.string(),
      childIds: z.array(z.string()).min(1, "Выберите хотя бы одного ученика"),
      dueAt: z.string().nullable(),
      targetPercent: z.number().int().min(0).max(100).default(70),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const topic = await db()
      .prepare("SELECT id, name FROM topics WHERE id = ?")
      .bind(data.topicId)
      .first<{ id: string; name: string }>();
    if (!topic) throw new Error("Тема не найдена");

    for (const childId of data.childIds) {
      await requireStudent(childId, user.id);
      const id = uid("asg");
      await db().batch([
        db()
          .prepare(
            `INSERT INTO assignments (id, child_id, tutor_id, title, comment, due_at, created_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          )
          .bind(id, childId, user.id, topic.name, data.dueAt, nowIso()),
        db()
          .prepare(
            `INSERT INTO assignment_items (id, assignment_id, kind, ref_id, target_percent, sort_order)
             VALUES (?, ?, 'topic', ?, ?, 0)`,
          )
          .bind(uid("ai"), id, topic.id, data.targetPercent),
      ]);
    }

    await track("assignment_bulk", {
      userId: user.id,
      props: { topic: topic.id, students: data.childIds.length },
    });
    return { count: data.childIds.length };
  });
