import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ChildAction, Owl, SiteFooter } from "../components/brand";
import { TrainerTop } from "../components/trainers";
import { me, saveSpellingDrill } from "../lib/api/app.functions";
import { drillSearch, pickMany, pickNumber } from "../lib/drill-search";
import { useEnterAction } from "../lib/keys";
import type { SpellingItem, SpellingRule } from "../lib/content/spelling";
import { filled, groupRules, SPELLING_GROUPS, SPELLING_RULES } from "../lib/content/spelling";

export const Route = createFileRoute("/pravopisanie")({
  head: () => ({
    meta: [
      { title: "Тренажёр по правописанию, Совёнок" },
      {
        name: "description",
        content:
          "Безударные гласные, парные согласные, жи-ши, -тся и -ться. К каждому упражнению раскрывается правило. Без регистрации.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) =>
    drillSearch(search, ["rules", "count"] as const),
  component: SpellingPage,
});

const COUNTS = [10, 20, 30];

type Card = { rule: SpellingRule; item: SpellingItem; options: string[] };
type Miss = { ruleId: string; gap: string; answer: string; given: string; why: string };

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Очередь упражнений из выбранных правил.
 *
 * Слов в одном правиле около дюжины, а попросить можно тридцать: тогда круг
 * повторяется. Повтор здесь не беда, а смысл тренажёра — слово, на котором
 * ошиблись в начале, во второй раз встречает уже подготовленным.
 */
function buildQueue(ruleIds: string[], count: number): Card[] {
  const rules = SPELLING_RULES.filter((r) => ruleIds.includes(r.id));
  const all = rules.flatMap((rule) => rule.items.map((item) => ({ rule, item })));
  const out: { rule: SpellingRule; item: SpellingItem }[] = [];
  while (out.length < count && all.length) {
    out.push(...shuffle(all).slice(0, count - out.length));
  }
  // Варианты тасуются на каждой карточке: в банке ответ стоит первым, и без
  // перемешивания ребёнок за десяток слов заучил бы «жать на левую».
  return out.map((c) => ({ ...c, options: shuffle(c.item.options) }));
}

/**
 * Тренажёр правописания.
 *
 * От обычной карточки с пропуском он отличается одним: правило открыто
 * рядом с упражнением, а не спрятано в учебнике. Ребёнок, который не помнит,
 * как проверять безударную гласную, иначе просто угадывает букву — и
 * тренажёр закрепляет угадывание. Поэтому правило можно раскрыть до ответа,
 * а после ошибки оно раскрывается само.
 */
function SpellingPage() {
  const navigate = useNavigate();
  // Настройки задания приезжают в адресе — см. lib/drill-search.ts.
  // Имя `given` здесь уже занято ответом ребёнка, поэтому `assigned`.
  const assigned = Route.useSearch();
  const [stage, setStage] = useState<"setup" | "play" | "done">("setup");
  const [picked, setPicked] = useState<string[]>(() =>
    pickMany(
      assigned.rules,
      SPELLING_RULES.map((r) => r.id),
      SPELLING_RULES.map((r) => r.id),
    ),
  );
  const [count, setCount] = useState(() => pickNumber(assigned.count, COUNTS, 10));
  /* Какие темы раскрыты. Считается один раз, от того набора правил, с
     которым экран открылся: тема, выбранная целиком (обычный случай — по
     умолчанию отмечено всё), свёрнута, а тема, из которой педагог взял
     часть, раскрыта. Дальше состоянием распоряжается сам ребёнок, поэтому
     это useState с начальным значением, а не вычисление на каждый рендер. */
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    SPELLING_GROUPS.filter((g) => {
      const chosen = g.ruleIds.filter((id) => picked.includes(id)).length;
      return chosen > 0 && chosen < g.ruleIds.length;
    }).map((g) => g.id),
  );

  const [queue, setQueue] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState(false);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [correct, setCorrect] = useState(0);

  const [childId, setChildId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    me()
      .then((account) => {
        setSignedIn(!!account.user);
        setChildId(account.activeChildId ?? account.children[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  const card = queue[index] ?? null;

  function start(ruleIds: string[] = picked) {
    if (!ruleIds.length) return;
    setQueue(buildQueue(ruleIds, count));
    setIndex(0);
    setGiven(null);
    setOpenRule(false);
    setMisses([]);
    setCorrect(0);
    setSaved(false);
    startedAt.current = Date.now();
    setStage("play");
  }

  function answer(option: string) {
    if (!card || given !== null) return;
    setGiven(option);
    if (option === card.item.answer) {
      setCorrect((n) => n + 1);
      return;
    }
    // Ошибся — правило открывается само: закрытая кнопка «правило» после
    // неверного ответа читается как укор, а не как помощь.
    setOpenRule(true);
    setMisses((prev) => [
      ...prev,
      {
        ruleId: card.rule.id,
        gap: card.item.gap,
        answer: card.item.answer,
        given: option,
        why: card.item.why,
      },
    ]);
  }

  /* Enter после ответа значит «дальше»: рука уже на клавише, а поле
     выключено (см. lib/keys.ts). */
  useEnterAction(given !== null, () => void next());

  async function next() {
    if (index + 1 >= queue.length) {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setStage("done");
      const res = await saveSpellingDrill({
        data: {
          childId: signedIn ? childId : null,
          correct,
          total: queue.length,
          seconds,
          rules: picked,
        },
      }).catch(() => ({ saved: false }));
      setSaved(res.saved);
      return;
    }
    setIndex((i) => i + 1);
    setGiven(null);
    setOpenRule(false);
  }

  if (stage === "setup") {
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <TrainerTop current="pravopisanie" />
          <div className="sov-card">
            <h2>Правописание</h2>
            <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              В слове пропущена буква — выбери нужную. Правило к упражнению открывается прямо здесь,
              до ответа: подсмотреть в него не считается ошибкой, ради этого он и сделан.
            </p>

            <div className="sov-setup">
              <div className="sov-setup__row">
                <span className="sov-setup__label">Правила</span>
                {/* Правила сложены по темам и свёрнуты.

                    Раньше все тринадцать стояли одним рядом и все были
                    отмечены: экран открывался стеной сплошного кобальта, в
                    которой не читалось, что здесь вообще можно выбирать —
                    синий значит «выбрано», а выбрано было всё. Теперь видно
                    три строки со счётом «выбрано 5 из 5», и до пилюль
                    ребёнок доходит, только если правда хочет менять набор.

                    Тема раскрыта заранее, если выбрана не целиком: так
                    выглядит набор, присланный педагогом по ссылке, и
                    прятать его было бы обманом. */}
                <div className="sov-rulegroups">
                  {SPELLING_GROUPS.map((group) => {
                    const rules = groupRules(group);
                    const chosen = rules.filter((r) => picked.includes(r.id)).length;
                    return (
                      <details
                        key={group.id}
                        className="sov-rulegroup"
                        open={openGroups.includes(group.id)}
                        onToggle={(e) => {
                          const on = e.currentTarget.open;
                          setOpenGroups((prev) =>
                            on
                              ? [...new Set([...prev, group.id])]
                              : prev.filter((id) => id !== group.id),
                          );
                        }}
                      >
                        <summary>
                          <span className="sov-rulegroup__name">{group.title}</span>
                          <span className="sov-rulegroup__count" data-empty={chosen === 0}>
                            выбрано {chosen} из {rules.length}
                          </span>
                        </summary>
                        <div className="sov-chips">
                          {rules.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              className="sov-chip"
                              data-active={picked.includes(r.id)}
                              aria-pressed={picked.includes(r.id)}
                              onClick={() =>
                                setPicked((prev) =>
                                  prev.includes(r.id)
                                    ? prev.filter((x) => x !== r.id)
                                    : [...prev, r.id],
                                )
                              }
                            >
                              {r.title}
                            </button>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
                {/* «Выбрать все» и «Снять все» — такие же пилюли, только
                    контурные: подчёркнутые ссылки мелким кеглем выпадали
                    из ряда чипов, рядом с которыми стояли. */}
                <div className="sov-setup__aside">
                  <button
                    type="button"
                    className="sov-chip"
                    onClick={() => setPicked(SPELLING_RULES.map((r) => r.id))}
                  >
                    Выбрать все
                  </button>
                  <button type="button" className="sov-chip" onClick={() => setPicked([])}>
                    Снять все
                  </button>
                </div>
                {!picked.length ? (
                  <span className="sov-field__error">Выберите хотя бы одно правило</span>
                ) : null}
              </div>

              <div className="sov-setup__row">
                <span className="sov-setup__label">Сколько слов</span>
                <div className="sov-chips" style={{ marginTop: 0 }}>
                  {COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="sov-chip"
                      data-active={count === n}
                      onClick={() => setCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 26 }}>
              <ChildAction onClick={() => start()} disabled={!picked.length}>
                Начать
              </ChildAction>
            </div>

            {!signedIn ? (
              <div className="sov-save-hint" style={{ marginTop: 22 }}>
                <strong>Можно тренироваться без аккаунта</strong>
                <span>Результат тогда не сохранится и не попадёт в отчёт родителя.</span>
              </div>
            ) : null}
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (stage === "done") {
    const total = queue.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const weakRules = [...new Set(misses.map((m) => m.ruleId))];
    return (
      <div className="sov sov-kid">
        <div className="sov-play">
          <TrainerTop current="pravopisanie" />
          <div className="sov-card">
            <Owl size={64} mood={percent >= 70 ? "happy" : "concerned"} animated />
            <h2 style={{ marginTop: 16 }}>Готово</h2>
            <p style={{ marginTop: 12, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
              Верных ответов: {correct} из {total} ({percent}%).
            </p>

            {misses.length ? (
              <div className="sov-missed">
                <h3>Слова, где ошибся</h3>
                {misses.map((m, i) => (
                  <div key={`${m.gap}-${i}`} className="sov-missed__row">
                    <strong>{m.gap.replace("_", m.answer)}</strong>
                    <span>
                      написано «{m.given}», нужно «{m.answer}». {m.why}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {!saved ? (
              <div className="sov-save-hint">
                <strong>Результат не сохранён</strong>
                <span>
                  {signedIn
                    ? "Выберите профиль ребёнка, чтобы тренировки попадали в отчёт родителя."
                    : "Заведите аккаунт: тренировки будут копиться, а родитель увидит, какие правила просели."}
                </span>
              </div>
            ) : (
              <p className="sov-mono" style={{ marginTop: 14, color: "var(--sov-ok)" }}>
                Результат сохранён в отчёте родителя.
              </p>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ChildAction onClick={() => start()}>Ещё раз</ChildAction>
              {weakRules.length ? (
                <button
                  type="button"
                  className="sov-act-ghost"
                  onClick={() => {
                    setPicked(weakRules);
                    start(weakRules);
                  }}
                >
                  Повторить трудные правила
                </button>
              ) : null}
              <button type="button" className="sov-act-ghost" onClick={() => setStage("setup")}>
                Выбрать правила
              </button>
              {!signedIn ? (
                <button
                  type="button"
                  className="sov-act-ghost"
                  onClick={() => navigate({ to: "/registraciya" })}
                >
                  Сохранить прогресс
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;
  const state = given === null ? "idle" : given === card.item.answer ? "right" : "wrong";

  return (
    <div className="sov sov-kid">
      <div className="sov-play">
        <TrainerTop current="pravopisanie" />

        <div className="sov-play__bar" style={{ marginTop: 14 }}>
          <Owl
            size={40}
            mood={state === "idle" ? "idle" : state === "right" ? "happy" : "concerned"}
          />
          <div className="sov-play__track">
            <div className="sov-play__fill" style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
          <span className="sov-mono">
            {index + 1} из {queue.length}
          </span>
        </div>

        <div className="sov-card">
          <span className="sov-card__tag">{card.rule.title}</span>
          <p className="sov-word" data-long={card.item.gap.includes(" ")}>
            <GapText gap={card.item.gap} fill={given} state={state} />
          </p>

          {/* Буква и сочетание букв — короткие варианты: во всю ширину
              карточки кнопка с одним «ь» читается как пустая полоса. */}
          <div className="sov-options" data-tight={card.options.every((o) => o.length <= 4)}>
            {card.options.map((option) => (
              <button
                key={option}
                type="button"
                className="sov-option"
                disabled={given !== null}
                data-state={
                  given === null
                    ? undefined
                    : option === card.item.answer
                      ? "right"
                      : option === given
                        ? "wrong"
                        : undefined
                }
                onClick={() => answer(option)}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Разбор стоит выше правила, а кнопка «дальше» ниже: после ошибки
              правило разворачивается само, и если бы оно было последним, за
              ним пришлось бы искать разбор. Так порядок чтения совпадает с
              порядком мысли: что вышло → почему → идём дальше. */}
          {given !== null ? (
            <div className="sov-feedback" data-kind={state === "right" ? "right" : "wrong"}>
              <div>
                <strong>{state === "right" ? "Верно" : "Пока не так"}</strong>
                <span>
                  {state === "right"
                    ? card.item.why
                    : `Правильно «${filled(card.item)}». ${card.item.why}`}
                </span>
              </div>
            </div>
          ) : null}

          <RuleReveal rule={card.rule} open={openRule} onToggle={() => setOpenRule((o) => !o)} />

          {given !== null ? (
            <div style={{ marginTop: 22 }}>
              <ChildAction onClick={() => void next()}>
                {index + 1 < queue.length ? "Дальше" : "Завершить"}
              </ChildAction>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Слово с пропуском: до ответа на месте буквы стоит пустая клетка. */
function GapText({
  gap,
  fill,
  state,
}: {
  gap: string;
  fill: string | null;
  state: "idle" | "right" | "wrong";
}) {
  const at = gap.indexOf("_");
  const before = gap.slice(0, at);
  const after = gap.slice(at + 1);
  return (
    <>
      {before}
      <span className="sov-gap" data-state={state}>
        {fill ?? "?"}
      </span>
      {after}
    </>
  );
}

/** Правило рядом с упражнением. Свёрнуто, пока его не спросили. */
function RuleReveal({
  rule,
  open,
  onToggle,
}: {
  rule: SpellingRule;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="sov-reveal" data-open={open}>
      <button type="button" className="sov-reveal__btn" onClick={onToggle} aria-expanded={open}>
        <span>Правило: {rule.title}</span>
        <span className="sov-reveal__sign" aria-hidden="true">
          {open ? "Свернуть" : "Открыть"}
        </span>
      </button>
      {open ? <RuleBody rule={rule} /> : null}
    </div>
  );
}

function RuleBody({ rule }: { rule: SpellingRule }) {
  return (
    <div className="sov-reveal__body sov-rule">
      <p className="sov-rule__hint">{rule.hint}</p>
      {rule.rule.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <ul className="sov-rule__ex">
        {rule.examples.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
      {rule.caution ? <p className="sov-rule__caution">{rule.caution}</p> : null}
    </div>
  );
}

/*
 * Списка «Правила целиком» под настройкой больше нет.
 *
 * Он повторял то, что и так раскрывается в карточке упражнения, и делал это
 * раньше — до первого слова. Читать тринадцать правил подряд, ещё не увидев
 * ни одного пропуска, ребёнок не станет, а место на стартовом экране это
 * занимало больше, чем сам выбор правил и кнопка «Начать».
 *
 * Правило живёт там, где в нём возникает нужда: рядом с упражнением, по
 * кнопке до ответа и само собой после ошибки (см. RuleReveal).
 */
