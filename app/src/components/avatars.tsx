/**
 * Лица профилей.
 *
 * Раньше это были эмодзи. Фотографий у нас нет и не будет — о ребёнке
 * хранятся только имя, класс и ответы, — поэтому лицо профиля рисуется
 * зверьком: его ребёнок узнаёт раньше, чем прочитает своё имя. Но эмодзи
 * для этого не годятся: 🦊 на Android, на iOS и на Windows — три разных
 * зверя, и ни один не похож на акварельного совёнка из шапки. Ребёнок
 * выбирает аватар один раз и потом ищет его глазами; он должен выглядеть
 * одинаково на планшете дома и на ноутбуке у репетитора.
 *
 * Рисунок плоский, как и всё остальное: заливки без градиентов, черты
 * одним тёмным цветом. Фон-кружок даёт .sov-avatar, здесь только зверь.
 */

/** Общий тёмный цвет черт: тот же, что чернила интерфейса. */
const INK = "#2b3350";
/** Клюв и нос — единственная тёплая нота, одна на всех. */
const BEAK = "#e8a33d";

function Face({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {children}
    </svg>
  );
}

function Owl({ size }: { size: number }) {
  return (
    <Face size={size}>
      <path d="M6.4 7.6 6.9 3.4 10.6 6.3Z" fill="#5b74c4" />
      <path d="M17.6 7.6 17.1 3.4 13.4 6.3Z" fill="#5b74c4" />
      <circle cx="12" cy="13.2" r="7.6" fill="#5b74c4" />
      <circle cx="9.3" cy="12.2" r="2.6" fill="#fdfbf6" />
      <circle cx="14.7" cy="12.2" r="2.6" fill="#fdfbf6" />
      <circle cx="9.3" cy="12.2" r="1.15" fill={INK} />
      <circle cx="14.7" cy="12.2" r="1.15" fill={INK} />
      <path d="M12 13.8 13.3 15.9h-2.6Z" fill={BEAK} />
    </Face>
  );
}

function Fox({ size }: { size: number }) {
  return (
    <Face size={size}>
      <path d="M5.6 9.4 6.3 3.9 10.7 6.7Z" fill="#e08a4a" />
      <path d="M18.4 9.4 17.7 3.9 13.3 6.7Z" fill="#e08a4a" />
      <circle cx="12" cy="13.2" r="7.4" fill="#e08a4a" />
      <ellipse cx="12" cy="15.6" rx="4.2" ry="3.7" fill="#fdfbf6" />
      <circle cx="9.4" cy="11.9" r="1.15" fill={INK} />
      <circle cx="14.6" cy="11.9" r="1.15" fill={INK} />
      <ellipse cx="12" cy="14.5" rx="1.2" ry="1" fill={INK} />
    </Face>
  );
}

function Bear({ size }: { size: number }) {
  return (
    <Face size={size}>
      <circle cx="6.7" cy="7.4" r="2.7" fill="#a9825e" />
      <circle cx="17.3" cy="7.4" r="2.7" fill="#a9825e" />
      <circle cx="12" cy="13.4" r="7.4" fill="#a9825e" />
      <ellipse cx="12" cy="15.7" rx="3.9" ry="3.1" fill="#e8d5bd" />
      <circle cx="9.5" cy="12.2" r="1.1" fill={INK} />
      <circle cx="14.5" cy="12.2" r="1.1" fill={INK} />
      <ellipse cx="12" cy="14.6" rx="1.25" ry="1" fill={INK} />
    </Face>
  );
}

function Hare({ size }: { size: number }) {
  return (
    <Face size={size}>
      <ellipse cx="9.1" cy="5.8" rx="1.9" ry="4.3" fill="#c0a9d4" transform="rotate(-12 9.1 5.8)" />
      <ellipse
        cx="14.9"
        cy="5.8"
        rx="1.9"
        ry="4.3"
        fill="#c0a9d4"
        transform="rotate(12 14.9 5.8)"
      />
      <ellipse cx="9.1" cy="6.2" rx=".85" ry="2.6" fill="#efe4f6" transform="rotate(-12 9.1 6.2)" />
      <ellipse
        cx="14.9"
        cy="6.2"
        rx=".85"
        ry="2.6"
        fill="#efe4f6"
        transform="rotate(12 14.9 6.2)"
      />
      <circle cx="12" cy="14.4" r="7" fill="#c0a9d4" />
      <circle cx="9.6" cy="13.4" r="1.1" fill={INK} />
      <circle cx="14.4" cy="13.4" r="1.1" fill={INK} />
      <path d="M12 15.4 13 16.6h-2Z" fill={INK} />
    </Face>
  );
}

