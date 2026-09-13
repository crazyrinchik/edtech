/*
 * Аркадный слой тренажёров: небо, искры и звук.
 *
 * Зачем он есть. Тренажёр для первоклассника конкурирует не с учебником, а
 * с играми, и «спокойные примеры на светлом фоне» он закрывает раньше, чем
 * успевает досчитать до десятого. Отсюда три вещи, которые здесь написаны:
 * серия правильных ответов, которую жалко прервать, разгон неба вместе с
 * ней и редкая кульминация на каждом пятом ответе.
 *
 * Чего здесь нарочно нет — Lottie. Плеер стоит около шестидесяти килобайт
 * на каждом экране тренажёра плюс вес самой анимации, а всё, что он давал
 * бы здесь (салют, искры, вспышка), рисуется частицами в паре килобайт.
 * Внешний плеер имело бы смысл тянуть ради сложной сцены с персонажем —
 * такой сцены в тренажёре нет.
 *
 * Всё в этом файле работает только в браузере: небо рисуется в canvas,
 * звук живёт в Web Audio. На сервере (SSR в workerd) ни один из классов
 * не создаётся — их заводит эффект в components/arcade.tsx.
 */

/** С какой серии небо разгоняется, а ребёнок видит слово «Разгон». */
export const ARCADE_RUSH = 3;

/** Каждый такой ответ подряд — кульминация: вспышка, залп, тройные пёрышки. */
export const ARCADE_BIG = 5;

/** Цвета берутся из палитры совёнка: янтарь клюва и светлая заливка живота. */
const SPARK_HOT = "#ffb43f";
const SPARK_CALM = "#9fd0ff";
const STAR = "#dce8ff";

