import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { FormAction, SiteFooter } from "../components/brand";
import {
  AddChildForm,
  CabinetHeader,
  CabinetLoading,
  ChangePinForm,
  DeleteAccountBlock,
  DeleteChildBlock,
  NotifyTab,
  needsPin,
  PinGate,
  useCabinetAccount,
} from "../components/cabinet-parts";
import { lockParentCabinet, updateChild } from "../lib/api/app.functions";
import { FREE_CHILD_LIMIT } from "../lib/billing";
import { capsFor } from "../lib/cabinet";
import { closedHead } from "../lib/seo";

/**
 * Настройки кабинета: занятия, дверь, напоминания, удаление.
 *
 * Всё это раньше было тремя вкладками рядом с прогрессом и заданиями — то
 * есть занимало треть кабинета собой. Сюда заходят раз в несколько месяцев:
 * поменять лимит времени, привязать Telegram, забрать данные. Отдельный
 * адрес честнее вкладки: он не мешает тем, кто пришёл смотреть занятия.
 *
 * Порядок блоков — от частого к редкому, а удаление стоит последним и
 * отделено: это дверь наружу, а не настройка.
 */
export const Route = createFileRoute("/kabinet/nastroyki")({
  head: () => closedHead("Настройки, Совёнок"),
  component: SettingsPage,
});

function SettingsPage() {
  const { account, reload } = useCabinetAccount();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!account) return <CabinetLoading />;
  if (needsPin(account)) {
    return <PinGate creating={!account.parentPinSet} onDone={reload} />;
  }

  const caps = capsFor(account.user?.role);
  /* Лимит времени, звук и удаление профиля — про своего ребёнка: у ученика
     всё это решает его семья, а не педагог. Поэтому и выбирается здесь
     ребёнок со связью «родитель», даже если активным стоит ученик. */
  const mine = account.children.filter((c) => c.access !== "tutor");
  const child = mine.find((c) => c.id === account.activeChildId) ?? mine[0] ?? null;
  const limitReached =
    account.user?.subscriptionStatus !== "active" && mine.length >= FREE_CHILD_LIMIT;

  return (
    <div className="sov">
      <CabinetHeader
        account={account}
        onLock={async () => {
          await lockParentCabinet();
          await reload();
        }}
      />
      <main className="sov-shell" style={{ paddingBottom: 60, maxWidth: 620 }}>
        <h1 style={{ fontSize: "var(--sov-t-h1)", fontWeight: 700, marginTop: 16 }}>Настройки</h1>

        {notice ? (
          <div
            className="sov-alert"
            style={{ marginTop: 16, background: "#e6f4ea", color: "var(--sov-ok)" }}
          >
            {notice}
          </div>
        ) : null}

        {child ? (
          <section style={{ marginTop: 28 }}>
            <h2 className="sov-kabinet__h">Занятия ребёнка</h2>
            <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
              Профиль: {child.name}, {child.grade} класс.
            </p>
            <form
              className="sov-form ym-hide-content ym-disable-keys"
              style={{ marginTop: 18 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setPending(true);
                await updateChild({
                  data: {
                    childId: child.id,
                    dailyLimitMin: Number(form.get("limit")),
                    soundOn: form.get("sound") === "on",
                  },
                });
                setNotice("Настройки сохранены");
                setPending(false);
                await reload();
              }}
            >
              <div className="sov-field">
                <label htmlFor="limit">Рекомендованное время занятия, минут</label>
                <input
                  id="limit"
                  name="limit"
                  type="number"
                  min={5}
                  max={120}
                  defaultValue={child.daily_limit_min}
                />
                <span className="sov-field__hint">
                  По достижении лимита ребёнок увидит мягкое напоминание об отдыхе.
                </span>
              </div>
              <label className="sov-check">
                <input type="checkbox" name="sound" defaultChecked={!!child.sound_on} />
                <span>Звуковое сопровождение заданий</span>
              </label>
              <FormAction pending={pending}>Сохранить</FormAction>
            </form>
          </section>
        ) : null}

        <section style={{ marginTop: 40 }}>
          <NotifyTab onNotice={setNotice} />
        </section>

        {caps.pin ? (
          <section style={{ marginTop: 44 }}>
            <h2 className="sov-kabinet__h">Код родителя</h2>
            <p style={{ marginTop: 8, color: "var(--sov-ink-soft)", fontSize: "var(--sov-t-cap)" }}>
              Четыре цифры, которые спрашивают на входе в кабинет. Занятия ребёнка кодом не
              закрываются — он заходит в них сам.
            </p>
            <ChangePinForm onNotice={setNotice} />
          </section>
        ) : null}

        <section style={{ marginTop: 44 }}>
          <h2 className="sov-kabinet__h">{child ? "Добавить ещё ребёнка" : "Свой ребёнок"}</h2>
          <AddChildForm
            onAdded={reload}
            compact
            limited={limitReached}
            needsConsent={account.needsChildConsent}
          />
        </section>

        <section style={{ marginTop: 44 }}>
          <h2 className="sov-kabinet__h">Удаление</h2>
          {child ? (
            <DeleteChildBlock
              child={child}
              onDeleted={async () => {
                setNotice("Профиль удалён");
                await reload();
              }}
            />
          ) : null}
          <DeleteAccountBlock />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
