import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  ChildAction,
  ChildAvatar,
  Owl,
  owlStage,
  SiteHeader,
  Stars,
} from "../components/brand";
import { TRAINERS } from "../components/trainers";
import { coinsLabel, plural, SHOP } from "../lib/shop";
import { AutoSpeakToggle, SpeakButton } from "../components/speak";
import { Bar, Ring, WeekStrip, weekBuckets } from "../components/figures";
import { getDiagnostic, getSkillMap, me, submitDiagnostic } from "../lib/api/app.functions";
import { buyOwlItem, equipOwlItem } from "../lib/api/app.functions";
import { childAssignments, customTaskFile, submitCustomAnswer } from "../lib/api/tutor.functions";

/** Уровень считается на сервере как звёзды/5 + 1 — держим шаг тем же. */
const STARS_PER_LEVEL = 5;

/** «к четвергу» ребёнку понятнее даты: он живёт неделей, а не числами. */
function dueLabel(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);
  if (days < 0) return "срок прошёл";
  if (days === 0) return "на сегодня";
  if (days === 1) return "на завтра";
  return `осталось ${days} дн.`;
}

export const Route = createFileRoute("/uchenik")({
  head: () => ({ meta: [{ title: "Занятия, Совёнок" }] }),
  component: PupilPage,
});

type TopicItem = {
  id: string; name: string; summary: string | null; stars: number; bestPercent: number;
  status: string; locked: boolean; available: boolean;
  reason: string | null; needsTopic: string;
};
type MapData = {
  child: { id: string; name: string; avatar: string; grade: number; soundOn: boolean; dailyLimitMin: number; diagnosticsDone: boolean };
  subjects: { id: string; name: string; topics: TopicItem[] }[];
  totalStars: number; level: number; paid: boolean; hasTutor: boolean; weekRuns: string[];
  coins: number; earned: number; owned: string[]; equipped: string;
};
type DiagData = {
  childName: string; grade: number;
  blocks: { subjectId: string; subjectName: string; tasks: { id: string; kind: string; prompt: string; payload: Record<string, unknown>; explanation: string }[] }[];
};
type Homework = Awaited<ReturnType<typeof childAssignments>>["assignments"];

type DiagResult = { subjectId: string; subjectName: string; correct: number; total: number; percent: number; level: string }[];

