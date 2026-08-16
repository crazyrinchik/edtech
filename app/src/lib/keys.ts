import { useEffect, useRef } from "react";

/**
 * Enter повторяет главное действие экрана.
 *
 * В тренажёрах ребёнок отвечает с клавиатуры: набрал число, нажал Enter —
 * форма проверила ответ. Дальше появляется разбор и кнопка «Дальше», но
 * рука всё ещё на Enter, а поле уже выключено — и нажатие проваливалось
 * в пустоту. Приходилось тянуться к мыши на каждом примере из двадцати.
 *
 * Отсюда правило: пока на экране висит разбор, Enter значит «дальше».
 *
 * Слушаем окно, а не поле: после ответа фокуса нет ни на чём. Внутри
 * поля, кнопки или ссылки не вмешиваемся — там у Enter уже есть смысл,
 * и подменять его нельзя. Повтор при зажатой клавише (e.repeat) тоже
 * пропускаем: иначе зажатый Enter пролистал бы весь тренажёр разом.
 */
export function useEnterAction(active: boolean, action: () => void) {
  const latest = useRef(action);
  latest.current = action;

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat || e.isComposing) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.tagName === "BUTTON" ||
          el.tagName === "A" ||
          el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      latest.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
