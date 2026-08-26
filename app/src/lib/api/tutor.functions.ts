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

import { CATALOG, SUBJECTS } from "../content/curriculum.data";
import {
  catalogIndex,
  isFreeTopic,
  programById,
  programList,
  topicByCode,
  topicsFor,
} from "../content/curriculum";
import { CHECK_SIZE, topicTasks as catalogTasks } from "../content/practice";
import { PRACTICE_SIZE } from "../content/practice.core";

import {
  childCountFor,
  childHasPaidAccess,
  db,
  ensureSeeded,
  grantChildAccess,
  hashPassword,
  materializeTopic,
  nowIso,
  requireChildAccess,
  requireUser,
  startSession,
  track,
  uid,
} from "../core.server";
import { FREE_CHILD_LIMIT } from "../billing";
import {
  DESTRUCTION_UNCLAIMED,
  purgeChildData,
  UNCLAIMED_DAYS,
  unclaimedDeadlineIso,
  unclaimedExpired,
} from "../retention.server";

/**
 * Названия тренажёров для домашнего задания. Ключ — тот же код, что уходит
 * в assignment_items.ref_id и по которому ребёнок открывает страницу.
 */
const DRILL_TITLES: Record<string, string> = {
  schet: "Устный счёт",
  tablica: "Таблица умножения",
  pravopisanie: "Правописание",
  chtenie: "Скорочтение",
  shulte: "Таблица Шульте",
};

/**
 * Тот же тренажёр в таблице drills зовётся иначе: там kind описывает вид
 * упражнения («mental»), а в задании стоит адрес страницы («schet»). Пока
 * сравнивали напрямую, выполнение засчитывалось только у Шульте — у неё
 * одной оба имени совпадали. Перевод живёт здесь.
 */
