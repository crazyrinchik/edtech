import { Link } from "@tanstack/react-router";
import { OTPInput } from "input-otp";
import type { ReactNode } from "react";
import { useState } from "react";

import { AvatarFace } from "./avatars";
import { EyeIcon } from "./icons";
import { Owl as Mascot } from "./mascot";

export { currentOwlItem, ForestScene, NightSky, OWL_UNLOCKS, owlStage } from "./mascot";
export type { OwlItem, OwlMood } from "./mascot";

/**
 * Совёнок: маскот. Прежняя версия была плоской аппликацией из нескольких
 * фигур; теперь это мягкая мультяшная сова, умеющая расти и менять настроение
 * (см. components/mascot.tsx). Обёртка сохраняет старую сигнатуру, поэтому
 * шапка, подвал и витрина продолжают работать без правок.
 */
export function Owl({
  size = 48,
  className = "",
  stage = 3,
  mood = "idle",
  item = "none",
  animated = false,
}: {
  size?: number;
  className?: string;
  stage?: number;
  mood?: "idle" | "happy" | "concerned" | "sleepy";
  item?: "none" | "scarf" | "glasses" | "cap" | "graduate";
  animated?: boolean;
}) {
  return (
    <Mascot
      size={size}
      className={className}
      stage={stage}
      mood={mood}
      item={item}
      animated={animated}
    />
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="sov-wordmark" aria-label="Совёнок, на главную">
      <Owl size={compact ? 38 : 46} />
      <span>Совёнок</span>
    </Link>
  );
}

/* Каждая кнопка получает собственный характер: общего стиля кнопок нет. */

export function StartAction({
  to,
  children,
  search,
}: {
  to: string;
  children: ReactNode;
  search?: Record<string, string>;
}) {
  return (
    <Link to={to} search={search as never} className="sov-act-start">
      <span className="sov-act-start__label">{children}</span>
      <span className="sov-act-start__arrow" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="18" height="18">
          <path
            d="M3 10h13M11 5l5 5-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}

export function QuietAction({
  to,
  children,
  search,
}: {
  to: string;
  children: ReactNode;
  search?: Record<string, string>;
}) {
  return (
    <Link to={to} search={search as never} className="sov-act-quiet">
      {children}
    </Link>
  );
}

export function ChildAction({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="sov-act-child">
      {children}
    </button>
  );
}

/**
 * Поле пароля с глазком.
 *
 * Пароль на регистрации требуют не короче восьми символов, а вводят его с
 * планшета одним пальцем — и ошибаются молча, потому что на экране точки.
 * Глазок показывает набранное, пока кнопку держат нажатой в состоянии
 * «видно»; тип поля меняется, а не значение, поэтому автозаполнение и
 * менеджеры паролей продолжают работать.
 *
 * Поле работает и без value/onChange: на входе форма читается через
 * FormData, и заводить состояние ради одной строки там незачем.
 */
export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  minLength,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  hint?: ReactNode;
  value?: string;
  onChange?: (value: string) => void;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="sov-field">
      <label htmlFor={id}>{label}</label>
      <div className="sov-secret">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          {...(onChange
            ? {
                value: value ?? "",
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
              }
            : {})}
        />
        <button
          type="button"
          className="sov-secret__eye"
          aria-pressed={visible}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          title={visible ? "Скрыть пароль" : "Показать пароль"}
          onClick={() => setVisible((v) => !v)}
        >
          <EyeIcon size={20} off={!visible} />
        </button>
      </div>
      {error ? <span className="sov-field__error">{error}</span> : null}
      {hint ? <span className="sov-field__hint">{hint}</span> : null}
    </div>
  );
}

/**
 * Код приглашения: шесть ячеек вместо одного поля.
 *
 * Раньше это была обычная строка ввода с моноширинным шрифтом и разрядкой,
 * а сколько цифр вводить, объяснял абзац сверху — да ещё и оговаривался,
 * что это не тот код из четырёх цифр, который родитель придумывает себе
 * сам. Шесть пустых ячеек говорят и то и другое молча: видно, сколько
 * цифр ждут, видно, сколько уже набрано, и перепутать с четырёхзначным
 * невозможно.
 *
 * Взята сама библиотека input-otp, а не готовый компонент из
 * components/ui: тот раскрашен классами Tailwind чужой тёмной темы
 * (border-input, ring-ring, bg-foreground), и на бумаге Совёнка выглядел
 * бы деталью из другого продукта. Поведение — вставку из буфера целиком,
 * стрелки, backspace через границы ячеек, цифровую клавиатуру на
 * телефоне — библиотека даёт сама.
 */
export function CodeField({
  id,
  label,
  length = 6,
  value,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  length?: number;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="sov-field">
      <label htmlFor={id}>{label}</label>
      <OTPInput
        id={id}
        value={value}
        onChange={onChange}
        maxLength={length}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        aria-invalid={error ? true : undefined}
        containerClassName="sov-otp"
        render={({ slots }) => (
          <>
            {slots.map((slot, i) => (
              <div
                key={i}
                className="sov-otp__cell"
                data-filled={slot.char ? "true" : undefined}
                data-active={slot.isActive ? "true" : undefined}
              >
                {slot.char ?? ""}
              </div>
            ))}
          </>
        )}
      />
      {error ? <span className="sov-field__error">{error}</span> : null}
      {hint ? <span className="sov-field__hint">{hint}</span> : null}
    </div>
  );
}

