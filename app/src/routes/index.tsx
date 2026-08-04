import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  NightSky,
  QuietAction,
  SiteFooter,
  SiteHeader,
  StartAction,
} from "../components/brand";

export const Route = createFileRoute("/")({ component: Landing });

const SCENES = [
  {
    id: "opushka",
    image: "/assets/scene-1.webp",
    title: "Занятие начинается за две минуты",
    text: "Родитель заводит профиль ребёнка, проходит короткую диагностику и сразу видит, с какой темы начинать. Никаких длинных настроек.",
    // Баблы описывают то, что показывает сама шторка, а не набор тем.
    // Диагностика — ровно 6 заданий на предмет (см. DIAGNOSTIC в content/seed.ts).
    tags: ["6 заданий на предмет", "Уровень определяется сам", "Без настроек"],
  },
  {
    id: "chisla",
    image: "/assets/scene-2.webp",
    title: "Математика как дорожка из полян",
    // Точного числа заданий на тему здесь нет намеренно: в сиде их от 2 до 12,
    // и любая цифра была бы неправдой для половины тем.
    text: "Темы открываются по очереди. Ребёнок видит короткий путь вперёд, а не бесконечный список. Каждая поляна это отдельная тема с проверочной в конце.",
    tags: ["Темы открываются по очереди", "Одна поляна — одна тема", "Виден путь вперёд"],
  },
  {
    id: "bukvy",
    image: "/assets/scene-3.webp",
    title: "Ошибка объясняется, а не отмечается красным",
    text: "Вместо слова «неверно» появляется разбор: почему так, как проверить, что запомнить. После разбора можно попробовать снова.",
    tags: ["Разбор вместо «неверно»", "Правильный ответ и почему", "Можно попробовать снова"],
  },
  {
    id: "vyshka",
    image: "/assets/scene-4.webp",
    title: "Родитель видит картину целиком",
    text: "Отдельный кабинет: пройденные темы, процент верных ответов, время за неделю и зоны риска, где ребёнок ошибается регулярно.",
    tags: ["Зоны риска", "История занятий", "Лимит времени"],
  },
];

function Landing() {
  return (
    <div className="sov">
      <SiteHeader
        right={
          <>
            <QuietAction to="/vhod">Войти</QuietAction>
            <StartAction to="/registraciya">Создать аккаунт</StartAction>
          </>
        }
      />
      <Hero />
      <Journey />
      <Trainers />
      <HowItWorks />
      <ForParents />
      <Safety />
      <Plans />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="sov-hero">
      <div className="sov-shell sov-hero__grid">
        <div>
          <h1>
            Ребёнок садится за уроки <em>сам</em>
          </h1>
          <p>
            Тренажёр по математике и русскому языку для 1 и 2 класса. Занятие идёт 20 минут,
            ошибки разбираются словами, а прогресс виден родителю в отдельном кабинете.
          </p>
          <div className="sov-hero__actions">
            {/* Нулевой урок стоит первым: попробовать до регистрации — самый
                короткий путь понять, подходит ли тренажёр ребёнку. */}
            <StartAction to="/demo">Попробовать без регистрации</StartAction>
            <QuietAction to="/registraciya">Завести аккаунт</QuietAction>
            <QuietAction to="/vhod">У меня уже есть аккаунт</QuietAction>
          </div>
          <p className="sov-mono" style={{ marginTop: 18, color: "var(--sov-ink-soft)" }}>
            Нулевой урок — 7 заданий, без почты и пароля. Там же кнопка-ушко: задание можно
            послушать, если ребёнок ещё не читает.
          </p>
        </div>
        <div className="sov-hero__art">
          <img
            src="/assets/hero.webp"
            alt="Бумажная аппликация: совёнок ведёт ребёнка по тропинке через лес заданий"
            width={1200}
            height={900}
          />
        </div>
      </div>
    </section>
  );
}

