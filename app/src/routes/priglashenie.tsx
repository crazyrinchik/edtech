import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useState } from "react";

import {
  CodeField,
  EmailPair,
  FormAction,
  PasswordField,
  QuietAction,
  SiteFooter,
  SiteHeader,
} from "../components/brand";
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
  const [email, setEmail] = useState("");
  const [emailRepeat, setEmailRepeat] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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
    const emailsMatch = email.trim().toLowerCase() === emailRepeat.trim().toLowerCase();
    setEmailError(emailsMatch ? null : "Адреса не совпали");
    setPasswordError(password === passwordRepeat ? null : "Пароли не совпали");
    if (!emailsMatch || password !== passwordRepeat) return;
    setPending(true);
    setError(null);
    try {
      await acceptInvite({
        data: {
          code,
          email: email.trim(),
          password,
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
        {/* Ключи на ветках обязательны.

            Обе ветки — фрагменты с одинаковой формой: заголовок, абзац,
            форма, а в форме первым полем идёт input. React сверяет детей по
            месту, поэтому после проверки кода он не заменял поле, а
            переиспользовал то же самое: DOM-узел с набранными шестью
            цифрами получал name="name" — и код оказывался в графе «Имя».
            Разные ключи заставляют размонтировать первую ветку целиком. */}
        {info?.ok ? (
          <Fragment key="join">
            <h1 style={{ fontSize: "var(--sov-t-display)" }}>
              {info.childName}, {info.grade} класс
            </h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              {info.tutorName ? `${info.tutorName} приглашает вас` : "Репетитор приглашает вас"}{" "}
              видеть занятия и домашние задания. Платить не нужно — подписку оплачивает репетитор.
            </p>
            <form className="sov-form" style={{ marginTop: 32 }} onSubmit={submit}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <div className="sov-field">
                <label htmlFor="name">Как к вам обращаться</label>
                <input id="name" name="name" required autoComplete="name" />
              </div>
              <EmailPair
                email={email}
                repeat={emailRepeat}
                onEmail={(v) => {
                  setEmail(v);
                  setEmailError(null);
                }}
                onRepeat={(v) => {
                  setEmailRepeat(v);
                  setEmailError(null);
                }}
                error={emailError}
              />
              <PasswordField
                id="password"
                name="password"
                label="Пароль"
                autoComplete="new-password"
                minLength={8}
                hint="Не короче 8 символов. Репетитор ваш пароль не видит."
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setPasswordError(null);
                }}
              />
              <PasswordField
                id="password2"
                name="passwordRepeat"
                label="Повторите пароль"
                autoComplete="new-password"
                minLength={8}
                value={passwordRepeat}
                onChange={(v) => {
                  setPasswordRepeat(v);
                  setPasswordError(null);
                }}
                error={passwordError}
              />
              <label className="sov-check">
                <input
                  type="checkbox"
                  name="consentPd"
                  checked={consentPd}
                  onChange={(e) => setConsentPd(e.target.checked)}
                  required
                />
                <span>
                  Мне исполнилось 18 лет, я принимаю условия{" "}
                  <a href="/oferta" target="_blank" rel="noreferrer">
                    публичной оферты
                  </a>{" "}
                  и даю согласие на обработку моих персональных данных на условиях{" "}
                  <a href="/soglasie" target="_blank" rel="noreferrer">
                    Согласия
                  </a>{" "}
                  и{" "}
                  <a href="/politika" target="_blank" rel="noreferrer">
                    Политики
                  </a>
                  .
                </span>
              </label>
              {/* Профиль завёл репетитор, поэтому согласие прямо охватывает и
                  уже внесённые им данные (п. 6.4 Согласия) — родитель должен
                  видеть, что подтверждает, а не догадываться. */}
              <label className="sov-check">
                <input
                  type="checkbox"
                  name="consentChildPd"
                  checked={consentChildPd}
                  onChange={(e) => setConsentChildPd(e.target.checked)}
                  required
                />
                <span>
                  Я родитель или иной законный представитель и даю согласие на обработку
                  персональных данных ребёнка, включая внесённые репетитором до этого момента, —
                  имя, класс, аватар, ответы и время занятий, фотографии работ — на условиях раздела
                  II{" "}
                  <a href="/soglasie" target="_blank" rel="noreferrer">
                    Согласия
                  </a>
                  .
                </span>
              </label>
              <FormAction pending={pending} disabled={!consentPd || !consentChildPd}>
                Подключиться
              </FormAction>
            </form>
          </Fragment>
        ) : (
          <Fragment key="code">
            <h1 style={{ fontSize: "var(--sov-t-display)" }}>Код приглашения</h1>
            {/* Оговорку «это не код кабинета из четырёх цифр» сняли: шесть
                пустых ячеек ниже говорят это сами, а лишнее предупреждение
                на первом же экране скорее пугало, чем помогало. */}
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Код, который дал репетитор. По нему откроется профиль вашего ребёнка.
            </p>
            <form className="sov-form" style={{ marginTop: 32 }} onSubmit={check}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <CodeField
                id="code"
                label="Код"
                value={code}
                onChange={(next) => setCode(next.replace(/\D/g, ""))}
              />
              <FormAction pending={pending} disabled={code.length < 6}>
                Проверить код
              </FormAction>
            </form>
          </Fragment>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