const DRILL_ROWS: Record<string, string> = {
  schet: "mental",
  tablica: "table",
  pravopisanie: "spelling",
  chtenie: "reading",
  shulte: "shulte",
};

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
  /** Заполняется только у своих заданий репетитора. */
  body?: string | null;
  fileName?: string | null;
  answer?: string | null;
  answerFile?: string | null;
  submittedAt?: string | null;
  grade?: number | null;
  comment?: string | null;
  /** Настройки тренажёра, с которыми его задали. Только у kind='drill'. */
  settings?: Record<string, string> | null;
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

  const topicIds = [
    ...new Set((items.results ?? []).filter((i) => i.kind === "topic").map((i) => i.ref_id)),
  ];
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

  // Настройки тренажёра лежат отдельной таблицей: колонку в assignment_items
  // не добавить — миграции идемпотентны, а ADD COLUMN IF NOT EXISTS в SQLite
  // нет. Строка есть только у пунктов, которые задали не «как обычно».
  const itemIds = (items.results ?? []).map((i) => i.id);
  const settings = new Map<string, Record<string, string>>();
  if (itemIds.length) {
    const rows = await db()
      .prepare(
        `SELECT item_id, settings FROM assignment_item_settings
          WHERE item_id IN (${itemIds.map(() => "?").join(", ")})`,
      )
      .bind(...itemIds)
      .all<{ item_id: string; settings: string }>();
    for (const row of rows.results ?? []) {
      try {
        settings.set(row.item_id, JSON.parse(row.settings) as Record<string, string>);
      } catch {
        // Битую строку молча пропускаем: ребёнок откроет тренажёр с его
        // обычными настройками, а не увидит ошибку вместо задания.
      }
    }
  }

  // Свои задания проверяет педагог, поэтому «сделано» здесь означает
  // «оценено», а не «доля верных выше порога».
  const custom = await db()
    .prepare(
      // item_id берётся из самого пункта, а не из ответа: ответа может не
      // быть, тогда LEFT JOIN отдаёт NULL — и строка становится ненаходимой,
      // а задание показывается безымянным «заданием от педагога».
      `SELECT ai.id AS item_id, s.answer, s.submitted_at, s.grade, s.comment,
              t.title, t.body, t.file_name, f.file_name AS answer_file
         FROM assignment_items ai
         JOIN assignments a ON a.id = ai.assignment_id
         LEFT JOIN custom_submissions s ON s.item_id = ai.id
         LEFT JOIN custom_tasks t ON t.id = ai.ref_id
         LEFT JOIN custom_answer_files f ON f.item_id = ai.id
        WHERE a.child_id = ? AND ai.kind = 'custom'`,
    )
    .bind(childId)
    .all<{
      item_id: string | null;
      answer: string | null;
      submitted_at: string | null;
      grade: number | null;
      comment: string | null;
      title: string | null;
      body: string | null;
      file_name: string | null;
      answer_file: string | null;
    }>();

  const now = nowIso();
  return rows.map((row) => {
    const own = (items.results ?? []).filter((i) => i.assignment_id === row.id);
    const views: AssignmentItemView[] = own.map((item) => {
      if (item.kind === "custom") {
        // Одна строка на пункт: и текст задания, и ответ приходят вместе,
        // потому что запрос идёт от assignment_items, а не от ответа.
        const row = (custom.results ?? []).find((c) => c.item_id === item.id);
        return {
          id: item.id,
          kind: item.kind,
          refId: item.ref_id,
          name: row?.title ?? "Задание от педагога",
          targetPercent: item.target_percent,
          done: row?.grade !== null && row?.grade !== undefined,
          bestPercent: null,
          body: row?.body ?? null,
          fileName: row?.file_name ?? null,
          answer: row?.answer ?? null,
          answerFile: row?.answer_file ?? null,
          submittedAt: row?.submitted_at ?? null,
          grade: row?.grade ?? null,
          comment: row?.comment ?? null,
        };
      }
      if (item.kind === "drill") {
        const hit = (drills.results ?? []).some(
          (d) => d.kind === DRILL_ROWS[item.ref_id] && d.created_at >= row.created_at,
        );
        return {
          id: item.id,
          kind: item.kind,
          refId: item.ref_id,
          name: DRILL_TITLES[item.ref_id] ?? "Устный счёт",
          targetPercent: item.target_percent,
          done: hit,
          bestPercent: null,
          settings: settings.get(item.id) ?? null,
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
      `SELECT c.id, c.name, c.avatar, c.grade, c.created_at,
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
      created_at: string;
      parent_linked: number;
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
      parentLinked: !!child.parent_linked,
      inviteCode: invite?.code ?? null,
      // День, когда неподтверждённый профиль будет уничтожен
      // (retention.server.ts). Педагог должен видеть срок заранее, а не
      // обнаружить пропажу ученика вместе с занятиями.
      autoDeleteAt: child.parent_linked ? null : unclaimedDeadlineIso(child.created_at),
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
      // Одно слово, как в addChild: имени достаточно, ФИО ученика Совёнок
      // не собирает, и пробел в этом поле — почти всегда вписанная фамилия.
      name: z
        .string()
        .trim()
        .min(1, "Как зовут ученика?")
        .refine((s) => !/\s/.test(s), "Только имя, одним словом — без фамилии и пробелов"),
      grade: z.number().int().min(1).max(4),
      avatar: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    /*
     * Без подписки — один ученик.
     *
     * Проверка на сервере, а не только кнопкой в кабинете: форма
     * отправляется запросом, и запрет, живущий в разметке, не запрет.
     *
     * Считаются уже заведённые, и только в момент создания нового.
     * У репетитора, чья подписка кончилась с десятью учениками, ни один
     * не пропадёт — он просто не заведёт одиннадцатого. Отобрать
     * заведённого значит отобрать у ребёнка его занятия.
     */
    if (user.subscriptionStatus !== "active") {
      const already = await childCountFor(user.id, "tutor");
      if (already >= FREE_CHILD_LIMIT) {
        throw new Error(
          "Без подписки можно вести одного ученика. Подписка открывает всех остальных — оформить её можно в разделе «Подписка».",
        );
      }
    }
    // Отдельной галочки «у меня есть согласие родителя» здесь больше нет.
    // Заверение по п. 9.5 оферты репетитор даёт один раз, принимая оферту при
    // регистрации, а спрашивать его на каждом ученике было нечестно: профиль
    // заводится до того, как в системе вообще появляется родитель, и
    // настоящее согласие семья подписывает в приглашении.
    const id = uid("chd");
    // parent_id — владелец записи, и он NOT NULL с самой первой миграции:
    // снять это ограничение одинаково в SQLite и PostgreSQL нельзя. Поэтому
    // до прихода родителя владельцем числится репетитор, а «родитель
    // подключён» определяется строкой в child_access с ролью parent —
    // там же, где живут все остальные роли.
    await db()
      .prepare(
        `INSERT INTO children (id, parent_id, name, avatar, grade, birth_year, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      )
      .bind(id, user.id, data.name.trim(), data.avatar, data.grade, nowIso())
      .run();
    await grantChildAccess(id, user.id, "tutor");
    await track("student_created", { userId: user.id, childId: id, props: { grade: data.grade } });
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
        `SELECT i.code, c.name AS child_name, c.grade AS grade, u.name AS tutor_name,
                c.created_at AS child_created,
                EXISTS (SELECT 1 FROM child_access p
                         WHERE p.child_id = c.id AND p.role = 'parent') AS parent_linked
           FROM invites i
           JOIN children c ON c.id = i.child_id
           JOIN users u ON u.id = i.tutor_id
          WHERE i.code = ? AND i.used_at IS NULL AND i.expires_at > ?`,
      )
      .bind(data.code.replace(/\D/g, ""), nowIso())
      .first<{
        child_name: string;
        grade: number;
        tutor_name: string | null;
        child_created: string;
        parent_linked: number;
      }>();
    if (!row) return { ok: false as const };
    // Профиль пережил свои UNCLAIMED_DAYS без родителя — код к нему уже не
    // ведёт, даже если плановая зачистка ещё не добежала. Показывать имя из
    // записи, которой положено быть уничтоженной, нельзя.
    if (!row.parent_linked && unclaimedExpired(row.child_created)) {
      return { ok: false as const };
    }
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

    // Профиль, не подтверждённый родителем за UNCLAIMED_DAYS, не активируется
    // даже живым приглашением — согласие нельзя оформить задним числом к
    // записи, которой положено быть уничтоженной. Сносится прямо здесь, не
    // дожидаясь плановой зачистки (retention.server.ts), и до создания
    // учётной записи родителя: регистрация без ученика ему ни к чему.
    const child = await db()
      .prepare(
        `SELECT c.created_at,
                EXISTS (SELECT 1 FROM child_access p
                         WHERE p.child_id = c.id AND p.role = 'parent') AS parent_linked
           FROM children c WHERE c.id = ?`,
      )
      .bind(invite.child_id)
      .first<{ created_at: string; parent_linked: number }>();
    if (!child) throw new Error("Приглашение не найдено или уже использовано");
    if (!child.parent_linked && unclaimedExpired(child.created_at)) {
      await purgeChildData(invite.child_id, DESTRUCTION_UNCLAIMED);
      await track("child_unclaimed_purged", { childId: invite.child_id });
      throw new Error(
        `Профиль ученика ждал подтверждения дольше ${UNCLAIMED_DAYS} дней и был удалён вместе с данными. Попросите наставника завести профиль заново и прислать новый код.`,
      );
    }

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
        .bind(
          userId,
          email,
          await hashPassword(data.password),
          data.name.trim(),
          nowIso(),
          nowIso(),
        )
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
    // Контент создаётся лениво, при первом обращении. Раньше это делали только
    // ручки из app.functions — и на чистой базе педагог, пришедший по прямой
    // ссылке на карточку ученика (а не через список), видел форму выдачи без
    // единой темы: ни вкладок предметов, ни чипов. Сеяли за него /repetitor
    // и /uchenik, но полагаться на порядок захода тут нечего.
    await ensureSeeded();
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
    const paid = await childHasPaidAccess(child.id);

    // Заметка личная, поэтому ключ выборки включает user.id: второй взрослый
    // с доступом к тому же ученику увидит свою, а не эту. В кабинет родителя
    // и на экран ребёнка заметки не отдаёт ни одна ручка.
    const note = await db()
      .prepare("SELECT note FROM tutor_notes WHERE tutor_id = ? AND child_id = ?")
      .bind(user.id, child.id)
      .first<{ note: string }>();

    const subjects = await db()
      .prepare("SELECT id, name FROM subjects ORDER BY sort_order")
      .all<{ id: string; name: string }>();

    // Раньше здесь стояло WHERE t.grade <= ?: репетитору были видны только
    // темы до класса ученика. Программу выбирает педагог, а не поле в
    // профиле — второклассник может добирать первый класс, а сильный
    // первоклассник уходить вперёд. Класс темы теперь просто подписан.
    // Вместе с темой отдаём долю верных по ней.
    //
    // Педагог приходит в форму с готовым решением — «этому вычитание, оно
    // просело», — а список тем был ровным алфавитным полем из двух десятков
    // чипов, где просевшая ничем не отличалась от пройденной. Зоны риска
    // при этом уже считались, но на другом экране. Теперь цифра приезжает
    // вместе с темой, и подбор может поставить провалы первыми.
    //
    // attempts агрегируется подзапросом, а не JOIN-ом с GROUP BY: тем
    // много, попыток на порядок больше, и группировать всю таблицу ради
    // двух чисел на тему незачем.
    const topics = await db()
      .prepare(
        `SELECT t.id, t.subject_id, t.name, t.summary, t.grade, t.is_free, t.sort_order,
                COALESCE(p.status, 'new') AS status,
                COALESCE(p.best_percent, 0) AS best_percent,
                COALESCE(a.total, 0) AS attempts,
                COALESCE(a.correct, 0) AS correct
           FROM topics t
           LEFT JOIN progress p ON p.topic_id = t.id AND p.child_id = ?
           LEFT JOIN (
             SELECT topic_id, COUNT(*) AS total, SUM(is_correct) AS correct
               FROM attempts WHERE child_id = ? GROUP BY topic_id
           ) a ON a.topic_id = t.id
          ORDER BY t.subject_id, t.grade, t.sort_order`,
      )
      .bind(child.id, child.id)
      .all<{
        id: string;
        subject_id: string;
        name: string;
        summary: string | null;
        grade: number;
        is_free: number;
        sort_order: number;
        status: string;
        best_percent: number;
        attempts: number;
        correct: number;
      }>();

    /*
     * Каталог дописывается к тому, что уже есть в базе.
     *
     * В базе лежат только сид и те темы каталога, которые кому-то уже
     * задавали: остальные семьдесят с лишним материализуются в момент
     * выдачи. Форма выдачи брала список прямо из базы — и педагог видел в
     * ней десяток тем вместо всей начальной школы, притом что на соседнем
     * экране «Темы и задания» лежала вся программа. Теперь списки совпадают,
     * а строка в базе по-прежнему заводится только когда тему задали.
     */
    const known = new Set((topics.results ?? []).map((t) => t.id));
    const fromCatalog = CATALOG.filter((t) => !known.has(t.code)).map((t) => ({
      id: t.code,
      subject_id: t.subject as string,
      name: t.title,
      summary: t.hours ? `${t.hours} ч по федеральной рабочей программе` : null,
      grade: t.grade,
      is_free: isFreeTopic(t.code) ? 1 : 0,
      // Тот же порядок, что и у материализованной темы: сид в начале
      // дорожки, каталог следом за ним.
      sort_order: 1000 + catalogIndex(t.code),
      status: "new",
      best_percent: 0,
      attempts: 0,
      correct: 0,
    }));
    const allTopics = [...(topics.results ?? []), ...fromCatalog].sort(
      (a, b) =>
        a.subject_id.localeCompare(b.subject_id) ||
        a.grade - b.grade ||
        a.sort_order - b.sort_order,
    );

    // Остальные ученики педагога — для выдачи одной домашки сразу группе.
    // Только имя и аватар: список нужен, чтобы отметить галочками, а не
    // чтобы читать в нём статистику.
    const classmates = await db()
      .prepare(
        `SELECT c.id, c.name, c.grade, c.avatar
           FROM child_access ca JOIN children c ON c.id = ca.child_id
          WHERE ca.user_id = ? AND ca.role = 'tutor' AND c.id <> ?
          ORDER BY c.grade, c.name`,
      )
      .bind(user.id, child.id)
      .all<{ id: string; name: string; grade: number; avatar: string }>();

    const lessons = await db()
      .prepare(
        `SELECT l.started_at, l.correct, l.total, l.seconds, t.name AS topic
           FROM lessons l JOIN topics t ON t.id = l.topic_id
          WHERE l.child_id = ? ORDER BY l.started_at DESC LIMIT 10`,
      )
      .bind(child.id)
      .all<{
        started_at: string;
        correct: number;
        total: number;
        seconds: number;
        topic: string;
      }>();

    return {
      child: {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        grade: child.grade,
        parentLinked: !!parent,
      },
      note: note?.note ?? "",
      paid,
      subjects: subjects.results ?? [],
      topics: allTopics.map((t) => ({
        ...t,
        // Доля верных считается тут, а не в SQL: делить на ноль в запросе
        // пришлось бы через CASE, а «попыток не было» — это не 0%, это
        // «нечего показывать», и на клиенте отличать null от нуля проще.
        percent: t.attempts >= 4 ? Math.round((t.correct / t.attempts) * 100) : null,
        // Закрытую тему форма выдачи гасит: сервер её всё равно не примет,
        // и лучше это видно до нажатия, чем после.
        locked: !paid && !t.is_free,
      })),
      classmates: classmates.results ?? [],
      lessons: lessons.results ?? [],
      assignments: await buildAssignments(child.id, await activeAssignments(child.id)),
    };
  });

/**
 * Заметка репетитора об ученике — сохранить или стереть.
 *
 * Пустая заметка удаляет строку, а не хранит пустоту: у большинства пар
 * (педагог, ученик) заметки нет, и таблица должна это отражать. Лимит —
 * страховка от вставки туда конспекта; сами формулировки на совести
 * педагога, поле подписано как «видите только вы».
 */
export const saveStudentNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string(),
      note: z.string().max(2000, "Заметка — до 2000 знаков"),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    await requireStudent(data.childId, user.id);
    const note = data.note.trim();
    if (!note) {
      await db()
        .prepare("DELETE FROM tutor_notes WHERE tutor_id = ? AND child_id = ?")
        .bind(user.id, data.childId)
        .run();
      return { ok: true };
    }
    // UPSERT одинаково понимают и SQLite, и PostgreSQL — как ON CONFLICT
    // DO NOTHING в соседних вставках.
    await db()
      .prepare(
        `INSERT INTO tutor_notes (tutor_id, child_id, note, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (tutor_id, child_id)
         DO UPDATE SET note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
      )
      .bind(user.id, data.childId, note, nowIso())
      .run();
    return { ok: true };
  });

/**
 * Выдача домашней работы — одному ученику или сразу нескольким.
 *
 * Раньше ручка принимала один childId, и педагог с пятнадцатью учениками
 * на одной программе проходил форму пятнадцать раз подряд. Теперь список:
 * на каждого заводится своя домашка (свой срок, свой прогресс, снять можно
 * по отдельности) — общей записи «на группу» не появляется, потому что
 * группы в модели нет и заводить её ради формы неправильно.
 *
 * Права проверяются по каждому ученику отдельно: requireStudent для всех
 * до единой вставки, чтобы чужой ребёнок не проехал в списке зайцем.
 */
export const createAssignment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childIds: z.array(z.string().min(1)).min(1, "Выберите хотя бы одного ученика"),
      title: z.string().trim().min(1, "Назовите задание"),
      comment: z.string().trim().nullable(),
      dueAt: z.string().nullable(),
      items: z
        .array(
          z.object({
            kind: z.enum(["topic", "drill"]),
            refId: z.string().min(1),
            targetPercent: z.number().int().min(0).max(100).default(70),
            /** Настройки тренажёра: разрядность, действия, таймер и прочее. */
            settings: z.record(z.string(), z.string()).nullable().default(null),
          }),
        )
        .min(1, "Добавьте хотя бы один пункт"),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    // Дубли в списке убираем до проверки прав: иначе один и тот же ученик
    // получил бы две одинаковые домашки за один клик.
    const childIds = [...new Set(data.childIds)];
    for (const childId of childIds) await requireStudent(childId, user.id);

    // Тема каталога до первой выдачи в базе не существует: без этого ученик
    // получал бы пункт домашки, ведущий в никуда.
    const topicIds = data.items.filter((i) => i.kind === "topic").map((i) => i.refId);
    for (const code of new Set(topicIds)) {
      if (topicByCode(code)) await materializeTopic(code);
    }
    await requireTopicsOpen(childIds, topicIds);

    const now = nowIso();
    const ids: string[] = [];
    const settingRows: { itemId: string; settings: string }[] = [];
    const statements = childIds.flatMap((childId) => {
      const id = uid("asg");
      ids.push(id);
      return [
        db()
          .prepare(
            `INSERT INTO assignments (id, child_id, tutor_id, title, comment, due_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            childId,
            user.id,
            data.title.trim(),
            data.comment?.trim() || null,
            data.dueAt,
            now,
          ),
        ...data.items.map((item, index) => {
          const itemId = uid("ai");
          if (item.settings && Object.keys(item.settings).length) {
            settingRows.push({ itemId, settings: JSON.stringify(item.settings) });
          }
          return db()
            .prepare(
              `INSERT INTO assignment_items (id, assignment_id, kind, ref_id, target_percent, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(itemId, id, item.kind, item.refId, item.targetPercent, index);
        }),
      ];
    });
    await db().batch([
      ...statements,
      ...settingRows.map((row) =>
        db()
          .prepare("INSERT INTO assignment_item_settings (item_id, settings) VALUES (?, ?)")
          .bind(row.itemId, row.settings),
      ),
    ]);
    for (const childId of childIds) {
      await track("assignment_created", {
        userId: user.id,
        childId,
        props: { items: data.items.length, students: childIds.length },
      });
    }
    return { ids };
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

/**
 * Удалить задание насовсем — вместе с вложением и ответами учеников.
 *
 * Отличается от cancelAssignment тем, что после него не остаётся ничего:
 * в задании и в ответе на него может лежать фотография, а фотография —
 * персональные данные, и отметки «отменено» для них мало.
 *
 * Своё задание создаётся одно на всех выбранных учеников, поэтому сам
 * custom_tasks удаляется только тогда, когда на него не ссылается больше
 * ни одно задание: иначе удаление у одного ученика оставило бы остальных
 * с пустой карточкой.
 */
export const deleteAssignment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const row = await db()
      .prepare("SELECT child_id FROM assignments WHERE id = ?")
      .bind(data.id)
      .first<{ child_id: string }>();
    if (!row) throw new Error("Задание не найдено");
    await requireStudent(row.child_id, user.id);

    const items = await db()
      .prepare("SELECT id, kind, ref_id FROM assignment_items WHERE assignment_id = ?")
      .bind(data.id)
      .all<{ id: string; kind: string; ref_id: string }>();
    const rows = items.results ?? [];

    for (const item of rows) {
      await db().batch([
        db().prepare("DELETE FROM custom_answer_files WHERE item_id = ?").bind(item.id),
        db().prepare("DELETE FROM custom_submissions WHERE item_id = ?").bind(item.id),
        db().prepare("DELETE FROM assignment_item_settings WHERE item_id = ?").bind(item.id),
      ]);
    }

    await db().batch([
      db().prepare("DELETE FROM assignment_items WHERE assignment_id = ?").bind(data.id),
      db().prepare("DELETE FROM assignments WHERE id = ?").bind(data.id),
    ]);

    // Осиротевшие свои задания убираем следом — вместе с файлом внутри.
    for (const item of rows) {
      if (item.kind !== "custom" || !item.ref_id) continue;
      const still = await db()
        .prepare("SELECT 1 AS ok FROM assignment_items WHERE ref_id = ? LIMIT 1")
        .bind(item.ref_id)
        .first<{ ok: number }>();
      if (!still) {
        await db().prepare("DELETE FROM custom_tasks WHERE id = ?").bind(item.ref_id).run();
      }
    }

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

/**
 * Список программ для выбора: репетитор узнаёт учебник по названию и авторам.
 *
 * Базовая программа в список не попадает: её порядок и есть общий список тем,
 * и вторая карточка с тем же содержимым только заставляла бы выбирать между
 * одинаковыми вариантами.
 */
export const programs = createServerFn({ method: "GET" }).handler(async () => {
  await requireTutor();
  return {
    programs: programList()
      .filter((p) => !p.isDefault)
      .map((p) => ({
        id: p.id,
        name: p.name,
        short: p.short,
        share: p.share,
        authors: p.authors,
        note: p.note,
        subjects: p.subjects,
        warning: p.warning,
      })),
  };
});

/**
 * Тему, закрытую подпиской, задать нельзя.
 *
 * Раньше выдача ничего не проверяла, и педагог без подписки спокойно
 * задавал платную тему: у ребёнка она появлялась в домашке, а по нажатию
 * встречала надписью «доступно по подписке». Тупик получался у того, кто в
 * нём ни при чём, — поэтому проверка стоит на выдаче, в единственном месте,
 * где ещё есть кому показать причину.
 *
 * Проверяется доступ ученика, а не подписка педагога: платить может и
 * семья, и тогда репетитору без подписки задавать не запрещено.
 */
async function requireTopicsOpen(childIds: string[], topicIds: string[]): Promise<void> {
  const unique = [...new Set(topicIds)];
  if (unique.length === 0) return;
  const rows = await db()
    .prepare(
      `SELECT id, name, is_free FROM topics WHERE id IN (${unique.map(() => "?").join(", ")})`,
    )
    .bind(...unique)
    .all<{ id: string; name: string; is_free: number }>();
  const closed = (rows.results ?? []).filter((t) => !t.is_free);
  if (closed.length === 0) return;

  for (const childId of childIds) {
    if (await childHasPaidAccess(childId)) continue;
    const names = closed.map((t) => `«${t.name}»`).join(", ");
    throw new Error(
      closed.length === 1
        ? `Тема ${names} откроется ученику только с подпиской. Оформите подписку или выберите открытую тему.`
        : `Темы ${names} откроются ученику только с подпиской. Оформите подписку или выберите открытые темы.`,
    );
  }
}

/**
 * Программа класса: темы в порядке выбранного учебника или общий список.
 *
 * Класс спрашивается всегда, программа — по желанию. Так и работает
 * подготовка к занятию: сначала «третий класс», потом уже «а учебник у нас
 * Петерсон».
 */
export const curriculum = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      programId: z.string().nullable().default(null),
      grade: z.number().int().min(1).max(4).default(1),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const paid = user.subscriptionStatus === "active";
    const program = programById(data.programId);

    const students = await db()
      .prepare(
        `SELECT c.id, c.name, c.grade FROM children c
           JOIN child_access a ON a.child_id = c.id
          WHERE a.user_id = ? AND a.role = 'tutor'
          ORDER BY c.created_at`,
      )
      .bind(user.id)
      .all<{ id: string; name: string; grade: number }>();

    /*
     * Предметы показываются все, даже когда программа их не описывает.
     *
     * Петерсон — автор математики, русского у него нет и не будет. Раньше
     * это значило, что на его вкладке русский просто исчезал, а вместо
     * него висела подсказка «откройте общим списком». Репетитор ведёт
     * ребёнка целиком и прыгал между вкладками ради второго предмета,
     * хотя темы в общем списке ровно те, что ему и нужны.
     *
     * Теперь недостающий предмет берётся из общего списка и стоит на
     * своём месте, а fromProgram отмечает, откуда он взялся: выдавать
     * общий порядок за авторский нельзя, и подпись над списком об этом
     * говорит.
     */
    const subjects = SUBJECTS.map((subject) => {
      const fromProgram = !program || program.subjects.includes(subject.id);
      return {
        id: subject.id,
        name: subject.name,
        fromProgram,
        topics: topicsFor(fromProgram ? (program?.id ?? null) : null, subject.id, data.grade).map(
          (topic) => ({
            code: topic.code,
            title: topic.title,
            hours: topic.hours,
            chapters: topic.chapters,
            inProgram: topic.inProgram,
            practice: PRACTICE_SIZE,
            check: CHECK_SIZE,
            free: isFreeTopic(topic.code),
            // Без подписки открыты только бесплатные темы — ровно то же правило,
            // по которому тема открывается ученику.
            locked: !paid && !isFreeTopic(topic.code),
          }),
        ),
      };
    });

    return {
      paid,
      grade: data.grade,
      program: program
        ? {
            id: program.id,
            name: program.name,
            short: program.short,
            note: program.note,
            warning: program.warning,
          }
        : null,
      subjects,
      students: students.results ?? [],
    };
  });

/** Задания темы целиком: тренировка, проверочная, ответы и разборы. */
export const topicTasks = createServerFn({ method: "GET" })
  .inputValidator(z.object({ topicId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const topic = topicByCode(data.topicId);
    if (!topic) throw new Error("Тема не найдена");
    if (!isFreeTopic(topic.code) && user.subscriptionStatus !== "active") {
      throw new Error("Задания этой темы открывает подписка");
    }

    return {
      topic: { id: topic.code, name: topic.title },
      tasks: catalogTasks(topic.code).map((task, index) => ({
        id: `${topic.code}#${index}`,
        kind: task.kind,
        prompt: task.prompt,
        options: task.payload.options ?? [],
        answer: task.answer,
        explanation: task.explanation,
        check: task.isCheck,
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
    // Тема каталога до первой выдачи в базе не существует — создаём её вместе
    // с заданиями, иначе ученику будет некуда зайти.
    if (topicByCode(data.topicId)) await materializeTopic(data.topicId);
    const topic = await db()
      .prepare("SELECT id, name FROM topics WHERE id = ?")
      .bind(data.topicId)
      .first<{ id: string; name: string }>();
    if (!topic) throw new Error("Тема не найдена");

    for (const childId of data.childIds) await requireStudent(childId, user.id);
    await requireTopicsOpen(data.childIds, [topic.id]);

    for (const childId of data.childIds) {
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

/* --------------------------------------------- свои задания репетитора

   Готовые темы закрывают программу, но у педагога всегда есть своё:
   карточка из учебника, страница прописей, задача с занятия. Такое
   задание проверяет он сам, поэтому здесь появляются ответ ученика и
   оценка — у обычных пунктов домашки их нет и быть не может. */

/** Предел размера вложения. Файл лежит в базе, а её каждую ночь дампят. */
const MAX_FILE_BYTES = 1_500_000;

export const createCustomAssignment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childIds: z.array(z.string()).min(1, "Выберите хотя бы одного ученика"),
      title: z.string().trim().min(1, "Назовите задание"),
      body: z.string().trim().nullable(),
      dueAt: z.string().nullable(),
      file: z
        .object({
          name: z.string().min(1),
          type: z.string().min(1),
          data: z.string().min(1),
        })
        .nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    if (!data.body && !data.file) throw new Error("Добавьте текст задания или файл");
    if (data.file) {
      // base64 раздувает вес примерно на треть — считаем исходный размер.
      const bytes = Math.floor((data.file.data.length * 3) / 4);
      if (bytes > MAX_FILE_BYTES) throw new Error("Файл больше 1,5 МБ — приложите файл поменьше");
    }

    const taskId = uid("ctk");
    await db()
      .prepare(
        `INSERT INTO custom_tasks (id, tutor_id, title, body, file_name, file_type, file_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        taskId,
        user.id,
        data.title.trim(),
        data.body?.trim() || null,
        data.file?.name ?? null,
        data.file?.type ?? null,
        data.file?.data ?? null,
        nowIso(),
      )
      .run();

    for (const childId of data.childIds) {
      await requireStudent(childId, user.id);
      const id = uid("asg");
      await db().batch([
        db()
          .prepare(
            `INSERT INTO assignments (id, child_id, tutor_id, title, comment, due_at, created_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          )
          .bind(id, childId, user.id, data.title.trim(), data.dueAt, nowIso()),
        db()
          .prepare(
            `INSERT INTO assignment_items (id, assignment_id, kind, ref_id, target_percent, sort_order)
             VALUES (?, ?, 'custom', ?, 0, 0)`,
          )
          .bind(uid("ai"), id, taskId),
      ]);
    }

    await track("custom_assignment", {
      userId: user.id,
      props: { students: data.childIds.length, withFile: !!data.file },
    });
    return { count: data.childIds.length };
  });

/** Вложение отдаётся отдельным запросом: в списке заданий оно ни к чему. */
export const customTaskFile = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ itemId: z.string(), which: z.enum(["task", "answer"]).default("task") }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    // Задание педагога и ответ ученика лежат в разных таблицах, но отдаются
    // одной ручкой: проверка доступа у них общая и должна быть одна.
    const source =
      data.which === "answer"
        ? `SELECT a.child_id, f.file_name, f.file_type, f.file_data
             FROM assignment_items ai
             JOIN assignments a ON a.id = ai.assignment_id
             JOIN custom_answer_files f ON f.item_id = ai.id
            WHERE ai.id = ?`
        : `SELECT a.child_id, t.file_name, t.file_type, t.file_data
             FROM assignment_items ai
             JOIN assignments a ON a.id = ai.assignment_id
             JOIN custom_tasks t ON t.id = ai.ref_id
            WHERE ai.id = ?`;
    const row = await db().prepare(source).bind(data.itemId).first<{
      child_id: string;
      file_name: string | null;
      file_type: string | null;
      file_data: string | null;
    }>();
    if (!row?.file_data) throw new Error("Файла нет");
    await requireChildAccess(row.child_id, user.id);
    return { name: row.file_name, type: row.file_type, data: row.file_data };
  });

/** Ответ ученика. Отправить может любой взрослый рядом с ним — обычно сам ребёнок из своего экрана. */
export const submitCustomAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      itemId: z.string(),
      // Ответом может быть одна фотография тетради: заставлять ещё и писать
      // текст, когда работа уже снята, незачем.
      answer: z.string().trim(),
      file: z
        .object({ name: z.string().min(1), type: z.string().min(1), data: z.string().min(1) })
        .nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const row = await db()
      .prepare(
        `SELECT a.child_id FROM assignment_items ai
           JOIN assignments a ON a.id = ai.assignment_id
          WHERE ai.id = ? AND ai.kind = 'custom'`,
      )
      .bind(data.itemId)
      .first<{ child_id: string }>();
    if (!row) throw new Error("Задание не найдено");
    await requireChildAccess(row.child_id, user.id);

    if (!data.answer && !data.file) throw new Error("Напиши ответ или приложи фотографию");
    if (data.file) {
      // Фото тетради — самое чувствительное в профиле. Пока родитель не
      // принял приглашение, у ученика, заведённого репетитором, хранится
      // только минимум под заверение п. 9.5 оферты; согласия законного
      // представителя на фотографии ещё нет — вложения не принимаются.
      const parent = await db()
        .prepare("SELECT 1 AS ok FROM child_access WHERE child_id = ? AND role = 'parent' LIMIT 1")
        .bind(row.child_id)
        .first<{ ok: number }>();
      if (!parent) {
        throw new Error(
          "Фотографию можно приложить после того, как родитель примет приглашение. Пока ответь словами",
        );
      }
      const bytes = Math.floor((data.file.data.length * 3) / 4);
      if (bytes > MAX_FILE_BYTES) throw new Error("Файл больше 1,5 МБ — приложи файл поменьше");
    }

    const now = nowIso();
    await db()
      .prepare(
        `INSERT INTO custom_submissions (item_id, child_id, answer, submitted_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (item_id) DO UPDATE SET answer = ?, submitted_at = ?, grade = NULL, comment = NULL, graded_at = NULL`,
      )
      .bind(data.itemId, row.child_id, data.answer, now, data.answer, now)
      .run();

    // Новая отправка заменяет прежнее вложение целиком: история черновиков
    // не нужна ни ребёнку, ни педагогу, а место в базе занимает.
    if (data.file) {
      await db()
        .prepare(
          `INSERT INTO custom_answer_files (item_id, child_id, file_name, file_type, file_data, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (item_id) DO UPDATE SET file_name = ?, file_type = ?, file_data = ?, uploaded_at = ?`,
        )
        .bind(
          data.itemId,
          row.child_id,
          data.file.name,
          data.file.type,
          data.file.data,
          now,
          data.file.name,
          data.file.type,
          data.file.data,
          now,
        )
        .run();
    }
    return { ok: true };
  });

