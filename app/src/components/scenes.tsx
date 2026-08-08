import { useId } from "react";

import { Owl, seeded } from "./mascot";

/**
 * Иллюстрации витрины.
 *
 * Раньше это были пять растровых кадров — фотографии бумажных макетов.
 * Совёнок на них остался прежним, с ушками и лицевым диском, и после смены
 * знака превратился в другого персонажа: в шапке пуховик, а на первом экране
 * взрослая сова.
 *
 * Здесь сцены нарисованы вектором и берут совёнка тем же компонентом Owl,
 * поэтому персонаж не «похож на знак», а буквально им является и разойтись с
 * ним больше не может. Бумажность осталась: слои кремовых оттенков с мягкой
 * тенью между ними — тот же приём, что даёт объём в аппликации.
 *
 * Два правила, из которых собраны все пять сцен:
 *
 * 1. Глубина читается цветом, а не размером: дальние планы почти белые,
 *    ближние кобальтовые. Отсюда строгий порядок отрисовки — от дальнего
 *    к ближнему.
 * 2. Кремовое на кремовом не читается. Всё, что должно быть замечено —
 *    бирки, задания, вышка, — стоит на контрастном плане или имеет
 *    кобальтовый контур.
 *
 * Холст 1200×900: контейнер .sov-hero__art режет по 4:3, и прежние кадры
 * 16:9 теряли в нём верх и низ.
 */

const P = {
  paper: "#fbf7f0",
  paper2: "#f1e9da",
  paper3: "#e2d7bf",
  paper4: "#cfc2a4",
  glow: "#fffdf7",
  cobalt: "#2f5bd4",
  navy: "#1c3f9e",
  deep: "#132b6f",
  soft: "#dfe7fb",
  amber: "#ffcf7a",
};

function Defs({ id }: { id: string }) {
  return (
    <defs>
      {/* тень между слоями: в аппликации именно она читается как толщина бумаги */}
      <filter id={id} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#6f5c3c" floodOpacity="0.24" />
      </filter>
      <radialGradient id={`${id}-glow`} cx="50%" cy="40%" r="68%">
        <stop offset="0%" stopColor={P.glow} />
        <stop offset="100%" stopColor={P.paper2} />
      </radialGradient>
    </defs>
  );
}

/* ---------------------------------------------------------------- деревья */

// fill не обязателен: без него заливка наследуется от родительской группы.
function Fir({ x, y, h, fill }: { x: number; y: number; h: number; fill?: string }) {
  const w = h * 0.48;
  return (
    <g transform={`translate(${x} ${y})`} fill={fill}>
      <rect x={-w * 0.06} y={-h * 0.16} width={w * 0.12} height={h * 0.18} rx={w * 0.05} />
      <path
        d={`M0 ${-h}L${w * 0.3} ${-h * 0.64}L${w * 0.13} ${-h * 0.64}L${w * 0.44} ${-h * 0.36}L${w * 0.22} ${-h * 0.36}L${w * 0.54} ${-h * 0.13}L${-w * 0.54} ${-h * 0.13}L${-w * 0.22} ${-h * 0.36}L${-w * 0.44} ${-h * 0.36}L${-w * 0.13} ${-h * 0.64}L${-w * 0.3} ${-h * 0.64}Z`}
      />
    </g>
  );
}

function Round({ x, y, h, fill }: { x: number; y: number; h: number; fill?: string }) {
  const w = h * 0.66;
  return (
    <g transform={`translate(${x} ${y})`} fill={fill}>
      <rect x={-w * 0.07} y={-h * 0.46} width={w * 0.14} height={h * 0.48} rx={w * 0.05} />
      <ellipse cx={-w * 0.26} cy={-h * 0.58} rx={w * 0.34} ry={h * 0.21} />
      <ellipse cx={w * 0.26} cy={-h * 0.58} rx={w * 0.34} ry={h * 0.21} />
      <ellipse cx="0" cy={-h * 0.76} rx={w * 0.44} ry={h * 0.26} />
    </g>
  );
}

/** Кустик травы — им подпираются стыки планов, чтобы бумага не «висела». */
function Grass({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 0c-2-14-8-24-16-30 12 2 20 10 24 22 2-16 8-28 18-36-6 12-8 26-6 44Z"
    />
  );
}

