import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ChildAvatar, CHILD_AVATARS, FormAction, QuietAction, SiteHeader } from "../components/brand";
import { addChild, registerParent, setParentPin } from "../lib/api/app.functions";

/**
 * ?rol=repetitor или ?rol=roditel пропускает развилку: с витрины человек
 * уже нажал на свою карточку, и спрашивать второй раз одно и то же грубо.
 */
export const Route = createFileRoute("/registraciya")({
  // Ключ именно необязательный, а не «есть со значением undefined»: иначе
  // роутер потребует search у каждой ссылки на регистрацию во всём проекте.
  validateSearch: (search: Record<string, unknown>): { rol?: "repetitor" | "roditel" } =>
    search.rol === "repetitor"
      ? { rol: "repetitor" }
      : search.rol === "roditel"
        ? { rol: "roditel" }
        : {},
  head: () => ({ meta: [{ title: "Регистрация, Совёнок" }] }),
  component: RegisterPage,
});

/**
 * Регистрация раздваивается на входе. Репетитор платит сам и заводит
 * учеников в своём кабинете, поэтому ни профиль ребёнка, ни код родителя
 * ему на этом шаге не нужны — и согласие за чужую семью он не подписывает.
 */
const PARENT_STEPS = ["role", "parent", "child", "pin"] as const;
const TUTOR_STEPS = ["role", "parent"] as const;

type Step = (typeof PARENT_STEPS)[number];

function RegisterPage() {
  const navigate = useNavigate();
  const { rol } = Route.useSearch();
  const [role, setRole] = useState<"parent" | "tutor">(rol === "repetitor" ? "tutor" : "parent");
  const [step, setStep] = useState<Step>(rol ? "parent" : "role");
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
          role,
          consentPd: form.get("consentPd") === "on",
          consentChildPd: role === "parent" && form.get("consentChildPd") === "on",
        },
      });
      if (role === "tutor") {
        await navigate({ to: "/repetitor" });
        return;
      }
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

  const steps: readonly Step[] = role === "tutor" ? TUTOR_STEPS : PARENT_STEPS;

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
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        {/* Пришедшему с витрины по прямой ссылке счётчик врал бы: развилку он
            уже прошёл там, и «шаг 2 из 2» на единственной форме читается
            как потерянный шаг. */}
        {step === "role" || (rol && step === "parent") ? null : (
          <p className="sov-mono" style={{ color: "var(--sov-ink-soft)" }}>
            Шаг {steps.indexOf(step) + 1} из {steps.length}
          </p>
        )}

        {step === "role" ? (
          <>
            <h1 style={{ fontSize: "2.2rem" }}>Кто вы?</h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              От этого зависит, что будет дальше: репетитор заводит учеников сам,
              родитель — своего ребёнка.
            </p>
            <div className="sov-pick" style={{ marginTop: 30 }}>
              <button
                type="button"
                className="sov-pick__card"
                onClick={() => {
                  setRole("tutor");
                  setStep("parent");
                }}
              >
                <strong>Я репетитор</strong>
                <span>
                  Ученики, домашние задания и отчёты в одном кабинете. Подписку оплачиваете вы,
                  семьям платить не нужно.
                </span>
              </button>
              <button
                type="button"
                className="sov-pick__card"
                onClick={() => {
                  setRole("parent");
                  setStep("parent");
                }}
              >
                <strong>Я родитель</strong>
                <span>
                  Занятия ребёнка дома и кабинет с прогрессом. Если с ребёнком занимается
                  репетитор, попросите у него код приглашения.
                </span>
              </button>
            </div>
            <p style={{ marginTop: 24 }}>
              <QuietAction to="/priglashenie">У меня есть код приглашения</QuietAction>
            </p>
          </>
        ) : null}

        {step === "parent" ? (
          <>
            <h1 style={{ fontSize: "2.2rem", marginTop: 10 }}>
              {role === "tutor" ? "Аккаунт репетитора" : "Аккаунт родителя"}
            </h1>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              {role === "tutor"
                ? "Учеников добавите в кабинете сразу после регистрации."
                : "Аккаунт оформляет взрослый. Профиль ребёнка добавим на следующем шаге."}
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
              {/* Ссылки ведут на полные тексты: согласие по ч. 1 ст. 9 152-ФЗ
                  должно быть информированным, а акцепт оферты — привязанным к
                  её тексту. Клик по ссылке внутри label не трогает галочку:
                  активация label не срабатывает на интерактивных элементах. */}
              <label className="sov-check">
                <input type="checkbox" name="consentPd" required />
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
              {/* Согласие за ребёнка подписывает только законный представитель.
                  У репетитора его спрашивать не за кого: данные учеников
                  подтвердит родитель, когда откроет приглашение. */}
              {role === "parent" ? (
                <label className="sov-check">
                  <input type="checkbox" name="consentChildPd" required />
                  <span>
                    Я родитель или иной законный представитель и даю согласие на обработку
                    персональных данных ребёнка — имя, класс, аватар, ответы и время занятий,
                    фотографии работ — на условиях раздела II{" "}
                    <a href="/soglasie" target="_blank" rel="noreferrer">
                      Согласия
                    </a>
                    .
                  </span>
                </label>
              ) : null}
              <FormAction pending={pending}>
                {role === "tutor" ? "Открыть кабинет" : "Продолжить"}
              </FormAction>
            </form>
          </>
        ) : null}

        {step === "child" ? (
          <>
            <h1 style={{ fontSize: "2.2rem", marginTop: 10 }}>Профиль ребёнка</h1>
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
            <h1 style={{ fontSize: "2.2rem", marginTop: 10 }}>Код родителя</h1>
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
