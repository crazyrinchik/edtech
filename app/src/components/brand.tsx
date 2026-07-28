import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Совёнок: маскот. Бумажная аппликация, один акцент. */
export function Owl({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <path d="M32 6c11 0 20 8 20 19v13c0 11-9 20-20 20s-20-9-20-20V25C12 14 21 6 32 6Z" fill="var(--sov-cobalt)" />
      <path d="M32 12c8 0 14 6 14 13v12c0 8-6 14-14 14s-14-6-14-14V25c0-7 6-13 14-13Z" fill="var(--sov-paper)" />
      <circle cx="24" cy="27" r="7" fill="var(--sov-cobalt)" />
      <circle cx="40" cy="27" r="7" fill="var(--sov-cobalt)" />
      <circle cx="25.5" cy="26" r="2.6" fill="var(--sov-paper)" />
      <circle cx="41.5" cy="26" r="2.6" fill="var(--sov-paper)" />
      <path d="M32 33l3.5 5h-7L32 33Z" fill="var(--sov-ink)" />
      <path d="M20 8l5 7-8 2 3-9Z" fill="var(--sov-cobalt)" />
      <path d="M44 8l-5 7 8 2-3-9Z" fill="var(--sov-cobalt)" />
    </svg>
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

export function StartAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="sov-act-start">
      <span className="sov-act-start__label">{children}</span>
      <span className="sov-act-start__arrow" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="18" height="18">
          <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

export function QuietAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="sov-act-quiet">
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

export function FormAction({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button type="submit" disabled={pending} className="sov-act-form">
      {pending ? "Секунду…" : children}
    </button>
  );
}

export function Stars({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span className="sov-stars" aria-label={`${value} из ${max} звёзд`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <path
            d="M10 2.5l2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2L2.5 8.1l5.2-.7L10 2.5Z"
            fill={i < value ? "var(--sov-cobalt)" : "transparent"}
            stroke="var(--sov-cobalt)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sov-header">
      <Wordmark compact />
      <div className="sov-header__right">{right}</div>
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
