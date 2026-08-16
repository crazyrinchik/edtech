import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AvatarFace } from "./avatars";
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
    <Mascot size={size} className={className} stage={stage} mood={mood} item={item} animated={animated} />
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="sov-wordmark" aria-label="Совёнок, на главную">
      <Owl size={compact ? 30 : 36} />
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
          <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        <p>Совёнок, тренажёр по школьной программе для 1 и 2 класса.</p>
      </div>
      <p className="sov-footer__legal">
        Данные детей обрабатываются по 152-ФЗ. Ребёнок не указывает почту и телефон, только имя и аватар.
      </p>
    </footer>
  );
}
