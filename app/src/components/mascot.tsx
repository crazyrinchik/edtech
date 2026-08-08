import { useId } from "react";

/**
 * Совёнок и лес.
 *
 * Совёнок нарисован с натуры — с фотографии пухового птенца: круглый силуэт
 * без острых ушек, тёмные глаза-бусины, крошечный клювик. Мохнатость даётся
 * не штриховкой, а формой: по контуру раскладываются кружки того же цвета,
 * поэтому силуэт остаётся мохнатым и на 20 px, где любая штриховка пропала бы.
 * Отсюда же отказ от градиентов — плоская заливка читается в фавиконе.
 *
 * Знак живёт только на бежевой бумаге (--sov-paper): кобальт на тёмном фоне
 * сливается, поэтому на синюю полосу лендинга совёнка не ставим.
 *
 * Совёнок растёт вместе с ребёнком: стадия 1 — голый пуховик, стадия 5 —
 * сова с кисточками, крыльями и оперением. Силуэт при этом не меняется,
 * меняются размер и детали — знак остаётся узнаваемым. Стадия считается из
 * уровня (уровень = звёзды / 5 + 1), новых полей в базе не нужно.
 */

/** Цвета совёнка. Держим рядом: они повторяются в фавиконе. */
const OWL = {
  body: "#2f5bd4",
  belly: "#eef2ff",
  dark: "#0f1b3c",
  beak: "#ffb43f",
  feet: "#ffb43f",
  line: "#c3d2f6",
  tuft: "#2247b4",
} as const;

/**
 * Простой генератор с фиксированным семенем: Math.random() дал бы разный пух
 * на сервере и в браузере, и React ругался бы на расхождение при гидратации.
 */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Кружок пуха: x, y, радиус. */
type Puff = [number, number, number];

/**
 * Раскладывает пух по овалу. Овал задан параметрически, а не путём, чтобы
 * центры кружков считались точно; pear делает низ шире верха (форма груши).
 */
function puffs(o: {
  cx: number;
  cy: number;
  a: number;
  top: number;
  bottom: number;
  pear?: number;
  n: number;
  r: number;
  seed: number;
}): Puff[] {
  const rnd = seeded(o.seed);
  const list: Puff[] = [];
  for (let i = 0; i < o.n; i++) {
    const t = (i / o.n) * Math.PI * 2;
    // Кружки сдвинуты внутрь на свой радиус, иначе контур раздувается.
    const a = o.a * (1 - (o.pear ?? 0) * Math.cos(t)) - o.r * 0.78;
    const b = (Math.cos(t) > 0 ? o.top : o.bottom) - o.r * 0.78;
    list.push([
      +(o.cx + a * Math.sin(t)).toFixed(1),
      +(o.cy - b * Math.cos(t)).toFixed(1),
      +(o.r * (0.74 + rnd() * 0.52)).toFixed(1),
    ]);
  }
  return list;
}

