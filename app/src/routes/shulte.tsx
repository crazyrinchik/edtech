import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChildAction, Owl, SiteFooter } from "../components/brand";
import { TrainerTop } from "../components/trainers";
import { me, saveShulteDrill } from "../lib/api/app.functions";

export const Route = createFileRoute("/shulte")({
  head: () => ({ meta: [{ title: "Таблица Шульте, Совёнок" }] }),
  component: ShultePage,
});

const SIZES = [3, 4, 5] as const;

/** Перемешивание Фишера — Йетса: каждый расклад равновероятен. */
function shuffled(n: number): number[] {
  const cells = Array.from({ length: n * n }, (_, i) => i + 1);
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

/**
 * Таблица Шульте: числа расставлены вразнобой, найти их надо по порядку.
 *
 * Ошибок в привычном смысле здесь нет — есть время, поэтому в результате
 * секунды, а не проценты. Промахи считаются отдельно: они говорят не
 * столько об ошибке, сколько о том, что ребёнок торопится.
 */
function ShultePage() {
  const [size, setSize] = useState<(typeof SIZES)[number]>(3);
  const [cells, setCells] = useState<number[] | null>(null);
  const [next, setNext] = useState(1);
  const [misses, setMisses] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [childId, setChildId] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    me()
      .then((a) => setChildId(a.activeChildId ?? a.children[0]?.id ?? null))
      .catch(() => setChildId(null));
  }, []);

  const total = size * size;
  const done = cells !== null && next > total;

  useEffect(() => {
    if (!cells || done) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [cells, done]);

  useEffect(() => {
    if (!done || saved !== null) return;
    const seconds = Math.max(1, Math.floor((Date.now() - startedAt.current) / 1000));
    saveShulteDrill({ data: { childId, size, seconds, misses } })
      .then((r) => setSaved(r.saved))
      .catch(() => setSaved(false));
  }, [done, saved, childId, size, misses]);

  const perCell = useMemo(
    () => (done && elapsed > 0 ? (elapsed / total).toFixed(1) : null),
    [done, elapsed, total],
  );

  function start() {
    setCells(shuffled(size));
    setNext(1);
    setMisses(0);
    setWrong(null);
    setElapsed(0);
    setSaved(null);
    startedAt.current = Date.now();
  }

  function tap(value: number) {
    if (!cells || done) return;
    if (value === next) {
      setNext((n) => n + 1);
      setWrong(null);
      return;
    }
    setMisses((m) => m + 1);
    setWrong(value);
    window.setTimeout(() => setWrong((w) => (w === value ? null : w)), 350);
  }

  return (
    <div className="sov sov-kid">
      <div className="sov-shell">
        <div style={{ padding: "18px 0" }}>
          <TrainerTop current="shulte" />
        </div>

        <div className="sov-play">
          {cells === null ? (
            <div className="sov-card">
              <h2>Таблица Шульте</h2>
              <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
                Числа расставлены вразнобой. Находи их по порядку: сначала 1, потом 2 и дальше
                до конца. Смотри в середину таблицы и старайся замечать числа боковым зрением —
                так тренируется поле зрения, а вместе с ним скорость чтения.
              </p>

              <div className="sov-setup" style={{ marginTop: 22 }}>
                <div className="sov-setup__row">
                  <span className="sov-setup__label">Размер</span>
                  <div className="sov-chips">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="sov-chip"
                        data-active={size === s}
                        onClick={() => setSize(s)}
                      >
                        {s} × {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 26 }}>
                <ChildAction onClick={start}>Начать</ChildAction>
              </div>
            </div>
          ) : done ? (
            <div className="sov-card">
              <Owl size={64} mood="happy" />
              <h2 style={{ marginTop: 14 }}>Готово за {elapsed} сек</h2>
              <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
                {perCell} секунды на клетку
                {misses > 0 ? `, промахов: ${misses}` : ", ни одного промаха"}.
              </p>
              {saved === false ? (
                <div className="sov-save-hint" style={{ marginTop: 20 }}>
                  <strong>Результат не сохранён</strong>
                  <span>Чтобы результаты копились, нужно войти в аккаунт.</span>
                </div>
              ) : null}
              <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ChildAction onClick={start}>Ещё раз</ChildAction>
                <button type="button" className="sov-act-ghost" onClick={() => setCells(null)}>
                  Другой размер
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="sov-play__bar">
                <Owl size={40} />
                <div className="sov-shulte__status">
                  <strong>Ищи {next}</strong>
                  <span className="sov-mono">
                    {elapsed} сек · {next - 1} из {total}
                  </span>
                </div>
              </div>

              <div
                className="sov-shulte"
                style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
                data-size={size}
              >
                {cells.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="sov-shulte__cell"
                    data-done={value < next}
                    data-wrong={wrong === value}
                    onClick={() => tap(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="sov-leave"
                onClick={() => setCells(null)}
              >
                Закончить
              </button>
            </>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
