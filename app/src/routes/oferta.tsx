import { createFileRoute } from "@tanstack/react-router";

import source from "../../../docs/legal/oferta.md?raw";
import { SiteFooter, SiteHeader } from "../components/brand";
import { LegalDoc } from "../components/legal-doc";

/**
 * Публичная оферта по постоянному адресу — на неё ссылается форма оплаты, и
 * без неё акцепт по разделу 3 не к чему привязать.
 *
 * Пока в исходнике остались поля `[[ЗАПОЛНИТЬ: …]]` (ФИО, ОГРНИП, ИНН,
 * реквизиты счёта), страница показывает заглушку, а не текст. Черновик
 * договора, выложенный по постоянному адресу, — это уже оферта: пункт 2
 * статьи 437 ГК не спрашивает, дописал ли автор реквизиты. Показывать его
 * с дырками нельзя, и «почти готово» тут не бывает.
 *
 * Заполненный документ появляется на странице сам, без правок кода.
 */
export const Route = createFileRoute("/oferta")({
  head: () => ({ meta: [{ title: "Публичная оферта, Совёнок" }] }),
  component: OfferPage,
});

/** Черновик виден по незаполненным полям вида `[[ЗАПОЛНИТЬ: …]]`. */
const draft = source.includes("[[");

function OfferPage() {
  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-narrow sov-legal" style={{ paddingBottom: 70 }}>
        {draft ? (
          <>
            <h1>Публичная оферта</h1>
            <p>
              Документ готовится к публикации. Пока он не опубликован, подписка оформляется только
              по промокоду, а оплата картой не принимается.
            </p>
          </>
        ) : (
          <LegalDoc source={source} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