/** Путешествие: положение скролла управляет кадром. Пассивного зацикленного видео нет. */
function Journey() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const render = () => {
      frame = 0;
      const rect = wrap.getBoundingClientRect();
      const span = wrap.offsetHeight - window.innerHeight;
      const raw = span > 0 ? (-rect.top) / span : 0;
      const t = Math.min(1, Math.max(0, raw)) * (SCENES.length - 1);

      layerRefs.current.forEach((layer, i) => {
        if (!layer) return;
        // Каждая следующая сцена наезжает поверх предыдущей: только clip и scale.
        const local = Math.min(1, Math.max(0, t - (i - 1)));
        const cover = i === 0 ? 1 : local;
        const push = 1.1 - 0.1 * Math.min(1, Math.max(0, t - i + 1));
        layer.style.clipPath = `inset(${(1 - cover) * 100}% 0% 0% 0%)`;
        layer.style.transform = `scale(${push.toFixed(4)})`;
      });

      setActive(Math.round(t));
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const goTo = (index: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const span = wrap.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: wrap.offsetTop + (span * index) / (SCENES.length - 1),
      behavior: "smooth",
    });
  };

  return (
    <section ref={wrapRef} className="sov-journey" aria-label="Как устроен путь ребёнка">
      <div className="sov-journey__stage">
        {SCENES.map((scene, i) => (
          <div
            key={scene.id}
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            className="sov-journey__layer"
            style={{ zIndex: i }}
          >
            <img src={scene.image} alt="" width={1600} height={900} loading={i === 0 ? "eager" : "lazy"} />
            <div className="sov-journey__scrim" />
          </div>
        ))}

        <div className="sov-journey__caption" style={{ zIndex: SCENES.length + 1 }}>
          <h2>{SCENES[Math.min(active, SCENES.length - 1)].title}</h2>
          <p>{SCENES[Math.min(active, SCENES.length - 1)].text}</p>
          <div className="sov-journey__tags">
            {SCENES[Math.min(active, SCENES.length - 1)].tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>

        <div className="sov-journey__rail">
          {SCENES.map((scene, i) => (
            <button
              key={scene.id}
              type="button"
              data-active={i === active}
              onClick={() => goTo(i)}
              aria-label={scene.title}
            />
          ))}
        </div>
      </div>

      {SCENES.map((scene) => (
        <article key={scene.id} className="sov-journey__chapter">
          <h3 className="sr-only">{scene.title}</h3>
          <p className="sr-only">{scene.text}</p>
        </article>
      ))}
    </section>
  );
}

