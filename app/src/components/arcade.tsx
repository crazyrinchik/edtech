import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import {
  ARCADE_BIG,
  ARCADE_RUSH,
  ArcadeSky,
  ArcadeSound,
  comboLabel,
  readSoundChoice,
  writeSoundChoice,
} from "../lib/arcade";
import { plural } from "../lib/shop";

/*
 * Аркадный слой в разметке тренажёра.
 *
 * Подключается тремя строками и одинаково во всех пяти тренажёрах:
 *
 *   const arcade = useArcade();                  // состояние серии
 *   <ArcadeStage arcade={arcade}>…</ArcadeStage> // ночь, искры, вспышка
 *   arcade.hit(ok, event.currentTarget);         // на каждом ответе
 *
 * Почему слой общий, а не по копии в каждом тренажёре: серия, разгон и
 * кульминация должны совпадать везде до сотых долей секунды. Ребёнок
 * переходит из счёта в правописание по ссылке в шапке, и если в одном
 * месте серия рвётся на ошибке, а в другом переживает её, он перестаёт
 * верить счётчику вообще.
 *
 * Шульте здесь тоже аркада, хотя «ответов» в ней нет: серия считается по
 * числам, найденным подряд без промаха.
 */

export type Arcade = {
  /** Сколько верных подряд прямо сейчас. Ноль — серии нет. */
  combo: number;
  /** Лучшая серия за заход: её показывает экран итога. */
  best: number;
  soundOn: boolean;
  toggleSound: () => void;
  /**
   * Ответ засчитан. Второй аргумент — элемент, по которому ребёнок ответил:
   * из него вылетают искры. Без него залп идёт из середины экрана.
   */
  hit: (ok: boolean, from?: Element | null) => void;
  /** Новый заход: серия обнуляется, лучшая — тоже. */
  reset: () => void;
  /** Конец захода: залп и гамма вверх. */
  finale: () => void;
  /** Служебное: связывает состояние с разметкой ArcadeStage. */
  bind: (stage: HTMLDivElement | null, canvas: HTMLCanvasElement | null) => void;
  stageRef: React.MutableRefObject<HTMLDivElement | null>;
};

export function useArcade(): Arcade {
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [soundOn, setSoundOn] = useState(false);

  const sky = useRef<ArcadeSky | null>(null);
  const sound = useRef<ArcadeSound | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const comboRef = useRef(0);
  const flashTimer = useRef(0);

  // Выбор про звук переживает переход между тренажёрами, поэтому читается
  // из браузера, а не заводится заново на каждом экране.
  useEffect(() => {
    const on = readSoundChoice();
    setSoundOn(on);
    sound.current = new ArcadeSound(on);
  }, []);

  const bind = useCallback((stage: HTMLDivElement | null, canvas: HTMLCanvasElement | null) => {
    stageRef.current = stage;
    canvasRef.current = canvas;
    sky.current?.stop();
    sky.current = canvas ? new ArcadeSky(canvas) : null;
    sky.current?.start();
    sky.current?.heat(comboRef.current);
  }, []);

  useEffect(() => {
    function onResize() {
      sky.current?.resize();
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      sky.current?.stop();
      window.clearTimeout(flashTimer.current);
    };
  }, []);

  /** Вспышка и тряска. Живут на самом блоке аркады — через данные, а не класс:
      анимацию надо уметь перезапускать подряд, и снятый атрибут это делает. */
  const shake = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.dataset.big = "1";
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      stage.dataset.big = "0";
    }, 460);
  }, []);

  const hit = useCallback(
    (ok: boolean, from?: Element | null) => {
      if (!ok) {
        comboRef.current = 0;
        setCombo(0);
        sky.current?.heat(0);
        sound.current?.soft();
        return;
      }
      const next = comboRef.current + 1;
      comboRef.current = next;
      setCombo(next);
      setBest((b) => Math.max(b, next));
      sky.current?.heat(next);
      sound.current?.right(next - 1);

      const stage = stageRef.current;
      if (stage && sky.current) {
        const box = stage.getBoundingClientRect();
        const spot = from?.getBoundingClientRect();
        const x = spot ? spot.left - box.left + spot.width / 2 : box.width / 2;
        const y = spot ? spot.top - box.top + spot.height / 2 : box.height / 2;
        sky.current.burst(x, y, 14 + next * 3, next >= ARCADE_RUSH);
      }

      if (next % ARCADE_BIG === 0) {
        sky.current?.salute();
        sound.current?.big();
        shake();
      }
    },
    [shake],
  );

  const reset = useCallback(() => {
    comboRef.current = 0;
    setCombo(0);
    setBest(0);
    sky.current?.heat(0);
  }, []);

  const finale = useCallback(() => {
    sky.current?.salute();
    sound.current?.finish();
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      writeSoundChoice(next);
      if (sound.current) sound.current.enabled = next;
      // Короткая нота сразу после включения: иначе непонятно, включилось ли,
      // и следующий звук прозвучит только через пример.
      if (next) sound.current?.right(2);
      return next;
    });
  }, []);

  return { combo, best, soundOn, toggleSound, hit, reset, finale, bind, stageRef };
}

