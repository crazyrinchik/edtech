import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  Owl,
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
    tags: ["7 заданий на предмет", "Стартовый уровень", "Без лишних шагов"],
  },
  {
    id: "chisla",
    image: "/assets/scene-2.webp",
    title: "Математика как дорожка из полян",
    text: "Темы открываются по очереди. Ребёнок видит короткий путь вперёд, а не бесконечный список. Каждая поляна это 5 или 10 заданий.",
    tags: ["Счёт до 20", "Таблица умножения", "Порядок действий"],
  },
  {
    id: "bukvy",
    image: "/assets/scene-3.webp",
    title: "Ошибка объясняется, а не отмечается красным",
    text: "Вместо слова «неверно» появляется разбор: почему так, как проверить, что запомнить. После разбора можно попробовать снова.",
    tags: ["Жи и ши", "Части речи", "Проверочное слово"],
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
    <section className="sov-section sov-shell">
      <h2>Два тренажёра работают сразу</h2>
      <p className="sov-section__lead">
        Ни регистрации, ни оплаты: открыл и занимаешься. Прогресс сохраняется только с аккаунтом —
        об этом сказано прямо на экране результата, а не мелким шрифтом.
      </p>
      <div className="sov-split">
        <div className="sov-panel">
          <h3>Устный счёт</h3>
          <p style={{ color: "var(--sov-ink-soft)", marginTop: 8, fontSize: ".95rem" }}>
            Однозначные, двузначные и трёхзначные числа, выбор действий и таймер на каждый ответ —
            от пяти секунд до «без ограничения».
          </p>
          <div style={{ marginTop: 18 }}>
            <StartAction to="/schet">Открыть тренажёр</StartAction>
          </div>
        </div>
        <div className="sov-panel">
          <h3>Скорочтение</h3>
          <p style={{ color: "var(--sov-ink-soft)", marginTop: 8, fontSize: ".95rem" }}>
            Слова показываются по одному с выбранной скоростью, после текста — вопросы на
            понимание. Три уровня сложности текстов.
          </p>
          <div style={{ marginTop: 18 }}>
            <StartAction to="/chtenie">Открыть тренажёр</StartAction>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="sov-section sov-shell">
      <h2>Что происходит внутри занятия</h2>
      <p className="sov-section__lead">
        Одна тема это набор из 5 или 10 упражнений с мгновенной проверкой. В конце темы идёт
        короткая проверочная работа, и только после неё открывается следующая.
      </p>
      <div className="sov-rows">
        {[
          ["Мгновенная проверка", "Ответ засчитывается сразу после нажатия. Реакция интерфейса занимает доли секунды, ребёнок не ждёт."],
          ["Разбор вместо оценки", "При ошибке появляется объяснение простыми словами и правильный ответ. Попробовать снова можно тут же."],
          ["Звёзды за темы", "Награда привязана к пройденным темам, а не к времени в приложении. Сидеть дольше не значит получить больше."],
          ["Мягкий стоп", "Через 20 минут занятие предлагает сделать перерыв. Лимит родитель настраивает сам."],
        ].map(([title, text]) => (
          <div key={title} className="sov-row">
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ForParents() {
  return (
    <section className="sov-section sov-shell">
      <div className="sov-split">
        <div>
          <h2>Кабинет родителя это другой продукт</h2>
          <p className="sov-section__lead">
            Взрослый интерфейс без анимаций и персонажей. Он отвечает на три вопроса: занимается ли
            ребёнок, что уже освоено и где проседает.
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

function Safety() {
  return (
    <section className="sov-section sov-shell">
      <div className="sov-split sov-split--flip">
        <div className="sov-panel">
          <Owl size={44} />
          <h3 style={{ marginTop: 14 }}>Что знает система о ребёнке</h3>
          <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: "var(--sov-ink-soft)", lineHeight: 1.9 }}>
            <li>Имя, которое выбрал родитель</li>
            <li>Класс и аватар</li>
            <li>Ответы на задания и время занятий</li>
          </ul>
          <p className="sov-mono" style={{ marginTop: 16, color: "var(--sov-ink-soft)" }}>
            Почта, телефон и фотографии ребёнка не собираются.
          </p>
        </div>
        <div>
          <h2>Данные детей под защитой</h2>
          <p className="sov-section__lead">
            Аккаунт заводит родитель и отдельно подтверждает согласие на обработку данных ребёнка по
            152-ФЗ. Профиль виден только внутри своего аккаунта: ребёнок не может открыть данные
            других семей. Пароли хранятся в виде хеша, весь обмен идёт по HTTPS.
          </p>
        </div>
      </div>
    </section>
  );
}

function Plans() {
  return (
    <section className="sov-section sov-shell">
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