/**
 * Почта и её повтор.
 *
 * Опечатка в почте на регистрации стоит дорого: письмо со сбросом пароля
 * уходит в никуда, а человек уверен, что адрес верный. Второе поле ловит
 * это на месте — ошибка показывается под ним, а не после отправки формы.
 * Вставку из буфера во второе поле не блокируем: проверку это ослабляет,
 * но заставлять набирать длинный адрес руками на планшете хуже.
 */
export function EmailPair({
  email,
  repeat,
  onEmail,
  onRepeat,
  error,
}: {
  email: string;
  repeat: string;
  onEmail: (value: string) => void;
  onRepeat: (value: string) => void;
  error?: string | null;
}) {
  return (
    <>
      <div className="sov-field">
        <label htmlFor="email">Электронная почта</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
        />
      </div>
      <div className="sov-field">
        <label htmlFor="email2">Повторите почту</label>
        <input
          id="email2"
          name="emailRepeat"
          type="email"
          required
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          value={repeat}
          onChange={(e) => onRepeat(e.target.value)}
        />
        {error ? <span className="sov-field__error">{error}</span> : null}
      </div>
    </>
  );
}

export function FormAction({
  children,
  pending,
  disabled,
}: {
  children: ReactNode;
  pending?: boolean;
  /** Отдельно от pending: заблокированная кнопка не должна врать «Секунду…». */
  disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={pending || disabled} className="sov-act-form">
      {pending ? "Секунду…" : children}
    </button>
  );
}

/**
 * Аватары детей. Фотографий у нас нет и не будет (о ребёнке хранятся только
 * имя, класс и ответы), поэтому лицо профиля — зверёк: его ребёнок узнаёт
 * раньше, чем прочитает своё имя.
 *
 * Сам рисунок живёт в components/avatars.tsx — эмодзи здесь не годятся,
 * причина расписана там же.
 */
export const CHILD_AVATARS: { id: string; label: string; tint: string }[] = [
  { id: "owl", label: "Совёнок", tint: "#e8eeff" },
  { id: "fox", label: "Лисёнок", tint: "#ffe9d9" },
  { id: "bear", label: "Медвежонок", tint: "#f1e6d8" },
  { id: "hare", label: "Зайчонок", tint: "#f2e6f7" },
  { id: "cat", label: "Котёнок", tint: "#ffeef1" },
  { id: "panda", label: "Панда", tint: "#dde3ea" },
  { id: "frog", label: "Лягушонок", tint: "#e4f6e6" },
  { id: "penguin", label: "Пингвинёнок", tint: "#e3f1fb" },
];

export function ChildAvatar({ avatar, size = 56 }: { avatar: string; size?: number }) {
  const found = CHILD_AVATARS.find((a) => a.id === avatar) ?? CHILD_AVATARS[0];
  return (
    <span
      className="sov-avatar"
      style={{ width: size, height: size, background: found.tint }}
      aria-hidden="true"
    >
      <AvatarFace avatar={found.id} size={Math.round(size * 0.82)} />
    </span>
  );
}

export function Stars({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span className="sov-stars" aria-label={`${value} из ${max} звёзд`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <path
            d="M10 2.5l2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2L2.5 8.1l5.2-.7L10 2.5Z"
            fill={i < value ? "var(--sov-star, var(--sov-cobalt))" : "transparent"}
            stroke="var(--sov-star, var(--sov-cobalt))"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * Шапка. Белая полоса во всю ширину окна, содержимое внутри — в общей
 * колонке: иначе логотип уезжал бы к самому краю монитора, а разделы
 * справа — к другому, и шапка переставала бы совпадать со страницей.
 *
 * Отсюда две вложенности: цвет живёт на полосе, ширину держит __in.
 */
export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sov-header">
      <div className="sov-header__in">
        <Wordmark compact />
        <div className="sov-header__right">{right}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="sov-footer">
      <div>
        <Owl size={28} />
        <p>Совёнок, тренажёр по школьной программе с 1 по 4 класс.</p>
      </div>
      <p className="sov-footer__legal">
        Данные детей обрабатываются по 152-ФЗ. Ребёнок не указывает почту и телефон, только имя и
        аватар.
      </p>
      {/* Обычные <a>, а не Link: юридические страницы должны открываться и
          из подвала любой страницы, и по прямому адресу — SSR им хватает. */}
      <nav className="sov-footer__links" aria-label="Документы">
        <a href="/oferta">Оферта</a>
        <a href="/politika">Политика персональных данных</a>
      </nav>
      {/* Наименование продавца и ОГРНИП на каждой странице: этого требует
          ст. 26.1 ЗоЗПП о дистанционной продаже — покупатель должен видеть,
          с кем имеет дело, до того, как нажал «Оплатить», а не после. */}
      <p className="sov-footer__legal">ИП Зюбанова Екатерина Алексеевна, ОГРНИП 326774600573081</p>
    </footer>
  );
}