/**
 * Убрать отправленный ответ вместе с вложением.
 *
 * Удаление настоящее, а не отметка «скрыто»: в ответе может оказаться
 * фотография, а фотография — персональные данные, и «мы его больше не
 * показываем» здесь не ответ. Оценка уходит вместе с ответом: она
 * поставлена за работу, которой больше нет.
 *
 * Право то же, что и на отправку: ребёнок и взрослые рядом с ним. Педагог
 * чужой ответ не удаляет — он может снять само задание.
 */
export const deleteCustomAnswer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ itemId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const row = await db()
      .prepare(
        `SELECT a.child_id FROM assignment_items ai
           JOIN assignments a ON a.id = ai.assignment_id
          WHERE ai.id = ? AND ai.kind = 'custom'`,
      )
      .bind(data.itemId)
      .first<{ child_id: string }>();
    if (!row) throw new Error("Задание не найдено");
    await requireChildAccess(row.child_id, user.id);

    await db().batch([
      db().prepare("DELETE FROM custom_answer_files WHERE item_id = ?").bind(data.itemId),
      db().prepare("DELETE FROM custom_submissions WHERE item_id = ?").bind(data.itemId),
    ]);
    return { ok: true };
  });

export const gradeCustomAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      itemId: z.string(),
      grade: z.number().int().min(2).max(5),
      comment: z.string().trim().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const row = await db()
      .prepare(
        `SELECT a.child_id FROM assignment_items ai
           JOIN assignments a ON a.id = ai.assignment_id
          WHERE ai.id = ? AND ai.kind = 'custom'`,
      )
      .bind(data.itemId)
      .first<{ child_id: string }>();
    if (!row) throw new Error("Задание не найдено");
    await requireStudent(row.child_id, user.id);

    await db()
      .prepare(
        `INSERT INTO custom_submissions (item_id, child_id, grade, comment, graded_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (item_id) DO UPDATE SET grade = ?, comment = ?, graded_at = ?`,
      )
      .bind(
        data.itemId,
        row.child_id,
        data.grade,
        data.comment,
        nowIso(),
        data.grade,
        data.comment,
        nowIso(),
      )
      .run();
    await track("custom_graded", {
      userId: user.id,
      childId: row.child_id,
      props: { grade: data.grade },
    });
    return { ok: true };
  });

