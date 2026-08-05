import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FormAction, QuietAction, SiteFooter, SiteHeader } from "../components/brand";
import { me } from "../lib/api/app.functions";
import {
  tutorCancelSubscription,
  tutorRedeemPromo,
  tutorSubscription,
} from "../lib/api/tutor.functions";

export const Route = createFileRoute("/repetitor/podpiska")({
  head: () => ({ meta: [{ title: "Подписка, Совёнок" }] }),
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
      <main className="sov-narrow" style={{ paddingTop: 40, paddingBottom: 70 }}>
        <h1 style={{ fontSize: "2.2rem" }}>Подписка</h1>

        {error ? (
          <div className="sov-alert" style={{ marginTop: 18 }}>
            {error}
          </div>
        ) : null}

        {!data ? (
          <p className="sov-mono" style={{ marginTop: 16 }}>
            Секунду…
          </p>
        ) : (
          <>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              {data.active
                ? "Подписка активна: всем вашим ученикам открыты все темы обоих классов."
                : "Подписка не активна: ученикам открыта только первая тема каждого предмета, тренажёры работают целиком."}
            </p>

            {/* Три плитки, а не четыре: «0 ₽ платят семьи» отвечала на вопрос,
                который репетитор себе не задаёт, а место занимала наравне со
                статусом подписки. Колонки тянутся, чтобы не оставалось дыры. */}
            <div
              className="sov-metrics"
              style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
            >
              <div className="sov-metric">
                <b>{data.active ? "Да" : "Нет"}</b>
                <span>подписка активна</span>
              </div>
              <div className="sov-metric">
                <b>{data.students}</b>
                <span>учеников в кабинете</span>
              </div>
              <div className="sov-metric">
                <b>{data.until ? DATE.format(new Date(data.until)) : "—"}</b>
                <span>действует до</span>
              </div>
            </div>

            {data.active ? (
              <div style={{ marginTop: 28 }}>
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
            ) : (
              <form
                className="sov-form"
                style={{ marginTop: 28 }}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  setPending(true);
                  setError(null);
                  try {
                    await tutorRedeemPromo({ data: { code: String(form.get("code") ?? "") } });
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Не получилось активировать");
                  }
                  setPending(false);
                }}
              >
                <div className="sov-field">
                  <label htmlFor="code">Промокод</label>
                  <input id="code" name="code" required autoComplete="off" />
                  <span className="sov-field__hint">
                    На пилоте подписка включается промокодом. Оплата картой появится позже.
                  </span>
                </div>
                <FormAction pending={pending}>Активировать</FormAction>
              </form>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
