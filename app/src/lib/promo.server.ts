/**
 * Акция «SOVENOK50» со стороны базы: кому показать баннер, действует ли
 * код, когда его погасить.
 *
 * Правила в одном месте, потому что к ним ведут три дороги — баннер в
 * кабинете, поле в форме оплаты и вебхук банка, — и все три должны
 * отвечать одинаково на вопрос «а этому человеку ещё можно?».
 *
 * Строка предложения заводится при первом показе баннера, и от этого
 * момента считается срок. Не от запуска акции: тот, кто зайдёт в кабинет
 * через неделю, тоже должен увидеть «только сегодня» и получить свой день,
 * а не обнаружить, что всё кончилось, пока его не было.
 */

import { db, nowIso, track, type SessionUser } from "./core.server";
import {
  PROMO_CODE,
  PROMO_PERCENT,
  PROMO_SIGNUP_BEFORE,
  discountedAmount,
  normalizePromo,
} from "./promo";

export type PromoOffer = {
  code: string;
  percent: number;
  /** ISO: до какого момента действует. */
  until: string;
};

type OfferRow = {
  user_id: string;
  code: string;
  shown_at: string;
  expires_at: string;
  dismissed_at: string | null;
  used_at: string | null;
};

/**
 * Часовой пояс акции — московский. Человек читает «только сегодня» в своём
 * дне, а не в UTC, где сутки заканчиваются в три часа ночи по Москве.
 * Аудитория — Россия; тонкая настройка под другие пояса не стоит своих
 * строк.
 */
const MSK_OFFSET_MS = 3 * 3600e3;

function endOfMoscowDay(at: Date): Date {
  const local = new Date(at.getTime() + MSK_OFFSET_MS);
  const nextMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  );
  return new Date(nextMidnight - MSK_OFFSET_MS);
}

/** Платящая роль, зарегистрированная до запуска акции. */
async function eligible(user: SessionUser): Promise<boolean> {
  if (user.role !== "parent" && user.role !== "tutor" && user.role !== "admin") return false;
  const row = await db()
    .prepare("SELECT created_at FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ created_at: string }>();
  return !!row && row.created_at < PROMO_SIGNUP_BEFORE;
}

async function offerRow(userId: string): Promise<OfferRow | null> {
  return await db()
    .prepare(
      `SELECT user_id, code, shown_at, expires_at, dismissed_at, used_at
         FROM promo_offers WHERE user_id = ?`,
    )
    .bind(userId)
    .first<OfferRow>();
}

/**
 * Предложение для этого человека: существующее или только что заведённое.
 * null — акция его не касается.
 *
 * Заводится не только баннером, но и формой оплаты: на страницу подписки
 * можно прийти из шапки, минуя кабинет, и набрать код, услышав его от
 * коллеги. Срок при этом всё равно начинается с первого касания.
 */
async function ensureOffer(user: SessionUser): Promise<OfferRow | null> {
  const existing = await offerRow(user.id);
  if (existing) return existing;
  if (!(await eligible(user))) return null;

  const now = new Date();
  const row: OfferRow = {
    user_id: user.id,
    code: PROMO_CODE,
    shown_at: now.toISOString(),
    expires_at: endOfMoscowDay(now).toISOString(),
    dismissed_at: null,
    used_at: null,
  };
  // Два параллельных запроса из двух вкладок заведут строку дважды —
  // побеждает первая, вторая перечитывает её срок.
  await db()
    .prepare(
      `INSERT INTO promo_offers (user_id, code, shown_at, expires_at)
       VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    )
    .bind(row.user_id, row.code, row.shown_at, row.expires_at)
    .run();
  await track("promo_offer_shown", { userId: user.id, props: { code: PROMO_CODE } });
  return (await offerRow(user.id)) ?? row;
}

function isLive(row: OfferRow): boolean {
  return !row.used_at && new Date(row.expires_at).getTime() > Date.now();
}

/**
 * Что показать в кабинете. null — баннера нет: не та роль, зарегистрирован
 * после запуска, закрыл крестиком, уже воспользовался или день кончился.
 */
export async function promoBannerFor(user: SessionUser): Promise<PromoOffer | null> {
  const row = await ensureOffer(user);
  if (!row || row.dismissed_at || !isLive(row)) return null;
  return { code: row.code, percent: PROMO_PERCENT, until: row.expires_at };
}

/**
 * Крестик прячет баннер навсегда, но код продолжает действовать до конца
 * дня: закрыть плашку и передумать через час — нормальное поведение, и
 * наказывать за него нечем.
 */
export async function dismissPromoOffer(userId: string): Promise<void> {
  await db()
    .prepare("UPDATE promo_offers SET dismissed_at = ? WHERE user_id = ? AND dismissed_at IS NULL")
    .bind(nowIso(), userId)
    .run();
  await track("promo_offer_dismissed", { userId, props: { code: PROMO_CODE } });
}

/**
 * Проверка введённого кода. Бросает ошибку с текстом для человека.
 *
 * Чужому — «такого промокода нет», а не «вы зарегистрированы слишком
 * поздно»: второе звучит как приглашение завести вторую учётную запись
 * задним числом, а первое ничего не обещает.
 */
export async function verifyPromo(user: SessionUser, code: string): Promise<PromoOffer> {
  if (normalizePromo(code) !== PROMO_CODE) throw new Error("Такого промокода нет");
  const row = await ensureOffer(user);
  if (!row) throw new Error("Такого промокода нет");
  if (row.used_at) throw new Error("Промокод уже использован — он действует один раз");
  if (!isLive(row)) {
    throw new Error("Срок промокода истёк: он действовал только в день, когда вы его увидели");
  }
  return { code: row.code, percent: PROMO_PERCENT, until: row.expires_at };
}

/** Сколько заплатить с этим кодом и сколько сэкономлено. */
export async function promoDiscount(
  user: SessionUser,
  code: string,
  fullAmount: number,
): Promise<{ code: string; amount: number; discount: number }> {
  const offer = await verifyPromo(user, code);
  const amount = discountedAmount(fullAmount);
  return { code: offer.code, amount, discount: fullAmount - amount };
}

/** Счёт выставлен со скидкой — запоминаем, чтобы вебхук погасил предложение. */
export async function recordPaymentPromo(input: {
  paymentId: string;
  userId: string;
  code: string;
  fullAmount: number;
  discount: number;
}): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO payment_promo (payment_id, user_id, code, full_amount, discount, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.paymentId, input.userId, input.code, input.fullAmount, input.discount, nowIso())
    .run();
}

/**
 * Деньги за льготный счёт пришли — предложение погашено. Возвращает код,
 * если счёт был со скидкой: applyPaidPayment кладёт его в событие.
 *
 * Гасится независимо от того, какой из начатых счётов оплачен: два
 * брошенных и один оплаченный — обычная история с картами, и все они
 * висят на одном предложении.
 */
export async function settlePaymentPromo(paymentId: string): Promise<string | null> {
  const row = await db()
    .prepare("SELECT user_id, code FROM payment_promo WHERE payment_id = ?")
    .bind(paymentId)
    .first<{ user_id: string; code: string }>();
  if (!row) return null;
  await db()
    .prepare(
      `UPDATE promo_offers SET used_at = ?, payment_id = ?
        WHERE user_id = ? AND used_at IS NULL`,
    )
    .bind(nowIso(), paymentId, row.user_id)
    .run();
  return row.code;
}
