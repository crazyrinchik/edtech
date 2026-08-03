import { useEffect, useState } from "react";

import { autoSpeakEnabled, setAutoSpeak, speak, speechSupported, stopSpeech } from "../lib/speech";

/**
 * Ушко: кнопка «прочитать вслух».
 *
 * Ребёнок, который ещё не читает, должен уметь начать занятие сам, поэтому
 * кнопка крупная, всегда на одном месте и подписана словом — иконку без
 * подписи первоклассник не опознаёт.
 */
export function EarIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M7.5 9.2a4.5 4.5 0 1 1 9 0c0 2.2-1.5 3.1-2.4 4.1-.8.9-1 1.7-1 2.7a2.1 2.1 0 1 1-4.2 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 9.4a1.2 1.2 0 1 1 2.4.3c0 .8-.9 1.2-1.2 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9.6 19.6c.6.7 1.4 1.1 2.4 1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpeakButton({
  text,
  label = "Слушать",
  compact = false,
}: {
  text: string;
  label?: string;
  compact?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [talking, setTalking] = useState(false);

  // Синтез есть только в браузере, и проверять его надо после гидратации:
  // на сервере window нет, а разошедшаяся разметка ломает гидратацию.
  useEffect(() => setSupported(speechSupported()), []);
  useEffect(() => () => stopSpeech(), []);

  if (!supported) return null;

  return (
    <button
      type="button"
      className="sov-ear"
      data-compact={compact}
      data-talking={talking}
      aria-label={`${label}: ${text}`}
      onClick={() => {
        speak(text);
        setTalking(true);
        window.setTimeout(() => setTalking(false), 900);
      }}
    >
      <span className="sov-ear__icon">
        <EarIcon size={compact ? 20 : 26} />
      </span>
      <span className="sov-ear__label">{label}</span>
    </button>
  );
}

/**
 * Переключатель «читать всё вслух»: если ребёнок не читает совсем, нажимать
 * ушко на каждом задании утомительно. Выбор хранится на устройстве, потому что
 * он про этот планшет, а не про аккаунт.
 */
export function AutoSpeakToggle({ onChange }: { onChange?: (on: boolean) => void }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setSupported(speechSupported());
    setOn(autoSpeakEnabled());
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      className="sov-ear-toggle"
      data-on={on}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        setAutoSpeak(next);
        if (!next) stopSpeech();
        onChange?.(next);
      }}
    >
      <EarIcon size={18} />
      <span>{on ? "Читаю вслух" : "Читать вслух"}</span>
    </button>
  );
}

/** Автоматическое чтение нового вопроса, если включён режим «читать вслух». */
export function useAutoSpeak(text: string | null | undefined, deps: unknown[] = []) {
  useEffect(() => {
    if (!text) return;
    if (!speechSupported() || !autoSpeakEnabled()) return;
    // Небольшая задержка: иначе синтез стартует до того, как экран отрисован,
    // и ребёнок слышит вопрос раньше, чем видит его.
    const timer = window.setTimeout(() => speak(text), 250);
    return () => {
      window.clearTimeout(timer);
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, ...deps]);
}
