/*
 * Настройки тренажёров глазами того, кто их задаёт.
 *
 * Внутри каждого тренажёра есть экран настройки: разрядность в устном счёте,
 * уровень таблицы, набор правил, скорость чтения, размер таблицы Шульте.
 * Пока задать тренажёр можно было только целиком, педагог просил ребёнка
 * «поставь двузначные и без таймера» словами — и это не выполнялось.
 *
 * Здесь тот же набор описан данными: форма выдачи рисуется по нему сама, а
 * выбранное уезжает ученику в адресе тренажёра. Значения — строки, потому
 * что тем же видом они лежат в базе и в строке запроса; разбирает их сам
 * тренажёр, он же остаётся единственным местом, где написано, что значит
 * «двузначные».
 *
 * fallback — то, что стоит в тренажёре без всяких заданий. Он не уходит в
 * адрес: пустая настройка и настройка «как по умолчанию» должны выглядеть
 * одинаково, иначе ссылка распухает на ровном месте.
 */

import { SPELLING_RULES } from "./content/spelling";

export type DrillId = "schet" | "tablica" | "pravopisanie" | "chtenie" | "shulte";

export type DrillOption = {
  /** Ключ в адресе тренажёра. */
  key: string;
  label: string;
  /** Можно отметить несколько значений: они уедут через запятую. */
  multi: boolean;
  values: { value: string; label: string }[];
  fallback: string;
};

export type DrillSettings = Record<string, string>;

const COUNTS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "30", label: "30" },
];

export const DRILL_OPTIONS: Record<DrillId, DrillOption[]> = {
  schet: [
    {
      key: "digits",
      label: "Числа",
      multi: false,
      values: [
        { value: "1", label: "однозначные" },
        { value: "2", label: "двузначные" },
        { value: "3", label: "трёхзначные" },
      ],
      fallback: "1",
    },
    {
      key: "ops",
      label: "Действия",
      multi: true,
      values: [
        { value: "add", label: "+ сложение" },
        { value: "sub", label: "− вычитание" },
        { value: "mul", label: "× умножение" },
        { value: "div", label: "÷ деление" },
      ],
      fallback: "add,sub",
    },
    {
      key: "limit",
      label: "Время на ответ",
      multi: false,
      values: [
        { value: "5", label: "5 сек" },
        { value: "10", label: "10 сек" },
        { value: "15", label: "15 сек" },
        { value: "20", label: "20 сек" },
        { value: "0", label: "без таймера" },
      ],
      fallback: "10",
    },
    { key: "count", label: "Сколько примеров", multi: false, values: COUNTS, fallback: "10" },
  ],
  tablica: [
    {
      key: "level",
      label: "Докуда",
      multi: false,
      values: [
        { value: "ten", label: "До 10" },
        { value: "hundred", label: "До 100" },
        { value: "beyond", label: "Дальше" },
      ],
      fallback: "hundred",
    },
    {
      key: "dirs",
      label: "Что спрашивать",
      multi: true,
      values: [
        { value: "mul", label: "Умножение" },
        { value: "div", label: "Деление" },
        { value: "factor", label: "Найти множитель" },
      ],
      fallback: "mul,div",
    },
    { key: "count", label: "Сколько примеров", multi: false, values: COUNTS, fallback: "10" },
  ],
  pravopisanie: [
    {
      key: "rules",
      label: "Правила",
      multi: true,
      // Список правил берётся из самого банка слов, а не переписывается сюда
      // руками: правило, которого нет в банке, задать всё равно нельзя.
      values: SPELLING_RULES.map((rule) => ({ value: rule.id, label: rule.title })),
      fallback: SPELLING_RULES.map((rule) => rule.id).join(","),
    },
    { key: "count", label: "Сколько слов", multi: false, values: COUNTS, fallback: "10" },
  ],
  chtenie: [
    {
      key: "wpm",
      label: "Скорость",
      multi: false,
      values: [60, 80, 120, 160, 200].map((s) => ({ value: String(s), label: `${s} сл/мин` })),
      fallback: "80",
    },
    // Текст ребёнок выбирает сам: их список зависит от подписки и приезжает
    // с сервера, а «прочитай именно про маяк» — не то, ради чего задают
    // скорочтение.
  ],
  shulte: [
    {
      key: "size",
      label: "Размер",
      multi: false,
      values: [3, 4, 5].map((n) => ({ value: String(n), label: `${n} × ${n}` })),
      fallback: "3",
    },
  ],
};

/** Настройки тренажёра по умолчанию — с них открывается форма выдачи. */
export function defaultDrillSettings(id: DrillId): DrillSettings {
  return Object.fromEntries(DRILL_OPTIONS[id].map((o) => [o.key, o.fallback]));
}

/**
 * Что из выбранного стоит везти ученику.
 *
 * Значения, совпавшие с настройкой тренажёра по умолчанию, отбрасываются:
 * задание без настроек и задание «всё как обычно» — это одно и то же, и
 * хранить между ними разницу незачем.
 */
export function trimDrillSettings(id: DrillId, settings: DrillSettings): DrillSettings | null {
  const out: DrillSettings = {};
  for (const option of DRILL_OPTIONS[id]) {
    const value = settings[option.key];
    if (value === undefined || value === "" || value === option.fallback) continue;
    out[option.key] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** Короткая строка «двузначные · без таймера · 20» для карточки задания. */
export function describeDrillSettings(id: DrillId, settings: DrillSettings | null): string | null {
  if (!settings) return null;
  const parts: string[] = [];
  for (const option of DRILL_OPTIONS[id]) {
    const value = settings[option.key];
    if (value === undefined || value === option.fallback) continue;
    const labels = value
      .split(",")
      .map((v) => option.values.find((o) => o.value === v)?.label ?? v)
      .join(", ");
    parts.push(labels);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Есть ли у тренажёра что настраивать. Пригодится, когда список пополнится. */
export function isDrillId(value: string): value is DrillId {
  return value in DRILL_OPTIONS;
}

/**
 * Перечень настроек словами: «числа, действия, время на ответ, сколько
 * примеров». Нужен в списке тренажёров у педагога — по одним названиям не
 * видно, что «Задать» открывает форму, а не выдаёт тренажёр целиком.
 *
 * Собирается из тех же DRILL_OPTIONS, по которым рисуется сама форма,
 * поэтому разойтись с ней не может. Первая буква не поднимается: строка
 * идёт после «Настроите:» и продолжает фразу.
 */
export function drillTuneSummary(id: DrillId): string {
  return DRILL_OPTIONS[id].map((option) => option.label.toLowerCase()).join(", ");
}
