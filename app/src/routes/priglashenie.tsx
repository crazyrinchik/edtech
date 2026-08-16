import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { FormAction, QuietAction, SiteHeader } from "../components/brand";
import { acceptInvite, inviteInfo } from "../lib/api/tutor.functions";

export const Route = createFileRoute("/priglashenie")({
  head: () => ({ meta: [{ title: "Приглашение, Совёнок" }] }),
  component: InvitePage,
});

type Info = Awaited<ReturnType<typeof inviteInfo>>;

/**
 * Родитель приходит сюда с кодом от репетитора. Здесь и только здесь он
 * подписывает согласие на обработку данных ребёнка: репетитор завёл профиль,
 * но подписаться за семью не может — это делает законный представитель.
 */
function InvitePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Согласия под контролем, чтобы кнопка гасла до их простановки: браузерный
  // required показывает подсказку только после нажатия, и человек жмёт в
  // неактивное на вид действие, не понимая, чего от него хотят.
  const [consentPd, setConsentPd] = useState(false);
  const [consentChildPd, setConsentChildPd] = useState(false);

  async function check(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const found = await inviteInfo({ data: { code } });
      if (!found.ok) throw new Error("Код не найден или уже использован");
      setInfo(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось проверить код");
    }
    setPending(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await acceptInvite({
        data: {
          code,
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          name: String(form.get("name") ?? ""),
          consentPd: form.get("consentPd") === "on",
          consentChildPd: form.get("consentChildPd") === "on",
        },
      });
      // Родитель только что подключился — ему интереснее увидеть, чем
      // занимается ребёнок, а не пустой кабинет с просьбой придумать код.
      await navigate({ to: "/uchenik" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось подключиться");
      setPending(false);
    }
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/vhod">Войти</QuietAction>} />
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        {info?.ok ? (
          <>
            <h1 style={{ fontSize: "2.2rem" }}>{info.childName}, {info.grade} класс</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              {info.tutorName ? `${info.tutorName} приглашает вас` : "Репетитор приглашает вас"} видеть
              занятия и домашние задания. Платить не нужно — подписку оплачивает репетитор.
            </p>
            <form className="sov-form" style={{ marginTop: 32 }} onSubmit={submit}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <div className="sov-field">
                <label htmlFor="name">Как к вам обращаться</label>
                <input id="name" name="name" required autoComplete="name" />
              </div>
              <div className="sov-field">
                <label htmlFor="email">Электронная почта</label>
                <input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="sov-field">
                <label htmlFor="password">Пароль</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <span className="sov-field__hint">
                  Не короче 8 символов. Репетитор ваш пароль не видит.
                </span>
              </div>
              <label className="sov-check">
                <input
                  type="checkbox"
                  name="consentPd"
                  checked={consentPd}
                  onChange={(e) => setConsentPd(e.target.checked)}
                  required
                />
                <span>Даю согласие на обработку моих персональных данных по 152-ФЗ.</span>
              </label>
              <label className="sov-check">
                <input
                  type="checkbox"
                  name="consentChildPd"
                  checked={consentChildPd}
                  onChange={(e) => setConsentChildPd(e.target.checked)}
                  required
                />
                <span>
                  Как законный представитель даю согласие на обработку данных моего ребёнка: имя,
                  класс, ответы на задания и время занятий.
                </span>
              </label>
              <FormAction pending={pending} disabled={!consentPd || !consentChildPd}>
                Подключиться
              </FormAction>
            </form>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "2.2rem" }}>Код приглашения</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Шесть цифр, которые дал репетитор. По ним откроется профиль вашего ребёнка.
              Это не код кабинета из четырёх цифр — тот придумывает себе сам родитель.
            </p>
            <form className="sov-form" style={{ marginTop: 32 }} onSubmit={check}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <div className="sov-field">
                <label htmlFor="code">Код</label>
                <input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  style={{ fontFamily: "var(--sov-mono)", letterSpacing: ".3em" }}
                />
              </div>
              <FormAction pending={pending}>Проверить код</FormAction>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