/* ------------------------------------------------ подписка репетитора

   Раньше «Подписка» в кабинете вела в /roditel, а тот закрыт кодом
   родителя — репетитору предлагали придумать код от чужого кабинета,
   которым он никогда не пользуется. Подписка репетитора живёт отдельно
   и никакими кодами не закрывается: это его собственные деньги. */

export const tutorSubscription = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireTutor();
  const students = await db()
    .prepare("SELECT COUNT(*) AS n FROM child_access WHERE user_id = ? AND role = 'tutor'")
    .bind(user.id)
    .first<{ n: number }>();
  const sub = await db()
    .prepare(
      `SELECT plan, status, start_date, end_date FROM subscriptions
        WHERE user_id = ? AND status = 'active' ORDER BY start_date DESC LIMIT 1`,
    )
    .bind(user.id)
    .first<{ plan: string; status: string; start_date: string; end_date: string | null }>();

  return {
    active: user.subscriptionStatus === "active",
    students: Number(students?.n ?? 0),
    until: sub?.end_date ?? null,
    plan: sub?.plan ?? null,
  };
});

export const tutorRedeemPromo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().trim().min(3) }))
  .handler(async ({ data }) => {
    const user = await requireTutor();
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
      db()
        .prepare("UPDATE promo_codes SET used_by = ?, used_at = ? WHERE code = ?")
        .bind(user.id, nowIso(), code),
      db()
        .prepare(
          `INSERT INTO subscriptions (id, user_id, plan, status, start_date, end_date)
           VALUES (?, ?, ?, 'active', ?, ?)`,
        )
        .bind(uid("sub"), user.id, `promo_${promo.months}m`, nowIso(), end),
    ]);
    await track("subscription_activated", { userId: user.id, props: { code, role: "tutor" } });
    return { until: end };
  });

