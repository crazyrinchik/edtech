import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  FormAction,
  Owl,
  PasswordField,
  QuietAction,
  SiteFooter,
  SiteHeader,
} from "../components/brand";
import { checkResetToken, resetPassword } from "../lib/api/app.functions";
import { closedHead } from "../lib/seo";

export const Route = createFileRoute("/novyy-parol")({
  head: () => closedHead("Новый пароль, Совёнок"),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : "",
  }),
  component: NewPasswordPage,
});

/**
 * Новый пароль по ссылке из письма.
 *
 * Годность ссылки проверяется до показа формы, а не после отправки:
 * узнать, что ссылка протухла, уже придумав пароль, — обидно, а причина
 * у этого была бы только одна, лень.
 *
 * Повтор пароля здесь не спрашиваем, в отличие от регистрации: там
 * опечатка запирает человека снаружи надолго, а тут он в двух кликах от
 * новой ссылки, и лишнее поле в этот момент только мешает. Глазок у поля
 * показывает набранное.
 */
function NewPasswordPage() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | "dead" | "done">("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!t) {
        setState("dead");
        return;
      }
      try {
        const res = await checkResetToken({ data: { token: t } });
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
    setPending(true);
    setError(null);
    try {
      await resetPassword({ data: { token: t, password } });
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось сменить пароль");
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
            <h1 style={{ fontSize: "var(--sov-t-display)" }}>Новый пароль</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Придумайте пароль, которым будете входить дальше. После смены все открытые входы
              закроются — на других устройствах придётся войти заново.
            </p>
            <form className="sov-form ym-hide-content ym-disable-keys" style={{ marginTop: 32 }} onSubmit={onSubmit}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <PasswordField
                id="password"
                name="password"
                label="Пароль"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={setPassword}
                hint="От восьми символов."
              />
              <FormAction pending={pending}>Сменить пароль</FormAction>
            </form>
          </>
        ) : null}

        {state === "dead" ? (
          <div className="sov-state" style={{ marginTop: 40 }}>
            <Owl size={84} mood="concerned" />
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Ссылка больше не работает</h1>
            <p>
              Она живёт один час и открывается один раз. Скорее всего, письмо пришло давно или
              паролем уже воспользовались. Запросите новую — это займёт минуту.
            </p>
            <Link to="/vosstanovlenie" className="sov-act-child">
              Прислать новую ссылку
            </Link>
          </div>
        ) : null}

        {state === "done" ? (
          <div className="sov-state" style={{ marginTop: 40 }}>
            <Owl size={84} mood="happy" animated />
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Пароль сменён</h1>
            <p>
              Входите с новым. Ученики, домашние задания и результаты занятий на месте — их смена
              пароля не трогает.
            </p>
            <button
              type="button"
              className="sov-act-child"
              onClick={() => void navigate({ to: "/vhod" })}
            >
              Войти
            </button>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
