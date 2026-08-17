import { useEffect, useState } from "react";

import { FormAction } from "./brand";
import { PLANS, priceLabel, type PlanId } from "../lib/billing";
import { billingInfo, startPayment } from "../lib/api/billing.functions";

/**
 * Форма оплаты подписки. Одна на кабинет родителя и кабинет репетитора:
 * покупают они одно и то же, и второй экземпляр этой формы разошёлся бы с
 * первым на первой же правке цены.
 *
 * Кнопка не платит, а уводит на платёжную страницу CloudPayments. Карту мы
 * не спрашиваем и не видим — так п. 5.3 оферты остаётся правдой, а PCI DSS
 * не касается нашего сервера.
 *
 * Пока ключи кассы не заданы, форма молчит: показывать кнопку «Оплатить»,
 * которая всегда отвечает ошибкой, хуже, чем не показывать ничего. В этом
 * случае наверху остаётся промокод — на пилоте он и был единственным путём.
 */
export function PayForm({ onDone }: { onDone?: () => void }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof billingInfo>> | null>(null);
  const [plan, setPlan] = useState<PlanId>("year");
  const [email, setEmail] = useState("");
  const [offer, setOffer] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingInfo()
      .then((data) => {
        setInfo(data);
        setEmail(data.email);
      })
      .catch(() => setInfo(null));
  }, []);

  if (!info?.ready) return null;

  return (
    <form
      className="sov-form"
      style={{ marginTop: 24 }}
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          const { url } = await startPayment({ data: { plan, email, offerAccepted: offer } });
          onDone?.();
          // Переход, а не открытие вкладки: возврат из кассы должен попасть
          // в ту же вкладку, где человек начинал, иначе он вернётся на
          // страницу «спасибо» рядом с кабинетом, который ничего не знает.
          window.location.href = url;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не удалось перейти к оплате");
          setPending(false);
        }
      }}
    >
      <div className="sov-tariffs" role="radiogroup" aria-label="Срок подписки">
        {PLANS.map((option) => (
          <label
            key={option.id}
            className={`sov-tariff${plan === option.id ? " sov-tariff--on" : ""}`}
          >
            <input
              type="radio"
              name="plan"
              value={option.id}
              checked={plan === option.id}
              onChange={() => setPlan(option.id)}
            />
            <span className="sov-tariff__body">
              <b>{option.title}</b>
              <span className="sov-tariff__price">{priceLabel(option.amount)}</span>
              {option.note ? <small>{option.note}</small> : null}
            </span>
          </label>
        ))}
      </div>

      <div className="sov-field">
        <label htmlFor="pay-email">Почта для чека</label>
        <input
          id="pay-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <span className="sov-field__hint">
          Кассовый чек придёт на этот адрес — так требует 54-ФЗ. По умолчанию стоит почта аккаунта.
        </span>
      </div>

      {/* Согласие — отдельной галочкой и без предустановленной отметки:
          акцепт оферты по п. 3 должен быть действием человека, а не
          состоянием формы по умолчанию. */}
      <label className="sov-check">
        <input
          type="checkbox"
          checked={offer}
          onChange={(event) => setOffer(event.target.checked)}
          required
        />
        <span>
          Я принимаю условия{" "}
          <a href="/oferta" target="_blank" rel="noreferrer">
            публичной оферты
          </a>{" "}
          и согласен на разовое списание. Подписка не продлевается сама.
        </span>
      </label>

      {error ? <div className="sov-alert">{error}</div> : null}

      <FormAction pending={pending}>
        {pending ? "Открываем оплату…" : `Оплатить ${priceLabel(currentAmount(plan))}`}
      </FormAction>

      <p className="sov-field__hint">
        Оплата картой на защищённой странице CloudPayments. Реквизиты карты «Совёнок» не получает и
        не хранит.
      </p>
    </form>
  );
}

function currentAmount(plan: PlanId): number {
  return PLANS.find((p) => p.id === plan)?.amount ?? 0;
}
