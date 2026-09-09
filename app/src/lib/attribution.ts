/**
 * Откуда пришёл взрослый, который завёл аккаунт.
 *
 * Директ считает клики и регистрации сам, но дальше его данные обрываются:
 * страница оплаты и кабинеты вне счётчика (п. 9.3 политики), и связать
 * кампанию с деньгами в отчётах Метрики нельзя. Поэтому метку объявления
 * запоминает сам Совёнок — в своей базе, рядом с учётной записью, и никуда
 * не передаёт.
 *
 * Метка живёт в памяти вкладки, а не в cookie и не в localStorage. Причина
 * не в экономии: реклама приводит человека на посадочную, а регистрируется
 * он через несколько экранов — за это время адрес с метками успевает
 * смениться дважды, и без промежуточного хранения метка теряется. Памяти
 * вкладки для этого достаточно: закрыл вкладку — метки нет, вернулся по
 * новому объявлению — метка новая.
 *
 * Перезаписываем при каждом новом переходе с меткой (последний клик, как
 * считает и сам Директ): если человек пришёл по одному объявлению, ушёл и
 * вернулся по другому, аккаунт должен достаться второму.
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Что забираем из адреса. Только рекламные метки и идентификатор клика
 * Директа — ничего, что человек мог бы ввести сам.
 */
const KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "yclid",
] as const;

export type AdSource = Partial<Record<(typeof KEYS)[number], string>> & { landing?: string };

/** Ключ в памяти вкладки. */
const STORE_KEY = "sov_ad";

/**
 * Предел длины одного значения. Метки Директа укладываются в несколько
 * десятков символов; всё, что длиннее, — либо чужая склейка параметров,
 * либо попытка что-то подсунуть, и в базе такому делать нечего.
 */
const MAX_VALUE = 200;

function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_VALUE);
  return trimmed || undefined;
}

/** Разбор адреса: null, если рекламных меток в нём нет вовсе. */
export function adSourceFromUrl(search: string, pathname: string): AdSource | null {
  const params = new URLSearchParams(search);
  const found: AdSource = {};
  for (const key of KEYS) {
    const value = clean(params.get(key));
    if (value) found[key] = value;
  }
  if (!Object.keys(found).length) return null;
  // Посадочная — путь без параметров: по ней видно, какая страница приняла
  // клик, а знать, с какими настройками открыли тренажёр, здесь незачем.
  found.landing = pathname.slice(0, MAX_VALUE);
  return found;
}

/**
 * Запомнить метку, если она есть в адресе. Молча ничего не делает там, где
 * хранилище недоступно (приватное окно, запрет на данные сайтов): метка —
 * удобство отчёта, а не условие регистрации.
 */
export function rememberAdSource(search: string, pathname: string): void {
  const found = adSourceFromUrl(search, pathname);
  if (!found) return;
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(found));
  } catch {
    /* приватное окно или запрет данных сайта — метки просто не будет */
  }
}

/** Метка текущей вкладки для отправки на сервер; null, если её нет. */
export function currentAdSource(): AdSource | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as AdSource) : null;
  } catch {
    return null;
  }
}

/**
 * Ловит метку и на первой загрузке, и на переходах роутера.
 *
 * Переходы нужны по той же причине, что и Метрике: приложение
 * одностраничное, и адрес меняется без перезагрузки. Реклама, ведущая с
 * метками на тренажёр, иначе осталась бы незамеченной — человек уходит
 * оттуда на страницу для родителей внутренней ссылкой.
 */
export function useAdSourceCapture(): void {
  const router = useRouter();

  useEffect(() => {
    rememberAdSource(window.location.search, window.location.pathname);

    return router.subscribe("onResolved", () => {
      rememberAdSource(window.location.search, window.location.pathname);
    });
  }, [router]);
}
