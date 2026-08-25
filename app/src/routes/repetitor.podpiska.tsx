import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FormAction, Owl, QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { PayForm } from "../components/pay-form";
import { closedHead } from "../lib/seo";
import { plural } from "../lib/shop";
import { FREE_CHILD_LIMIT } from "../lib/billing";
import { deleteAccount, me } from "../lib/api/app.functions";
import {
  tutorCancelSubscription,
  tutorRedeemPromo,
  tutorSubscription,
} from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/podpiska")({
  head: () => closedHead("Подписка, Совёнок"),
  component: TutorBillingPage,
});

type Data = Awaited<ReturnType<typeof tutorSubscription>>;

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

/**
 * Подписка репетитора.
 *
 * Раньше кнопка «Подписка» вела в кабинет родителя, а тот закрыт кодом из
 * четырёх цифр — репетитору предлагали придумать код от чужого кабинета,
 * которым он не пользуется. Свои деньги он должен видеть у себя и без
 * лишних замков.
 *
 * Экран собран из трёх этажей, и порядок у них не случайный: сначала
 * состояние (открыто всё или не всё), потом действие (оплатить, продлить),
 * потом управление (промокод, отмена, удаление). Раньше все три весили
 * одинаково: «Удаление учётной записи» стояло таким же заголовком, как
 * «Продлить», и разбиралось глазами наравне с оплатой.
 */
function TutorBillingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    setData(await tutorSubscription());
  }

  useEffect(() => {
    (async () => {
      const account = await me();
      if (!account.user) {
        await navigate({ to: "/vhod" });
        return;
      }
      if (account.user.role !== "tutor" && account.user.role !== "admin") {
        await navigate({ to: "/roditel" });
        return;
      }
      load().catch((e) => setError(e instanceof Error ? e.message : "Не удалось открыть подписку"));
    })();
  }, [navigate]);

  return (
    <div className="sov">
      <SiteHeader right={<QuietAction to="/repetitor">К ученикам</QuietAction>} />
      <main className="sov-narrow sov-sub">
        <h1>Подписка</h1>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        {!data ? (
          /* Скелет вместо строчки «Секунду…»: место карточки состояния
             занимает карточка-заготовка того же силуэта, и экран не
             прыгает, когда ответ придёт. */
          <div className="sov-skel-stack" style={{ marginTop: 22 }}>
            <span className="sov-skel" style={{ height: 190, borderRadius: 24 }} />
            <span className="sov-skel" style={{ width: "34%", height: 18, marginTop: 20 }} />
            <span className="sov-skel" style={{ height: 104 }} />
          </div>
        ) : (
          <>
            <SubscriptionState data={data} />

            {data.active ? (
              <>
                <div className="sov-sub-block">
                  {/* Продление доступно, не дожидаясь конца срока: оплаченный
                      остаток при этом не сгорает, новый период считается от
                      старой даты окончания (extendSubscription). */}
                  <h2>Продлить</h2>
                  <p>
                    Новый срок считается от даты окончания, а не от дня оплаты: остаток оплаченного
                    не сгорает.
                  </p>
                  <PayForm onDone={load} />
                </div>

                <div className="sov-sub-quiet">
                  <div>
                    <h2>Отмена</h2>
                    <p>
                      Подписка разовая и сама не продлевается, так что отменять её ради этого не
                      нужно. Отмена закрывает доступ к темам сразу; ученики и их занятия остаются в
                      кабинете.
                    </p>
                    <div className="sov-sub-actions">
                      <button
                        type="button"
                        className="sov-act-ghost"
                        disabled={pending}
                        onClick={async () => {
                          setPending(true);
                          await tutorCancelSubscription();
                          await load();
                          setPending(false);
                        }}
                      >
                        Отменить подписку
                      </button>
                    </div>
                  </div>
                  <TutorDeleteAccount />
                </div>
              </>
            ) : (
              <>
                <div className="sov-sub-block">
                  <h2>Что откроет подписка</h2>
                  {/* Тот же список, что и в платной колонке витрины, и той же
                      длины: кабинет не место для второго прайса, он только
                      напоминает, за что берут деньги. Цена и сроки — ниже, в
                      форме, и оба числа приходят из lib/billing.ts. */}
                  <ul className="sov-sub-list">
                    <li>Сколько угодно учеников</li>
                    <li>Все темы с 1 по 4 класс — всем вашим ученикам</li>
                    <li>Проверочные работы и звёзды</li>
                    <li>Зоны риска по каждой теме</li>
                  </ul>
                  <PayForm onDone={load} />
                </div>

                <div className="sov-sub-quiet">
                  <div>
                    <h2>Промокод</h2>
                    <p>Если подписку выдали промокодом, введите его здесь — платить не нужно.</p>
                    <form
                      className="sov-form"
                      style={{ marginTop: 14 }}
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        setPending(true);
                        setError(null);
                        try {
                          await tutorRedeemPromo({
                            data: { code: String(form.get("code") ?? "") },
                          });
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Не получилось активировать");
                        }
                        setPending(false);
                      }}
                    >
                      <div className="sov-field">
                        <label htmlFor="code">Код подписки</label>
                        <input id="code" name="code" required autoComplete="off" />
                      </div>
                      <FormAction pending={pending}>Активировать</FormAction>
                    </form>
                  </div>
                  <TutorDeleteAccount />
                </div>
              </>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Состояние подписки одной карточкой.
 *
 * Раньше ответ на главный вопрос экрана лежал в трёх одинаковых плитках
 * .sov-metric, и первая печатала слово «Да» кеглем в два ремá: цифровая
 * форма под нецифровой ответ. Теперь слово стоит пилюлей рядом с совёнком,
 * а числа ушли под черту помельче — они подробности ответа, а не он сам.
 *
 * Второе число разное в двух состояниях, и это не украшение. У платящего
 * важна дата, до которой всё открыто; у неплатящего — что вести можно
 * одного, а заведённые остаются. Про второе сказано и словами: кончившаяся
 * подписка не должна читаться как угроза отобрать учеников.
 */
function SubscriptionState({ data }: { data: Data }) {
  const on = data.active;
  return (
    <div className={`sov-sub-state${on ? " sov-sub-state--on" : ""}`}>
      <div className="sov-sub-state__head">
        <Owl size={64} mood={on ? "happy" : "idle"} item={on ? "graduate" : "none"} animated={on} />
        <span className="sov-sub-state__mark">{on ? "Подписка активна" : "Бесплатный режим"}</span>
      </div>

      <p className="sov-sub-state__lead">
        {on
          ? "Учеников сколько угодно, и всем открыты все темы начальной школы."
          : "Вести можно одного ученика, и ему открыта только первая тема каждого предмета. Тренажёры работают целиком. Уже заведённые ученики остаются в кабинете в любом случае."}
      </p>

      <div className="sov-sub-facts">
        <div>
          <b>{data.students}</b>
          <span>{plural(data.students, "ученик", "ученика", "учеников")} в кабинете</span>
        </div>
        {on ? (
          <div>
            <b>{data.until ? DATE.format(new Date(data.until)) : "—"}</b>
            <span>действует до</span>
          </div>
        ) : (
          <div>
            <b>{FREE_CHILD_LIMIT}</b>
            <span>{plural(FREE_CHILD_LIMIT, "ученик", "ученика", "учеников")} без подписки</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Отзыв согласия наставника на собственные данные: подтверждается паролем.
 * Что случится с учениками, сказано над кнопкой; сервер удаляет только тех,
 * у кого parent_id ещё указывает на наставника (см. deleteAccount).
 */
function TutorDeleteAccount() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div>
      <h2>Учётная запись</h2>
      <p>
        Ученики, к которым ещё не присоединился родитель, будут удалены вместе с занятиями. Ученики,
        привязанные к семьям, останутся у своих семей, но выданные вами задания и приложенные к ним
        файлы будут удалены.
      </p>

      {!open ? (
        <div className="sov-sub-actions">
          <button type="button" className="sov-act-ghost" onClick={() => setOpen(true)}>
            Удалить учётную запись…
          </button>
        </div>
      ) : (
        <form
          className="sov-form"
          style={{ marginTop: 16 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setPending(true);
            try {
              await deleteAccount({ data: { password } });
              await navigate({ to: "/" });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Не получилось удалить");
              setPending(false);
            }
          }}
        >
          <div className="sov-alert">
            Учётная запись и непривязанные ученики будут удалены без возможности восстановления.
            Сведения о платежах и чеки хранятся 5 лет, они остаются. Активная подписка закроется.
          </div>
          {error ? <div className="sov-alert">{error}</div> : null}
          <div className="sov-field">
            <label htmlFor="deltutorpwd">Пароль от учётной записи</label>
            <input
              id="deltutorpwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="sov-act-ghost"
              disabled={pending || password.length === 0}
              style={{ borderColor: "var(--sov-warn)", color: "var(--sov-warn)" }}
            >
              {pending ? "Удаляем…" : "Удалить учётную запись навсегда"}
            </button>
            <button type="button" className="sov-act-ghost" onClick={() => setOpen(false)}>
              Передумал
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
