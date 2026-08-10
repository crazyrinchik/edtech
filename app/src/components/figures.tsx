import type { ReactNode } from "react";

/**
 * Фигуры: кольца, полосы, столбики, камешки.
 *
 * Всё, что раньше объяснялось абзацем под заголовком. Правило у файла
 * одно: фигура показывает величину и её порог, а подпись рядом — одна
 * строка. Если фигуре нужен объясняющий абзац, значит она нарисована
 * плохо и её надо переделать, а не дописать текст.
 *
 * Цвет берётся из общей палитры и значит то же, что везде: синий —
 * сделано, охра — ниже порога зачёта, зелёный — верный ответ.
 */

/** Порог зачёта темы. Тот же, что проверяет finishTopic на сервере. */
export const PASS_PERCENT = 70;

const DAY_LABELS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/**
 * Раскладка меток времени по семи календарным дням, заканчивая сегодня.
 *
 * Считается на клиенте намеренно: сервер отдаёт занятия строками, потому
 * что часового пояса ребёнка у него нет. Занятие в девять вечера по
 * Москве на сервере в UTC попало бы во «вчера», и полоска недели врала бы
 * ровно тем детям, которые занимаются перед сном.
 */
export function weekBuckets<T>(rows: T[], at: (row: T) => string) {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const slot = new Map(days.map((d, i) => [dayKey(d), i]));
  const buckets: T[][] = days.map(() => []);
  for (const row of rows) {
    const i = slot.get(dayKey(new Date(at(row))));
    if (i !== undefined) buckets[i].push(row);
  }
  return days.map((date, i) => ({
    date,
    label: DAY_LABELS[date.getDay()],
    rows: buckets[i],
    today: i === 6,
  }));
}

/**
 * Кольцо с засечкой порога.
 *
 * Засечка — главное здесь. «82%» отвечает на вопрос «сколько», а родитель
 * и ребёнок спрашивают «хватило ли»; чёрточка на семидесяти процентах
 * отвечает на второй вопрос без единого слова.
 */
export function Ring({
  value,
  size = 120,
  threshold,
  tone,
  hole,
  caption,
  label,
  children,
}: {
  value: number;
  size?: number;
  /** Проценты, на которых стоит засечка. Без него кольцо просто доля. */
  threshold?: number;
  tone?: "warn" | "ok";
  /** Цвет дырки: кольцо на цветной подложке иначе светится белым. */
  hole?: string;
  /** Мелкая подпись под числом внутри кольца. */
  caption?: string;
  /** Что читает скринридер вместо картинки. */
  label: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`sov-ring${tone ? ` sov-ring--${tone}` : ""}`}
      role="img"
      aria-label={label}
      style={
        {
          "--sov-ring-size": `${size}px`,
          "--sov-ring-value": `${Math.max(0, Math.min(100, value))}%`,
          "--sov-ring-font": `${Math.max(0.8, size / 88).toFixed(2)}rem`,
          ...(hole ? { "--sov-ring-hole": hole } : {}),
        } as React.CSSProperties
      }
    >
      {threshold !== undefined ? (
        <span
          className="sov-ring__mark"
          aria-hidden="true"
          style={{ "--sov-ring-mark": `${threshold * 3.6}deg` } as React.CSSProperties}
        />
      ) : null}
      <span className="sov-ring__mid">
        <b>{children ?? `${value}%`}</b>
        {caption ? <span>{caption}</span> : null}
      </span>
    </div>
  );
}

export type StoneState = "right" | "wrong" | "now" | "next";

/**
 * Камешки заданий: по одному на вопрос.
 *
 * Заменяют строку «9 из 11». Ребёнок видит не только счёт, но и место
 * ошибки, а по клику возвращается к разбору — раньше перечитать разбор
 * можно было только шагом назад по одному вопросу.
 */
export function Stones({
  items,
  small = false,
  onPick,
}: {
  items: { state: StoneState; label: string }[];
  small?: boolean;
  onPick?: (index: number) => void;
}) {
  const title = (state: StoneState) =>
    state === "right" ? "верно" : state === "wrong" ? "ошибка" : state === "now" ? "сейчас" : "ещё не открыт";
  return (
    <div className={`sov-stones${small ? " sov-stones--sm" : ""}`}>
      {items.map((item, i) =>
        onPick ? (
          <button
            key={i}
            type="button"
            className="sov-stone"
            data-state={item.state}
            disabled={item.state === "next"}
            aria-label={`Задание ${item.label}: ${title(item.state)}`}
            onClick={() => onPick(i)}
          >
            {item.label}
          </button>
        ) : (
          <span key={i} className="sov-stone" data-state={item.state} title={title(item.state)}>
            {item.label}
          </span>
        ),
      )}
    </div>
  );
}

