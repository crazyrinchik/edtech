import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FormAction, Owl, QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { checkPinResetToken, resetParentPin } from "../lib/api/app.functions";
import { closedHead } from "../lib/seo";

export const Route = createFileRoute("/novyy-kod")({
  head: () => closedHead("Новый код родителя, Совёнок"),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : "",
  }),
  component: NewPinPage,
});

/**
 * Новый код родителя по ссылке из письма.
 *
 * Годность ссылки проверяется до показа формы — по той же причине, что и на
 * странице нового пароля: узнать о просрочке, уже придумав код, обидно.
 *
 * Повтор кода здесь спрашиваем, в отличие от пароля. У пароля есть глазок,
 * которым видно набранное, а четыре цифры вводятся вслепую и промах в них
 * ничем себя не выдаёт: кабинет откроется сразу — мы сами его и откроем, —
 * а запрётся человек в следующий раз, когда письма под рукой уже не будет.
 */
function NewPinPage() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | "dead" | "done">("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!t) {
        setState("dead");
        return;
      }
      try {
        const res = await checkPinResetToken({ data: { token: t } });
        if (alive) setState(res.valid ? "ok" : "dead");
      } catch {
        if (alive) setState("dead");
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (pin !== repeat) {
      setError("Коды не совпали");
      return;
    }
    setPending(true);
    try {
      await resetParentPin({ data: { token: t, pin } });
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось сохранить код");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/vhod">Войти</QuietAction>} />
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        {state === "checking" ? (
          <div style={{ marginTop: 40 }}>
            <span className="sov-skel" style={{ width: "56%", height: 34 }} />
            <span className="sov-skel" style={{ width: "82%", height: 14, marginTop: 16 }} />
            <span className="sov-skel" style={{ height: 52, marginTop: 30 }} />
          </div>
        ) : null}

        {state === "ok" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-display)" }}>Новый код родителя</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Четыре цифры, которые знает только взрослый. Занятия ребёнка кодом не закрываются — он
              заходит в них сам.
            </p>
            <form
              className="sov-form ym-hide-content ym-disable-keys"
              style={{ marginTop: 32 }}
              onSubmit={onSubmit}
            >
              {error ? <div className="sov-alert">{error}</div> : null}
              <div className="sov-field">
                <label htmlFor="pin">Новый код</label>
                <input
                  id="pin"
                  className="sov-pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  required
                />
              </div>
              <div className="sov-field">
                <label htmlFor="repeat">Повторите код</label>
                <input
                  id="repeat"
                  className="sov-pin"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
                <span className="sov-field__hint">
                  Не берите дату рождения ребёнка и четыре одинаковые цифры.
                </span>
              </div>
              <FormAction pending={pending}>Сохранить код</FormAction>
            </form>
          </>
        ) : null}

        {state === "dead" ? (
          <div className="sov-state" style={{ marginTop: 40 }}>
            <Owl size={84} mood="concerned" />
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Ссылка больше не работает</h1>
            <p>
              Она живёт один час и открывается один раз. Скорее всего, письмо пришло давно или кодом
              уже воспользовались. Откройте кабинет родителя и попросите новую ссылку — это займёт
              минуту.
            </p>
            <Link to="/roditel" className="sov-act-child">
              В кабинет родителя
            </Link>
          </div>
        ) : null}

        {state === "done" ? (
          <div className="sov-state" style={{ marginTop: 40 }}>
            <Owl size={84} mood="happy" animated />
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Код сохранён</h1>
            <p>
              Кабинет уже открыт — вводить код прямо сейчас не нужно. Если вы открывали кабинет на
              других устройствах, там он закрылся: понадобится новый код.
            </p>
            <button
              type="button"
              className="sov-act-child"
              onClick={() => void navigate({ to: "/roditel" })}
            >
              В кабинет
            </button>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