export const tutorCancelSubscription = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireTutor();
  await db().batch([
    db().prepare("UPDATE users SET subscription_status = 'free' WHERE id = ?").bind(user.id),
    db()
      .prepare(
        "UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'",
      )
      .bind(user.id),
  ]);
  return { ok: true };
});

/** Выдать тренажёр сразу нескольким ученикам — как и тему. */
export const assignDrill = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      kind: z.enum(["schet", "tablica", "pravopisanie", "chtenie", "shulte"]),
      childIds: z.array(z.string()).min(1, "Выберите хотя бы одного ученика"),
      dueAt: z.string().nullable(),
      settings: z.record(z.string(), z.string()).nullable().default(null),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireTutor();
    const title = DRILL_TITLES[data.kind] ?? "Устный счёт";
    const settings =
      data.settings && Object.keys(data.settings).length ? JSON.stringify(data.settings) : null;

    for (const childId of data.childIds) {
      await requireStudent(childId, user.id);
      const id = uid("asg");
      const itemId = uid("ai");
      await db().batch([
        db()
          .prepare(
            `INSERT INTO assignments (id, child_id, tutor_id, title, comment, due_at, created_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          )
          .bind(id, childId, user.id, title, data.dueAt, nowIso()),
        db()
          .prepare(
            `INSERT INTO assignment_items (id, assignment_id, kind, ref_id, target_percent, sort_order)
             VALUES (?, ?, 'drill', ?, 0, 0)`,
          )
          .bind(itemId, id, data.kind),
        ...(settings
          ? [
              db()
                .prepare("INSERT INTO assignment_item_settings (item_id, settings) VALUES (?, ?)")
                .bind(itemId, settings),
            ]
          : []),
      ]);
    }
    await track("drill_assigned", {
      userId: user.id,
      props: { kind: data.kind, students: data.childIds.length },
    });
    return { count: data.childIds.length };
  });