function Leaf({ x, y, r, s = 1 }: { x: number; y: number; r: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
      d="M0 0c18-5 33-18 38-34-18 4-33 16-38 34Z"
    />
  );
}

/** Ряд деревьев по всей ширине. Индекс ряда — глубина, от неё же и цвет. */
function treeRow(seed: number, y: number, minH: number, maxH: number, step: number, gap: number) {
  const rnd = seeded(seed);
  const list: { x: number; y: number; h: number; fir: boolean }[] = [];
  let x = -70;
  while (x < 1280) {
    list.push({ x, y, h: minH + rnd() * (maxH - minH), fir: rnd() < 0.55 });
    x += step + rnd() * gap;
  }
  return list;
}

function Row({ list, fill }: { list: ReturnType<typeof treeRow>; fill: string }) {
  return (
    <g fill={fill}>
      {list.map((t, i) =>
        t.fir ? <Fir key={i} x={t.x} y={t.y} h={t.h} /> : <Round key={i} x={t.x} y={t.y} h={t.h} />,
      )}
    </g>
  );
}

/* ------------------------------------------------------- 1. первый экран */

/** Совёнок за столиком: тихий угол, где делают уроки. */
export function SceneDesk() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 1200 900"
      className="sov-scene"
      role="img"
      aria-label="Бумажная аппликация: совёнок сидит на стульчике у столика со стопкой листов"
    >
      <Defs id={uid} />
      <rect width="1200" height="900" fill={`url(#${uid}-glow)`} />

      {/* окно: свет, ради которого стол и стоит именно здесь */}
      <g filter={`url(#${uid})`}>
        <rect x="96" y="80" width="356" height="326" rx="20" fill={P.soft} />
        <g fill={P.paper}>
          <rect x="260" y="80" width="28" height="326" />
          <rect x="96" y="228" width="356" height="28" />
        </g>
        <rect
          x="96"
          y="80"
          width="356"
          height="326"
          rx="20"
          fill="none"
          stroke={P.paper}
          strokeWidth="16"
        />
      </g>

      {/* пол и кобальтовый коврик — они держат низ кадра */}
      <rect y="716" width="1200" height="184" fill={P.paper} />
      <rect y="714" width="1200" height="6" fill={P.paper4} opacity="0.5" />
      <path d="M186 802h828l104 98H82Z" fill={P.soft} />

      {/* столик: столешница, ящик, стопка листов и синяя тетрадь */}
      <g filter={`url(#${uid})`}>
        <g fill={P.paper2}>
          <rect x="126" y="556" width="422" height="38" rx="13" />
          <rect x="160" y="594" width="354" height="86" rx="11" />
          <rect x="176" y="680" width="34" height="156" rx="12" />
          <rect x="464" y="680" width="34" height="156" rx="12" />
        </g>
        <rect x="178" y="610" width="318" height="54" rx="9" fill={P.paper3} opacity="0.7" />
        <circle cx="337" cy="637" r="15" fill={P.cobalt} />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={196 + i * 5} y={528 - i * 10} width="196" height="14" rx="4" fill={P.glow} />
            <rect
              x={196 + i * 5}
              y={539 - i * 10}
              width="196"
              height="4"
              fill={P.paper3}
              opacity="0.6"
            />
          </g>
        ))}
        <rect x="406" y="520" width="124" height="16" rx="5" fill={P.cobalt} />
        <rect x="410" y="506" width="116" height="15" rx="5" fill={P.navy} />
      </g>

      {/* совёнок стоит у стола: ростом он с ребёнка, поэтому голова выше
          столешницы — стул тут только мешал бы и читался как рама */}
      <g filter={`url(#${uid})`} transform="translate(700 508)">
        <Owl size={300} stage={1} mood="happy" animated />
      </g>

      {/* передний план: растение в кобальтовом горшке */}
      <g filter={`url(#${uid})`}>
        <g fill={P.paper3}>
          <Leaf x={1084} y={778} r={-78} s={1.8} />
          <Leaf x={1084} y={778} r={-46} s={2.1} />
          <Leaf x={1084} y={778} r={-12} s={1.7} />
        </g>
        <path d="M1026 774h116l-16 126h-84Z" fill={P.cobalt} />
        <path d="M1026 774h116l-4 26h-108Z" fill={P.navy} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------ 2. ученик заводится */

