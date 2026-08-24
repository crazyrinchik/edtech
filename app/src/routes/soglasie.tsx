import { createFileRoute } from "@tanstack/react-router";

import source from "../../../docs/legal/soglasie-pdn.md?raw";
import { SiteFooter, SiteHeader } from "../components/brand";
import { LegalDoc } from "../components/legal-doc";
import { closedHead, pageHead } from "../lib/seo";

/**
 * Условия согласия на обработку персональных данных — текст, на который
 * ссылаются галочки в регистрации и приглашении. Согласие должно быть
 * информированным (ч. 1 ст. 9 152-ФЗ): галочка без доступного полного
 * текста этому требованию не отвечает.
 *
 * Правило публикации то же, что у оферты: пока в исходнике остались поля
 * `[[ЗАПОЛНИТЬ: …]]`, страница показывает заглушку.
 */
export const Route = createFileRoute("/soglasie")({
  // Заглушка вместо текста — не то, что стоит показывать в выдаче:
  // черновик документа осел бы в индексе и всплывал бы по запросам
  // ещё долго после того, как реквизиты допишут.
  head: () =>
    draft
      ? closedHead("Согласие на обработку персональных данных, Совёнок")
      : pageHead("/soglasie"),
  component: ConsentPage,
});

/** Черновик виден по незаполненным полям вида `[[ЗАПОЛНИТЬ: …]]`. */
const draft = source.includes("[[");

function ConsentPage() {
  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-narrow sov-legal" style={{ paddingBottom: 70 }}>
        {draft ? (
          <>
            <h1>Согласие на обработку персональных данных</h1>
            <p>
              Документ готовится к публикации и появится по этому адресу. Состав обрабатываемых
              данных перечислен в формах, где проставляется согласие.
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
