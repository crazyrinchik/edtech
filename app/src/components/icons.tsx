import type { ReactNode } from "react";

/**
 * Иконки интерфейса.
 *
 * Тот же язык, что у иконок гарантий на витрине: viewBox 24, обводка 2,
 * скругления на концах, цвет наследуется через currentColor. Своя графика
 * здесь не прихоть — системные эмодзи приходят цветными и разными на каждой
 * платформе: 🧮 на Android и на iOS это два разных рисунка, и оба выпадают
 * из акварельной графики сайта. Раз уж витрина рисует иконки руками, детский
 * экран и кабинет репетитора не могут делать иначе.
 */
function icon(paths: ReactNode, size: number) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

/** Счёты: рама и костяшки на трёх спицах. */
export function AbacusIcon({ size = 24 }: { size?: number }) {
  return icon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M3 9h18M3 15h18" />
      <circle cx="8" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </>,
    size,
  );
}

/** Таблица Шульте: сетка, по которой глаз ищет числа по порядку. */
export function GridIcon({ size = 24 }: { size?: number }) {
  return icon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </>,
    size,
  );
}

/** Раскрытая книга: два разворота и корешок между ними. */
export function BookIcon({ size = 24 }: { size?: number }) {
  return icon(
    <>
      <path d="M12 6.6C10.4 5.1 7.9 4.6 4 4.9v13c3.9-.3 6.4.2 8 1.7 1.6-1.5 4.1-2 8-1.7v-13c-3.9-.3-6.4.2-8 1.7Z" />
      <path d="M12 6.6V19.6" />
    </>,
    size,
  );
}

/** Таблица умножения: знак действия в рамке клетки. */
export function MultiplyIcon({ size = 24 }: { size?: number }) {
  return icon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="m8.8 8.8 6.4 6.4M15.2 8.8l-6.4 6.4" />
    </>,
    size,
  );
}

/** Правописание: карандаш над строкой. */
export function PencilIcon({ size = 24 }: { size?: number }) {
  return icon(
    <>
      <path d="M14.7 4.7a2 2 0 0 1 2.8 0l1.8 1.8a2 2 0 0 1 0 2.8l-8.4 8.4-4.4 1.6 1.6-4.4Z" />
      <path d="M4 21h16" />
    </>,
    size,
  );
}

/** Лупа для поиска по темам. */
export function SearchIcon({ size = 18 }: { size?: number }) {
  return icon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>,
    size,
  );
}

/**
 * Глаз у поля пароля: открытый — пароль виден, перечёркнутый — скрыт.
 *
 * Иконка отвечает за текущее состояние, а не за действие: так её читают
 * и в банковских приложениях, и в почте, откуда родитель приходит с этой
 * привычкой. Подпись для читающих с экрана живёт на самой кнопке.
 */
export function EyeIcon({ size = 20, off = false }: { size?: number; off?: boolean }) {
  return icon(
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 20 20 4" /> : null}
    </>,
    size,
  );
}
