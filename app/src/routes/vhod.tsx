import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { QuietAction, SiteHeader, FormAction } from "../components/brand";
import { loginParent } from "../lib/api/app.functions";

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
      await navigate({ to: "/roditel" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось войти");
      setPending(false);
    }
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/registraciya">Создать аккаунт</QuietAction>} />
      <main className="sov-narrow" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700 }}>Вход для родителя</h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
          Занятия ребёнка открываются из вашего аккаунта.
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
      </main>
    </div>
  );
}
