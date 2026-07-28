import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ChildAction, Owl, Stars, Wordmark } from "../components/brand";
import { getDiagnostic, getSkillMap, me, submitDiagnostic } from "../lib/api/app.functions";

export const Route = createFileRoute("/uchenik")({
  head: () => ({ meta: [{ title: "Занятия, Совёнок" }] }),
  component: PupilPage,
});

type TopicItem = { id: string; name: string; summary: string | null; stars: number; bestPercent: number; status: string; locked: boolean; available: boolean };
type MapData = {
  child: { id: string; name: string; avatar: string; grade: number; soundOn: boolean; dailyLimitMin: number; diagnosticsDone: boolean };
  subjects: { id: string; name: string; topics: TopicItem[] }[];
  totalStars: number; level: number; paid: boolean;
};
type DiagData = {
  childName: string; grade: number;
  blocks: { subjectId: string; subjectName: string; tasks: { id: string; kind: string; prompt: string; payload: Record<string, unknown>; explanation: string }[] }[];
};
type DiagResult = { subjectId: string; subjectName: string; correct: number; total: number; percent: number; level: string }[];

function PupilPage() {
  const navigate = useNavigate();
  const [childId, setChildId] = useState<string | null>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const account = await me();
        if (!account.user) {
          await navigate({ to: "/vhod" });
          return;
        }
        const first = account.activeChildId ?? account.children[0]?.id ?? null;
        if (!first) {
          await navigate({ to: "/roditel" });
          return;
        }
        const map = await getSkillMap({ data: { childId: first } });
        if (!alive) return;
        setChildId(first);
        setData(map);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Не удалось загрузить занятия");
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="sov sov-kid">
        <div className="sov-shell" style={{ paddingTop: 40 }}>
          <div className="sov-alert">{error}</div>
        </div>
      </div>
    );
  }

  if (!data || !childId) {
    return (
      <div className="sov sov-kid">
        <div className="sov-shell" style={{ paddingTop: 60 }}>
          <div className="sov-node" style={{ maxWidth: 420 }}>
            <div className="sov-node__badge">…</div>
            <div className="sov-node__body">
              <strong>Готовим задания</strong>
              <span>Пара секунд</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data.child.diagnosticsDone) {
    return <Diagnostic childId={childId} onDone={() => location.reload()} />;
  }

  return (
    <div className="sov sov-kid">
      <div className="sov-shell">
        <div className="sov-header" style={{ padding: "18px 0" }}>
          <Wordmark compact />
          <Link to="/roditel" className="sov-act-ghost" style={{ textDecoration: "none" }}>
            Кабинет родителя
          </Link>
        </div>

        <div className="sov-kid__head">
          <div className="sov-kid__who">
            <Owl size={54} />
            <div>
              <strong>Привет, {data.child.name}</strong>
              <div className="sov-mono" style={{ color: "var(--sov-ink-soft)" }}>
                {data.child.grade} класс
              </div>
            </div>
          </div>
          <div className="sov-kid__level">
            Уровень {data.level} · {data.totalStars} звёзд
          </div>
        </div>

        {data.subjects.map((subject) => (
          <section key={subject.id} className="sov-subject">
            <h2>{subject.name}</h2>
            <div className="sov-path">
              {subject.topics.map((topic, index) => {
                const open = topic.available || topic.status !== "locked";
                const body = (
                  <>
                    <div className="sov-node__badge">{index + 1}</div>
                    <div className="sov-node__body">
                      <strong>{topic.name}</strong>
                      <span>
                        {topic.locked
                          ? "Откроется с подпиской"
                          : topic.status === "completed"
                            ? "Тема пройдена"
                            : topic.summary}
                      </span>
                    </div>
                    <Stars value={topic.stars} />
                  </>
                );
                return open ? (
                  <Link
                    key={topic.id}
                    to="/urok/$topicId"
                    params={{ topicId: topic.id }}
                    className="sov-node"
                    data-done={topic.status === "completed"}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={topic.id} className="sov-node" data-locked="true">
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!data.paid ? (
          <div className="sov-panel" style={{ marginTop: 40, marginBottom: 60 }}>
            <h3>Остальные темы закрыты</h3>
            <p style={{ marginTop: 8, color: "var(--sov-ink-soft)" }}>
              Попросите взрослого открыть подписку в кабинете родителя.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Diagnostic({ childId, onDone }: { childId: string; onDone: () => void }) {
  const [diag, setDiag] = useState<DiagData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DiagResult | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getDiagnostic({ data: { childId } }).then(setDiag).catch(() => setDiag(null));
  }, [childId]);

  if (!diag) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <p>Готовим короткий тест…</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <div className="sov-card">
            <Owl size={56} />
            <h2 style={{ marginTop: 16 }}>Готово, {diag.childName}</h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
              Мы поняли, с чего начать. Вот твой стартовый уровень.
            </p>
            <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
              {result.map((r) => (
                <div key={r.subjectId} className="sov-risk" style={{ borderLeftColor: "var(--sov-cobalt)" }}>
                  <strong>{r.subjectName}</strong>
                  <div className="sov-mono" style={{ marginTop: 4 }}>
                    {r.correct} из {r.total} верно, уровень {r.level}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28 }}>
              <ChildAction onClick={onDone}>К занятиям</ChildAction>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = diag.blocks.reduce((n, b) => n + b.tasks.length, 0);
  const filled = Object.keys(answers).length;

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        <div className="sov-play__bar">
          <Owl size={40} />
          <div className="sov-play__track">
            <div className="sov-play__fill" style={{ width: `${(filled / total) * 100}%` }} />
          </div>
        </div>
        <div className="sov-card">
          <h2>Короткий тест, чтобы не начинать со скучного</h2>
          <p style={{ marginTop: 10, color: "var(--sov-ink-soft)" }}>
            Если не знаешь ответ, пропусти. Это не оценка.
          </p>
          {diag.blocks.map((block) => (
            <div key={block.subjectId} style={{ marginTop: 30 }}>
              <h3 style={{ fontWeight: 700, fontSize: "1.2rem" }}>{block.subjectName}</h3>
              {block.tasks.map((task) => (
                <div key={task.id} style={{ marginTop: 18 }}>
                  <p style={{ fontWeight: 500 }}>{task.prompt}</p>
                  {task.kind === "choice" ? (
                    <div className="sov-chips">
                      {((task.payload as { options?: string[] }).options ?? []).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className="sov-chip"
                          data-active={answers[task.id] === option}
                          onClick={() => setAnswers((prev) => ({ ...prev, [task.id]: option }))}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="sov-field__input"
                      style={{ marginTop: 8, padding: "10px 14px", border: "1px solid var(--sov-line)", borderRadius: 10, fontSize: "1rem", fontFamily: "var(--sov-font)" }}
                      value={answers[task.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      inputMode="text"
                      aria-label={task.prompt}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 32 }}>
            <ChildAction
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const payload = Object.entries(answers).map(([id, value]) => ({ id, value }));
                const res = await submitDiagnostic({ data: { childId, answers: payload } });
                setResult(res.result);
                setPending(false);
              }}
            >
              Показать результат
            </ChildAction>
          </div>
        </div>
      </div>
    </div>
  );
}