/** Подпись к камешкам. Читается один раз, поэтому стоит под рядом. */
export function StonesLegend({ hint }: { hint?: string }) {
  return (
    <p className="sov-legend">
      <span>
        <i data-state="right" aria-hidden="true" />
        верно
      </span>
      <span>
        <i data-state="wrong" aria-hidden="true" />
        ошибка{hint ? ` — ${hint}` : ""}
      </span>
    </p>
  );
}

/**
 * Минуты по дням со средней линией.
 *
 * Одно число «96 минут за неделю» не отличает ребёнка, который занимался
 * каждый день по четверти часа, от того, кто всё сделал в воскресенье.
 * Родителю важна именно эта разница.
 */
export function DayBars({ days }: { days: { label: string; minutes: number; today: boolean }[] }) {
  const top = Math.max(10, ...days.map((d) => d.minutes));
  const avg = days.reduce((sum, d) => sum + d.minutes, 0) / (days.length || 1);
  const height = 74;
  return (
    <div
      className="sov-days"
      role="img"
      aria-label={`Минуты по дням: ${days.map((d) => `${d.label} ${d.minutes}`).join(", ")}`}
    >
      {avg > 0 ? (
        <span className="sov-days__avg" aria-hidden="true" style={{ bottom: `${(avg / top) * height + 22}px` }} />
      ) : null}
      {days.map((day) => (
        <span key={day.label} className="sov-day-bar" data-hi={day.minutes >= avg && day.minutes > 0} data-zero={day.minutes === 0}>
          <i style={{ height: `${day.minutes ? Math.max(6, (day.minutes / top) * height) : 4}px` }} />
          <u>{day.label}</u>
        </span>
      ))}
    </div>
  );
}

/**
 * Неделя кружками: занимался — синий, пропустил — бумажный.
 * Стоит в шапке у ребёнка: пропущенный день он замечает сам.
 */
export function WeekStrip({
  days,
  showLabels = true,
}: {
  days: { label: string; count: number; today: boolean }[];
  showLabels?: boolean;
}) {
  return (
    <div
      className="sov-week"
      role="img"
      aria-label={`Занятия за неделю: ${days.map((d) => `${d.label} ${d.count}`).join(", ")}`}
    >
      {days.map((day) => (
        <span key={day.label} className="sov-week__day" data-on={day.count > 0} data-today={day.today}>
          <i>{day.count > 0 ? (day.count > 1 ? day.count : "✓") : day.today ? "?" : ""}</i>
          {showLabels ? <u>{day.label}</u> : null}
        </span>
      ))}
    </div>
  );
}

/**
 * Полоса освоения темы с засечкой порога. Ниже порога уходит в охру —
 * тот же цвет, которым отмечен неверный ответ в разборе.
 */
export function Bar({
  percent,
  threshold = true,
  label,
}: {
  percent: number;
  threshold?: boolean;
  label?: string;
}) {
  return (
    <span
      className={`sov-bar${threshold ? "" : " sov-bar--plain"}`}
      data-risk={threshold && percent < PASS_PERCENT}
      role="img"
      aria-label={label ?? `${percent}% верных`}
    >
      <i style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </span>
  );
}

/**
 * Спарклайн заходов тренажёра.
 *
 * В таблице «4 захода, 64% верных» падение не видно: там одно среднее за
 * всё время. Линия показывает направление, а стрелка рядом — насколько.
 */
export function Spark({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = 196 / (points.length - 1);
  const y = (v: number) => 44 - ((v - min) / span) * 36;
  const down = points[points.length - 1] < points[0];
  const stroke = down ? "var(--sov-warn)" : "var(--sov-cobalt)";
  return (
    <svg className="sov-spark" viewBox="0 0 200 52" preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline
        points={points.map((v, i) => `${(i * step + 2).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={(points.length - 1) * step + 2} cy={y(points[points.length - 1])} r="5" fill={stroke} />
    </svg>
  );
}

/** Стрелка «стало лучше / стало хуже». Без «было» число ни о чём. */
export function Delta({ value, unit = "" }: { value: number; unit?: string }) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  return (
    <span className="sov-delta" data-dir={dir}>
      {dir === "up" ? "▲" : dir === "down" ? "▼" : "="} {Math.abs(value)}
      {unit}
    </span>
  );
}
