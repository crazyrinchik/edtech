import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { FormAction, QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { requestPasswordReset } from "../lib/api/app.functions";
import { closedHead } from "../lib/seo";

export const Route = createFileRoute("/vosstanovlenie")({
  head: () => closedHead("Восстановление пароля, Совёнок"),
  component: ForgotPage,
});

/**
 * Заявка на смену пароля.
 *
 * Экран отвечает одинаково на любой адрес — и на тот, который у нас есть,
 * и на тот, которого нет. Это не небрежность, а условие: иначе форма
 * превращается в справочную «пользуется ли Совёнком вот эта семья», и
 * узнать это сможет кто угодно, не заходя в аккаунт.
 *
 * Отсюда же формулировка «если такой адрес у нас есть». Она звучит менее
 * гладко, чем «письмо отправлено», зато не врёт ни в одном из двух
 * случаев.
 */
function ForgotPage() {
  const [stage, setStage] = useState<"form" | "sent" | "manual">("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await requestPasswordReset({ data: { email } });
      // Почта на сервере не настроена — обещать письмо нельзя, показываем
      // живой путь: адрес, по которому оферта велит писать обращения.
      setStage(res.sent ? "sent" : "manual");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось отправить заявку");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/vhod">Вспомнил, войти</QuietAction>} />
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        {stage === "form" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-display)" }}>Забыли пароль?</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Пришлём на почту ссылку, по которой можно придумать новый. Ученики, домашние задания и
              результаты занятий останутся на месте.
            </p>
            <form className="sov-form ym-hide-content ym-disable-keys" style={{ marginTop: 32 }} onSubmit={onSubmit}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <div className="sov-field">
                <label htmlFor="email">Электронная почта</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span className="sov-field__hint">Та, на которую заведён аккаунт.</span>
              </div>
              <FormAction pending={pending}>Прислать ссылку</FormAction>
            </form>
          </>
        ) : null}

        {stage === "sent" ? (
          <div className="sov-state" style={{ marginTop: 40 }}>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Проверьте почту</h1>
            <p>
              Если аккаунт с адресом <b>{email}</b> у нас есть, письмо со ссылкой уже в пути. Ссылка
              работает один час и только один раз.
            </p>
            <p>
              Письма нет через несколько минут — загляните в «Спам». Если и там пусто, значит на
              этот адрес аккаунт не заводили: попробуйте другой.
            </p>
            <QuietAction to="/vhod">Вернуться ко входу</QuietAction>
          </div>
        ) : null}

        {stage === "manual" ? (
          <div className="sov-state" style={{ marginTop: 40 }}>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Пока вручную</h1>
            <p>
              Отправка писем на сервере сейчас не настроена, поэтому ссылку выслать не можем.
              Напишите на <a href="mailto:ekaterinazyub@gmail.com">ekaterinazyub@gmail.com</a> с той
              почты, на которую заведён аккаунт, — вернём доступ руками.
            </p>
            <QuietAction to="/vhod">Вернуться ко входу</QuietAction>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