/** Пух заливается один раз: многоугольник по центрам плюс сами кружки. */
function Fluff({ points, fill }: { points: Puff[]; fill: string }) {
  return (
    <g fill={fill}>
      <path d={`M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`} />
      {points.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

const OWL_BODY = puffs({ cx: 60, cy: 72, a: 40, top: 46, bottom: 44, pear: 0.1, n: 42, r: 7.5, seed: 4242 });
// Кисточки — тоже пух, а не острые треугольники: иначе на голове вырастают рожки.
const OWL_TUFT = puffs({ cx: 0, cy: 0, a: 7, top: 13, bottom: 9, n: 16, r: 4.5, seed: 5150 });
const OWL_BELLY = puffs({ cx: 60, cy: 86, a: 26, top: 30, bottom: 22, pear: -0.06, n: 26, r: 6, seed: 991 });

export type OwlMood = "idle" | "happy" | "concerned" | "sleepy";
export type OwlItem = "none" | "scarf" | "glasses" | "cap" | "graduate";

/** 1..5 — чем больше звёзд, тем взрослее сова. */
export function owlStage(level: number): number {
  return Math.max(1, Math.min(5, level));
}

/** Последняя открытая вещь — её совёнок и носит. */
export function currentOwlItem(level: number): OwlItem {
  const unlocked = OWL_UNLOCKS.filter((u) => u.level <= level);
  return unlocked.length ? unlocked[unlocked.length - 1].item : "none";
}

/** Что открывается на каждом уровне: совёнок растёт и получает новую вещь. */
export const OWL_UNLOCKS: { level: number; item: OwlItem; title: string; note: string }[] = [
  { level: 1, item: "none", title: "Птенец", note: "Совсем маленький и пушистый" },
  { level: 2, item: "scarf", title: "Тёплый шарф", note: "Подрос и оброс пёрышками" },
  { level: 3, item: "glasses", title: "Очки умника", note: "Появились ушки-кисточки" },
  { level: 4, item: "cap", title: "Колпак звездочёта", note: "Расправились крылья" },
  { level: 5, item: "graduate", title: "Шапочка выпускника", note: "Настоящая мудрая сова" },
];

type OwlProps = {
  size?: number;
  stage?: number;
  mood?: OwlMood;
  item?: OwlItem;
  className?: string;
  /** Мягкое покачивание — включено на витрине и карте, выключено в мелких иконках. */
  animated?: boolean;
};

export function Owl({
  size = 96,
  stage = 3,
  mood = "idle",
  item = "none",
  className = "",
  animated = false,
}: OwlProps) {
  const s = Math.max(1, Math.min(5, stage));
  const grow = (s - 1) / 4; // 0 → 1

  // Рост читается размером. Масштаб берётся от лапок, чтобы сова «вырастала»
  // вверх, а не расползалась от центра.
  const overall = 0.88 + grow * 0.24;
  // Взросление — это ещё и пропорции: у птенца глаза заметно крупнее.
  const eyeR = 11.2 - grow * 2.4;
  const eyeX = 45.5 + grow * 1.4;
  const eyeY = 62 - grow;
  const mirrorX = 120 - eyeX;

  const feathers = s >= 2;
  const tufts = s >= 3;
  const wings = s >= 4;

  const happy = mood === "happy";
  const sleepy = mood === "sleepy";
  const concerned = mood === "concerned";

  return (
    <svg
      viewBox="0 0 120 132"
      width={size}
      height={size * (132 / 120)}
      className={`sov-owl ${animated ? "sov-owl--live" : ""} ${className}`}
      role="img"
      aria-label="Совёнок"
    >
      <g className="sov-owl__all">
        {/* тень под совой — приземляет фигуру */}
        <ellipse cx="60" cy="124" rx={26 + grow * 5} ry="5" fill={OWL.dark} opacity="0.13" />

        <g transform={`translate(60 120) scale(${overall}) translate(-60 -120)`}>
          {/* лапки */}
          <g fill={OWL.feet}>
            <circle cx="52.4" cy="112" r="4.4" />
            <circle cx="67.6" cy="112" r="4.4" />
            <path d="M44.5 115h10v3.2h-10zM52 115h4.6v4.4H52zM65.5 115h10v3.2h-10zM63.4 115h4.6v4.4h-4.6z" />
          </g>

          {/* лёгкий наклон головы: от него совёнок читается живым, а не штампом */}
          <g transform="rotate(-4 60 108)">
            {tufts ? (
              <>
                <g transform="translate(39 38) rotate(-24)">
                  <Fluff points={OWL_TUFT} fill={OWL.tuft} />
                </g>
                <g transform="translate(81 38) rotate(24)">
                  <Fluff points={OWL_TUFT} fill={OWL.tuft} />
                </g>
              </>
            ) : null}

            <Fluff points={OWL_BODY} fill={OWL.body} />

            {wings ? (
              <g fill={OWL.tuft} opacity="0.85">
                <ellipse cx="30" cy="84" rx="8" ry="19" transform="rotate(-7 30 84)" />
                <ellipse cx="90" cy="84" rx="8" ry="19" transform="rotate(7 90 84)" />
              </g>
            ) : null}

            <Fluff points={OWL_BELLY} fill={OWL.belly} />

            {/* оперение груди — ниже клюва, чтобы не читалось как рот */}
            {feathers ? (
              <g
                stroke={OWL.line}
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                opacity="0.7"
              >
                <path d="M49 94c3-3 6-3 9 0 3-3 6-3 9 0" />
                <path d="M45 101c4-3 8-3 12 0 4-3 8-3 12 0" />
                <path d="M47 108c4-3 7-3 11 0 4-3 7-3 11 0" />
              </g>
            ) : null}

            {happy ? (
              <g fill="#f0857f" opacity="0.4">
                <ellipse cx="30" cy="74" rx="6" ry="3.8" />
                <ellipse cx="90" cy="74" rx="6" ry="3.8" />
              </g>
            ) : null}

            {/* глаза */}
            {happy || sleepy ? (
              <g stroke={OWL.dark} strokeWidth="3.4" fill="none" strokeLinecap="round">
                {happy ? (
                  <>
                    <path d={`M${eyeX - 8} ${eyeY + 3}q8 -9 16 0`} />
                    <path d={`M${mirrorX - 8} ${eyeY + 3}q8 -9 16 0`} />
                  </>
                ) : (
                  <>
                    <path d={`M${eyeX - 8} ${eyeY - 1}q8 7 16 0`} />
                    <path d={`M${mirrorX - 8} ${eyeY - 1}q8 7 16 0`} />
                  </>
                )}
              </g>
            ) : (
              <>
                {/* светлый ободок вокруг глаза — как у птенца на фотографии */}
                <circle cx={eyeX} cy={eyeY} r={eyeR + 1.6} fill={OWL.belly} opacity="0.35" />
                <circle cx={mirrorX} cy={eyeY} r={eyeR + 1.6} fill={OWL.belly} opacity="0.35" />
                <circle cx={eyeX} cy={eyeY} r={eyeR} fill={OWL.dark} />
                <circle cx={mirrorX} cy={eyeY} r={eyeR} fill={OWL.dark} />
                <circle
                  cx={eyeX - eyeR * 0.32}
                  cy={eyeY - eyeR * 0.34}
                  r={eyeR * 0.35}
                  fill="#fff"
                />
                <circle
                  cx={mirrorX - eyeR * 0.32}
                  cy={eyeY - eyeR * 0.34}
                  r={eyeR * 0.35}
                  fill="#fff"
                />
                <circle
                  cx={eyeX + eyeR * 0.4}
                  cy={eyeY + eyeR * 0.42}
                  r={eyeR * 0.17}
                  fill="#fff"
                  opacity="0.45"
                />
                <circle
                  cx={mirrorX + eyeR * 0.4}
                  cy={eyeY + eyeR * 0.42}
                  r={eyeR * 0.17}
                  fill="#fff"
                  opacity="0.45"
                />
              </>
            )}

            {/* встревоженные бровки: внутрь-вверх, а не сердито вниз */}
            {concerned ? (
              <g stroke={OWL.dark} strokeWidth="2.4" strokeLinecap="round">
                <path d="M36 48c5-3 10-4 14-3" />
                <path d="M84 48c-5-3-10-4-14-3" />
              </g>
            ) : null}

            {/* клювик: крошечный, как у пуховика */}
            <path
              d="M60 67c2.6 0 4.4 1.6 4.4 3.7 0 3-2.1 7-4.4 9.2-2.3-2.2-4.4-6.2-4.4-9.2 0-2.1 1.8-3.7 4.4-3.7Z"
              fill={OWL.beak}
            />
            <path
              d="M60 73.4c1.3.7 2.4 1.6 3.2 2.5-.9 1.1-2 2.1-3.2 3-1.2-.9-2.3-1.9-3.2-3 .8-.9 1.9-1.8 3.2-2.5Z"
              fill="#000"
              opacity="0.16"
            />

            {/* что совёнок заработал */}
            {item === "scarf" ? (
              <g>
                {/* концы шарфа заходят на синее — иначе розовая полоса на белой
                    грудке читается не как шарф, а как рот */}
                <path
                  d="M33 87c8 5 17 7 27 7s19-2 27-7v9c-8 5-17 7-27 7s-19-2-27-7Z"
                  fill="#e0578c"
                />
                <path d="M76 95c5 2 8 7 8 13l-9-2c1-4 1-7 1-11Z" fill="#c74d7c" />
                <g stroke="#f4a0be" strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
                  <path d="M45 90.5v9M60 92.5v9M75 90.5v9" />
                </g>
              </g>
            ) : null}
            {item === "glasses" ? (
              <g stroke="#2b3f6b" strokeWidth="2.6" fill="none">
                <circle cx={eyeX} cy={eyeY} r="13.6" fill="#cfe4ff" fillOpacity="0.3" />
                <circle cx={mirrorX} cy={eyeY} r="13.6" fill="#cfe4ff" fillOpacity="0.3" />
                <path d={`M${eyeX + 13.6} ${eyeY}h${mirrorX - eyeX - 27.2}`} />
              </g>
            ) : null}
            {item === "cap" ? (
              <g>
                <path
                  d="M60 12c11 7 17 17 19 28-7-5-13-8-19-8s-12 3-19 8c2-11 8-21 19-28Z"
                  fill="#7c5cff"
                />
                <circle cx="60" cy="12" r="4" fill="#ffd166" />
                <path d="M50 30l3-5 3 5-3 2Zm14-3l2-4 2 4-2 2Z" fill="#ffd166" opacity="0.9" />
              </g>
            ) : null}
            {item === "graduate" ? (
              <g>
                <path d="M60 16l27 11-27 11-27-11Z" fill="#22315c" />
                <path d="M47 35v9c0 4 26 4 26 0v-9l-13 5Z" fill="#2c3f73" />
                <path d="M87 27v14" stroke="#ffd166" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="87" cy="41" r="3.4" fill="#ffd166" />
              </g>
            ) : null}
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ лес */

function RoundTree({ x, y, scale = 1, hue = 0 }: { x: number; y: number; scale?: number; hue?: number }) {
  const greens = [
    ["#4e9a5f", "#3d7f4c", "#6bb87b"],
    ["#57a86a", "#437f52", "#77c186"],
    ["#3f8a52", "#2f6b40", "#5da76d"],
  ][hue % 3];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-4" y="-16" width="8" height="20" rx="3" fill="#8a6042" />
      <ellipse cx="-11" cy="-26" rx="14" ry="12" fill={greens[1]} />
      <ellipse cx="11" cy="-26" rx="14" ry="12" fill={greens[1]} />
      <ellipse cx="0" cy="-36" rx="18" ry="16" fill={greens[0]} />
      <ellipse cx="-5" cy="-42" rx="8" ry="6" fill={greens[2]} opacity="0.75" />
    </g>
  );
}

function PineTree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-3.5" y="-12" width="7" height="16" rx="2.5" fill="#8a6042" />
      <path d="M0-52c7 9 12 16 14 22-4-2-9-3-14-3s-10 1-14 3c2-6 7-13 14-22Z" fill="#3f8a52" />
      <path d="M0-38c8 10 13 18 15 24-5-2-10-3-15-3s-10 1-15 3c2-6 7-14 15-24Z" fill="#357a47" />
      <path d="M0-24c9 11 14 19 16 26-5-2-11-3-16-3s-11 1-16 3c2-7 7-15 16-26Z" fill="#2f6b40" />
    </g>
  );
}

function Bush({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="-8" cy="0" rx="10" ry="8" fill="#4b9a5c" />
      <ellipse cx="8" cy="0" rx="10" ry="8" fill="#4b9a5c" />
      <ellipse cx="0" cy="-5" rx="12" ry="10" fill="#57ab68" />
    </g>
  );
}

function Mushroom({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-3 0h6v-7h-6Z" fill="#f6ecd8" />
      <path d="M-9-6c0-5 4-9 9-9s9 4 9 9Z" fill="#e0574f" />
      <circle cx="-3.5" cy="-9.5" r="1.8" fill="#fff6ea" />
      <circle cx="3.5" cy="-11" r="1.4" fill="#fff6ea" />
    </g>
  );
}

/* ------------------------------------------------------- ночная полоса */

/**
 * Звёзды и силуэт леса для тёмной секции витрины.
 *
 * Совёнок — ночная птица, а карта уровней у ребёнка упирается в опушку;
 * поэтому тёмная полоса на лендинге не просто «тёмная для контраста», а
 * ночь над тем же лесом.
 *
 * Координаты считаются один раз при загрузке модуля тем же seeded, что и пух
 * совёнка: Math.random() дал бы разные звёзды на сервере и в браузере.
 */
const NIGHT_STARS = (() => {
  const rnd = seeded(20260804);
  return Array.from({ length: 68 }, (_, i) => ({
    x: rnd() * 1436 + 2,
    y: rnd() * 320 + 4,
    r: i < 6 ? 1.9 + rnd() * 0.7 : [0.9, 1.1, 1.4][Math.floor(rnd() * 3)],
    o: 0.35 + rnd() * 0.6,
  }));
})();

const NIGHT_TREES = (() => {
  const rnd = seeded(77001);
  const list: { x: number; scale: number; pine: boolean; far: boolean }[] = [];
  for (const far of [true, false]) {
    let x = -20;
    while (x < 1470) {
      list.push({ x, scale: (far ? 0.8 : 0.95) + rnd() * 0.5, pine: rnd() < 0.55, far });
      x += 70 + rnd() * 60;
    }
  }
  return list;
})();

function NightTree({ x, scale, pine, fill }: { x: number; scale: number; pine: boolean; fill: string }) {
  return (
    <g transform={`translate(${x.toFixed(0)} 420) scale(${scale.toFixed(2)})`} fill={fill}>
      {pine ? (
        <>
          <rect x="-4" y="-14" width="8" height="18" rx="3" />
          <path d="M0-58c8 10 13 18 15 24-5-2-10-3-15-3s-10 1-15 3c2-6 7-14 15-24Z" />
          <path d="M0-42c9 11 15 20 17 27-6-2-11-3-17-3s-11 1-17 3c2-7 8-16 17-27Z" />
          <path d="M0-26c10 12 16 21 18 29-6-2-12-4-18-4s-12 2-18 4c2-8 8-17 18-29Z" />
        </>
      ) : (
        <>
          <rect x="-4" y="-18" width="9" height="22" rx="3" />
          <ellipse cx="-12" cy="-28" rx="15" ry="13" />
          <ellipse cx="12" cy="-28" rx="15" ry="13" />
          <ellipse cx="0" cy="-40" rx="19" ry="17" />
        </>
      )}
    </g>
  );
}

export function NightSky() {
  return (
    <div className="sov-night__art" aria-hidden="true">
      <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
        {NIGHT_STARS.map((s, i) => (
          <circle key={i} cx={s.x.toFixed(0)} cy={s.y.toFixed(0)} r={s.r.toFixed(1)} fill="#fff" opacity={s.o.toFixed(2)} />
        ))}
        {NIGHT_TREES.filter((t) => t.far).map((t, i) => (
          <NightTree key={`f${i}`} {...t} fill="#0c1730" />
        ))}
        {NIGHT_TREES.filter((t) => !t.far).map((t, i) => (
          <NightTree key={`n${i}`} {...t} fill="#070d1e" />
        ))}
      </svg>
    </div>
  );
}

/**
 * Фон-лес: несколько планов с разной насыщенностью, чтобы получилась глубина.
 * Рисуется за содержимым, поэтому aria-hidden.
 */
export function ForestScene({ className = "" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMidYMax slice"
      className={`sov-forest ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe6ff" />
          <stop offset="100%" stopColor="#eef3ff" />
        </linearGradient>
        <linearGradient id={`${uid}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9dcc9" />
          <stop offset="100%" stopColor="#b6d2b8" />
        </linearGradient>
      </defs>

      <rect width="1200" height="260" fill={`url(#${uid}-sky)`} />

      {/* дальние холмы */}
      <path d="M0 190c120-40 220-20 330 6 120 28 210-8 330-24 130-18 240 10 340 30 90 18 200 4 200 4v54H0Z" fill={`url(#${uid}-far)`} />

      {/* дальний план деревьев — приглушённый */}
      <g opacity="0.45">
        <PineTree x={90} y={198} scale={1.1} />
        <RoundTree x={250} y={196} scale={0.9} hue={2} />
        <PineTree x={430} y={200} scale={0.95} />
        <RoundTree x={620} y={194} scale={1.05} hue={0} />
        <PineTree x={800} y={198} scale={1.15} />
        <RoundTree x={980} y={196} scale={0.9} hue={1} />
        <PineTree x={1130} y={200} scale={1} />
      </g>

      {/* земля */}
      <path d="M0 214c150-16 280 6 430 10 160 5 300-16 460-12 120 3 220 14 310 10v38H0Z" fill="#8fc79a" />
      <path d="M0 226c150-14 280 8 430 12 160 4 300-14 460-10 120 3 220 12 310 8v24H0Z" fill="#7cb98a" />

      {/* ближний план */}
      <RoundTree x={70} y={238} scale={1.35} hue={1} />
      <Bush x={190} y={236} scale={1.1} />
      <Mushroom x={250} y={240} scale={1.2} />
      <PineTree x={330} y={242} scale={1.3} />
      <Bush x={470} y={238} scale={0.95} />
      <RoundTree x={560} y={240} scale={1.15} hue={0} />
      <Mushroom x={660} y={242} scale={1} />
      <Bush x={740} y={236} scale={1.2} />
      <PineTree x={880} y={240} scale={1.25} />
      <Mushroom x={960} y={241} scale={0.9} />
      <RoundTree x={1060} y={238} scale={1.3} hue={2} />
      <Bush x={1160} y={240} scale={1.05} />
    </svg>
  );
}
