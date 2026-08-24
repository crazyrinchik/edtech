import { createFileRoute } from "@tanstack/react-router";

import source from "../../../docs/legal/politika.md?raw";
import { SiteFooter, SiteHeader } from "../components/brand";
import { LegalDoc } from "../components/legal-doc";
import { closedHead, pageHead } from "../lib/seo";

/**
 * Политика обработки персональных данных по постоянному адресу. Открытый
 * доступ без регистрации — требование ч. 2 ст. 18.1 152-ФЗ; на этот адрес
 * ссылаются галочки согласий, подвал и оферта.
 *
 * Правило публикации то же, что у оферты: пока в исходнике остались поля
 * `[[ЗАПОЛНИТЬ: …]]`, страница показывает заглушку. Заполненный документ
 * появляется сам, без правок кода.
 */
export const Route = createFileRoute("/politika")({
  // Заглушка вместо текста — не то, что стоит показывать в выдаче:
  // черновик документа осел бы в индексе и всплывал бы по запросам
  // ещё долго после того, как реквизиты допишут.
  head: () => (draft ? closedHead("Политика персональных данных, Совёнок") : pageHead("/politika")),
  component: PolicyPage,
});

/** Черновик виден по незаполненным полям вида `[[ЗАПОЛНИТЬ: …]]`. */
const draft = source.includes("[[");

function PolicyPage() {
  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-narrow sov-legal" style={{ paddingBottom: 70 }}>
        {draft ? (
          <>
            <h1>Политика обработки персональных данных</h1>
            <p>
              Документ готовится к публикации и появится по этому адресу. До публикации данные
              обрабатываются в минимальном объёме, необходимом для работы Сервиса.
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