function PupilPage() {
  const navigate = useNavigate();
  const [childId, setChildId] = useState<string | null>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [manyChildren, setManyChildren] = useState(false);
  const [adultRole, setAdultRole] = useState<string>("parent");
  const [homework, setHomework] = useState<Homework>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (childId) {
      const hw = await childAssignments({ data: { childId } });
      setHomework(hw.assignments);
    }
  };

  /**
   * Ответ лавки вживляется в состояние экрана.
   *
   * Раньше на покупку и на «надеть» отвечали location.reload(): экран гас
   * белым, прокрутка улетала наверх, и лавку приходилось искать заново —
   * ради действия, которое существует ровно для приятного отклика. Сервер
   * отдаёт свежие пёрышки, список купленного и надетую вещь, эти четыре
   * поля и подменяем; карта тем и домашка остаются на месте.
   */
  const applyOwl = (owl: { coins: number; earned: number; owned: string[]; equipped: string }) =>
    setData((prev) => (prev ? { ...prev, ...owl } : prev));

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
        // Детей несколько, а кто сейчас за столом — неизвестно: спрашиваем
        // на отдельном экране, аватарами, а не выпадающим списком.
        if (account.children.length > 1 && !account.activeChildId) {
          await navigate({ to: "/kto" });
          return;
        }
        const first = account.activeChildId ?? account.children[0]?.id ?? null;
        if (!first) {
          await navigate({ to: "/roditel" });
          return;
        }
        if (alive) {
          setManyChildren(account.children.length > 1);
          setAdultRole(account.user.role);
        }
        const map = await getSkillMap({ data: { childId: first } });
        if (!alive) return;
        setChildId(first);
        setData(map);
        // Домашка грузится отдельно: без репетитора её просто нет, и
        // задерживать из-за неё карту тем незачем.
        childAssignments({ data: { childId: first } })
          .then((hw) => alive && setHomework(hw.assignments))
          .catch(() => undefined);
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
    // После диагностики нужна свежая карта: перезагружать ради этого всю
    // страницу незачем — забираем её тем же запросом, что и при входе.
    return (
      <Diagnostic
        childId={childId}
        onDone={async () => {
          setData(await getSkillMap({ data: { childId } }));
        }}
      />
    );
  }

  // Темы из активной домашки помечаются прямо на тропе: ребёнок, который
  // пролистал задание и пошёл выбирать сам, всё равно видит, что задано.
  const assignedTopics = new Set(
    homework.flatMap((hw) => hw.items.filter((i) => i.kind === "topic").map((i) => i.refId)),
  );

  const stage = owlStage(data.level);
  // Рост идёт от уровня сам, а вещь — только та, что ребёнок купил и надел.
  const item = data.equipped as "none" | "scarf" | "glasses" | "cap" | "graduate";
  const starsInLevel = data.totalStars % STARS_PER_LEVEL;
  const toNextLevel = stage >= 5 ? 0 : STARS_PER_LEVEL - starsInLevel;

  // Занятия за неделю раскладываются по календарным дням здесь, а не на
  // сервере: часовой пояс ребёнка знает только браузер (см. figures.tsx).
  const weekDays = weekBuckets(data.weekRuns, (iso) => iso).map((d) => ({
    label: d.label,
    count: d.rows.length,
    today: d.today,
  }));
  const topicsDone = data.subjects.reduce(
    (sum, s) => sum + s.topics.filter((t) => t.status === "completed").length,
    0,
  );
  const topicsTotal = data.subjects.reduce((sum, s) => sum + s.topics.length, 0);

  /**
   * Одно дело, которое ребёнок начнёт с этого экрана.
   *
   * Сперва смотрим в домашку: если педагог что-то задал, спорить не о чем.
   * Если задания нет, а карта тем открыта (ученик без репетитора) —
   * предлагаем продолжить начатую тему, а её нет, так первую доступную.
   * У ребёнка с репетитором и без домашки карточки не будет: звать его
   * в темы вперёд плана педагога мы не вправе.
   */
  const pendingHw = homework.find((hw) => hw.status !== "done");
  const pendingItem = pendingHw?.items.find((i) => !i.done);
  const freeTopic =
    !pendingItem && !data.hasTutor
      ? (data.subjects.flatMap((s) => s.topics).find((t) => t.status === "in_progress") ??
        data.subjects
          .flatMap((s) => s.topics)
          .find((t) => !t.locked && t.available && t.status !== "completed"))
      : undefined;

  const nextUp: {
    cap: string;
    name: string;
    label: string;
    /* Срок прошёл. Считает сервер (AssignmentView.status), а не браузер:
       часы на планшете ребёнка могут врать, а охра значит «требует
       внимания» — вешать её по ошибке нельзя. */
    overdue?: boolean;
    topicId?: string;
    to?: string;
    anchor?: string;
  } | null = pendingHw && pendingItem
    ? {
        overdue: pendingHw.status === "overdue",
        cap: [
          pendingHw.title,
          pendingHw.dueAt ? dueLabel(pendingHw.dueAt) : "без срока",
          `сделано ${pendingHw.doneCount} из ${pendingHw.total}`,
        ].join(" · "),
        name: pendingItem.name,
        // Своё задание от педагога проверяет человек, и «начать» его нельзя —
        // можно только открыть форму ответа ниже на этой же странице.
        label: pendingItem.kind === "custom" ? "Открыть задание" : "Начать",
        topicId: pendingItem.kind === "topic" ? pendingItem.refId : undefined,
        to:
          pendingItem.kind === "topic" || pendingItem.kind === "custom"
            ? undefined
            : (TRAINERS.find((t) => t.id === pendingItem.refId)?.to ?? "/schet"),
        anchor: pendingItem.kind === "custom" ? `#zadanie-${pendingItem.id}` : undefined,
      }
    : freeTopic
      ? {
          cap: freeTopic.status === "in_progress" ? "Ты уже начал" : "Можно начать",
          name: freeTopic.name,
          label: freeTopic.status === "in_progress" ? "Продолжить" : "Начать",
          topicId: freeTopic.id,
        }
      : null;

  return (
    <div className="sov sov-kid">
      {/* Та же шапка, что и на остальных экранах. Своя копия стояла здесь
          внутри колонки и потому не могла стать полосой во всю ширину. */}
      <SiteHeader
        right={
          <>
            <AutoSpeakToggle />
            {manyChildren ? (
              <Link to="/kto" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                <ChildAvatar avatar={data.child.avatar} size={22} /> Сменить
              </Link>
            ) : null}
            {/* Взрослый рядом с ребёнком теперь не обязательно родитель:
                репетитору нужен список учеников, а не родительский кабинет. */}
            {adultRole === "tutor" ? (
              <Link to="/repetitor" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                К ученикам
              </Link>
            ) : (
              <Link to="/roditel" className="sov-act-ghost" style={{ textDecoration: "none" }}>
                Кабинет родителя
              </Link>
            )}
          </>
        }
      />
      <div className="sov-shell">

        {/* Первым делом — что делать сейчас.

            Раньше экран открывался сводкой о ребёнке: аватар, бейдж уровня,
            имя, класс, пёрышки, «2 / 5 звёзд», полоса роста, подсказка,
            неделя занятий и кольцо пройденных тем. Одиннадцать значений,
            и только под ними — домашка, ради которой экран и открыли.
            Ребёнок, который читает по слогам, разбирал чужую статистику о
            себе прежде, чем видел первое задание.

            Теперь порядок обратный: имя, одна карточка с названием темы и
            одной кнопкой, список остального, тренажёры — и лишь потом рост
            совёнка и неделя. Ни одна цифра не потерялась, они просто стоят
            после действия, а не перед ним. */}
        <p className="sov-kid__hi">Привет, {data.child.name}!</p>

        {nextUp ? (
          <section className="sov-next" data-overdue={nextUp.overdue ? "true" : undefined}>
            <span className="sov-next__cap">{nextUp.cap}</span>
            <strong className="sov-next__what">{nextUp.name}</strong>
            {nextUp.anchor ? (
              <a href={nextUp.anchor} className="sov-act-child sov-next__go">
                {nextUp.label}
              </a>
            ) : nextUp.topicId ? (
              <Link
                to="/urok/$topicId"
                params={{ topicId: nextUp.topicId }}
                search={{ mode: "practice" }}
                className="sov-act-child sov-next__go"
              >
                {nextUp.label}
              </Link>
            ) : (
              <Link to={nextUp.to ?? "/schet"} className="sov-act-child sov-next__go">
                {nextUp.label}
              </Link>
            )}
          </section>
        ) : null}

        {/* Домашка стоит над всем остальным: это то, о чём договорились с
            педагогом, и искать её среди тем ребёнок не должен. */}
        {homework.length === 0 ? (
          <p className="sov-kid__free">
            {data.hasTutor
              ? "Задания сейчас нет. Можно потренироваться в устном счёте или скорочтении."
              : "Задания от педагога сейчас нет — выбирай тему сам или загляни в тренажёры."}
          </p>
        ) : null}

        {homework.map((hw) => (
          <section key={hw.id} className="sov-homework" data-status={hw.status}>
            <div className="sov-homework__head">
              <strong>{hw.status === "done" ? `${hw.title} — сделано!` : hw.title}</strong>
              {/* Цвет чипа задаётся data-status на карточке выше: охра
                  достаётся только статусу overdue, который считает сервер. */}
              <span className="sov-homework__due">
                {hw.status === "done"
                  ? "молодец"
                  : hw.dueAt
                    ? dueLabel(hw.dueAt)
                    : "без срока"}
              </span>
            </div>
            {/* Счёт сделанного словами: «1 из 3» ребёнок читает быстрее,
                чем считает галочки в списке. */}
            <span className="sov-homework__count">
              Сделано {hw.doneCount} из {hw.total}
            </span>
            {/* Сделанное сворачивается.
                Список домашки читается сверху вниз ради одного вопроса —
                «что ещё осталось», — а сделанные пункты стояли в нём
                наравне с несделанными и отодвигали ответ вниз. Теперь
                наверху только то, что ждёт, а сделанное лежит под строкой,
                которую можно открыть: похвалу видно и в свёрнутом виде,
                а место она больше не занимает.

                details, а не своё состояние: раскрывашка переживает
                перерисовку после ответа и открывается с клавиатуры. */}
            <div className="sov-homework__items">
              {hw.items.filter((i) => !i.done).map((item) =>
                item.kind === "custom" ? (
                  <CustomItem key={item.id} item={item} onDone={reload} />
                ) : item.kind === "topic" ? (
                  <div key={item.id} className="sov-homework__row">
                    <Link
                      to="/urok/$topicId"
                      params={{ topicId: item.refId }}
                      search={{ mode: "practice" }}
                      className="sov-homework__item"
                      data-done={item.done}
                    >
                      <span className="sov-homework__mark">{item.done ? "✓" : "•"}</span>
                      {item.name}
                    </Link>
                    {/* Тему засчитывает только проверочная. Пока у ученика была
                        карта тем, вход в неё жил там; без карты второй двери
                        не остаётся, поэтому она стоит прямо в задании. */}
                    <Link
                      to="/urok/$topicId"
                      params={{ topicId: item.refId }}
                      search={{ mode: "check" }}
                      className="sov-homework__check"
                    >
                      Проверочная
                    </Link>
                  </div>
                ) : (
                  <Link
                    key={item.id}
                    to={TRAINERS.find((t) => t.id === item.refId)?.to ?? "/schet"}
                    className="sov-homework__item"
                    data-done={item.done}
                  >
                    <span className="sov-homework__mark">{item.done ? "✓" : "•"}</span>
                    {item.name}
                  </Link>
                ),
              )}
            </div>

            {hw.items.some((i) => i.done) ? (
              <details className="sov-homework__past">
                <summary>
                  Сделано: {hw.items.filter((i) => i.done).length}{" "}
                  {plural(
                    hw.items.filter((i) => i.done).length,
                    "задание",
                    "задания",
                    "заданий",
                  )}
                </summary>
                <div className="sov-homework__items">
                  {hw.items.filter((i) => i.done).map((item) =>
                    item.kind === "custom" ? (
                      <CustomItem key={item.id} item={item} onDone={reload} />
                    ) : (
                      <Link
                        key={item.id}
                        to={
                          item.kind === "topic"
                            ? "/urok/$topicId"
                            : (TRAINERS.find((t) => t.id === item.refId)?.to ?? "/schet")
                        }
                        params={item.kind === "topic" ? { topicId: item.refId } : undefined}
                        search={item.kind === "topic" ? { mode: "practice" } : undefined}
                        className="sov-homework__item"
                        data-done={true}
                      >
                        <span className="sov-homework__mark">✓</span>
                        {item.name}
                      </Link>
                    ),
                  )}
                </div>
              </details>
            ) : null}

            {hw.comment ? <p className="sov-homework__comment">{hw.comment}</p> : null}
          </section>
        ))}

        {/* Тренажёры стоят до тем: в них заходят «на пять минут», и искать их
            в конце длинной карты неудобно. */}
        <div className="sov-trainers">
          {TRAINERS.map((trainer) => (
            <Link key={trainer.id} to={trainer.to} className="sov-trainer">
              <span className="sov-trainer__icon">
                <trainer.Icon size={26} />
              </span>
              <span>
                <strong>{trainer.title}</strong>
                <em>{trainer.blurb}</em>
              </span>
            </Link>
          ))}
        </div>

        {/* Рост совёнка и неделя занятий. Стоят после действия, а не перед
            ним: это ответ на вопрос «как у меня дела», который ребёнок
            задаёт, когда уже позанимался, а не когда сел за стол.

            Пёрышки отсюда ушли в заголовок лавки — там на них смотрят,
            выбирая покупку, а здесь они были четвёртым числом подряд. */}
        <div className="sov-hollow">
          <div className="sov-hollow__owl">
            <Owl size={52} stage={stage} item={item} mood="happy" animated />
            <span className="sov-hollow__badge">{data.level}</span>
          </div>

          <div className="sov-hollow__xp">
            <div className="sov-xp">
              <div className="sov-xp__row">
                <span>Уровень {data.level}</span>
                {/* Эмодзи-звезда была здесь единственным жёлтым пятном в
                    интерфейсе — счёт словом держит экран одноцветным. */}
                <span className="sov-mono">
                  {starsInLevel} / {STARS_PER_LEVEL} звёзд
                </span>
              </div>
              <div className="sov-xp__track">
                <div className="sov-xp__fill" style={{ width: `${(starsInLevel / STARS_PER_LEVEL) * 100}%` }} />
              </div>
              <span className="sov-xp__hint">
                {toNextLevel === 0
                  ? "Совёнок вырос до предела — ты молодец!"
                  : `Ещё ${toNextLevel} ${plural(toNextLevel, "звезда", "звезды", "звёзд")} — и совёнок подрастёт`}
              </span>
            </div>
          </div>

          {/* Неделя занятий: пропущенный день ребёнок замечает сам, без
              взрослого и без единой строки текста. Рядом — кольцо со
              счётом пройденных тем: «5 из 10» вместо «18 звёзд» в
              пустоте. */}
          <div className="sov-hollow__week">
            <WeekStrip days={weekDays} />
            <Ring value={topicsTotal ? (topicsDone / topicsTotal) * 100 : 0} size={56} label={`Пройдено ${topicsDone} тем из ${topicsTotal}`}>
              {`${topicsDone}/${topicsTotal}`}
            </Ring>
          </div>
        </div>

        {/* Карта тем видна только ученику без педагога. Когда занятия ведёт
            репетитор, программу выбирает он: свободная карта рядом с
            заданием предлагала ребёнку заняться чем-то другим, а темы
            вперёд плана ломали последовательность, которую держит педагог. */}
        {data.hasTutor ? null : (
          // Тропа больше не ограничена шириной колонки, и два предмета
          // помещаются рядом: вся карта видна целиком, без прокрутки до
          // русского языка.
          <div className="sov-quests">
            {data.subjects.map((subject) => {
          const passed = subject.topics.filter((t) => t.status === "completed").length;
          const stars = subject.topics.reduce((sum, t) => sum + t.stars, 0);
          return (
            <section key={subject.id} className="sov-quest">
              <header className="sov-quest__head">
                <h2>{subject.name}</h2>
                <span className="sov-quest__count">
                  {passed} из {subject.topics.length} · ★ {stars}
                </span>
              </header>

              <ol className="sov-trail">
                {subject.topics.map((topic, index) => {
                  const open = topic.available || topic.status !== "locked";
                  const done = topic.status === "completed";
                  const started = topic.status === "in_progress";
                  const state = done ? "done" : topic.locked ? "locked" : open ? "current" : "wait";
                  // Почему тема закрыта, ребёнку важнее самого замка: подписку
                  // открывает взрослый, а предыдущую тему он проходит сам.
                  const note = topic.locked
                    ? "Откроется с подпиской"
                    : topic.reason === "sequence"
                      ? `После «${topic.needsTopic}»`
                      : done || started
                        ? null
                        : topic.summary;
                  const assigned = assignedTopics.has(topic.id);
                  const body = (
                    <>
                      <span className="sov-level__num">{done ? "✓" : index + 1}</span>
                      <span className="sov-level__text">
                        <strong>
                          {topic.name}
                          {assigned ? <em className="sov-level__tag">задано</em> : null}
                        </strong>
                        {/* У пройденной и начатой темы вместо строки
                            «Пройдено на 92%» стоит полоса с засечкой
                            порога: она отвечает и «сколько», и
                            «засчитано ли», и читается не читая. */}
                        {done || started ? (
                          <Bar
                            percent={topic.bestPercent}
                            label={`${topic.name}: лучший результат ${topic.bestPercent} процентов`}
                          />
                        ) : (
                          <span>{note}</span>
                        )}
                      </span>
                      <Stars value={topic.stars} />
                    </>
                  );
                  return (
                    <li
                      key={topic.id}
                      className="sov-trail__item"
                      data-side={index % 2 === 0 ? "left" : "right"}
                      data-state={state}
                    >
                      <span className="sov-trail__dot" aria-hidden="true" />
                      {open ? (
                        <Link
                          to="/urok/$topicId"
                          params={{ topicId: topic.id }}
                          search={{ mode: "practice" }}
                          className="sov-level"
                          data-state={state}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="sov-level" data-state={state}>
                          {body}
                        </div>
                      )}
                      {/* Тему засчитывает только проверочная работа, поэтому
                          вход в неё есть прямо с карты: раньше до неё можно
                          было добраться лишь дойдя до конца тренировки. */}
                      {open ? (
                        <Link
                          to="/urok/$topicId"
                          params={{ topicId: topic.id }}
                          search={{ mode: "check" }}
                          className="sov-level__check"
                        >
                          {done ? "Пройти проверочную ещё раз" : "Сразу проверочная работа"}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              </section>
            );
          })}
          </div>
        )}

        {/* Лавка вместо полки наград. Раньше вещь выдавалась вместе с ростом
            на том же уровне — выбора не было ни в чём. Теперь совёнок растёт
            сам, а вещи ребёнок покупает за пёрышки, которые приносит в том
            числе домашняя работа. */}
        <section className="sov-quest">
          <header className="sov-quest__head">
            <h2>Лавка совёнка</h2>
            <span className="sov-quest__count">{coinsLabel(data.coins)}</span>
          </header>
          <p className="sov-shop__hint">
            Пёрышки капают за сделанную домашку и за пройденные темы. Совёнок растёт сам —
            в лавке только наряды.
          </p>
          <div className="sov-shelf">
            {SHOP.map((goods) => {
              const owned = data.owned.includes(goods.id);
              const worn = data.equipped === goods.id;
              const levelOk = data.level >= goods.minLevel;
              const enough = data.coins >= goods.cost;
              return (
                <div
                  key={goods.id}
                  className="sov-shelf__item"
                  data-open={owned || (levelOk && enough)}
                >
                  <Owl size={44} stage={stage} item={goods.id} mood={owned ? "happy" : "sleepy"} />
                  <strong>{goods.title}</strong>
                  <span>{!levelOk ? `Откроется на уровне ${goods.minLevel}` : goods.note}</span>
                  {owned ? (
                    <button
                      type="button"
                      className="sov-act-ghost"
                      disabled={worn || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          applyOwl(
                            await equipOwlItem({
                              data: { childId, item: worn ? "none" : goods.id },
                            }),
                          );
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Не получилось переодеть");
                        }
                        setBusy(false);
                      }}
                    >
                      {worn ? "Надето" : "Надеть"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sov-act-ghost"
                      disabled={!levelOk || !enough || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          applyOwl(await buyOwlItem({ data: { childId, item: goods.id } }));
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Не получилось купить");
                        }
                        setBusy(false);
                      }}
                    >
                      {goods.cost} пёрышек
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {data.equipped !== "none" ? (
            <p className="sov-shop__hint">
              <button
                type="button"
                className="sov-act-ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  applyOwl(await equipOwlItem({ data: { childId, item: "none" } }));
                  setBusy(false);
                }}
              >
                Снять всё
              </button>
            </p>
          ) : null}
        </section>

        {/* Панель «Остальные темы пока закрыты» отсюда убрана: замок на
            кружке и подпись «Откроется с подпиской» под ним говорят то же
            самое там, где ребёнок на это смотрит, — а не абзацем в конце
            страницы, до которого он не доскроллит. */}
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
                <div key={r.subjectId} className="sov-save-hint">
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
            Если не знаешь ответ, пропусти. Это не оценка. Не читаешь — нажми ушко, вопрос
            прочитают вслух.
          </p>
          {diag.blocks.map((block) => (
            <div key={block.subjectId} style={{ marginTop: 30 }}>
              <h3 style={{ fontSize: "1.2rem" }}>{block.subjectName}</h3>
              {block.tasks.map((task) => (
                <div key={task.id} style={{ marginTop: 18 }}>
                  <div className="sov-ask">
                    <p style={{ fontWeight: 700 }}>{task.prompt}</p>
                    <SpeakButton compact text={task.prompt} />
                  </div>
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
                      style={{ marginTop: 8, padding: "12px 15px", border: "2px solid var(--sov-line)", borderRadius: 12, fontSize: "1rem", fontWeight: 600, fontFamily: "var(--sov-font)" }}
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

/**
 * Своё задание от педагога: текст, файл и поле ответа.
 *
 * Проверяет его человек, а не платформа, поэтому здесь нет «верно» и
 * «неверно» — есть отправленный ответ и оценка, когда педагог посмотрит.
 */
function CustomItem({
  item,
  onDone,
}: {
  item: {
    id: string;
    name: string;
    body?: string | null;
    fileName?: string | null;
    answer?: string | null;
    answerFile?: string | null;
    submittedAt?: string | null;
    grade?: number | null;
    comment?: string | null;
  };
  onDone: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState(item.answer ?? "");
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div id={`zadanie-${item.id}`} className="sov-homework__custom" data-done={!!item.grade}>
      <strong>{item.name}</strong>
      {item.body ? <p>{item.body}</p> : null}

      {item.fileName ? (
        <button
          type="button"
          className="sov-homework__file"
          onClick={async () => {
            const got = await customTaskFile({ data: { itemId: item.id, which: "task" } });
            const bytes = Uint8Array.from(atob(got.data), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(
              new Blob([bytes], { type: got.type ?? "application/octet-stream" }),
            );
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          }}
        >
          Открыть {item.fileName}
        </button>
      ) : null}

      {item.grade ? (
        <span className="sov-homework__grade">
          Оценка {item.grade}
          {item.comment ? ` · ${item.comment}` : ""}
        </span>
      ) : (
        <>
          <textarea
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Напиши ответ или что сделал"
          />

          {/* Работа чаще всего сделана в тетради — её проще сфотографировать,
              чем переписывать в поле. Поэтому фотография это полноценный
              ответ, а не приложение к тексту. */}
          <label className="sov-homework__attach">
            <input
              type="file"
              accept=".pdf,image/*"
              capture="environment"
              onChange={async (e) => {
                const picked = e.target.files?.[0];
                if (!picked) {
                  setFile(null);
                  return;
                }
                if (picked.size > 1_500_000) {
                  setError("Файл больше 1,5 МБ — сфотографируй помельче");
                  e.target.value = "";
                  return;
                }
                const bytes = new Uint8Array(await picked.arrayBuffer());
                let binary = "";
                for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
                setFile({ name: picked.name, type: picked.type, data: btoa(binary) });
                setError(null);
              }}
            />
            <span>{file ? `Выбрано: ${file.name}` : "Сфотографировать или выбрать файл"}</span>
          </label>

          {item.answerFile && !file ? (
            <span className="sov-homework__grade">Уже отправлено: {item.answerFile}</span>
          ) : null}
          {error ? <span className="sov-homework__grade">{error}</span> : null}
          <button
            type="button"
            className="sov-act-child"
            disabled={pending || (!answer.trim() && !file)}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                await submitCustomAnswer({ data: { itemId: item.id, answer, file } });
                await onDone();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Не получилось отправить");
              }
              setPending(false);
            }}
          >
            {item.submittedAt ? "Отправить ещё раз" : "Отправить педагогу"}
          </button>
          {item.submittedAt ? (
            <span className="sov-homework__grade">Отправлено, ждём проверки</span>
          ) : null}
        </>
      )}
    </div>
  );
}
