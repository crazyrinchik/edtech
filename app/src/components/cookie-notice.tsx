import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { isCountedPath } from "../lib/metrika";

/*
 * Уведомление об использовании файлов cookie.
 *
 * Информирует, а не спрашивает: у аналитики основание — законный интерес
 * Оператора (строка 9 таблицы политики), а не согласие, поэтому кнопки
 * «отклонить» здесь нет и счётчик не ждёт нажатия. Если юрист решит, что
 * основанием должно быть согласие, эта карточка станет воротами: счётчик
 * нельзя будет заводить до нажатия, а к «Хорошо» добавится отказ. Менять
 * придётся два места — здесь и COUNTED_PATHS в lib/metrika.ts.
 *
 * Показывается там же, где работает счётчик. Это не совпадение и не экономия:
 * в кабинете и на занятии из cookie остаются только технически необходимые —
 * сессия и выбранный профиль, — про которые предупреждать нечего, а взрослый
 * принял политику ещё при регистрации. Заодно карточка не выскакивает посреди
 * занятия ребёнка: ему этот текст не адресован и прочитать его он не может.
 *
 * Отметка о закрытии лежит в localStorage, а не в cookie. Это осознанно:
 * новая кука потребовала бы новой строки в пункте 9.1 политики — то есть
 * предупреждения о cookie, заведённой ради предупреждения о cookie.
 *
 * На сервере карточка не рисуется вовсе (showing стартует с false): иначе
 * человек, который её уже закрыл, каждый раз ловил бы вспышку баннера до
 * гидратации.
 */

const STORAGE_KEY = "sov_cookie_notice";

export function CookieNotice() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (!isCountedPath(pathname)) {
      setShowing(false);
      return;
    }
    // Приватное окно и запрет на хранение данных сайта бросают исключение на
    // самом обращении к localStorage — не на чтении значения. Без перехвата
    // падал бы весь корневой компонент, то есть страница целиком.
    try {
      setShowing(window.localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setShowing(true);
    }
  }, [pathname]);

  if (!showing) return null;

  function accept() {
    setShowing(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Не запомнить отметку неприятно, но не смертельно: карточка вернётся
      // на следующей странице. Ронять из-за этого экран точно не стоит.
    }
  }

  return (
    <aside className="sov-cookie" role="region" aria-label="Файлы cookie">
      <p className="sov-cookie__text">
        Мы используем файлы cookie, чтобы работал вход в аккаунт и чтобы видеть, какими страницами
        пользуются посетители. Подробности —{" "}
        {/* Обычный <a>, а не Link: как и в подвале, юридические страницы
            должны открываться и тогда, когда роутер по какой-то причине не
            поднялся. */}
        <a href="/politika">в политике персональных данных</a>.
      </p>
      <button type="button" className="sov-cookie__ok" onClick={accept}>
        Хорошо
      </button>
    </aside>
  );
}