function Cat({ size }: { size: number }) {
  return (
    <Face size={size}>
      <path d="M6 9.8 6.4 4.7 10.8 7.4Z" fill="#e59aa8" />
      <path d="M18 9.8 17.6 4.7 13.2 7.4Z" fill="#e59aa8" />
      <circle cx="12" cy="13.4" r="7.4" fill="#e59aa8" />
      <circle cx="9.4" cy="12.4" r="1.15" fill={INK} />
      <circle cx="14.6" cy="12.4" r="1.15" fill={INK} />
      <path d="M12 14.6 13 15.7h-2Z" fill={INK} />
      <path
        d="M5.6 14.2h2.4M5.8 16.2 8.1 15.6M18.4 14.2h-2.4M18.2 16.2 15.9 15.6"
        stroke={INK}
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />
    </Face>
  );
}

function Panda({ size }: { size: number }) {
  return (
    <Face size={size}>
      <circle cx="6.7" cy="7.2" r="2.6" fill={INK} />
      <circle cx="17.3" cy="7.2" r="2.6" fill={INK} />
      {/* Голова панды белая, а кружок под ней светло-серый: без обводки
          морда растворялась в фоне и оставались висеть одни глаза. */}
      <circle cx="12" cy="13.4" r="7.4" fill="#fdfbf6" stroke="#c3cad6" strokeWidth="0.7" />
      <ellipse cx="9.2" cy="12.4" rx="2.1" ry="2.5" fill={INK} transform="rotate(-14 9.2 12.4)" />
      <ellipse cx="14.8" cy="12.4" rx="2.1" ry="2.5" fill={INK} transform="rotate(14 14.8 12.4)" />
      <circle cx="9.2" cy="12.4" r=".85" fill="#fdfbf6" />
      <circle cx="14.8" cy="12.4" r=".85" fill="#fdfbf6" />
      <ellipse cx="12" cy="15.8" rx="1.3" ry="1" fill={INK} />
    </Face>
  );
}

function Frog({ size }: { size: number }) {
  return (
    <Face size={size}>
      <circle cx="8.2" cy="8.6" r="3" fill="#6bbf72" />
      <circle cx="15.8" cy="8.6" r="3" fill="#6bbf72" />
      <ellipse cx="12" cy="15" rx="7.6" ry="6.2" fill="#6bbf72" />
      <circle cx="8.2" cy="8.4" r="1.6" fill="#fdfbf6" />
      <circle cx="15.8" cy="8.4" r="1.6" fill="#fdfbf6" />
      <circle cx="8.2" cy="8.4" r=".9" fill={INK} />
      <circle cx="15.8" cy="8.4" r=".9" fill={INK} />
      <path
        d="M8.2 15.6q3.8 2.8 7.6 0"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </Face>
  );
}

function Penguin({ size }: { size: number }) {
  return (
    <Face size={size}>
      <circle cx="12" cy="13.2" r="7.5" fill="#4a6f96" />
      <ellipse cx="12" cy="14.4" rx="4.9" ry="5.2" fill="#fdfbf6" />
      <circle cx="9.9" cy="12.1" r="1.1" fill={INK} />
      <circle cx="14.1" cy="12.1" r="1.1" fill={INK} />
      <path d="M10.2 14.6h3.6L12 16.9Z" fill={BEAK} />
    </Face>
  );
}

/** Ключ аватара -> рисунок. Незнакомый ключ отдаёт совёнка. */
const FACES: Record<string, (p: { size: number }) => React.ReactElement> = {
  owl: Owl,
  fox: Fox,
  bear: Bear,
  hare: Hare,
  cat: Cat,
  panda: Panda,
  frog: Frog,
  penguin: Penguin,
};

/**
 * Наружу — один компонент, а не словарь компонентов: файл, который
 * экспортирует и то и другое, ломает горячую перезагрузку в разработке.
 */
export function AvatarFace({ avatar, size }: { avatar: string; size: number }) {
  const Face = FACES[avatar] ?? Owl;
  return <Face size={size} />;
}
