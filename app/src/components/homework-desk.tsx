/**
 * Стол домашней работы: список выданного и форма «задать на дом».
 *
 * Один компонент на два кабинета. Репетитор открывает его в карточке
 * ученика, родитель — во вкладке «Задания» своего кабинета, и делают
 * они ровно одно и то же: отмечают темы и тренажёры, выставляют
 * настройки тренажёра, пишут своё задание с файлом, ставят оценку за
 * ответ. Пока форма жила внутри /repetitor/uchenik, родителю оставалось
 * только смотреть на процент и «не задана» — и звать репетитора, даже
 * когда он занимается с ребёнком сам.
 *
 * Слова различаются: репетитору — «ученик», родителю — «ребёнок». Это
 * единственное, что зависит от audience; данные и ручки общие
 * (lib/api/tutor.functions.ts, studentCard).
 */

import { useRef, useState } from "react";

import { SearchIcon } from "./icons";
import { TRAINERS } from "./trainers";
import type { DrillId, DrillSettings } from "../lib/drills";
import {
  defaultDrillSettings,
  describeDrillSettings,
  DRILL_OPTIONS,
  isDrillId,
  trimDrillSettings,
} from "../lib/drills";
import { plural } from "../lib/shop";
import {
  createAssignment,
  createCustomAssignment,
  customTaskFile,
  deleteAssignment,
  gradeCustomAnswer,
  type studentCard,
} from "../lib/api/tutor.functions";

export type HomeworkCard = Awaited<ReturnType<typeof studentCard>>;

export type Audience = "tutor" | "parent";

const DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

const STATUS_LABEL: Record<string, string> = {
  done: "выполнено",
  overdue: "просрочено",
  in_progress: "в работе",
  new: "не начато",
};

/** Порог зоны риска. Тот же, что в кабинете родителя и в зачёте темы. */
const RISK_PERCENT = 70;

/**
 * Слова, которые зависят от того, кто смотрит. Репетитор говорит про
 * ученика и знает раздел «Темы и задания», родитель — про ребёнка, и
 * раздела с программой у него нет.
 */
const WORDS: Record<
  Audience,
  {
    who: string;
    whoGen: string;
    whoDat: string;
    whoPl: string;
    topicsHint: string;
    customIntro: string;
    /** Подпись у задания, которое выдал другой взрослый. */
    theirs: string;
  }
> = {
  tutor: {
    who: "ученик",
    whoGen: "ученика",
    whoDat: "ученику",
    whoPl: "ученикам",
    topicsHint:
      "Здесь вся программа начальной школы — тот же список, что в разделе «Темы и задания». Сначала класс ученика, соседние классы под отдельной строкой.",
    customIntro:
      "Ученик увидит его в домашке и ответит текстом или фотографией, а вы поставите оценку. Платформа такие задания не проверяет.",
    theirs: "задали родители",
  },
  parent: {
    who: "ребёнок",
    whoGen: "ребёнка",
    whoDat: "ребёнку",
    whoPl: "детям",
    topicsHint:
      "Здесь вся программа начальной школы. Сначала класс ребёнка, соседние классы под отдельной строкой.",
    customIntro:
      "Ребёнок увидит его в домашке и ответит текстом или фотографией, а вы поставите оценку. Платформа такие задания не проверяет.",
    theirs: "задал наставник",
  },
};

/** Подпись настроек у выданного тренажёра: «двузначные · без таймера · 20». */
function drillNote(id: DrillId, settings: DrillSettings | null): string {
  const note = describeDrillSettings(id, settings);
  return note ? ` — ${note}` : " — как обычно";
}

/** Срок по умолчанию — неделя: типичный шаг между занятиями. */
function defaultDue(): string {
  return new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
}

/**
 * Список выданного и форма выдачи.
 *
 * Черновик выбора живёт здесь, поэтому при смене ученика компонент надо
 * перемонтировать (key={childId}): иначе отмеченные темы переехали бы в
 * чужую карточку и выдались бы не тому.
 */