const FOREST_FAR = treeRow(31337, 606, 150, 240, 76, 40);
const FOREST_MID = treeRow(4242, 664, 280, 400, 128, 74);
const FOREST_NEAR = [
  { x: 168, y: 812, h: 520, fir: true },
  { x: 372, y: 780, h: 402, fir: false },
  { x: 838, y: 784, h: 418, fir: false },
  { x: 1044, y: 816, h: 536, fir: true },
];
const FOREST_FRONT = [
  { x: 8, y: 950, h: 800, fir: false },
  { x: 1196, y: 950, h: 830, fir: true },
];

/** Совёнок один на тропинке: с этого шага начинается ученик. */
export function SceneForest() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 1200 900"
      className="sov-scene"
      role="img"
      aria-label="Бумажная аппликация: совёнок стоит на тропинке посреди леса"
    >
      <Defs id={uid} />
      <clipPath id={`${uid}-box`}>
        <rect x="44" y="44" width="1112" height="812" rx="14" />
      </clipPath>

      <rect width="1200" height="900" fill={P.paper2} />
      <g clipPath={`url(#${uid}-box)`}>
        <rect x="44" y="44" width="1112" height="812" fill={`url(#${uid}-glow)`} />

        <Row list={FOREST_FAR} fill={P.glow} />
        <Row list={FOREST_MID} fill={P.paper3} />

        {/* земля и тропинка: тропинка светлее земли, иначе её не видно */}
        <rect y="606" width="1200" height="294" fill={P.paper2} />
        <path d="M600 608c-30 84-126 176-286 248h572c-160-72-256-164-286-248Z" fill={P.glow} />
        <path d="M600 608c-30 84-126 176-286 248h34c142-72 226-162 252-248Z" fill={P.paper} />

        <Row list={FOREST_NEAR} fill={P.cobalt} />
        <Row list={FOREST_FRONT} fill={P.navy} />

        <g fill={P.paper4} opacity="0.8">
          <Grass x={244} y={848} s={1.4} />
          <Grass x={332} y={866} />
          <Grass x={900} y={854} s={1.2} />
          <Grass x={986} y={870} s={0.9} />
        </g>
      </g>

      {/* совёнок стоит на тропинке, ногами на земле */}
      <g filter={`url(#${uid})`} transform="translate(480 556)">
        <Owl size={240} stage={1} animated />
      </g>

      {/* рамка короба поверх всего — она и делает сцену «в коробке» */}
      <path
        d="M0 0h1200v900H0Zm44 44v812h1112V44Z"
        fill={P.paper}
        fillRule="evenodd"
        filter={`url(#${uid})`}
      />
    </svg>
  );
}

/* --------------------------------------------------- 3. домашка в два клика */

/**
 * Задания раскиданы по спирали, а не выложены дугой: правильная дуга читается
 * как радуга из шариков, а нужна горсть, которую можно пересчитать.
 */
const TASK_BITS = (() => {
  const rnd = seeded(9091);
  return Array.from({ length: 10 }, (_, i) => {
    const a = i * 2.39996; // золотой угол — точки не сбиваются в кучу
    const r = 46 + i * 25;
    return {
      x: 566 + Math.cos(a) * r * 1.45 + (rnd() - 0.5) * 30,
      y: 396 + Math.sin(a) * r * 0.92 + (rnd() - 0.5) * 30,
      s: 32 + rnd() * 18,
      cube: i % 3 === 1,
      dark: i % 2 === 0,
    };
  });
})();

const GLADE_BACK = treeRow(777, 646, 190, 280, 96, 52);

