import { useId } from "react";

/**
 * Совёнок и лес.
 *
 * Прежний маскот был собран из плоских геометрических фигур: сплошная заливка,
 * острые треугольные ушки, лес — два зелёных треугольника. Здесь совёнок
 * нарисован как мягкая мультяшная сова: объём даётся градиентами, перья —
 * фестонами, глаза — с радужкой и двумя бликами.
 *
 * Совёнок растёт вместе с ребёнком: стадия 1 — пуховый птенец с большой
 * головой, стадия 5 — взрослая сова с ушками, хвостом и проработанным
 * оперением. Стадия считается из уровня (уровень = звёзды / 5 + 1),
 * поэтому никаких новых полей в базе не нужно.
 */

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
  { level: 4, item: "cap", title: "Колпак звездочёта", note: "Вырос хвост и крылья" },
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
  const raw = useId();
  // useId отдаёт «:r1:» — двоеточия ломают ссылки url(#…) в части браузеров.
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");

  const s = Math.max(1, Math.min(5, stage));
  const grow = (s - 1) / 4; // 0 → 1
  // Рост читается размером: птенец мельче, взрослая сова крупнее. Масштаб
  // берётся от лапок, чтобы сова «вырастала» вверх, а не расползалась от центра.
  const overall = 0.88 + grow * 0.24;
  // Взросление — это ещё и пропорции: у малыша глаза во всё лицо.
  const eyeR = 12.6 - grow * 1.8;
  const irisR = eyeR * 0.63;
  const pupilR = eyeR * 0.34;
  const discRx = 26.5 - grow * 1.5;
  const tufts = s >= 3 ? 1 : s >= 2 ? 0.5 : 0;
  // Пух исчезает к 3-й стадии, когда появляются ушки: иначе торчит между ними.
  const downy = Math.max(0, 0.6 - grow * 1.2);
  const showChestFeathers = s >= 3;
  const wingSpread = 0.85 + grow * 0.3;

  const happy = mood === "happy";
  const concerned = mood === "concerned";
  const sleepy = mood === "sleepy";

  return (
    <svg
      viewBox="0 0 120 132"
      width={size}
      height={size * (132 / 120)}
      className={`sov-owl ${animated ? "sov-owl--live" : ""} ${className}`}
      role="img"
      aria-label="Совёнок"
    >
      <defs>
        <radialGradient id={`${uid}-body`} cx="38%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#6f95ef" />
          <stop offset="52%" stopColor="#3f68d8" />
          <stop offset="100%" stopColor="#26429b" />
        </radialGradient>
        <radialGradient id={`${uid}-belly`} cx="50%" cy="26%" r="76%">
          <stop offset="0%" stopColor="#fffdf8" />
          <stop offset="100%" stopColor="#ecdfc6" />
        </radialGradient>
        <radialGradient id={`${uid}-disc`} cx="50%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#fffefb" />
          <stop offset="100%" stopColor="#e6dbc4" />
        </radialGradient>
        <linearGradient id={`${uid}-wing`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3559bd" />
          <stop offset="100%" stopColor="#1f3782" />
        </linearGradient>
        <linearGradient id={`${uid}-beak`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffc85c" />
          <stop offset="100%" stopColor="#e8942a" />
        </linearGradient>
        <radialGradient id={`${uid}-iris`} cx="42%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#ffd98a" />
          <stop offset="60%" stopColor="#f0a43a" />
          <stop offset="100%" stopColor="#c9761c" />
        </radialGradient>
      </defs>

      <g className="sov-owl__all">
        {/* тень под совой — приземляет фигуру */}
        <ellipse cx="60" cy="122" rx={22 + s * 1.6} ry="5" fill="#12203a" opacity="0.13" />

        <g transform={`translate(60 110) scale(${overall}) translate(-60 -110)`}>
          {/* ушки-кисточки: мягкие, скруглённые, а не острые треугольники */}
          {tufts > 0 ? (
            <g opacity={tufts}>
              <path
                d={`M37 29c-4-${7 + tufts * 7} -2-${12 + tufts * 9} 4-${14 + tufts * 10}c0 6 3 12 8 16Z`}
                fill="#2a49a6"
              />
              <path
                d={`M83 29c4-${7 + tufts * 7} 2-${12 + tufts * 9} -4-${14 + tufts * 10}c0 6-3 12-8 16Z`}
                fill="#2a49a6"
              />
            </g>
          ) : null}

          {/* пуховые торчащие пёрышки — примета птенца */}
          {downy > 0 ? (
            <g stroke="#8fb0f5" strokeWidth="2.6" strokeLinecap="round" opacity={downy}>
              <path d="M54 18c-1-5-3-8-6-10" />
              <path d="M60 15v-9" />
              <path d="M66 18c1-5 3-8 6-10" />
            </g>
          ) : null}

          {/* тело: округлая капля, шире книзу */}
          <path
            d="M60 16c19 0 33 14 33 33v22c0 21-14 34-33 34S27 92 27 71V49c0-19 14-33 33-33Z"
            fill={`url(#${uid}-body)`}
          />

          {/* мягкий блик по макушке — объём */}
          <path
            d="M42 24c4-6 10-9 18-9s14 3 18 9c-6-4-12-6-18-6s-12 2-18 6Z"
            fill="#8fb0f5"
            opacity="0.55"
          />

          {/* крылья с фестонами перьев */}
          <g fill={`url(#${uid}-wing)`}>
            <path
              d={`M29 54c-6 3-9 10-9 18 0 ${10 + wingSpread * 8} 4 ${16 + wingSpread * 6} 10 ${19 + wingSpread * 4}c2-13 3-26 2-39Z`}
            />
            <path
              d={`M91 54c6 3 9 10 9 18 0 ${10 + wingSpread * 8} -4 ${16 + wingSpread * 6} -10 ${19 + wingSpread * 4}c-2-13-3-26-2-39Z`}
            />
          </g>
          <g stroke="#5b82e4" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.75">
            <path d="M24 68c3 1 5 1 8 0M24 78c3 1 5 1 8 0M25 88c3 1 5 1 7 0" />
            <path d="M96 68c-3 1-5 1-8 0M96 78c-3 1-5 1-8 0M95 88c-3 1-5 1-7 0" />
          </g>

          {/* грудка */}
          <path
            d="M60 52c13 0 22 9 22 21 0 15-10 26-22 26s-22-11-22-26c0-12 9-21 22-21Z"
            fill={`url(#${uid}-belly)`}
          />
          {/* оперение груди — ниже клюва, чтобы не читалось как рот */}
          {showChestFeathers ? (
            <g stroke="#dccbaa" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.85">
              <path d="M50 84c3-3 7-3 10 0 3-3 7-3 10 0" />
              <path d="M48 92c4-3 8-3 12 0 4-3 8-3 12 0" />
            </g>
          ) : null}

          {/* лицевой диск */}
          <ellipse cx="60" cy="52" rx={discRx} ry={discRx * 0.83} fill={`url(#${uid}-disc)`} />

          {/* глаза */}
          {happy || sleepy ? (
            <g stroke="#1b2b4d" strokeWidth="3.2" strokeLinecap="round" fill="none">
              <path d="M39 53c4-6 10-6 14 0" />
              <path d="M67 53c4-6 10-6 14 0" />
            </g>
          ) : (
            <>
              <circle cx="46" cy="51" r={eyeR} fill="#fffdf7" />
              <circle cx="74" cy="51" r={eyeR} fill="#fffdf7" />
              <circle cx="46" cy="51" r={irisR} fill={`url(#${uid}-iris)`} />
              <circle cx="74" cy="51" r={irisR} fill={`url(#${uid}-iris)`} />
              <circle cx="46" cy="51" r={pupilR} fill="#1a2947" />
              <circle cx="74" cy="51" r={pupilR} fill="#1a2947" />
              <circle cx={46 - eyeR * 0.2} cy={51 - eyeR * 0.24} r={eyeR * 0.19} fill="#fff" />
              <circle cx={74 - eyeR * 0.2} cy={51 - eyeR * 0.24} r={eyeR * 0.19} fill="#fff" />
              <circle cx={46 + eyeR * 0.22} cy={51 + eyeR * 0.28} r={eyeR * 0.09} fill="#fff" opacity="0.75" />
              <circle cx={74 + eyeR * 0.22} cy={51 + eyeR * 0.28} r={eyeR * 0.09} fill="#fff" opacity="0.75" />
            </>
          )}

          {/* встревоженные бровки: внутрь-вверх, а не сердито вниз */}
          {concerned ? (
            <g stroke="#1b2b4d" strokeWidth="2.4" strokeLinecap="round">
              <path d="M38 40c5-3 10-4 14-3" />
              <path d="M82 40c-5-3-10-4-14-3" />
            </g>
          ) : null}

          {/* клюв */}
          <path d="M60 58c3.4 0 6 2.6 6 5.6 0 3.4-2.8 6.4-6 8.4-3.2-2-6-5-6-8.4 0-3 2.6-5.6 6-5.6Z" fill={`url(#${uid}-beak)`} />
          <path d="M60 66c1.8 1 3.4 2.2 4.6 3.6-1.4 1.2-3 2.2-4.6 3.2-1.6-1-3.2-2-4.6-3.2 1.2-1.4 2.8-2.6 4.6-3.6Z" fill="#c9761c" opacity="0.45" />

          {/* румянец */}
          <ellipse cx="35" cy="60" rx="6" ry="3.6" fill="#f0857f" opacity={happy ? 0.55 : 0.32} />
          <ellipse cx="85" cy="60" rx="6" ry="3.6" fill="#f0857f" opacity={happy ? 0.55 : 0.32} />

          {/* лапки */}
          <g fill="#f0a43a">
            <path d="M48 103c0-2 1.6-3 3.4-3s3.4 1 3.4 3c0 1.6-1.4 2.6-3.4 2.6S48 104.6 48 103Z" />
            <path d="M65 103c0-2 1.6-3 3.4-3s3.4 1 3.4 3c0 1.6-1.4 2.6-3.4 2.6s-3.4-1-3.4-2.6Z" />
            <path d="M45 105h13v2.4H45zM62 105h13v2.4H62z" opacity="0.85" />
          </g>

          {/* что совёнок заработал */}
          {item === "scarf" ? (
            <g>
              <path d="M38 74c7 5 15 7 22 7s15-2 22-7v9c-7 5-15 7-22 7s-15-2-22-7Z" fill="#e0578c" />
              <path d="M74 81c5 2 8 8 8 14l-9-2c1-4 1-8 1-12Z" fill="#c74d7c" />
            </g>
          ) : null}
          {item === "glasses" ? (
            <g stroke="#2b3f6b" strokeWidth="2.6" fill="none">
              <circle cx="46" cy="51" r="13" fill="#cfe4ff" fillOpacity="0.35" />
              <circle cx="74" cy="51" r="13" fill="#cfe4ff" fillOpacity="0.35" />
              <path d="M59 51h2" />
            </g>
          ) : null}
          {item === "cap" ? (
            <g>
              <path d="M60 4c10 6 16 14 18 24-6-4-12-6-18-6s-12 2-18 6c2-10 8-18 18-24Z" fill="#7c5cff" />
              <circle cx="60" cy="4" r="4" fill="#ffd166" />
              <path d="M50 20l3-5 3 5-3 2Zm14-3l2-4 2 4-2 2Z" fill="#ffd166" opacity="0.9" />
            </g>
          ) : null}
          {item === "graduate" ? (
            <g>
              <path d="M60 6l26 11-26 11-26-11Z" fill="#22315c" />
              <path d="M46 24v9c0 4 28 4 28 0v-9l-14 6Z" fill="#2c3f73" />
              <path d="M86 17v14" stroke="#ffd166" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="86" cy="33" r="3.4" fill="#ffd166" />
            </g>
          ) : null}
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
 * Координаты считаются один раз при загрузке модуля простым генератором с
 * фиксированным семенем: Math.random() дал бы разные звёзды на сервере и в
 * браузере, и React ругался бы на расхождение разметки при гидратации.
 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

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