export function HomeworkDesk({
  childId,
  card,
  audience,
  onReload,
}: {
  childId: string;
  card: HomeworkCard;
  audience: Audience;
  onReload: () => Promise<void>;
}) {
  const words = WORDS[audience];
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [drills, setDrills] = useState<string[]>([]);
  // Настройки тренажёра живут отдельно от отметки «задан»: снятая и снова
  // поставленная галочка не должна стирать выставленную разрядность.
  const [drillSettings, setDrillSettings] = useState<Record<string, DrillSettings>>({});
  const [alsoFor, setAlsoFor] = useState<string[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  // Какое задание переспрашивает подтверждение удаления. Хранится id, а не
  // флаг: карточек на странице много, а переспрашивать должна одна.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const chosen = picked.length + drills.length;
  const empty = chosen === 0;

  const toggleTopic = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Вкладка по умолчанию — первый предмет.
  const activeTab = tab ?? card.subjects[0]?.id ?? null;
  const search = query.trim().toLowerCase();
  const risky = card.topics
    .filter((t) => t.percent !== null && t.percent < RISK_PERCENT)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0));
  const riskyIds = new Set(risky.map((t) => t.id));
  // Просевшие темы уже стоят наверху — во втором списке они не повторяются,
  // пока их не ищут поиском по имени.
  const shownTopics = card.topics.filter((t) =>
    search
      ? t.name.toLowerCase().includes(search)
      : t.subject_id === activeTab && !riskyIds.has(t.id),
  );

  /*
   * Свой класс — списком, чужие — под раскрывашкой.
   *
   * Тем в начальной школе почти восемьдесят, и вываливать их одним полем
   * чипов бессмысленно: ищут тему своего второклассника, а глаз идёт по
   * всем четырём классам сразу. Чужой класс при этом не запрещён — добор
   * первого и уход вперёд случаются на каждом втором занятии, — он просто
   * вынесен за отдельную строку, чтобы это был осознанный выбор, а не
   * случайное попадание в соседний чип.
   */
  const ownGrade = shownTopics.filter((t) => t.grade === card.child.grade);
  const otherGrades = [
    ...new Set(shownTopics.filter((t) => t.grade !== card.child.grade).map((t) => t.grade)),
  ]
    .sort((a, b) => a - b)
    .map((grade) => ({ grade, topics: shownTopics.filter((t) => t.grade === grade) }));
  const otherCount = otherGrades.reduce((sum, g) => sum + g.topics.length, 0);

  const shownIds = new Set([...shownTopics.map((t) => t.id), ...risky.map((t) => t.id)]);
  const pickedElsewhere = card.topics.filter((t) => picked.includes(t.id) && !shownIds.has(t.id));

  /** Чип темы. Закрытая подпиской не нажимается: сервер её всё равно не примет. */
  const topicChip = (t: HomeworkCard["topics"][number], extra?: { risk?: boolean }) => (
    <button
      key={t.id}
      type="button"
      className="sov-chip"
      data-risk={extra?.risk ? "true" : undefined}
      data-active={picked.includes(t.id)}
      disabled={t.locked}
      title={t.locked ? `Тема откроется ${words.whoDat} с подпиской` : undefined}
      onClick={() => toggleTopic(t.id)}
    >
      {t.name}
      {extra?.risk ? (
        <em style={{ fontStyle: "normal", opacity: 0.75 }}> · {t.percent}%</em>
      ) : (
        <em style={{ fontStyle: "normal", opacity: 0.6 }}> · {t.grade} кл.</em>
      )}
      {t.locked ? <em style={{ fontStyle: "normal", opacity: 0.75 }}> · по подписке</em> : null}
      {!t.locked && t.status === "completed" ? " ✓" : ""}
    </button>
  );

  const drillSettingsFor = (id: string): DrillSettings =>
    drillSettings[id] ?? defaultDrillSettings(id as DrillId);

  /** Одно значение настройки: у одиночного оно заменяется, у списочного копится. */
  function setDrillValue(id: string, key: string, value: string, multi: boolean) {
    setDrillSettings((prev) => {
      const current = prev[id] ?? defaultDrillSettings(id as DrillId);
      if (!multi) return { ...prev, [id]: { ...current, [key]: value } };
      const chosenValues = (current[key] ?? "").split(",").filter(Boolean);
      const next = chosenValues.includes(value)
        ? chosenValues.filter((v) => v !== value)
        : [...chosenValues, value];
      // Пустой список сломал бы тренажёр: без единого действия считать
      // нечего, и он просто не запустится. Последнюю галочку не снимаем.
      if (next.length === 0) return prev;
      return { ...prev, [id]: { ...current, [key]: next.join(",") } };
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await createAssignment({
        data: {
          childIds: [childId, ...alsoFor],
          title: String(form.get("title") ?? "").trim() || "Домашняя работа",
          comment: String(form.get("comment") ?? "").trim() || null,
          dueAt: form.get("due") ? new Date(String(form.get("due"))).toISOString() : null,
          items: [
            ...picked.map((id) => ({
              kind: "topic" as const,
              refId: id,
              targetPercent: Number(form.get("target") ?? 70),
            })),
            ...drills.map((kind) => ({
              kind: "drill" as const,
              refId: kind,
              targetPercent: 0,
              settings: trimDrillSettings(kind as DrillId, drillSettingsFor(kind)),
            })),
          ],
        },
      });
      setPicked([]);
      setDrills([]);
      setAlsoFor([]);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось выдать задание");
    }
    setPending(false);
  }

  return (
    <>
      {error ? (
        <div className="sov-alert" style={{ marginTop: 18 }}>
          {error}
        </div>
      ) : null}

      {/* Своё задание стоит над списком выданного: в самом низу страницы,
          под длинным перечнем тем, кнопку просто не находили. */}
      <CustomForm childId={childId} words={words} onDone={onReload} />

      <section style={{ marginTop: 34 }}>
        <h2 style={{ fontSize: "var(--sov-t-h2)" }}>Домашняя работа</h2>
        {card.assignments.length === 0 ? (
          <p style={{ marginTop: 10, color: "var(--sov-ink-soft)", fontWeight: 500 }}>
            Пока ничего не задано.
          </p>
        ) : (
          <div className="sov-hw-list">
            {card.assignments.map((a) => (
              <article key={a.id} className="sov-hw-card" data-status={a.status}>
                <header>
                  <strong>{a.title}</strong>
                  <span className="sov-hw-card__status">{STATUS_LABEL[a.status]}</span>
                </header>
                <p className="sov-mono">
                  {a.doneCount} из {a.total}
                  {a.dueAt ? ` · срок ${DATE.format(new Date(a.dueAt))}` : " · без срока"}
                  {/* Чужое задание подписано: у ребёнка с репетитором и
                      родителем в одном списке лежат оба, и без подписи не
                      понять, почему у половины нет кнопки «удалить». */}
                  {a.mine ? "" : ` · ${words.theirs}`}
                </p>
                <ul>
                  {a.items.map((item) => (
                    <li key={item.id} data-done={item.done}>
                      {item.done ? "✓" : "•"} {item.name}
                      {item.kind === "topic" ? (
                        <em>
                          {item.bestPercent === null
                            ? " — не начато"
                            : ` — ${item.bestPercent}% из ${item.targetPercent}%`}
                        </em>
                      ) : null}
                      {/* С какими настройками задали тренажёр: без этой
                          строки выданное «двузначные без таймера» нигде
                          больше не видно. */}
                      {item.kind === "drill" && isDrillId(item.refId) ? (
                        <em>{drillNote(item.refId, item.settings ?? null)}</em>
                      ) : null}
                      {item.kind === "custom" ? (
                        <CustomAnswer item={item} mine={a.mine} words={words} onDone={onReload} />
                      ) : null}
                    </li>
                  ))}
                </ul>
                {a.comment ? <p className="sov-hw-card__comment">{a.comment}</p> : null}
                {/* Удаление настоящее: задание, вложение и ответы стираются
                    из базы. Поэтому спрашиваем подтверждение прямо в кнопке —
                    отдельное окно ради одного вопроса здесь лишнее. Чужое
                    задание не удалить: сервер откажет, и кнопки нет. */}
                {a.mine ? (
                  <button
                    type="button"
                    className="sov-act-ghost"
                    onClick={async () => {
                      if (confirmDelete !== a.id) {
                        setConfirmDelete(a.id);
                        return;
                      }
                      try {
                        await deleteAssignment({ data: { id: a.id } });
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Не получилось удалить");
                      }
                      setConfirmDelete(null);
                      await onReload();
                    }}
                  >
                    {confirmDelete === a.id ? "Точно удалить? Нажмите ещё раз" : "Удалить задание"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <form className="sov-panel sov-form" style={{ marginTop: 30 }} onSubmit={submit}>
        <h3>Задать на дом</h3>
        <div className="sov-field">
          <label htmlFor="hw-title">Название</label>
          <input id="hw-title" name="title" defaultValue="Домашняя работа" required />
        </div>

        {/* Просевшие темы — первыми и отдельно.

            В форму приходят, уже зная, что задавать: на занятии видно, где
            ученик плывёт. Раньше это знание приходилось заново искать
            глазами в ровном поле из двух десятков чипов, где провал ничем
            не отличался от пройденного. Теперь темы ниже порога вынесены
            наверх со своей долей верных, и выбор начинается с них. */}
        {risky.length > 0 ? (
          <div className="sov-field">
            <label>Просело у {words.whoGen}</label>
            <span className="sov-field__hint">
              Темы, где верных меньше {RISK_PERCENT}%. Считается по всем ответам, а не по последнему
              занятию.
            </span>
            <div className="sov-chips">{risky.map((t) => topicChip(t, { risk: true }))}</div>
          </div>
        ) : null}

        <div className="sov-field">
          <label>Темы</label>
          <span className="sov-field__hint">{words.topicsHint}</span>

          {/* Вкладка на предмет и поиск: сорок тем предмета — это стена,
              по которой глаз идёт медленнее, чем пальцы набирают «вычит». */}
          <div className="sov-tabs sov-tabs--inline">
            {card.subjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                data-active={activeTab === subject.id}
                onClick={() => setTab(subject.id)}
              >
                {subject.name}
              </button>
            ))}
          </div>

          <label className="sov-search">
            <SearchIcon size={17} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти тему"
              aria-label="Найти тему"
            />
          </label>

          <div className="sov-chips">
            {ownGrade.map((t) => topicChip(t))}
            {/* Пустой список — это два разных случая, и валить их в одну
                подпись нельзя: «ничего не нашлось по запросу «»» на чистой
                базе выглядит поломкой, а не ответом. */}
            {shownTopics.length === 0 ? (
              <span className="sov-field__hint">
                {search
                  ? `Ничего не нашлось по запросу «${query}».`
                  : "Тем пока нет — учебный контент создаётся при первом обращении к приложению."}
              </span>
            ) : ownGrade.length === 0 ? (
              <span className="sov-field__hint">
                В {card.child.grade} классе по этому предмету подходящих тем нет — смотрите соседние
                классы ниже.
              </span>
            ) : null}
          </div>

          {otherCount > 0 ? (
            <details className="sov-grades" open={!!search}>
              <summary>
                Темы других классов: {otherCount}
                <em>добор пройденного и работа на опережение — задаются так же, как свои</em>
              </summary>
              {otherGrades.map((group) => (
                <div key={group.grade} className="sov-grades__block">
                  <span className="sov-grades__label">{group.grade} класс</span>
                  <div className="sov-chips">{group.topics.map((t) => topicChip(t))}</div>
                </div>
              ))}
            </details>
          ) : null}

          {/* Выбранное из других вкладок не должно исчезать из виду:
              иначе отмечают математику, переключаются на русский и не
              понимают, задалась первая тема или нет. */}
          {pickedElsewhere.length > 0 ? (
            <span className="sov-field__hint">
              Ещё выбрано в другом предмете: {pickedElsewhere.map((t) => t.name).join(", ")}.
            </span>
          ) : null}
        </div>

        {/* Тренажёр задаётся со своими настройками.

            Раньше уезжал только сам тренажёр, а «поставь двузначные и
            убери таймер» передавали ребёнку словами — то есть не
            передавали. Настройки те же самые, что на экране самого
            тренажёра, и раскрываются они только у отмеченного: пять
            развёрнутых наборов сразу превратили бы форму в стену. */}
        <div className="sov-field">
          <label>Тренажёры</label>
          <div className="sov-chips">
            {TRAINERS.map((d) => (
              <button
                key={d.id}
                type="button"
                className="sov-chip"
                data-active={drills.includes(d.id)}
                onClick={() =>
                  setDrills((prev) =>
                    prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                  )
                }
              >
                {d.title}
              </button>
            ))}
          </div>

          {TRAINERS.filter((d) => drills.includes(d.id)).map((d) => (
            <div key={d.id} className="sov-drill-setup">
              <strong className="sov-drill-setup__name">{d.title}</strong>
              {DRILL_OPTIONS[d.id].map((option) => {
                const chosenValues = (drillSettingsFor(d.id)[option.key] ?? "").split(",");
                return (
                  <div key={option.key} className="sov-drill-setup__row">
                    <span className="sov-drill-setup__label">{option.label}</span>
                    <div className="sov-chips">
                      {option.values.map((value) => (
                        <button
                          key={value.value}
                          type="button"
                          className="sov-chip"
                          data-active={chosenValues.includes(value.value)}
                          onClick={() => setDrillValue(d.id, option.key, value.value, option.multi)}
                        >
                          {value.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sov-field">
          <label htmlFor="hw-target">Засчитывать тему от</label>
          <select id="hw-target" name="target" defaultValue="70">
            <option value="50">50% верных</option>
            <option value="70">70% верных</option>
            <option value="90">90% верных</option>
          </select>
          <span className="sov-field__hint">
            Пункт закрывается, когда после выдачи задания было занятие с такой долей верных.
          </span>
        </div>

        <div className="sov-field">
          <label htmlFor="hw-due">Срок</label>
          <input id="hw-due" name="due" type="date" defaultValue={defaultDue()} />
        </div>

        <div className="sov-field">
          <label htmlFor="hw-comment">Комментарий ребёнку, по желанию</label>
          <input id="hw-comment" name="comment" placeholder="Начни со счёта, потом темы" />
        </div>

        {/* Та же домашка — сразу нескольким.

            Педагог, который ведёт группу по одной программе, проходил эту
            форму по разу на ученика; родителю с двумя детьми — по разу на
            ребёнка. Каждый получает свою домашку со своим сроком и своим
            прогрессом — общей записи «на группу» не появляется, снять
            можно по отдельности. */}
        {card.classmates.length > 0 ? (
          <div className="sov-field">
            <label>Отправить ещё</label>
            <span className="sov-field__hint">
              Каждый получит свою домашку с этим же составом и сроком.
            </span>
            <div className="sov-chips">
              {card.classmates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="sov-chip"
                  data-active={alsoFor.includes(c.id)}
                  onClick={() =>
                    setAlsoFor((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                    )
                  }
                >
                  {c.name}
                  <em style={{ fontStyle: "normal", opacity: 0.6 }}> · {c.grade} кл.</em>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Своя кнопка, а не FormAction: тот подменяет подпись на «Секунду…»
            по признаку pending, и пустой выбор выглядел бы как отправка.
            Подпись называет результат целиком — сколько пунктов и скольким
            детям, — чтобы массовая выдача не случилась незаметно. */}
        <button type="submit" className="sov-act-child" disabled={pending || empty}>
          {pending
            ? "Секунду…"
            : empty
              ? "Выберите хотя бы один пункт"
              : alsoFor.length > 0
                ? `Задать ${chosen} ${plural(chosen, "пункт", "пункта", "пунктов")} ${alsoFor.length + 1} ${words.whoPl}`
                : `Задать: ${chosen}`}
        </button>
      </form>
    </>
  );
}

/**
 * Своё задание: текст руками и, если нужно, файл.
 *
 * Файл уходит в base64 вместе с формой — объектного хранилища на своём
 * сервере нет, а приложение живёт в workerd и не имеет файловой системы.
 * Отсюда и жёсткий предел размера: вложения лежат в базе, которую дампят.
 */
function CustomForm({
  childId,
  words,
  onDone,
}: {
  childId: string;
  words: (typeof WORDS)[Audience];
  onDone: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null);
  // Сбросить выбор одним состоянием нельзя: пока в input лежит прежнее имя,
  // повторный выбор того же файла не считается изменением.
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (!open) {
    return (
      <div style={{ marginTop: 30 }}>
        <button type="button" className="sov-act-ghost" onClick={() => setOpen(true)}>
          Своё задание: текст или файл
        </button>
        {ok ? (
          <p className="sov-prog__ok" style={{ marginTop: 10 }}>
            Задание отправлено {words.whoDat}.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="sov-panel sov-form"
      style={{ marginTop: 30 }}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        try {
          await createCustomAssignment({
            data: {
              childIds: [childId],
              title: String(form.get("title") ?? "").trim(),
              body: String(form.get("body") ?? "").trim() || null,
              dueAt: form.get("due") ? new Date(String(form.get("due"))).toISOString() : null,
              file,
            },
          });
          setOk(true);
          setOpen(false);
          setFile(null);
          await onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не получилось отправить");
        }
        setPending(false);
      }}
    >
      <h3>Своё задание</h3>
      <p style={{ color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
        {words.customIntro}
      </p>

      {error ? <div className="sov-alert">{error}</div> : null}

      <div className="sov-field">
        <label htmlFor="ctitle">Название</label>
        <input id="ctitle" name="title" required placeholder="Прописи, страница 14" />
      </div>

      <div className="sov-field">
        <label htmlFor="cbody">Что сделать</label>
        <textarea id="cbody" name="body" rows={4} placeholder="Спиши слова и подчеркни гласные" />
      </div>

      <div className="sov-field">
        <label htmlFor="cfile">Файл, по желанию</label>
        <div className="sov-attach">
          <input
            id="cfile"
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              if (!picked) {
                setFile(null);
                return;
              }
              if (picked.size > 1_500_000) {
                setError("Файл больше 1,5 МБ — приложите файл поменьше");
                e.target.value = "";
                return;
              }
              const buffer = await picked.arrayBuffer();
              let binary = "";
              const bytes = new Uint8Array(buffer);
              for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
              setFile({ name: picked.name, type: picked.type, data: btoa(binary) });
              setError(null);
            }}
          />
          {file ? (
            <button
              type="button"
              className="sov-attach__clear"
              aria-label={`Убрать файл ${file.name}`}
              title="Убрать файл"
              onClick={() => {
                setFile(null);
                setError(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        <span className="sov-field__hint">
          PDF или картинка, до 1,5 МБ. Нельзя прикреплять изображения людей и иные персональные
          данные.
        </span>
      </div>

      <div className="sov-field">
        <label htmlFor="cdue">Срок</label>
        <input id="cdue" name="due" type="date" defaultValue={defaultDue()} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="sov-act-child" disabled={pending}>
          {pending ? "Отправляем…" : `Отправить ${words.whoDat}`}
        </button>
        <button type="button" className="sov-act-ghost" onClick={() => setOpen(false)}>
          Отмена
        </button>
      </div>
    </form>
  );
}

/**
 * Ответ на своё задание и оценка за него.
 *
 * Оценку ставит автор задания: у чужого форма не показывается — сервер
 * всё равно откажет, а взрослому незачем видеть кнопку, которая не его.
 */
function CustomAnswer({
  item,
  mine,
  words,
  onDone,
}: {
  item: {
    id: string;
    answer?: string | null;
    submittedAt?: string | null;
    grade?: number | null;
    comment?: string | null;
    fileName?: string | null;
    answerFile?: string | null;
  };
  mine: boolean;
  words: (typeof WORDS)[Audience];
  onDone: () => Promise<void>;
}) {
  const [grade, setGrade] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);

  if (!item.submittedAt) {
    return (
      <div className="sov-custom">
        <span className="sov-custom__meta">
          Ответа пока нет{item.fileName ? ` · приложен файл ${item.fileName}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="sov-custom">
      <span className="sov-custom__meta">Ответ {words.whoGen}</span>
      {item.answer ? <p className="sov-custom__answer">{item.answer}</p> : null}
      {item.answerFile ? (
        <button
          type="button"
          className="sov-homework__file"
          onClick={async () => {
            const got = await customTaskFile({ data: { itemId: item.id, which: "answer" } });
            const bytes = Uint8Array.from(atob(got.data), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(
              new Blob([bytes], { type: got.type ?? "application/octet-stream" }),
            );
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          }}
        >
          Открыть {item.answerFile}
        </button>
      ) : null}

      {item.grade ? (
        <span className="sov-custom__grade">
          Оценка {item.grade}
          {item.comment ? ` · ${item.comment}` : ""}
        </span>
      ) : !mine ? (
        <span className="sov-custom__grade">Ждёт проверки — оценку ставит тот, кто задал</span>
      ) : (
        <div className="sov-custom__grade-form">
          <div className="sov-chips">
            {[5, 4, 3, 2].map((g) => (
              <button
                key={g}
                type="button"
                className="sov-chip"
                data-active={grade === g}
                onClick={() => setGrade(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Комментарий, по желанию"
          />
          <button
            type="button"
            className="sov-act-ghost"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await gradeCustomAnswer({
                data: { itemId: item.id, grade, comment: comment || null },
              });
              await onDone();
              setPending(false);
            }}
          >
            Поставить оценку
          </button>
        </div>
      )}
    </div>
  );
}
