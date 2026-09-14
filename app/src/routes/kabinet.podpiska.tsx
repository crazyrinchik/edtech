import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { FormAction, SiteFooter } from "../components/brand";
import {
  CabinetHeader,
  CabinetLoading,
  needsPin,
  PinGate,
  useCabinetAccount,
} from "../components/cabinet-parts";
import { PayForm } from "../components/pay-form";
import { cancelSubscription, lockParentCabinet, redeemPromo } from "../lib/api/app.functions";
import { closedHead } from "../lib/seo";

/**
 * Подписка семьи.
 *
 * Была вкладкой в кабинете, до которой надо было догадаться дойти: ребёнок
 * упирался в замок с надписью «покажи взрослому», а взрослый в кабинете не
 * видел ни слова о том, что замок снимается деньгами. Теперь это адрес, на
 * который ведут и плашка, и шапка, и баннер акции.
 *
 * Что именно продаётся, написано здесь же и теми же словами, что в плашке
 * на экране ребёнка: тренажёры открыты всем, а подписка хранит результаты,
 * разрешает настраивать заход и открывает темы.
 *
 * У репетитора своя страница (/repetitor/podpiska): у него другие ручки —
 * подписка покрывает всех его учеников сразу.
 */
export const Route = createFileRoute("/kabinet/podpiska")({
  head: () => closedHead("Подписка, Совёнок"),
  // Код акции из адреса: сюда ведёт кнопка баннера. Ключ необязательный,
  // иначе роутер потребует search у каждой ссылки на подписку.
  validateSearch: (search: Record<string, unknown>): { promo?: string } =>
    typeof search.promo === "string" && search.promo ? { promo: search.promo } : {},
  component: BillingPage,
});

function BillingPage() {
  const { promo } = Route.useSearch();
  const { account, reload } = useCabinetAccount();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!account) return <CabinetLoading />;
  if (needsPin(account)) {
    return <PinGate creating={!account.parentPinSet} onDone={reload} />;
  }

  const active = account.user?.subscriptionStatus === "active";

  return (
    <div className="sov">
      <CabinetHeader
        account={account}
        onLock={async () => {
          await lockParentCabinet();
          await reload();
        }}
      />
      <main className="sov-shell" style={{ paddingBottom: 60, maxWidth: 560 }}>
        <h1 style={{ fontSize: "var(--sov-t-h1)", fontWeight: 700, marginTop: 16 }}>Подписка</h1>

        {notice ? (
          <div
            className="sov-alert"
            style={{ marginTop: 16, background: "#e6f4ea", color: "var(--sov-ok)" }}
          >
            {notice}
          </div>
        ) : null}

        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
          Сейчас:{" "}
          {active
            ? "подписка активна — результаты сохраняются, настройки и темы открыты"
            : "бесплатный доступ — все шесть тренажёров в базовой настройке"}
          .
        </p>

        {!active ? (
          <ul className="sov-list" style={{ marginTop: 16 }}>
            <li>Результаты и рекорды серий сохраняются и видны в кабинете</li>
            <li>Заход настраивается: разрядность, таймер, уровень, набор правил</li>
            <li>Темы с 1 по 4 класс целиком, а не первая в каждом предмете</li>
          </ul>
        ) : null}

        <PayForm onDone={reload} promo={promo} />

        {active ? (
          <button
            className="sov-act-ghost"
            style={{ marginTop: 28 }}
            onClick={async () => {
              await cancelSubscription();
              setNotice("Подписка отменена");
              await reload();
            }}
          >
            Отменить подписку
          </button>
        ) : (
          <form
            className="sov-form ym-hide-content ym-disable-keys"
            style={{ marginTop: 34 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const code = String(new FormData(e.currentTarget).get("code") ?? "");
              setPending(true);
              try {
                await redeemPromo({ data: { code } });
                setNotice("Подписка активирована");
                await reload();
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
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
