// Уничтожение персональных данных: физическая зачистка и её журнал.
//
// Здесь собрано всё, что 152-ФЗ требует делать с данными не «когда-нибудь»,
// а по событию и по календарю: снос профиля ребёнка одним заходом, журнал
// уничтожения по приказу Роскомнадзора от 28.10.2022 № 179 (тот самый
// «порядок, установленный нормативными правовыми актами» из п. 11.3
// политики), снятие профилей, к которым законный представитель так
// и не пришёл, и трёхлетние сроки следов удаления — записей самого журнала
// и строк deleted_accounts. Правило одно: физического DELETE детских или
// учётных данных без строки в журнале в кодовой базе быть не должно.

import { db, nowIso, track } from "./core.server";

/**
 * Что пишется в журнал уничтожения. Названия системы и категорий — статические
 * строки по п. 5 приказа: субъект у нас определяется идентификатором записи,
 * а все хранимые данные попадают в категорию «иные».
 */
const PD_SYSTEM_NAME = "Онлайн-сервис «Совёнок» (sovenok.space)";
const PD_CATEGORIES = "иные персональные данные";

/** Причина в журнале: человек сам попросил удалить профиль или учётную запись. */
export const DESTRUCTION_BY_REQUEST = "волеизъявление пользователя";

/** Причина в журнале: профиль ученика не подтверждён законным представителем. */
export const DESTRUCTION_UNCLAIMED =
  "согласие законного представителя не получено в течение 10 дней после создания профиля";

/** Причина в журнале: у следа согласий из deleted_accounts вышел трёхлетний срок. */
const DESTRUCTION_TRACE_EXPIRED =
  "истечение срока хранения сведений о согласиях (3 года после прекращения обработки)";

/**
 * Сколько лет живёт информация об удалениях. Оба срока — три года, но
 * основания разные, поэтому константы две: след согласий в deleted_accounts —
 * строка 7 таблицы раздела 3 политики («3 года после прекращения обработки»),
 * сам журнал уничтожения — п. 6 приказа № 179 (подтверждающие документы
 * хранятся три года со дня уничтожения).
 */
const CONSENT_TRACE_YEARS = 3;
const DESTRUCTION_LOG_YEARS = 3;

/** Момент ровно N лет назад — календарных, а не 365-дневных. */
function yearsAgoIso(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString();
}

/**
 * Сколько дней профиль ученика, заведённый репетитором, ждёт родителя.
 * Не дождался — считается несостоявшимся: не активируется и уничтожается.
 */
export const UNCLAIMED_DAYS = 10;

/**
 * С какого момента правило действует. Профили, заведённые раньше, получают
 * свои десять дней от этой даты, а не от создания: они появились, когда
 * никакого срока не обещали, и сносить их выкладкой задним числом — без
 * предупреждения, которое кабинет показывает с той же выкладки, — нельзя.
 *
 * Дата названа в пункте 9.8 оферты дословно, и разъезжаться им нельзя:
 * сдвинете здесь — правьте и там, иначе сервис начнёт уничтожать данные
 * раньше, чем обещал договор.
 */
export const UNCLAIMED_RULE_SINCE = "2026-08-28T00:00:00.000Z";

/** Когда неподтверждённый профиль будет (или был бы) уничтожен. */
export function unclaimedDeadlineIso(createdAt: string): string {
  const base = createdAt > UNCLAIMED_RULE_SINCE ? createdAt : UNCLAIMED_RULE_SINCE;
  return new Date(new Date(base).getTime() + UNCLAIMED_DAYS * 864e5).toISOString();
}

/** Просрочен ли профиль без родителя, с учётом льготного срока старых записей. */
export function unclaimedExpired(createdAt: string): boolean {
  return unclaimedDeadlineIso(createdAt) < nowIso();
}

/**
 * Строка журнала уничтожения — для вклейки в тот же batch, что и DELETE.
 *
 * ON CONFLICT DO NOTHING, а не ошибка: повторный заход (двойной клик по
 * кнопке удаления, гонка двух запросов) не должен ни падать, ни дублировать
 * уже записанный факт. Ключ — (субъект, причина), поэтому у одного человека
 * могут быть два разных события, но не два одинаковых.
 */
export function pdDestructionStatement(subjectId: string, reason: string) {
  return db()
    .prepare(
      `INSERT INTO pd_destruction_log (subject_id, categories, system_name, reason, destroyed_at)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT (subject_id, reason) DO NOTHING`,
    )
    .bind(subjectId, PD_CATEGORIES, PD_SYSTEM_NAME, reason, nowIso());
}

