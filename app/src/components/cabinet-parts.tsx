/**
 * Части кабинета взрослого, общие для всех его экранов.
 *
 * Сюда переехало то, что раньше жило внутри одного файла /roditel: дверь с
 * кодом, профиль ребёнка, напоминания, удаление. Кабинет перестал быть одним
 * экраном со вкладками и разъехался по адресам /kabinet/*, а эти части нужны
 * сразу нескольким из них — и родителю, и репетитору.
 *
 * Код экрана не переписан, а перенесён: у каждого блока своя история правок,
 * и переписывать их заново значит терять её вместе с причинами.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  CHILD_AVATARS,
  ChildAvatar,
  FormAction,
  Owl,
  QuietAction,
  SiteFooter,
  SiteHeader,
} from "./brand";
import {
  addChild,
  deleteAccount,
  deleteChild,
  lockParentCabinet,
  logout,
  me,
  notifyConnect,
  notifyDisconnect,
  notifySettings,
  notifyToggle,
  requestParentPinReset,
  setParentPin,
  unlockParentCabinet,
} from "../lib/api/app.functions";
import { capsFor } from "../lib/cabinet";

/** Кто вошёл и к каким детям у него доступ. Ответ me() целиком. */
export type Account = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    subscriptionStatus: string;
  } | null;
  // Строка children целиком, как её отдаёт me(): лимит времени и звук
  // нужны странице настроек, и ради двух чисел отдельный запрос не нужен.
  // access — кем взрослый приходится этому ребёнку: своих и чужих детей у
  // одного человека может быть поровну.
  children: {
    id: string;
    name: string;
    grade: number;
    avatar: string;
    daily_limit_min: number;
    sound_on: number;
    access: string;
  }[];
  activeChildId: string | null;
  /** Согласия на обработку данных ребёнка ещё нет: спросим при заведении. */
  needsChildConsent: boolean;
  parentPinSet: boolean;
  parentUnlocked: boolean;
};

type Channel = {
  channel: "tg" | "max";
  title: string;
  ready: boolean;
  connected: boolean;
  enabled: boolean;
  code: string | null;
};

/**
 * Профиль ребёнка. Без подписки его можно завести один.
 *
 * Когда место занято, формы здесь нет вовсе — вместо неё объяснение и
 * два выхода. Показывать форму, которая заведомо получит отказ, значит
 * заставить человека набрать имя, выбрать класс и аватар ради сообщения
 * об ошибке; про ограничение честнее сказать до того, как он начал.
 *
 * Второй выход — код репетитора — здесь важнее первого: у семьи, чей
 * ребёнок занимается с репетитором, платит репетитор, и предлагать ей
 * подписку первой было бы продажей того, что уже оплачено.
 */