/** Задания как счётный материал: кубики и шарики сами собираются в домашку. */
export function SceneTasks() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 1200 900"
      className="sov-scene"
      role="img"
      aria-label="Бумажная аппликация: кубики и шарики парят над лесной поляной"
    >
      <Defs id={uid} />
      <rect width="1200" height="900" fill={`url(#${uid}-glow)`} />

      <Row list={GLADE_BACK} fill={P.glow} />

      {/* кулисы: поляна открыта в центре, деревья только по краям */}
      <g fill={P.paper3}>
        <Round x={128} y={706} h={470} />
        <Fir x={296} y={690} h={360} />
        <Round x={1072} y={706} h={486} />
        <Fir x={912} y={690} h={372} />
      </g>
      <g fill={P.cobalt}>
        <Fir x={-16} y={880} h={700} />
        <Round x={1222} y={880} h={676} />
      </g>

      <rect y="700" width="1200" height="200" fill={P.paper2} />
      <path
        d="M0 700h1200v28c-192 30-434 8-632 20-198 12-388 4-568-16Z"
        fill={P.paper3}
        opacity="0.8"
      />

      <g fill={P.paper4} opacity="0.7">
        {Array.from({ length: 13 }, (_, i) => (
          <Grass key={i} x={62 + i * 92} y={744} s={0.8 + (i % 3) * 0.22} />
        ))}
      </g>

      {/* сами задания: высоту им даёт общая тень слоя, отдельные тени на
          земле сливались в грязную полосу и только пачкали поляну */}
      <g filter={`url(#${uid})`}>
        {TASK_BITS.map((b, i) => {
          const fill = b.dark ? P.navy : P.cobalt;
          return b.cube ? (
            <g key={i} transform={`translate(${b.x} ${b.y})`}>
              <path
                d={`M0 0l${b.s} -${b.s * 0.52}l${b.s} ${b.s * 0.52}l-${b.s} ${b.s * 0.52}Z`}
                fill={P.soft}
              />
              <path d={`M0 0v${b.s}l${b.s} ${b.s * 0.52}V${b.s * 0.52}Z`} fill={fill} />
              <path d={`M${b.s * 2} 0v${b.s}l-${b.s} ${b.s * 0.52}V${b.s * 0.52}Z`} fill={P.deep} />
            </g>
          ) : (
            <g key={i}>
              <circle cx={b.x + b.s} cy={b.y + b.s * 0.6} r={b.s * 0.92} fill={fill} />
              <circle
                cx={b.x + b.s * 0.64}
                cy={b.y + b.s * 0.22}
                r={b.s * 0.3}
                fill={P.soft}
                opacity="0.55"
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------- 4. что просело */

/** Ствол крупным планом: колонна с бумажной фаской и парой волокон. */
function Trunk({ x, w, fill, edge }: { x: number; w: number; fill: string; edge: string }) {
  return (
    <g>
      <rect x={x} y={-40} width={w} height={980} fill={fill} />
      <rect x={x} y={-40} width={w * 0.24} height={980} fill={edge} opacity="0.45" />
      <g stroke={edge} strokeWidth="3" opacity="0.3" strokeLinecap="round">
        <path d={`M${x + w * 0.52} 60v170M${x + w * 0.72} 330v210M${x + w * 0.46} 640v180`} />
      </g>
    </g>
  );
}

const TAGS = [
  { x: 236, y: 250, len: 190 },
  { x: 470, y: 196, len: 258 },
  { x: 648, y: 286, len: 146 },
  { x: 880, y: 222, len: 232 },
  { x: 1050, y: 274, len: 168 },
];

/** Бирки на ветках: к занятию видно, что где просело. */
export function SceneTags() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tag = (x: number, y: number, rot = 0) => (
    <g filter={`url(#${uid})`} transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect
        x="-48"
        width="96"
        height="126"
        rx="17"
        fill={P.glow}
        stroke={P.cobalt}
        strokeWidth="6"
      />
      <circle cy="24" r="9" fill={P.soft} stroke={P.cobalt} strokeWidth="4" />
    </g>
  );
  return (
    <svg
      viewBox="0 0 1200 900"
      className="sov-scene"
      role="img"
      aria-label="Бумажная аппликация: на ветках деревьев висят пустые бумажные бирки"
    >
      <Defs id={uid} />
      <rect width="1200" height="900" fill={`url(#${uid}-glow)`} />

      {/* дальние стволы — светлее и тоньше */}
      <g opacity="0.45">
        <Trunk x={188} w={38} fill={P.cobalt} edge={P.soft} />
        <Trunk x={596} w={32} fill={P.cobalt} edge={P.soft} />
        <Trunk x={1004} w={40} fill={P.cobalt} edge={P.soft} />
      </g>

      {/* ближние стволы: разной ширины, иначе кадр читается как штрихкод */}
      <g filter={`url(#${uid})`}>
        <Trunk x={24} w={116} fill={P.navy} edge={P.cobalt} />
        <Trunk x={330} w={74} fill={P.navy} edge={P.cobalt} />
        <Trunk x={726} w={126} fill={P.navy} edge={P.cobalt} />
        <Trunk x={1104} w={82} fill={P.navy} edge={P.cobalt} />
      </g>

      {/* ветки с листьями */}
      {/* каждой бирке — своя ветка, иначе нитки висят из ниоткуда */}
      <g stroke={P.navy} strokeWidth="11" strokeLinecap="round" fill="none">
        <path d="M140 232c66-28 132-16 190 34" />
        <path d="M404 174c64-32 128-24 182 26" />
        <path d="M726 268c-38-18-70-16-102 12" />
        <path d="M852 250c62-34 126-30 184 16" />
        <path d="M1104 254c-30-16-56-14-84 12" />
      </g>
      <g fill={P.navy}>
        {[
          [192, 214, -30],
          [242, 204, -8],
          [292, 218, 18],
          [452, 156, -30],
          [502, 146, -8],
          [552, 160, 18],
          [900, 232, -30],
          [950, 222, -8],
          [1000, 236, 18],
          [656, 250, 150],
          [1058, 236, 150],
        ].map(([x, y, r], i) => (
          <Leaf key={i} x={x} y={y} r={r} s={0.9} />
        ))}
      </g>

      {/* бирки на нитках */}
      {TAGS.map((t, i) => (
        <g key={i}>
          <path d={`M${t.x} ${t.y}v${t.len}`} stroke={P.cobalt} strokeWidth="6" />
          {tag(t.x, t.y + t.len)}
        </g>
      ))}
      {/* одна бирка сорвалась — не всё доходит до занятия */}
      {tag(548, 742, -17)}
    </svg>
  );
}

/* -------------------------------------------------- 5. родитель по коду */

const CANOPY = [
  treeRow(6161, 700, 120, 176, 84, 44),
  treeRow(7272, 790, 168, 240, 108, 60),
  treeRow(8383, 918, 210, 310, 138, 78),
];

/** Смотровая вышка над лесом: родителю видно ту же картину, что и педагогу. */
export function SceneTower() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 1200 900"
      className="sov-scene"
      role="img"
      aria-label="Бумажная аппликация: смотровая вышка поднимается над кронами бумажного леса"
    >
      <Defs id={uid} />
      <rect width="1200" height="900" fill={`url(#${uid}-glow)`} />

      {/* низкое солнце — оно и делает из кадра рассвет, а не пустое небо */}
      <circle cx="936" cy="196" r="86" fill={P.amber} opacity="0.5" />
      <circle cx="936" cy="196" r="54" fill={P.amber} opacity="0.55" />

      {/* дальние холмы */}
      <path
        d="M0 430c186-50 328-22 512 8 184 30 348-16 688-40v502H0Z"
        fill={P.paper2}
        opacity="0.7"
      />
      <path d="M0 512c224-44 388-10 570 18 182 28 386-12 630-30v400H0Z" fill={P.paper2} />

      {/* вышка: ноги видны над кронами, поэтому она читается как вышка */}
      <g filter={`url(#${uid})`}>
        {/* опоры темнее кремового: на светлых кронах paper3 просто исчезал */}
        <g fill={P.paper4}>
          <rect x="548" y="392" width="28" height="386" rx="10" />
          <rect x="624" y="392" width="28" height="386" rx="10" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="548" y={452 + i * 68} width="104" height="16" rx="7" />
          ))}
        </g>
        <rect x="486" y="356" width="228" height="38" rx="13" fill={P.paper} />
        <g fill={P.cobalt}>
          <rect x="486" y="248" width="228" height="18" rx="8" />
          <rect x="486" y="266" width="18" height="96" rx="7" />
          <rect x="696" y="266" width="18" height="96" rx="7" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={530 + i * 40} y="266" width="13" height="96" rx="5" />
          ))}
        </g>
      </g>

      {/* кроны рядами: чем ближе, тем темнее бумага */}
      <Row list={CANOPY[0]} fill={P.glow} />
      <Row list={CANOPY[1]} fill={P.paper3} />
      <Row list={CANOPY[2]} fill={P.cobalt} />
    </svg>
  );
}
