import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { me } from "../lib/api/app.functions";
import { paymentStatus } from "../lib/api/billing.functions";
import { closedHead } from "../lib/seo";

/**
 * Возвращение из кассы.
 *
 * Страница ничего не решает: подписку открывает уведомление банка (см.
 * billing-webhook.server.ts), а сюда человек попадает по адресу, который
 * видно в браузере и можно набрать руками. Поэтому она не верит query, а
 * спрашивает у базы, чем кончился счёт.
 *
 * Уведомление кассы иногда приходит на секунду-другую позже редиректа,
 * поэтому статус pending — не отказ, а «ещё не дошло»: страница
 * переспрашивает, а не объявляет, что денег нет. Ошибиться здесь дорого:
 * «не оплачено» сразу после списания толкает платить второй раз.
 */
export const Route = createFileRoute("/oplata")({
  head: () => closedHead("Оплата, Совёнок"),
  validateSearch: (search: Record<string, unknown>) => ({
    p: typeof search.p === "string" ? search.p : "",
    sboy: search.sboy === "1" || search.sboy === 1,
  }),
  component: PaymentResultPage,
});

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

/** Пятнадцать секунд опроса: дольше ждать перед человеком уже неприлично. */
const TRIES = 15;

type State =
  | { kind: "waiting" }
  | { kind: "paid"; until: string | null }
  | { kind: "failed" }
  | { kind: "refunded" }
  | { kind: "slow" }
  | { kind: "error"; message: string };

function PaymentResultPage() {
  const { p, sboy } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "waiting" });
  const [role, setRole] = useState<string | null>(null);
  const tries = useRef(0);
  /* Секунды ожидания — отдельным состоянием, а не из tries.current:
     ref меняется молча и перерисовку не вызывает, а полосе нужно
     двигаться на глазах. Тикает только пока ждём. */
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    if (state.kind !== "waiting") return;
    const timer = window.setInterval(() => setWaited((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state.kind]);

  useEffect(() => {
    let stopped = false;

    (async () => {
      const account = await me();
      if (!account.user) {
        await navigate({ to: "/vhod" });
        return;
      }
      setRole(account.user.role);
      if (!p) {
        setState({ kind: "error", message: "Не видно, о каком платеже речь" });
        return;
      }

      const ask = async () => {
        if (stopped) return;
        try {
          const result = await paymentStatus({ data: { id: p } });
          if (stopped) return;
          if (result.status === "paid") {
            setState({ kind: "paid", until: result.until });
            return;
          }
          if (result.status === "failed") {
            setState({ kind: "failed" });
            return;
          }
          // Открыть эту страницу по старой ссылке можно и после возврата.
          // «Платёж не прошёл» здесь было бы неправдой: он прошёл, а потом
          // деньги вернули.
          if (result.status === "refunded") {
            setState({ kind: "refunded" });
            return;
          }
          tries.current += 1;
          if (tries.current >= TRIES) {
            setState({ kind: "slow" });
            return;
          }
          setTimeout(ask, 1000);
        } catch (e) {
          if (!stopped) {
            setState({
              kind: "error",
              message: e instanceof Error ? e.message : "Что-то пошло не так",
            });
          }
        }
      };

      // Возврат с адреса неудачи не отменяет опроса: списание могло пройти
      // со второй попытки в самой кассе, и решает всё равно вебхук.
      await ask();
    })();

    return () => {
      stopped = true;
    };
  }, [p, navigate]);

  const home = role === "tutor" ? "/repetitor/podpiska" : "/roditel";

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to={home}>В кабинет</QuietAction>} />
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        {state.kind === "waiting" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Проверяем оплату</h1>
            <p style={{ marginTop: 14, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Банк подтверждает платёж. Это занимает несколько секунд — не закрывайте страницу.
            </p>
            {/* Полоса ожидания.

                Здесь стояли только эти две строки, и экран с деньгами
                выглядел застывшим: написано «не закрывайте страницу», а
                признаков того, что что-то происходит, ноль. Через десяток
                секунд тишины человек обновляет страницу или уходит в банк
                смотреть, списалось ли.

                Полоса честная, а не декоративная: опрос идёт раз в секунду
                и ровно TRIES раз, после чего экран сам переходит в
                «подтверждение задерживается». То есть заполненная полоса
                — это буквально момент, когда сменится текст, а не
                придуманный прогресс. Отсюда и счётчик секунд рядом: он
                работает и с выключенными анимациями. */}
            <div className="sov-wait" role="status" aria-live="polite">
              <div className="sov-wait__track">
                <div
                  className="sov-wait__fill"
                  style={{ width: `${Math.min(100, (waited / TRIES) * 100)}%` }}
                />
              </div>
              <p className="sov-mono sov-wait__count">
                Проверяем… {waited} с из {TRIES}
              </p>
            </div>
          </>
        ) : null}

        {state.kind === "paid" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Оплачено</h1>
            <p style={{ marginTop: 14, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              {/* Точка после даты своя: ru-RU печатает «15 августа 2027 г.»,
                  и вторая точка рядом с сокращением выглядит опечаткой. */}
              {state.until
                ? `Подписка активна до ${DATE.format(new Date(state.until))} `
                : "Подписка активна. "}
              Все темы открыты. Кассовый чек придёт на почту, указанную при оплате.
            </p>
            <div style={{ marginTop: 26 }}>
              <QuietAction to={home}>Вернуться в кабинет</QuietAction>
            </div>
          </>
        ) : null}

        {state.kind === "failed" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Платёж не прошёл</h1>
            <p style={{ marginTop: 14, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Деньги не списаны. Так бывает, если банк не пропустил операцию или на карте не хватило
              средств — попробуйте ещё раз или другой картой.
            </p>
            <div style={{ marginTop: 26 }}>
              <QuietAction to={home}>Вернуться к оплате</QuietAction>
            </div>
          </>
        ) : null}

        {state.kind === "refunded" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Деньги возвращены</h1>
            <p style={{ marginTop: 14, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Возврат по этому счёту проведён, подписка по нему закрыта. Деньги приходят на карту в
              срок до десяти календарных дней — так требует закон о защите прав потребителей.
            </p>
            <div style={{ marginTop: 26 }}>
              <QuietAction to={home}>В кабинет</QuietAction>
            </div>
          </>
        ) : null}

        {state.kind === "slow" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Подтверждение задерживается</h1>
            <p style={{ marginTop: 14, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              {sboy
                ? "Похоже, платёж не прошёл, но окончательный ответ банка ещё не пришёл. "
                : "Банк ещё не подтвердил платёж. "}
              Если деньги списались, подписка включится сама в течение нескольких минут — платить
              второй раз не нужно. Загляните в кабинет чуть позже.
            </p>
            <div style={{ marginTop: 26 }}>
              <QuietAction to={home}>В кабинет</QuietAction>
            </div>
          </>
        ) : null}

        {state.kind === "error" ? (
          <>
            <h1 style={{ fontSize: "var(--sov-t-h1)" }}>Не получилось проверить</h1>
            <div className="sov-alert" style={{ marginTop: 18 }}>
              {state.message}
            </div>
            <div style={{ marginTop: 26 }}>
              <QuietAction to={home}>В кабинет</QuietAction>
            </div>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