/**
 * Ночь вокруг занятия.
 *
 * Бежевая бумага и один синий — правила для экранов взрослого: там читают
 * таблицы и принимают решения. На экране, где первоклассник считает на
 * скорость, те же правила дают ровно то, от чего он уходит в другое
 * приложение. Поэтому ночь включается только на стадии упражнения и только
 * в тренажёрах: витрина, кабинет и карта тем остаются прежними.
 */
export function ArcadeStage({ arcade, children }: { arcade: Arcade; children: ReactNode }) {
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const { bind } = arcade;

  useEffect(() => {
    bind(stage.current, canvas.current);
    return () => bind(null, null);
  }, [bind]);

  return (
    <div
      className="sov-arcade"
      ref={stage}
      data-hot={arcade.combo >= ARCADE_RUSH ? "1" : "0"}
      data-big="0"
    >
      <canvas className="sov-arcade__sky" ref={canvas} aria-hidden="true" />
      <div className="sov-arcade__flash" aria-hidden="true" />
      <div className="sov-arcade__body">{children}</div>
    </div>
  );
}

/**
 * Счётчик серии и переключатель звука.
 *
 * Стоит в той же строке, что и полоса «сколько пройдено»: это статус
 * захода, и искать его в другом углу экрана ребёнку не придётся.
 *
 * Счётчик появляется со второго верного ответа. Единица подряд — это не
 * серия, а просто верный ответ, и показывать «серия 1» после каждого
 * первого попадания значит обесценить слово раньше, чем оно понадобится.
 */
export function ArcadeCombo({ arcade }: { arcade: Arcade }) {
  const shown = arcade.combo >= 2;
  return (
    <div className="sov-combo">
      <span
        className="sov-combo__count"
        data-on={shown ? "1" : "0"}
        data-hot={arcade.combo >= ARCADE_BIG ? "1" : "0"}
        aria-live="polite"
      >
        {shown ? (
          <>
            <b>{arcade.combo}</b> {comboLabel(arcade.combo)}
          </>
        ) : null}
      </span>
      <button
        type="button"
        className="sov-combo__sound"
        aria-pressed={arcade.soundOn}
        onClick={arcade.toggleSound}
        title={arcade.soundOn ? "Выключить звук" : "Включить звук"}
      >
        {arcade.soundOn ? "Звук вкл." : "Звук выкл."}
      </button>
    </div>
  );
}

/**
 * Строка «лучшая серия» для экрана итога.
 *
 * Отдельным компонентом, потому что итог у каждого тренажёра свой: где-то
 * проценты, где-то секунды, где-то разбор ошибок. Общее — только серия.
 *
 * Рекорд — это серия длиннее всех прошлых в этом же тренажёре, и считает
 * его сервер при сохранении захода: у вошедшего ребёнка заходы лежат в
 * базе, а браузер помнит только текущий. Поэтому без аккаунта рекорда не
 * бывает — сравнивать не с чем, и обещать «рекорд» там, где ничего не
 * сохранилось, нельзя.
 */
export function ArcadeBest({ best, record = false }: { best: number; record?: boolean }) {
  if (best < 2) return null;
  return (
    <p className="sov-arcade__best" data-record={record ? "1" : "0"}>
      Лучшая серия: <b>{best}</b> подряд
      {record ? <span className="sov-arcade__record">новый рекорд!</span> : null}
    </p>
  );
}

/**
 * Пёрышки за заход.
 *
 * Показываются только когда они и правда начислены: без аккаунта заход
 * никуда не ложится, и обещать за него награду нельзя. Ноль тоже молчит —
 * это либо четвёртый заход за день, либо результат ниже семидесяти
 * процентов, и объяснять это на экране итога значит спорить с ребёнком
 * там, где он ждал похвалы. Где пёрышки и сколько их — видно в лавке.
 */
export function ArcadeReward({ coins }: { coins: number }) {
  if (coins <= 0) return null;
  return (
    <p className="sov-arcade__coins">
      +{coins} {plural(coins, "пёрышко", "пёрышка", "пёрышек")}
    </p>
  );
}
