import { useEffect, useState } from "react";

import { PLANS, priceLabel } from "../lib/billing";
import { discountedAmount } from "../lib/promo";
import { dismissPromo, promoOffer } from "../lib/api/billing.functions";

type Offer = NonNullable<Awaited<ReturnType<typeof promoOffer>>>;

/**
 * Баннер акции «SOVENOK50» в кабинете. Один на родителя и репетитора:
 * предложение у них одно, и различается только то, куда ведёт кнопка.
 *
 * Сервер решает, показывать ли: ему видны дата регистрации, срок и
 * крестик. Здесь только рисуем и прячем. Пока ответа нет, места под
 * баннер не бронируем — большинству он не положен, и пустой прямоугольник
 * на секунду у каждого хуже, чем сдвиг экрана у немногих.
 *
 * Крестик прячет насовсем (dismissPromoOffer), но код продолжает работать
 * в форме оплаты до конца дня — об этом сказано прямо на баннере, чтобы
 * закрывший его в спешке не решил, что всё потерял.
 */
export function PromoBanner({ onPay }: { onPay: (code: string) => void }) {
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    promoOffer()
      .then((data) => setOffer(data))
      .catch(() => setOffer(null));
  }, []);

  if (!offer) return null;

  return (
    <aside className="sov-promo" aria-label="Специальное предложение">
      <button
        type="button"
        className="sov-promo__close"
        aria-label="Скрыть предложение"
        onClick={() => {
          setOffer(null);
          void dismissPromo().catch(() => undefined);
        }}
      >
        ×
      </button>
      <span className="sov-promo__eyebrow">Только сегодня · цена для вас</span>
      <strong className="sov-promo__title">Подписка за полцены</strong>
      <p className="sov-promo__text">
        Промокод <span className="sov-promo__code">{offer.code}</span> даёт скидку {offer.percent}%
        на месяц или на год:{" "}
        {PLANS.map((plan, i) => (
          <span key={plan.id} className="sov-promo__price">
            {i > 0 ? " или " : ""}
            <b>{priceLabel(discountedAmount(plan.amount))}</b> <s>{priceLabel(plan.amount)}</s>
          </span>
        ))}
        . Действует один раз и до конца дня, даже если закрыть эту плашку.
      </p>
      <div className="sov-promo__act">
        <button type="button" className="sov-act-child" onClick={() => onPay(offer.code)}>
          Оплатить со скидкой
        </button>
      </div>
    </aside>
  );
}
