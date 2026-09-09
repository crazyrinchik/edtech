import { useEffect, useState } from "react";

import { FormAction } from "./brand";
import { PLANS, priceLabel, type PlanId } from "../lib/billing";
import { discountedAmount, normalizePromo } from "../lib/promo";
import { billingInfo, checkPromo, startPayment } from "../lib/api/billing.functions";

type Applied = Awaited<ReturnType<typeof checkPromo>>;

/**
 * Форма оплаты подписки. Одна на кабинет родителя и кабинет репетитора:
 * покупают они одно и то же, и второй экземпляр этой формы разошёлся бы с
 * первым на первой же правке цены.
 *
 * Кнопка не платит, а уводит на платёжную страницу T-Bank. Карту мы
 * не спрашиваем и не видим — так п. 5.3 оферты остаётся правдой, а PCI DSS
 * не касается нашего сервера.
 *
 * Пока ключи кассы не заданы, форма молчит: показывать кнопку «Оплатить»,
 * которая всегда отвечает ошибкой, хуже, чем не показывать ничего. В этом
 * случае наверху остаётся промокод — на пилоте он и был единственным путём.
 *
 * Промокод на скидку живёт здесь, а не в старом поле «Промокод» рядом:
 * то поле выдаёт подписку без денег, а этот код меняет сумму счёта, и
 * применять его нужно до нажатия «Оплатить». Код из баннера приходит
 * через promo и применяется сам; набранный руками проверяется кнопкой
 * «Применить». Сервер в любом случае проверит его ещё раз в момент счёта.
 */
export function PayForm({ onDone, promo }: { onDone?: () => void; promo?: string }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof billingInfo>> | null>(null);
  const [plan, setPlan] = useState<PlanId>("year");
  const [email, setEmail] = useState("");
  const [offer, setOffer] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [promoOpen, setPromoOpen] = useState(!!promo);
  const [promoCode, setPromoCode] = useState(promo ?? "");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);

  useEffect(() => {
    billingInfo()
      .then((data) => {
        setInfo(data);
        setEmail(data.email);
      })
      .catch(() => setInfo(null));
  }, []);

  // Код с баннера применяется без лишнего нажатия: человек уже прочёл его
  // и нажал «Оплатить со скидкой», просить набрать ещё раз незачем.
  useEffect(() => {
    if (!promo) return;
    setPromoOpen(true);
    setPromoCode(promo);
    void apply(promo);
  }, [promo]);

  async function apply(code: string) {
    setPromoPending(true);
    setPromoError(null);
    try {
      setApplied(await checkPromo({ data: { code: normalizePromo(code) } }));
    } catch (e) {
      setApplied(null);
      setPromoError(e instanceof Error ? e.message : "Промокод не подошёл");
    }
    setPromoPending(false);
  }

  if (!info?.ready) return null;

  const amountFor = (full: number) => (applied ? discountedAmount(full) : full);

  return (
    <form
      className="sov-form ym-hide-content ym-disable-keys"
      style={{ marginTop: 24 }}
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          const { url } = await startPayment({
            data: { plan, email, offerAccepted: offer, promo: applied?.code },
          });
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
              <span className="sov-tariff__price">
                {priceLabel(amountFor(option.amount))}
                {applied ? <s className="sov-tariff__was">{priceLabel(option.amount)}</s> : null}
              </span>
              {option.note ? <small>{option.note}</small> : null}
            </span>
          </label>
        ))}
      </div>

      {/* Ссылка вместо поля по умолчанию: у большинства кода нет, и пустое
          поле «Промокод» над почтой заставляло бы искать, где его взять. */}
      {!promoOpen ? (
        <p className="sov-promo-toggle">
          <button type="button" className="sov-link" onClick={() => setPromoOpen(true)}>
            Есть промокод на скидку?
          </button>
        </p>
      ) : applied ? (
        <div className="sov-save-hint sov-promo-applied" data-tone="ok">
          <strong>
            Промокод {applied.code} применён: −{applied.percent}%
          </strong>
          <span>
            Действует один раз и до конца дня по московскому времени.{" "}
            <button
              type="button"
              className="sov-link"
              onClick={() => {
                setApplied(null);
                setPromoCode("");
                setPromoOpen(false);
              }}
            >
              Убрать
            </button>
          </span>
        </div>
      ) : (
        <div className="sov-field sov-promo-field">
          <label htmlFor="pay-promo">Промокод на скидку</label>
          <div className="sov-promo-field__row">
            <input
              id="pay-promo"
              name="promo"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value)}
              onKeyDown={(event) => {
                // Enter в этом поле применяет код, а не отправляет всю
                // форму в кассу с неприменённой скидкой.
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (promoCode.trim()) void apply(promoCode);
                }
              }}
            />
            <button
              type="button"
              className="sov-act-ghost"
              disabled={promoPending || !promoCode.trim()}
              onClick={() => apply(promoCode)}
            >
              {promoPending ? "Проверяем…" : "Применить"}
            </button>
          </div>
          {promoError ? (
            <span className="sov-field__hint sov-promo-error">{promoError}</span>
          ) : null}
        </div>
      )}

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
        {pending ? "Открываем оплату…" : `Оплатить ${priceLabel(amountFor(currentAmount(plan)))}`}
      </FormAction>

      <p className="sov-field__hint">
        Оплата картой на защищённой странице T-Bank. Реквизиты карты «Совёнок» не получает и не
        хранит.
      </p>
    </form>
  );
}

function currentAmount(plan: PlanId): number {
  return PLANS.find((p) => p.id === plan)?.amount ?? 0;
}
