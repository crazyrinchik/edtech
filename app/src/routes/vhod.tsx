import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  FormAction,
  PasswordField,
  QuietAction,
  SiteFooter,
  SiteHeader,
} from "../components/brand";
import { loginParent, me } from "../lib/api/app.functions";

export const Route = createFileRoute("/vhod")({
  head: () => ({ meta: [{ title: "Вход, Совёнок" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await loginParent({
        data: {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        },
      });
      // Вход один для всех, а дальше роль решает, куда человек попадёт:
      // репетитору — список учеников, родителю — занятия ребёнка. Кабинет
      // взрослого открывается отдельно, кнопкой и кодом: чаще всего вход
      // происходит, чтобы посадить ребёнка заниматься, а не читать отчёты.
      const account = await me();
      await navigate({ to: account.user?.role === "tutor" ? "/repetitor" : "/uchenik" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось войти");
      setPending(false);
    }
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/registraciya">Создать аккаунт</QuietAction>} />
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        <h1 style={{ fontSize: "var(--sov-t-display)" }}>Вход</h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
          Одна дверь для репетитора и для родителя — куда попадёте, решит ваша роль.
        </p>
        <form className="sov-form" style={{ marginTop: 32 }} onSubmit={onSubmit}>
          {error ? <div className="sov-alert">{error}</div> : null}
          <div className="sov-field">
            <label htmlFor="email">Электронная почта</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <PasswordField
            id="password"
            name="password"
            label="Пароль"
            autoComplete="current-password"
          />
          <FormAction pending={pending}>Войти</FormAction>
          {/* Выход для того, кто забыл пароль.

              Его тут не было вовсе: почта, пароль, кнопка — и всё. Для
              продукта с подпиской это тупик, потому что вместе с паролем
              теряются оплаченные занятия ребёнка, а сказать об этом
              человеку было негде.

              Автоматического восстановления пока нет, и врать про
              «письмо со ссылкой» нельзя. Поэтому здесь честная развилка:
              что происходит на самом деле и куда писать. Адрес не новый —
              это тот же адрес, по которому оферта велит направлять любые
              обращения (docs/legal/oferta.md, разделы 12 и 16). */}
          <details className="sov-forgot">
            <summary>Забыли пароль?</summary>
            <p>
              Восстановление по ссылке из письма мы ещё не сделали. Напишите на{" "}
              <a href="mailto:ekaterinazyub@gmail.com">ekaterinazyub@gmail.com</a> с той почты, на
              которую заведён аккаунт, — доступ вернём вручную. Ученики, домашние задания и
              результаты при этом остаются на месте.
            </p>
          </details>
        </form>
        <p style={{ marginTop: 26, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
          Репетитор попадёт в список учеников, родитель — сразу к занятиям ребёнка. Кабинет с
          отчётами и подпиской открывается оттуда кнопкой и закрыт кодом из четырёх цифр.
        </p>
        <p style={{ marginTop: 18 }}>
          <QuietAction to="/priglashenie">У меня есть код от репетитора</QuietAction>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