function reduced(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Star = { x: number; y: number; r: number; v: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; r: number; hue: string };

/**
 * Небо тренажёра: звёзды падают сверху вниз, искры вылетают из точки ответа.
 *
 * Скорость звёзд тянется к цели плавно, а не прыгает: серия обрывается
 * мгновенно, и резкая остановка неба читалась бы как поломка экрана.
 *
 * Кадры не рисуются, когда вкладка спрятана или движение выключено в
 * системе: и то и другое — пустая работа батарейки на экране ребёнка.
 */
export class ArcadeSky {
  private ctx: CanvasRenderingContext2D | null;
  private stars: Star[] = [];
  private sparks: Spark[] = [];
  private w = 0;
  private h = 0;
  private speed = 1;
  private target = 1;
  private raf = 0;
  private calm: boolean;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    this.calm = reduced();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = this.canvas.getBoundingClientRect();
    this.w = box.width;
    this.h = box.height;
    this.canvas.width = Math.max(1, Math.round(this.w * dpr));
    this.canvas.height = Math.max(1, Math.round(this.h * dpr));
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.stars.length) {
      const count = Math.round(Math.min(120, Math.max(40, (this.w * this.h) / 6400)));
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          r: Math.random() * 1.7 + 0.4,
          v: Math.random() * 0.5 + 0.15,
        });
      }
    }
  }

  /** Серия задаёт скорость неба: без неё разгон нечем показать. */
  heat(combo: number) {
    this.target = this.calm ? 1 : 1 + Math.min(combo, 12) * 0.42;
  }

  /**
   * Залп искр из точки экрана. Координаты приходят от элемента, по которому
   * ребёнок ответил: искры должны вылетать оттуда, куда он смотрел, а не из
   * середины экрана.
   */
  burst(x: number, y: number, n: number, hot = false) {
    if (this.calm) return;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.4 + 1.4;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.1,
        life: 1,
        r: Math.random() * 3.4 + 1.6,
        hue: hot ? SPARK_HOT : SPARK_CALM,
      });
    }
  }

  /** Кульминация: залп из середины, вдвое гуще обычного. */
  salute() {
    this.burst(this.w / 2, this.h * 0.42, 70, true);
  }

  start() {
    if (this.raf) return;
    const frame = () => {
      this.raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      this.draw();
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    this.speed += (this.target - this.speed) * 0.06;

    for (const s of this.stars) {
      if (!this.calm) {
        s.y += s.v * this.speed;
        if (s.y > this.h) {
          s.y = -3;
          s.x = Math.random() * this.w;
        }
      }
      ctx.globalAlpha = 0.35 + Math.sin((s.y + s.x) * 0.04) * 0.3 + 0.25;
      ctx.fillStyle = STAR;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      // Хвост появляется только на разгоне: это и есть видимая разница
      // между «считаю» и «считаю подряд без ошибок».
      if (this.speed > 1.7) {
        ctx.globalAlpha = 0.16;
        ctx.fillRect(s.x - 0.5, s.y - s.v * 9 * this.speed, 1, s.v * 9 * this.speed);
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.13;
      p.vx *= 0.985;
      p.life -= 0.019;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.hue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/*
 * Звук.
 *
 * Ноты синтезируются, а не берутся файлами: пять звуков весили бы больше
 * всего остального тренажёра, а нужен здесь не звук как таковой, а его
 * высота — она поднимается с каждым ответом серии и сама по себе говорит
 * ребёнку «идёт хорошо».
 *
 * Шкала пентатоническая (до, ре, ми, соль, ля): любые её ступени звучат
 * согласно в любом порядке, поэтому серия не превращается в фальшь, куда
 * бы она ни зашла.
 *
 * Контекст заводится только после нажатия: браузер всё равно не даст
 * звучать до жеста, а лишний AudioContext на странице — это работающий
 * аудиопоток у ребёнка, который звук не включал.
 */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

export class ArcadeSound {
  private ctx: AudioContext | null = null;

  constructor(public enabled = false) {}

  private wake(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private note(freq: number, at: number, dur: number, kind: OscillatorType, gain: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = kind;
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(0, at);
    vol.gain.linearRampToValueAtTime(gain, at + 0.012);
    vol.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.04);
  }

  /** Верный ответ: ступень тем выше, чем длиннее серия. */
  right(step: number) {
    if (!this.enabled) return;
    const ctx = this.wake();
    if (!ctx) return;
    const f = SCALE[Math.min(Math.max(step, 0), SCALE.length - 1)];
    this.note(f, ctx.currentTime, 0.26, "triangle", 0.2);
    this.note(f * 2, ctx.currentTime + 0.02, 0.18, "sine", 0.07);
  }

  /** Кульминация: аккорд вразбивку, слышно как «получилось». */
  big() {
    if (!this.enabled) return;
    const ctx = this.wake();
    if (!ctx) return;
    [2, 4, 6, 9].forEach((s, i) =>
      this.note(SCALE[s], ctx.currentTime + i * 0.07, 0.5, "triangle", 0.17),
    );
  }

  /**
   * Ошибка. Низкая мягкая пара нот, а не «провал»: в продукте нет слова
   * «неверно», и звук не то место, где это правило стоит отменять.
   */
  soft() {
    if (!this.enabled) return;
    const ctx = this.wake();
    if (!ctx) return;
    this.note(196, ctx.currentTime, 0.3, "sine", 0.12);
    this.note(174.6, ctx.currentTime + 0.1, 0.34, "sine", 0.1);
  }

  /** Конец захода: короткая гамма вверх. */
  finish() {
    if (!this.enabled) return;
    const ctx = this.wake();
    if (!ctx) return;
    [0, 2, 4, 5, 7, 9].forEach((s, i) =>
      this.note(SCALE[s], ctx.currentTime + i * 0.08, 0.6, "triangle", 0.16),
    );
  }
}

/**
 * Включён ли звук — помним между заходами.
 *
 * Настройка звука у ребёнка в кабинете родителя есть, но она про занятия и
 * приезжает только вошедшему, а тренажёры открыты и без аккаунта. Поэтому
 * переключатель здесь свой и хранится в браузере: ребёнок включил звук на
 * устном счёте — он включён и в правописании.
 */
const SOUND_KEY = "sov.arcade.sound";

export function readSoundChoice(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSoundChoice(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* приватный режим — звук просто не запомнится */
  }
}

/** Подпись к серии: слово меняется на разгоне, чтобы его заметили. */
export function comboLabel(combo: number): string {
  if (combo >= ARCADE_BIG) return "Огонь!";
  if (combo >= ARCADE_RUSH) return "Разгон";
  return "подряд";
}