export function AddChildForm({
  onAdded,
  compact,
  limited,
  needsConsent = false,
}: {
  onAdded: () => Promise<void>;
  compact?: boolean;
  limited?: boolean;
  /**
   * Спросить согласие законного представителя.
   *
   * У родителя оно взято на регистрации, у репетитора — нет: там данные
   * учеников подтверждают их родители по приглашению. Но свой ребёнок у
   * репетитора тоже бывает, и за него согласие даёт он сам — здесь, той же
   * строкой, что стоит в регистрации родителя.
   */
  needsConsent?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [avatar, setAvatar] = useState("owl");
  const [error, setError] = useState<string | null>(null);

  if (limited) {
    return (
      <div className="sov-save-hint" style={{ marginTop: compact ? 16 : 32, maxWidth: 520 }}>
        <strong>Без подписки можно завести одного ребёнка</strong>
        <span>
          Если с ребёнком занимается репетитор, попросите у него код приглашения — тогда платить не
          нужно вовсе. Если занимаетесь сами, второй профиль откроет подписка.
        </span>
        <p style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <QuietAction to="/priglashenie">Ввести код репетитора</QuietAction>
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: compact ? 16 : 32, maxWidth: 520 }}>
      {!compact ? (
        <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Добавьте профиль ребёнка</h2>
      ) : null}
      <form
        className="sov-form ym-hide-content ym-disable-keys"
        style={{ marginTop: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setPending(true);
          setError(null);
          // Отказ сервера здесь раньше был необработанным: форма молча
          // ничего не делала. Теперь у неё есть ветка на «нет».
          try {
            await addChild({
              data: {
                name: String(form.get("name") ?? ""),
                grade: Number(form.get("grade") ?? 1),
                avatar,
                birthYear: null,
                consentChildPd: form.get("consentChildPd") === "on",
              },
            });
            (e.target as HTMLFormElement).reset();
            await onAdded();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Не получилось добавить профиль");
          } finally {
            setPending(false);
          }
        }}
      >
        {error ? <div className="sov-alert">{error}</div> : null}
        <div className="sov-field">
          <label htmlFor="childname">Имя ребёнка</label>
          {/* Пробел не вводится и не вставляется: одно поле — одно имя.
              Фамилию Совёнок не собирает, и сервер её тоже не пропустит
              (addChild в app.functions.ts). */}
          <input
            id="childname"
            name="name"
            required
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(/\s+/g, "");
            }}
          />
        </div>
        <div className="sov-field">
          <label htmlFor="childgrade">Класс</label>
          <select id="childgrade" name="grade" defaultValue="1">
            <option value="1">1 класс</option>
            <option value="2">2 класс</option>
            <option value="3">3 класс</option>
            <option value="4">4 класс</option>
          </select>
        </div>
        {/* Аватар нужен не для красоты: по нему ребёнок находит себя на экране
            выбора профиля, ещё не умея читать имена. */}
        <div className="sov-field">
          <label>Аватар</label>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
        {/* Та же строка, что в регистрации родителя: согласие за ребёнка
            даёт законный представитель, и текст у него один. */}
        {needsConsent ? (
          <label className="sov-check">
            <input type="checkbox" name="consentChildPd" required />
            <span>
              Я родитель или иной законный представитель и даю согласие на обработку персональных
              данных ребёнка — имя, класс, аватар, ответы и время занятий, фотографии работ — на
              условиях{" "}
              <a href="/politika" target="_blank" rel="noreferrer">
                Политики
              </a>
              .
            </span>
          </label>
        ) : null}
        <FormAction pending={pending}>Добавить</FormAction>
      </form>
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="sov-avatar-pick">
      {CHILD_AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          className="sov-avatar-pick__item"
          data-active={value === a.id}
          aria-label={a.label}
          aria-pressed={value === a.id}
          onClick={() => onChange(a.id)}
        >
          <ChildAvatar avatar={a.id} size={44} />
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Дверь в кабинет: придумать код или ввести его. Пока кода нет, кабинет
 * открыт — иначе родитель, заведённый до появления этой проверки, оказался бы
 * заперт снаружи; поэтому первый экран не пропускает дальше без кода.
 */
export function PinGate({ creating, onDone }: { creating: boolean; onDone: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /* Куда ушло письмо со ссылкой на новый код. null — ещё не просили.
     Адрес показываем возвращённый сервером, а не введённый: спрашивать
     почту здесь нечего, дверь кабинета стоит уже за входом в аккаунт. */
  const [mailed, setMailed] = useState<{ sent: boolean; email: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (creating) {
        if (pin !== repeat) throw new Error("Коды не совпали");
        await setParentPin({ data: { pin, currentPin: null } });
      } else {
        await unlockParentCabinet({ data: { pin } });
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось");
      setPin("");
      setRepeat("");
    }
    setPending(false);
  }

  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-narrow" style={{ paddingBottom: 80 }}>
        <Owl size={64} />
        <h1 style={{ fontSize: "var(--sov-t-h1)", fontWeight: 700, marginTop: 18 }}>
          {creating ? "Придумайте код родителя" : "Кабинет родителя закрыт"}
        </h1>
        <p style={{ marginTop: 12, color: "var(--sov-ink-soft)" }}>
          {creating
            ? "Четыре цифры, которые знает только взрослый. Занятия ребёнка кодом не закрываются — он заходит в них сам."
            : "Введите четыре цифры, чтобы открыть отчёты, настройки и подписку."}
        </p>
        <form
          className="sov-form ym-hide-content ym-disable-keys"
          style={{ marginTop: 30 }}
          onSubmit={submit}
        >
          {error ? <div className="sov-alert">{error}</div> : null}
          <div className="sov-field">
            <label htmlFor="pin">{creating ? "Новый код" : "Код"}</label>
            <input
              id="pin"
              className="sov-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
            />
          </div>
          {creating ? (
            <div className="sov-field">
              <label htmlFor="pin2">Повторите код</label>
              <input
                id="pin2"
                className="sov-pin"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                required
              />
              <span className="sov-field__hint">
                Не ставьте дату рождения ребёнка и четыре одинаковые цифры.
              </span>
            </div>
          ) : null}
          <FormAction pending={pending}>
            {creating ? "Сохранить код" : "Открыть кабинет"}
          </FormAction>
        </form>
        {/* Забытые четыре цифры запирали кабинет наглухо: сменить код можно
            только изнутри или предъявив старый, и до этой кнопки обходного
            пути не было вовсе — вместе с отчётами закрывалась и подписка.
            На экране «придумайте код» ссылки нет: там ещё нечего вспоминать. */}
        {!creating ? (
          <div style={{ marginTop: 20 }}>
            {mailed === null ? (
              <button
                type="button"
                className="sov-act-ghost"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError(null);
                  try {
                    setMailed(await requestParentPinReset());
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Не получилось отправить письмо");
                  }
                  setPending(false);
                }}
              >
                Не помню код
              </button>
            ) : mailed.sent ? (
              <div className="sov-save-hint" data-tone="ok" style={{ marginTop: 0 }}>
                <strong>Письмо отправлено</strong>
                <span>
                  Отправили ссылку на {mailed.email}. Она работает один час и открывается один раз.
                  Если письма нет — загляните в спам.
                </span>
              </div>
            ) : (
              <div className="sov-alert">
                Отправка почты сейчас не настроена. Напишите на{" "}
                <a href="mailto:ekaterinazyub@gmail.com">ekaterinazyub@gmail.com</a> — код вернём
                руками.
              </div>
            )}
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          <Link to="/uchenik" className="sov-act-ghost" style={{ textDecoration: "none" }}>
            Вернуться к занятиям
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function ChangePinForm({ onNotice }: { onNotice: (text: string) => void }) {
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="sov-form ym-hide-content ym-disable-keys"
      style={{ marginTop: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await setParentPin({ data: { pin, currentPin: null } });
          onNotice("Код обновлён");
          setPin("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Не получилось");
        }
        setPending(false);
      }}
    >
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-field">
        <label htmlFor="newpin">Новый код</label>
        <input
          id="newpin"
          className="sov-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          required
        />
      </div>
      <FormAction pending={pending}>Сменить код</FormAction>
    </form>
  );
}

/**
 * Напоминания в мессенджер.
 *
 * Родитель редко открывает кабинет каждый день, но хочет знать, что ребёнок
 * сел заниматься. Привязка идёт кодом: он пишет боту короткое слово, бот
 * запоминает чат. Логин мессенджера мы не спрашиваем и не храним.
 */
export function NotifyTab({ onNotice }: { onNotice: (text: string) => void }) {
  const [channels, setChannels] = useState<Channel[] | null>(null);

  const load = useCallback(async () => {
    const data = await notifySettings();
    setChannels(data.channels as Channel[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!channels) {
    return <p style={{ marginTop: 24, color: "var(--sov-ink-soft)" }}>Загружаем…</p>;
  }

  return (
    <section style={{ marginTop: 24, maxWidth: 640 }}>
      <h2 style={{ fontSize: "var(--sov-t-h3)", fontWeight: 600 }}>Напоминания</h2>
      <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
        Короткое сообщение после каждой проверочной работы и тренажёра — о том, что занятие
        окончено. Ни имени ребёнка, ни темы, ни результатов бот не присылает: мессенджер чужой, и
        всё это остаётся здесь, в кабинете.
      </p>

      {channels.map((ch) => (
        <div key={ch.channel} className="sov-panel" style={{ marginTop: 18 }}>
          <h3>{ch.title}</h3>
          {!ch.ready ? (
            <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
              Канал пока не подключён на сервере: администратору нужно задать токен бота.
            </p>
          ) : ch.connected ? (
            <>
              <p style={{ marginTop: 8, color: "var(--sov-ok)", fontSize: "var(--sov-t-cap)" }}>
                Подключено. Сообщения {ch.enabled ? "приходят" : "поставлены на паузу"}.
              </p>
              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="sov-act-ghost"
                  onClick={async () => {
                    await notifyToggle({ data: { channel: ch.channel, enabled: !ch.enabled } });
                    await load();
                  }}
                >
                  {ch.enabled ? "Поставить на паузу" : "Включить снова"}
                </button>
                <button
                  className="sov-act-ghost"
                  onClick={async () => {
                    await notifyDisconnect({ data: { channel: ch.channel } });
                    onNotice(`${ch.title} отключён`);
                    await load();
                  }}
                >
                  Отключить
                </button>
              </div>
            </>
          ) : ch.code ? (
            <>
              <p
                style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}
              >
                Напишите боту «Совёнок» в {ch.title} этот код:
              </p>
              <div className="sov-code">{ch.code}</div>
              <button
                className="sov-act-ghost"
                style={{ marginTop: 14 }}
                onClick={() => void load()}
              >
                Я отправил код, проверить
              </button>
            </>
          ) : (
            <button
              className="sov-act-ghost"
              style={{ marginTop: 12 }}
              onClick={async () => {
                await notifyConnect({ data: { channel: ch.channel } });
                await load();
              }}
            >
              Получить код привязки
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * Самое необратимое действие в продукте, поэтому кнопка ничего не удаляет:
 * она раскрывает объяснение, что именно пропадёт, и просит набрать имя
 * ребёнка руками (сервер сверяет ещё раз, так же мягко, как ответы ребёнка,
 * — регистр и «ё» не мешают). Про восстановление сказано прямо: только из
 * ночной резервной копии по письму, занятия после последней копии не
 * вернутся.
 */
export function DeleteChildBlock({
  child,
  onDeleted,
}: {
  child: { id: string; name: string };
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");
  const ready = norm(typed) === norm(child.name);

  if (!open) {
    return (
      <button className="sov-act-ghost" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
        Удалить профиль: {child.name}…
      </button>
    );
  }
  return (
    <form
      className="sov-form ym-hide-content ym-disable-keys"
      style={{ marginTop: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          await deleteChild({ data: { childId: child.id, confirmName: typed } });
          await onDeleted();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Не получилось удалить");
          setPending(false);
        }
      }}
    >
      <div className="sov-alert">
        Пропадут все занятия, история, звёзды, награды и загруженные фотографии. Отменить это
        нельзя: восстановление возможно только из ночной резервной копии по письму на
        ekaterinazyub@gmail.com, и занятия после последней копии не вернутся.
      </div>
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-field">
        <label htmlFor="delchild">Чтобы удалить, наберите имя ребёнка: {child.name}</label>
        <input
          id="delchild"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="sov-act-ghost"
          disabled={!ready || pending}
          style={{ borderColor: "var(--sov-warn)", color: "var(--sov-warn)" }}
        >
          {pending ? "Удаляем…" : "Удалить профиль навсегда"}
        </button>
        <button type="button" className="sov-act-ghost" onClick={() => setOpen(false)}>
          Передумал
        </button>
      </div>
    </form>
  );
}

/** Полный отзыв согласия: подтверждается паролем, а не кодом из четырёх цифр. */
export function DeleteAccountBlock() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button className="sov-act-ghost" style={{ marginTop: 14 }} onClick={() => setOpen(true)}>
        Удалить учётную запись…
      </button>
    );
  }
  return (
    <form
      className="sov-form ym-hide-content ym-disable-keys"
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
        Будут удалены все профили детей со всеми занятиями и фотографиями, настройки и сама учётная
        запись — без возможности восстановления. Сведения о платежах и чеки мы обязаны хранить 5
        лет, они остаются. Активная подписка закроется; за возвратом остатка напишите на
        ekaterinazyub@gmail.com (раздел 7 оферты).
      </div>
      {error ? <div className="sov-alert">{error}</div> : null}
      <div className="sov-field">
        <label htmlFor="delaccpwd">Пароль от учётной записи</label>
        <input
          id="delaccpwd"
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
  );
}

/**
 * Кто вошёл и к кому у него доступ — на каждом экране кабинета.
 *
 * Ответ me() маленький и приезжает из одного запроса, поэтому каждый экран
 * спрашивает его сам, а не получает через контекст: кабинет перестал быть
 * одной страницей со вкладками, и общего родителя, который жил бы дольше
 * экрана, у них больше нет.
 */
export function useCabinetAccount() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);

  const reload = useCallback(async () => {
    const acc = (await me()) as unknown as Account;
    if (!acc.user) {
      await navigate({ to: "/vhod" });
      return;
    }
    setAccount(acc);
  }, [navigate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { account, reload };
}

/**
 * Нужна ли дверь с кодом.
 *
 * Только в семье: вход в приложение один на всех, и без кода ребёнок в два
 * касания снял бы себе лимит времени и выдал подписку. У репетитора ребёнка
 * за плечом нет, а код от «родительского» кабинета он и придумать не может —
 * это чужая дверь.
 */
export function needsPin(account: Account): boolean {
  if (!capsFor(account.user?.role).pin) return false;
  return !account.parentPinSet || !account.parentUnlocked;
}

/**
 * Шапка кабинета: одни и те же разделы на всех его экранах.
 *
 * Раньше разделы жили вкладками внутри одной страницы у родителя и ссылками
 * в шапке у репетитора — и набор расходился: тренажёры у родителя лежали
 * внутри вкладки «Задания», то есть на третьем уровне от входа. Теперь
 * список один, а роль меняет в нём две вещи: куда ведёт «домой» и есть ли
 * дверь, которую можно закрыть за собой.
 *
 * «Темы» в этом списке стали «Повторением». Раздел никуда не делся и
 * работает как раньше, но после разворота на тренажёры он не то, ради чего
 * сюда приходят: выдачей домашки по темам почти не пользуются, а имя
 * обещало главный раздел кабинета. Новое обещает ровно то, зачем туда
 * всё-таки заходят, — повторить пройденное в школе.
 *
 * В навигации раздел зовётся одним словом, а экран, который за ним
 * открывается, — полностью: «Повторение школьной программы». Целиком имя в
 * пилюлю не помещается: на окне уже 1200 px строка разделов уезжает на вторую
 * и удваивает шапку (с одним словом она держится в одну до 1100), а на 375 px
 * переносится внутри самой пилюли. Так же подписана и ссылка сюда с
 * тренажёров — навигация называет раздел одинаково везде.
 */
export function CabinetHeader({ account, onLock }: { account: Account; onLock: () => void }) {
  const navigate = useNavigate();
  const caps = capsFor(account.user?.role);
  return (
    <SiteHeader
      right={
        <>
          <QuietAction to="/kabinet">{caps.homeLabel}</QuietAction>
          <QuietAction to="/kabinet/trenazhery">Тренажёры</QuietAction>
          <QuietAction to="/kabinet/temy">Повторение</QuietAction>
          <QuietAction to="/kabinet/nastroyki">Настройки</QuietAction>
          <QuietAction to={caps.audience === "tutor" ? "/repetitor/podpiska" : "/kabinet/podpiska"}>
            Подписка
          </QuietAction>
          {account.user?.role === "admin" ? (
            <Link to="/admin" className="sov-act-ghost" style={{ textDecoration: "none" }}>
              Админка
            </Link>
          ) : null}
          {caps.pin && account.parentPinSet ? (
            <button className="sov-act-ghost" onClick={onLock}>
              Закрыть кабинет
            </button>
          ) : null}
          <button
            className="sov-act-ghost"
            onClick={async () => {
              await logout();
              await navigate({ to: "/" });
            }}
          >
            Выйти
          </button>
        </>
      }
    />
  );
}

/** Экран кабинета, пока он грузится. Одинаковый у всех — чтобы не мигало. */
export function CabinetLoading() {
  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-shell">
        <p style={{ marginTop: 24, color: "var(--sov-ink-soft)" }}>Загружаем кабинет…</p>
      </main>
    </div>
  );
}
