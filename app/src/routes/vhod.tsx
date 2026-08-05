import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { QuietAction, SiteHeader, FormAction } from "../components/brand";
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
      <main className="sov-narrow" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <h1 style={{ fontSize: "2.2rem" }}>Вход</h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
          Одна дверь для репетитора и для родителя — куда попадёте, решит ваша роль.
        </p>
        <form className="sov-form" style={{ marginTop: 32 }} onSubmit={onSubmit}>
          {error ? <div className="sov-alert">{error}</div> : null}
          <div className="sov-field">
            <label htmlFor="email">Электронная почта</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="sov-field">
            <label htmlFor="password">Пароль</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <FormAction pending={pending}>Войти</FormAction>
        </form>
        <p style={{ marginTop: 26, color: "var(--sov-ink-soft)", fontSize: ".95rem" }}>
          Репетитор попадёт в список учеников, родитель — сразу к занятиям ребёнка. Кабинет с
          отчётами и подпиской открывается оттуда кнопкой и закрыт кодом из четырёх цифр.
        </p>
        <p style={{ marginTop: 18 }}>
          <QuietAction to="/priglashenie">У меня есть код от репетитора</QuietAction>
        </p>
      </main>
    </div>
  );
}