/**
 * Все следы ребёнка одним заходом. Порядок важен: настройки пунктов домашки
 * и сами пункты уходят раньше assignments, на которые смотрят их подзапросы,
 * — batch выполняется последовательно в одной транзакции.
 *
 * Удаление физическое, а не флагом: колонку deleted_at не добавить
 * (миграции идемпотентные, ADD COLUMN IF NOT EXISTS в SQLite нет), а фильтр
 * по отдельной таблице пришлось бы не забыть в каждом из десятка запросов
 * по child_id. Страховка от ошибочного удаления — ночные дампы
 * (deploy/backup-db.sh); политика (строки 1–2 таблицы раздела 3) обещает
 * «в составе резервных копий не более 10 дней», KEEP в скрипте обязан
 * укладываться в этот срок. events не трогаются — это технический
 * журнал со своим сроком хранения.
 *
 * Запись в журнал уничтожения идёт тем же batch: ребёнок — субъект
 * персональных данных (имя — уже они), и без строки в журнале его следы
 * не стираются. Причину называет вызывающий: кнопка в кабинете — это
 * волеизъявление, снос неподтверждённого профиля — истёкший срок.
 */
export async function purgeChildData(childId: string, reason: string): Promise<void> {
  const D = db();
  await D.batch([
    pdDestructionStatement(childId, reason),
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
    D.prepare("DELETE FROM tutor_notes WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM child_access WHERE child_id = ?").bind(childId),
    D.prepare("DELETE FROM children WHERE id = ?").bind(childId),
  ]);
}

/**
 * Профили, к которым родитель не пришёл за UNCLAIMED_DAYS, снимаются пачкой.
 *
 * «Родитель пришёл» — это строка child_access с ролью parent: она появляется
 * либо сразу (родитель завёл ребёнка сам), либо при принятии приглашения.
 * Профиль без неё живёт только заверением репетитора (п. 9.5 оферты), и у
 * этого заверения теперь есть срок годности.
 *
 * Своего cron у развёртывания нет (workerd под miniflare), поэтому зачистку
 * заводит первый запрос после истечения паузы — см. sweepIfDue().
 */
async function sweepUnclaimedProfiles(): Promise<void> {
  // Пока льготный срок старых профилей не вышел, снимать нечего: всё, что
  // моложе правила, тем более не просрочено. Один общий выход вместо
  // GREATEST/MAX в запросе, которые SQLite и PostgreSQL пишут по-разному.
  if (nowIso() < unclaimedDeadlineIso(UNCLAIMED_RULE_SINCE)) return;
  const stale = await db()
    .prepare(
      `SELECT id FROM children c
        WHERE c.created_at < ?
          AND NOT EXISTS (SELECT 1 FROM child_access p
                           WHERE p.child_id = c.id AND p.role = 'parent')`,
    )
    .bind(new Date(Date.now() - UNCLAIMED_DAYS * 864e5).toISOString())
    .all<{ id: string }>();
  for (const row of stale.results ?? []) {
    await purgeChildData(row.id, DESTRUCTION_UNCLAIMED);
    await track("child_unclaimed_purged", { childId: row.id });
  }
}

/**
 * Следы удалений, у которых вышли три года.
 *
 * deleted_accounts: перед DELETE каждый истёкший след получает свою строку в
 * журнале — в нём лежит почта, то есть настоящие персональные данные, и его
 * уничтожение фиксируется как любое другое. Вставка и удаление одним batch.
 *
 * Сам журнал чистится без записи о записи: строка журнала — не данные
 * субъекта, а подтверждающий документ, у которого п. 6 приказа № 179 свой
 * срок; фиксировать уничтожение фиксации значило бы не закончить никогда.
 * Свежая строка «остатки уничтожены» при этом переживёт вычищенную старую
 * на свои три года — обрыва в истории не остаётся.
 */
async function sweepExpiredTraces(): Promise<void> {
  const D = db();
  const consentCutoff = yearsAgoIso(CONSENT_TRACE_YEARS);
  const expired = await D.prepare("SELECT user_id FROM deleted_accounts WHERE deleted_at < ?")
    .bind(consentCutoff)
    .all<{ user_id: string }>();
  const rows = expired.results ?? [];
  if (rows.length) {
    await D.batch([
      ...rows.map((r) => pdDestructionStatement(r.user_id, DESTRUCTION_TRACE_EXPIRED)),
      D.prepare("DELETE FROM deleted_accounts WHERE deleted_at < ?").bind(consentCutoff),
    ]);
  }
  await D.prepare("DELETE FROM pd_destruction_log WHERE destroyed_at < ?")
    .bind(yearsAgoIso(DESTRUCTION_LOG_YEARS))
    .run();
}

const SWEEP_EVERY_MS = 6 * 3_600_000;
const SWEEP_RETRY_MS = 30 * 60_000;
let nextSweepAt = 0;

/**
 * Обёртка для вызова из fetch-обработчика: почти всегда — сравнение двух
 * чисел и выход. Настоящая зачистка идёт раз в шесть часов, после сбоя
 * (база ещё поднимается, шлюз недоступен) — повтор через полчаса, чтобы
 * неудачный первый запрос после выкладки не откладывал её до вечера.
 * Ошибка глотается: просроченный профиль не повод не отдать страницу.
 */
export async function sweepIfDue(): Promise<void> {
  if (Date.now() < nextSweepAt) return;
  nextSweepAt = Date.now() + SWEEP_EVERY_MS;
  try {
    await sweepUnclaimedProfiles();
    await sweepExpiredTraces();
  } catch (error) {
    nextSweepAt = Date.now() + SWEEP_RETRY_MS;
    console.error(error);
  }
}
