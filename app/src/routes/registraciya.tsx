import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ChildAvatar, CHILD_AVATARS, FormAction, QuietAction, SiteHeader } from "../components/brand";
import { addChild, registerParent, setParentPin } from "../lib/api/app.functions";

export const Route = createFileRoute("/registraciya")({
  head: () => ({ meta: [{ title: "Регистрация, Совёнок" }] }),
  component: RegisterPage,
});

const STEPS = ["parent", "child", "pin"] as const;

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<(typeof STEPS)[number]>("parent");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [avatar, setAvatar] = useState("owl");
  const [pin, setPin] = useState("");
  const [pinRepeat, setPinRepeat] = useState("");

  async function submitParent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await registerParent({
        data: {
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          name: String(form.get("name") ?? ""),
          consentPd: form.get("consentPd") === "on",
          consentChildPd: form.get("consentChildPd") === "on",
        },
      });
      setStep("child");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось зарегистрироваться");
    }
    setPending(false);
  }

  async function submitChild(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await addChild({
        data: {
          name: String(form.get("childName") ?? ""),
          grade: Number(form.get("grade") ?? 1),
          avatar,
          birthYear: form.get("birthYear") ? Number(form.get("birthYear")) : null,
        },
      });
      setStep("pin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось создать профиль");
    }
    setPending(false);
  }

  async function submitPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (pin !== pinRepeat) throw new Error("Коды не совпали");
      await setParentPin({ data: { pin, currentPin: null } });
      await navigate({ to: "/uchenik" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось сохранить код");
      setPending(false);
    }
  }

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/vhod">Войти</QuietAction>} />
      <main className="sov-narrow" style={{ paddingTop: 48, paddingBottom: 80 }}>
        <p className="sov-mono" style={{ color: "var(--sov-ink-soft)" }}>
          Шаг {STEPS.indexOf(step) + 1} из {STEPS.length}
        </p>

        {step === "parent" ? (
          <>
            <h1 style={{ fontSize: "2.2rem", fontWeight: 700, marginTop: 10 }}>Аккаунт родителя</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Аккаунт оформляет взрослый. Профиль ребёнка добавим на следующем шаге.
            </p>
            <form className="sov-form" style={{ marginTop: 32 }} onSubmit={submitParent}>
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
                <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                <span className="sov-field__hint">Не короче 8 символов.</span>
              </div>
              <label className="sov-check">
                <input type="checkbox" name="consentPd" required />
                <span>Даю согласие на обработку моих персональных данных по 152-ФЗ.</span>
              </label>
              <label className="sov-check">
                <input type="checkbox" name="consentChildPd" required />
                <span>
                  Как законный представитель даю согласие на обработку данных моего ребёнка: имя,
                  класс, ответы на задания и время занятий.
                </span>
              </label>
              <FormAction pending={pending}>Продолжить</FormAction>
            </form>
          </>
        ) : null}

        {step === "child" ? (
          <>
            <h1 style={{ fontSize: "2.2rem", fontWeight: 700, marginTop: 10 }}>Профиль ребёнка</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Достаточно имени и класса. Почту и телефон ребёнка мы не спрашиваем.
            </p>
            <form className="sov-form" style={{ marginTop: 32 }} onSubmit={submitChild}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <div className="sov-field">
                <label htmlFor="childName">Имя ребёнка</label>
                <input id="childName" name="childName" required />
              </div>
              <div className="sov-field">
                <label htmlFor="grade">Класс</label>
                <select id="grade" name="grade" defaultValue="1">
                  <option value="1">1 класс</option>
                  <option value="2">2 класс</option>
                </select>
              </div>
              <div className="sov-field">
                <label htmlFor="birthYear">Год рождения, по желанию</label>
                <input id="birthYear" name="birthYear" type="number" min={2010} max={2025} />
                <span className="sov-field__hint">Нужен только для возрастных настроек интерфейса.</span>
              </div>
              <div className="sov-field">
                <label>Аватар</label>
                <div className="sov-avatar-pick">
                  {CHILD_AVATARS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="sov-avatar-pick__item"
                      data-active={avatar === a.id}
                      aria-pressed={avatar === a.id}
                      aria-label={a.label}
                      onClick={() => setAvatar(a.id)}
                    >
                      <ChildAvatar avatar={a.id} size={44} />
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
                <span className="sov-field__hint">
                  По нему ребёнок находит себя, если в аккаунте несколько детей.
                </span>
              </div>
              <FormAction pending={pending}>Дальше</FormAction>
            </form>
          </>
        ) : null}

        {step === "pin" ? (
          <>
            <h1 style={{ fontSize: "2.2rem", fontWeight: 700, marginTop: 10 }}>Код родителя</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Четыре цифры для входа в кабинет: отчёты, настройки и подписка. Ребёнок открывает
              занятия без кода — он нужен только взрослой части.
            </p>
            <form className="sov-form" style={{ marginTop: 32 }} onSubmit={submitPin}>
              {error ? <div className="sov-alert">{error}</div> : null}
              <div className="sov-field">
                <label htmlFor="pin">Код</label>
                <input
                  id="pin"
                  className="sov-pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="sov-field">
                <label htmlFor="pin2">Повторите код</label>
                <input
                  id="pin2"
                  className="sov-pin"
                  value={pinRepeat}
                  onChange={(e) => setPinRepeat(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
                <span className="sov-field__hint">
                  Не берите дату рождения ребёнка и четыре одинаковые цифры.
                </span>
              </div>
              <FormAction pending={pending}>Открыть занятия</FormAction>
            </form>
          </>
        ) : null}
      </main>
    </div>
  );
}
