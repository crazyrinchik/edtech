import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChildAvatar, Owl, SiteHeader } from "../components/brand";
import { me, selectChild } from "../lib/api/app.functions";

export const Route = createFileRoute("/kto")({
  head: () => ({ meta: [{ title: "Кто занимается, Совёнок" }] }),
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

  useEffect(() => {
    let alive = true;
    (async () => {
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
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

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
          <Owl size={92} mood="happy" animated />
          <h1>Кто сейчас занимается?</h1>
          <p>Нажми на своего зверька.</p>

          <div className="sov-who__grid">
            {(children ?? []).map((child) => (
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
            {children === null ? <p className="sov-mono">Загружаем профили…</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
