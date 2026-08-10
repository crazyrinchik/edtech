import { Link } from "@tanstack/react-router";

import { Wordmark } from "./brand";
import { AbacusIcon, BookIcon, GridIcon, MultiplyIcon, PencilIcon } from "./icons";

/*
 * Тренажёры в одном списке.
 *
 * Их пять, и каждый открыт без аккаунта. Пока их было два, шапка с
 * перекрёстными ссылками писалась в каждом тренажёре руками, и списки
 * разъезжались: из счёта была видна Шульте, из Шульте — не всё. Список
 * живёт здесь, а шапка сама показывает остальные.
 */

export type TrainerId = "schet" | "tablica" | "pravopisanie" | "chtenie" | "shulte";

/*
 * Иконка у тренажёра — компонент, а не эмодзи. Причина та же, по которой
 * иконки гарантий на витрине нарисованы руками: системные эмодзи приходят
 * цветными и разными на каждой платформе, и рядом с акварельным совёнком
 * это видно сразу. Заодно ✖️ и ✍️ на части Android рисуются в чёрно-белом
 * начертании и просто теряются на бумаге.
 */
export const TRAINERS = [
  {
    id: "schet",
    to: "/schet",
    Icon: AbacusIcon,
    title: "Устный счёт",
    blurb: "Примеры на время, скорость и точность",
  },
  {
    id: "tablica",
    to: "/tablica-umnozheniya",
    Icon: MultiplyIcon,
    title: "Таблица умножения",
    blurb: "В обе стороны, с таблицей под рукой",
  },
  {
    id: "pravopisanie",
    to: "/pravopisanie",
    Icon: PencilIcon,
    title: "Правописание",
    blurb: "Буква в слове и правило рядом с ней",
  },
  {
    id: "chtenie",
    to: "/chtenie",
    Icon: BookIcon,
    title: "Скорочтение",
    blurb: "Слова по одному и вопросы по тексту",
  },
  {
    id: "shulte",
    to: "/shulte",
    Icon: GridIcon,
    title: "Таблица Шульте",
    blurb: "Найти числа по порядку, тренируя поле зрения",
  },
] as const satisfies readonly {
  id: TrainerId;
  to: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  title: string;
  blurb: string;
}[];

/**
 * Шапка тренажёра: логотип и переходы в остальные.
 *
 * Полных названий пять, в строку они не встают, поэтому соседи подписаны
 * коротко — «Умножение», «Правописание». Ссылка на занятия стоит последней:
 * из тренажёра выходят реже, чем переходят в соседний.
 */
export function TrainerTop({ current }: { current: TrainerId }) {
  return (
    <div className="sov-demo__top">
      <Wordmark compact />
      <div className="sov-trainer-nav">
        {TRAINERS.filter((t) => t.id !== current).map((t) => (
          <Link key={t.id} to={t.to} className="sov-act-ghost" style={{ textDecoration: "none" }}>
            {SHORT[t.id]}
          </Link>
        ))}
        <Link to="/uchenik" className="sov-act-ghost" style={{ textDecoration: "none" }}>
          Занятия
        </Link>
      </div>
    </div>
  );
}

/** Короткие подписи для шапки: полные названия в строку не помещаются. */
const SHORT: Record<TrainerId, string> = {
  schet: "Счёт",
  tablica: "Умножение",
  pravopisanie: "Правописание",
  chtenie: "Скорочтение",
  shulte: "Шульте",
};
