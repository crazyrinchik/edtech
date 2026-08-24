import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChildAvatar, Owl, SiteFooter, SiteHeader } from "../components/brand";
import { me, selectChild } from "../lib/api/app.functions";
import { closedHead } from "../lib/seo";

export const Route = createFileRoute("/kto")({
  head: () => closedHead("Кто занимается, Совёнок"),
  component: WhoPage,
});

type Child = { id: string; name: string; grade: number; avatar: string };

/**
 * «Кто сейчас занимается».
 *
 * Аккаунт один на семью, а детей может быть несколько, поэтому выбор профиля
 * вынесен на отдельный экран: крупные карточки с аватаром и именем, чтобы
 * ребёнок нашёл себя, ещё не умея читать. Выбор запоминается в куке и его
 * можно сменить одной кнопкой из карты занятий.
 */
function WhoPage() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  /* Раньше у этого запроса не было ветки на отказ вообще: при сбое сети
     промис падал необработанным, в консоль летела ошибка, а на экране
     навсегда оставалась строчка «Загружаем профили…». Ребёнок ждал
     профиль, которого уже никто не грузил. */
  const [loadError, setLoadError] = useState(false);
  /* Счётчик попыток — то, за что цепляется useEffect при повторе:
     сам запрос сидит в эффекте с навигацией, вытаскивать его наружу
     ради одной кнопки дороже, чем прибавить единицу. */
  const [attempt, setAttempt] = useState(0);

  function retry() {
    setLoadError(false);
    setChildren(null);
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const account = await me();
        if (!account.user) {
          await navigate({ to: "/vhod" });
          return;
        }
        if (!alive) return;
        if (account.children.length === 0) {
          await navigate({ to: "/roditel" });
          return;
        }
        setChildren(account.children as unknown as Child[]);
        setActiveId(account.activeChildId);
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate, attempt]);

  async function pick(child: Child) {
    setPending(child.id);
    await selectChild({ data: { childId: child.id } });
    await navigate({ to: "/uchenik" });
  }

  return (
    <div className="sov sov-kid">
      <SiteHeader
        right={
          <Link to="/roditel" className="sov-act-ghost" style={{ textDecoration: "none" }}>
            Кабинет родителя
          </Link>
        }
      />
      <div className="sov-shell">
        <div className="sov-who">
          <Owl size={92} mood={loadError ? "concerned" : "happy"} animated={!loadError} />
          <h1>{loadError ? "Профили не загрузились" : "Кто сейчас занимается?"}</h1>
          <p>
            {loadError
              ? "Похоже, пропала связь. Проверьте интернет и нажмите ещё раз."
              : "Нажми на своего зверька."}
          </p>

          {loadError ? (
            <p style={{ marginTop: 24 }}>
              <button type="button" className="sov-act-child" onClick={retry}>
                Попробовать ещё раз
              </button>
            </p>
          ) : (
            <div className="sov-who__grid">
              {/* Пока профили едут, на их месте стоят карточки той же формы,
                  а не строчка текста сбоку: раньше «Загружаем профили…»
                  вставало ячейкой сетки, съезжало влево и не давало понять,
                  сколько зверьков сейчас появится. */}
              {children === null
                ? [0, 1].map((i) => (
                    <div key={i} className="sov-who__card" aria-hidden="true">
                      <span
                        className="sov-skel"
                        style={{ width: 96, height: 96, borderRadius: "50%" }}
                      />
                      <span className="sov-skel" style={{ width: 82, height: 18, marginTop: 4 }} />
                      <span className="sov-skel" style={{ width: 56, height: 13 }} />
                    </div>
                  ))
                : children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className="sov-who__card"
                      data-active={child.id === activeId}
                      disabled={pending !== null}
                      onClick={() => void pick(child)}
                    >
                      <ChildAvatar avatar={child.avatar} size={96} />
                      <strong>{child.name}</strong>
                      <span>{child.grade} класс</span>
                    </button>
                  ))}
            </div>
          )}
          {children === null && !loadError ? (
            <p
              className="sov-mono"
              aria-live="polite"
              style={{ marginTop: 16, color: "var(--sov-ink-soft)" }}
            >
              Загружаем профили…
            </p>
          ) : null}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