/** Тренажёры открыты без аккаунта — это отдельный вход в продукт, не подраздел тем. */
function Trainers() {
  return (
    <section className="sov-section sov-shell sov-section--glow">
      <h2>Бесплатные тренажёры</h2>
      <p className="sov-section__lead">
        Открыты без аккаунта — можно начать прямо сейчас. Регистрация нужна только для того,
        чтобы сохранялся прогресс.
      </p>
      <div className="sov-duo">
        <div className="sov-big">
          <h3>Устный счёт</h3>
          <p>
            Однозначные, двузначные и трёхзначные числа, выбор действий и таймер на каждый ответ —
            от пяти секунд до «без ограничения».
          </p>
          <div style={{ marginTop: 22 }}>
            <StartAction to="/schet">Открыть тренажёр</StartAction>
          </div>
        </div>
        <div className="sov-big sov-big--warm">
          <h3>Скорочтение</h3>
          <p>
            Слова показываются по одному с выбранной скоростью, после текста — вопросы на
            понимание. Три уровня сложности текстов.
          </p>
          <div style={{ marginTop: 22 }}>
            <StartAction to="/chtenie">Открыть тренажёр</StartAction>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    /* Ночь над лесом: совёнок ночная птица, а карта уровней у ребёнка
       упирается в опушку. Тёмная полоса разрывает бежевую монотонность
       сильнее любого оттенка и при этом остаётся в языке продукта. */
    <section className="sov-night">
      <NightSky />
      <div className="sov-shell">
        <h2>Что происходит внутри занятия</h2>
        <p className="sov-section__lead">
          Одна тема это набор упражнений с мгновенной проверкой. Следующая открывается только
          после проверочной работы.
        </p>
        {/* Каждая цифра проверена по коду, а не придумана для красоты. */}
        <div className="sov-figures">
          <div className="sov-fig">
            <b>70%</b>
            <span>нужно набрать в проверочной, чтобы тема засчиталась</span>
          </div>
          <div className="sov-fig">
            <b>20</b>
            <span>минут — и занятие само предложит передохнуть</span>
          </div>
          <div className="sov-fig">
            <b>3</b>
            <span>звезды за тему, и только за неё, а не за время в приложении</span>
          </div>
          <div className="sov-fig">
            <b>0</b>
            <span>слов «неверно»: вместо оценки ребёнок видит разбор ошибки</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ForParents() {
  return (
    <section className="sov-section sov-shell sov-section--glow">
      <div className="sov-split">
        <div>
          <h2>Кабинет родителя</h2>
          <p className="sov-section__lead">
            Взрослый интерфейс без анимаций и персонажей: видно, занимается ли ребёнок, что уже
            освоено и где он ошибается чаще всего.
          </p>
          <div className="sov-chips">
            <span className="sov-chip">Процент верных ответов</span>
            <span className="sov-chip">Минуты за неделю</span>
            <span className="sov-chip">Зоны риска</span>
            <span className="sov-chip">История занятий</span>
          </div>
        </div>
        <div className="sov-panel">
          <h3>Зоны риска</h3>
          <p style={{ color: "var(--sov-ink-soft)", marginTop: 8, fontSize: ".95rem" }}>
            Темы, где ребёнок ошибается регулярно, выносятся отдельно. Это подсказка, что повторить
            вместе за столом.
          </p>
          <div style={{ marginTop: 18 }}>
            <div className="sov-risk">
              <strong>Вычитание до 20</strong>
              <div className="sov-mono" style={{ marginTop: 4 }}>верных 52 процента</div>
            </div>
            <div className="sov-risk">
              <strong>Проверяемые гласные в корне</strong>
              <div className="sov-mono" style={{ marginTop: 4 }}>верных 61 процент</div>
            </div>
          </div>
          <p className="sov-mono" style={{ marginTop: 16, color: "var(--sov-ink-soft)" }}>
            Пример оформления. Реальные цифры появятся после первых занятий.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Иконки гарантий. Рисуются здесь, а не берутся эмодзи: системные эмодзи
 * приходят цветными и разными на каждой платформе — из графики сайта они
 * выпадают. Общий язык: viewBox 24, обводка 2, цвет наследуется.
 */
const guardIcon = (paths: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);

const GUARDS = [
  {
    // два отдельных согласия — две галочки, а не одна
    icon: guardIcon(
      <>
        <rect x="3" y="4" width="7" height="7" rx="2" />
        <path d="M5 7.5 6.5 9 9 6" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <path d="M5 17.5 6.5 19 9 16" />
        <path d="M13 7h8M13 17h8" />
      </>,
    ),
    title: "Согласие отдельно",
    text: "Данные родителя и данные ребёнка подтверждаются двумя разными галочками, а не одной общей.",
  },
  {
    icon: guardIcon(
      <>
        <rect x="4" y="10" width="16" height="10" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
      </>,
    ),
    title: "Профиль внутри семьи",
    text: "Ребёнок не может открыть данные других семей: доступ проверяется на каждом запросе.",
  },
  {
    icon: guardIcon(
      <>
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h9M18 12v3.5M15 12v2.5" />
      </>,
    ),
    title: "Пароли не хранятся",
    text: "В базе лежит только хеш, восстановить из него исходный пароль нельзя.",
  },
  {
    icon: guardIcon(
      <>
        <path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3Z" />
        <path d="M9 12.2 11 14.2 15 10" />
      </>,
    ),
    title: "Обмен по HTTPS",
    text: "Соединение шифруется целиком, включая ответы ребёнка на задания.",
  },
];

function Safety() {
  return (
    <section className="sov-section sov-shell sov-section--glow">
      <h2>Данные детей под защитой</h2>
      <p className="sov-section__lead">
        Аккаунт заводит взрослый и отдельно подтверждает согласие на обработку данных ребёнка
        по 152-ФЗ.
      </p>

      <div className="sov-guards">
        {GUARDS.map((g) => (
          <div key={g.title} className="sov-guard">
            <span className="sov-guard__icon">{g.icon}</span>
            <h3>{g.title}</h3>
            <p>{g.text}</p>
          </div>
        ))}
      </div>

      {/* Главный вопрос родителя не «как защищено», а «что система знает
          о моём ребёнке» — поэтому список данных явно поделён надвое. */}
      <div className="sov-data">
        <h3>Что знает система о ребёнке</h3>
        <div className="sov-data__col sov-data__col--yes">
          <b>Хранит</b>
          <ul>
            <li>Имя, которое выбрал родитель</li>
            <li>Класс и аватар</li>
            <li>Ответы и время занятий</li>
          </ul>
        </div>
        <div className="sov-data__col sov-data__col--no">
          <b>Не спрашивает</b>
          <ul>
            <li>Почту и телефон</li>
            <li>Фотографии</li>
            <li>Геолокацию</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Plans() {
  return (
    <section className="sov-section sov-shell sov-section--glow">
      <h2>Сколько это стоит</h2>
      <p className="sov-section__lead">
        Первая тема каждого предмета открыта всегда. Подписка снимает ограничение и открывает
        остальные темы обоих предметов.
      </p>
      <div className="sov-plans">
        <div className="sov-plan">
          <h3>Бесплатно</h3>
          <div className="sov-plan__price">0 ₽</div>
          <ul>
            <li>Нулевой урок и оба тренажёра без регистрации</li>
            <li>Входная диагностика</li>
            <li>По одной теме в математике и русском</li>
            <li>Кабинет родителя целиком</li>
            <li>Несколько детей в одном аккаунте</li>
          </ul>
          <div style={{ marginTop: 24 }}>
            <StartAction to="/registraciya">Завести аккаунт</StartAction>
          </div>
        </div>
        <div className="sov-plan sov-plan--paid">
          <h3>Подписка</h3>
          <div className="sov-plan__price">490 ₽ в месяц</div>
          <ul>
            <li>Все темы 1 и 2 класса</li>
            <li>Проверочные работы и звёзды</li>
            <li>Зоны риска по каждой теме</li>
            <li>Отмена в один клик</li>
          </ul>
          <p className="sov-mono" style={{ marginTop: 18 }}>
            На пилоте оплата подключается промокодом. Введите SOVENOK в кабинете.
          </p>
        </div>
      </div>
    </section>
  );
}
