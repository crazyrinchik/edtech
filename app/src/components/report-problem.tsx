import { useEffect, useRef, useState } from "react";

import { reportProblem, supportContext } from "../lib/api/feedback.functions";
import { SUPPORT_EMAIL } from "../lib/support";

/*
 * «Сообщить об ошибке» — кнопка в углу и лист с формой.
 *
 * Стоит в __root.tsx, поэтому появляется на каждом экране: и там, где
 * есть подвал, и на четырёх, где его нет, — на занятии, в нулевом уроке,
 * у ученика и в админке. Про поломку в задании родитель узнаёт как раз
 * на занятии, и уводить его оттуда искать адрес поддержки — значит не
 * узнать о поломке никогда.
 *
 * Кнопка намеренно тихая: обводка вместо заливки, кегль подписи, угол
 * экрана. Синий в Совёнке значит «идти дальше», и жалоба на ошибку
 * никак не может выглядеть так же, как «Начать занятие». На узком экране
 * от подписи остаётся значок: место у нижнего края нужно не ей.
 *
 * Обёртки .sov здесь нет: этот класс тянет min-height: 100dvh, и внутри
 * потока страницы он добавил бы пустой экран под подвалом. Цвета и шрифт
 * берутся из переменных :root напрямую (см. brand.css).
 */

type Stage = "form" | "sent" | "throttled";

export function ReportProblem() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [fromAccount, setFromAccount] = useState(false);
  const [trap, setTrap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Открывать модальный лист умеет только сам <dialog>, и только в
  // браузере: showModal() даёт ловушку фокуса, закрытие по Esc и подложку
  // без единой строки нашего кода. На сервере разметка просто рисуется
  // закрытой.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Почта аккаунта спрашивается в момент открытия, а не при загрузке
  // страницы: запрос ради кнопки, которую нажимают раз в месяц, платили бы
  // все остальные.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void supportContext()
      .then((ctx) => {
        if (!alive) return;
        if (ctx.email) {
          setEmail((current) => current || ctx.email!);
          setFromAccount(true);
        }
      })
      .catch(() => {
        // Не узнали почту — не беда: поле останется пустым, а сервер и
        // так подставит адрес аккаунта, если человек вошёл.
      });
    return () => {
      alive = false;
    };
  }, [open]);

  function openSheet() {
    setStage("form");
    setError(null);
    setOpen(true);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await reportProblem({
        data: {
          message,
          replyTo: email.trim(),
          // Адрес страницы берём в браузере: серверная функция знает
          // только собственный адрес вызова, а нужен тот экран, на
          // котором человек стоял.
          page: window.location.href,
          trap,
        },
      });
      // Дошло ли письмо до почтового сервиса, человеку знать незачем:
      // обращение в любом случае лежит в таблице, и отвечаем мы по ней.
      setStage(res.throttled ? "throttled" : "sent");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось отправить. Попробуйте ещё раз");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="sov-report">
      {/* Имя кнопки задано явно: на телефоне подпись убрана из раскладки
          (display: none), а вместе с ней исчезла бы и из дерева
          доступности — экранный диктор прочитал бы «кнопка». */}
      <button
        type="button"
        className="sov-report__open"
        aria-label="Сообщить об ошибке"
        onClick={openSheet}
      >
        {/* Значок — восклицательный знак в кружке, не «жучок»: жука в
            интерфейсе для младших классов приходится объяснять, а знак
            понятен и ребёнку, и взрослому. */}
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 5.6v5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="10" cy="13.9" r="1" fill="currentColor" />
        </svg>
        <span className="sov-report__label">Сообщить об ошибке</span>
      </button>

      <dialog
        ref={dialogRef}
        className="sov-report__sheet"
        aria-labelledby="sov-report-title"
        onClose={() => setOpen(false)}
        // Щелчок по подложке — это щелчок по самому <dialog>: у формы
        // внутри своя площадь, и её нажатия сюда не долетают.
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        {stage === "form" ? (
          <form className="sov-form" onSubmit={onSubmit}>
            {/* Пояснения под заголовком нет намеренно: подпись под полем
                уже говорит, что писать, а «мы приложим адрес страницы»
                человеку в этот момент неинтересно — он пришёл пожаловаться,
                а не читать. */}
            <h2 id="sov-report-title">Что-то сломалось?</h2>
            {error ? <div className="sov-alert">{error}</div> : null}
            <div className="sov-field">
              <label htmlFor="sov-report-message">Что произошло</label>
              <textarea
                id="sov-report-message"
                name="message"
                rows={4}
                required
                minLength={10}
                maxLength={2000}
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <span className="sov-field__hint">
                Например: «в умножении кнопка „Проверить“ не работает». Пароль писать не нужно.
              </span>
            </div>
            <div className="sov-field">
              <label htmlFor="sov-report-email">Почта для ответа</label>
              <input
                id="sov-report-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFromAccount(false);
                }}
              />
              <span className="sov-field__hint">
                {fromAccount
                  ? "Почта аккаунта — ответим на неё. Можно заменить."
                  : "Не обязательно, но без адреса ответить будет некуда."}
              </span>
            </div>
            {/* Ловушка для роботов: человек этого поля не видит и не
                достанет его табуляцией, а автозаполнялка робота — заполнит.
                Спрятано в CSS, а не hidden: часть роботов пропускает поля,
                у которых выставлен hidden. */}
            <div className="sov-report__trap" aria-hidden="true">
              <label htmlFor="sov-report-company">Организация</label>
              <input
                id="sov-report-company"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
              />
            </div>
            <div className="sov-report__actions">
              <button type="button" className="sov-act-ghost" onClick={() => setOpen(false)}>
                Закрыть
              </button>
              <button type="submit" className="sov-act-form" disabled={pending}>
                {pending ? "Секунду…" : "Отправить"}
              </button>
            </div>
          </form>
        ) : (
          <div className="sov-report__done">
            <h2 id="sov-report-title">
              {stage === "throttled"
                ? "Мы уже получили ваши сообщения"
                : "Спасибо за Ваше обращение!"}
            </h2>
            {stage === "sent" ? (
              <p>Обращение ушло. Если вы оставили почту, ответим на неё — обычно в течение дня.</p>
            ) : null}
            {stage === "throttled" ? (
              <p>
                За последний час с этого устройства пришло уже несколько обращений, и все они у нас.
                Если нужно добавить что-то ещё прямо сейчас — напишите на{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            ) : null}
            <div className="sov-report__actions">
              <button type="button" className="sov-act-form" onClick={() => setOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
