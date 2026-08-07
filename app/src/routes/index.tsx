import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

import {
  QuietAction,
  SiteFooter,
  SiteHeader,
  StartAction,
} from "../components/brand";

export const Route = createFileRoute("/")({ component: Landing });

/**
 * Витрина говорит с репетитором.
 *
 * Раньше она была написана для родителя: «ребёнок садится за уроки сам»,
 * кабинет, лимит времени. Платит теперь репетитор, и он же приводит семьи —
 * значит первый экран должен отвечать на его вопрос, а не на родительский.
 * Родитель при этом никуда не делся: у него свой вход, и он стоит рядом,
 * а не спрятан в подвале, — чаще всего он приходит с кодом от педагога.
 */
const STEPS = [
  {
    id: "uchenik",
    image: "/assets/scene-1.webp",
    title: "Ученик заводится за минуту",
    text: "Имя и класс — всё. Заниматься можно сразу, ждать родителя не нужно: он подключится позже и увидит ту же картину.",
    tags: ["Без почты ученика", "Сразу к занятиям", "Сколько угодно учеников"],
  },
  {
    id: "domashka",
    image: "/assets/scene-2.webp",
    title: "Домашка задаётся в два клика",
    text: "Отмечаете темы и тренажёры, ставите срок и порог: тема засчитывается, когда ребёнок сделает её на 70% верных. Проверять руками нечего.",
    tags: ["Темы и тренажёры", "Срок и порог", "Проверяется само"],
  },
  {
    id: "kontrol",
    image: "/assets/scene-3.webp",
    title: "К занятию видно, что просело",
    text: "В списке учеников — кто сделал домашку, кто не открывал, и темы, где доля верных ниже 70%. Занятие начинается не с «ну как дела», а с конкретной темы.",
    tags: ["Статус домашки", "Зоны риска", "История занятий"],
  },
  {
    id: "roditel",
    image: "/assets/scene-4.webp",
    title: "Родитель подключается кодом",
    text: "Вы диктуете шесть цифр, родитель заводит себе пароль и видит прогресс. Платить ему не нужно, и вашего аккаунта он не касается.",
    tags: ["Шесть цифр", "Родитель не платит", "Согласие подписывает сам"],
  },
];

function Landing() {
  return (
    <div className="sov">
      {/* В шапке только вход. Кнопка «Я репетитор» стояла здесь же, где и
          карточка выбора роли под заголовком, — на первом экране получалось
          две одинаковые двери в двадцати сантиметрах друг от друга. Шапка
          для тех, кто уже зарегистрирован; выбор роли — для новых. */}
      <SiteHeader right={<QuietAction to="/vhod">Войти</QuietAction>} />
      <Hero />
      <Steps />
      <Inside />
      <ForParents />
      <Plans />
      <Safety />
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
            Учимся <em>вместе</em>
          </h1>
          <p>
            Совёнок — помощник репетитора начальных классов. Задание живёт не в тетради, а на
            экране у ребёнка, со сроком и проверкой сразу после каждого ответа.
          </p>

          {/* Три действия на всю витрину и ни одного повтора: «Войти» в шапке
              для тех, у кого аккаунт уже есть, и две двери здесь — для
              репетитора, который платит, и для родителя, который приходит
              с его кодом. Ниже по странице кнопок входа больше нет. */}
          <div className="sov-hero__actions">
            <StartAction to="/registraciya" search={{ rol: "repetitor" }}>
              Создать аккаунт репетитора
            </StartAction>
            <QuietAction to="/priglashenie">Ввести код приглашения</QuietAction>
          </div>

          <p className="sov-mono" style={{ marginTop: 22, color: "var(--sov-ink-soft)" }}>
            Посмотреть, как выглядит занятие: нулевой урок из семи заданий, без почты и
            пароля.{" "}
            <Link to="/demo" style={{ color: "var(--sov-cobalt)" }}>
              Открыть нулевой урок
            </Link>
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

function Steps() {
  return (
    <section aria-label="Как это устроено у репетитора">
      {STEPS.map((step, i) => (
        <div key={step.id} className="sov-section sov-shell">
          <div className={`sov-split${i % 2 ? " sov-split--flip" : ""}`}>
            <div>
              <h2>{step.title}</h2>
              <p className="sov-section__lead">{step.text}</p>
              <div className="sov-journey__tags">
                {step.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <div className="sov-hero__art">
              <img
                src={step.image}
                alt=""
                width={1600}
                height={900}
                loading={i === 0 ? "eager" : "lazy"}
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function Inside() {
  return (
    <section className="sov-night">
      <div className="sov-shell">
        <h2>Что происходит внутри занятия</h2>
        <p className="sov-section__lead">
          Тема — это набор упражнений с мгновенной проверкой. Следующая открывается только
          после проверочной работы, поэтому «прошёл тему» значит прошёл, а не открыл.
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
            <b>2</b>
            <span>предмета: математика и русский язык, 1 и 2 класс</span>
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
    <section className="sov-section sov-shell">
      <div className="sov-cab">
        <div>
          <h2>Родителям</h2>
          <p className="sov-section__lead">
            Если с ребёнком занимается репетитор, попросите у него код приглашения и{" "}
            <Link to="/priglashenie" style={{ color: "var(--sov-cobalt)" }}>
              введите его здесь
            </Link>
            : вы увидите занятия, домашние задания и результаты. Платить не нужно — подписку
            оплачивает педагог.
          </p>
          <p className="sov-section__lead">
            Если репетитора нет,{" "}
            <Link
              to="/registraciya"
              search={{ rol: "roditel" } as never}
              style={{ color: "var(--sov-cobalt)" }}
            >
              заведите аккаунт родителя
            </Link>{" "}
            и занимайтесь сами: тот же тренажёр, те же темы, отдельный взрослый кабинет с
            прогрессом и лимитом времени.
          </p>

        </div>

        <div className="sov-cab__card">
          <div className="sov-cab__head">
            <strong>Маша, 1 класс</strong>
            <span>за неделю</span>
          </div>
          <div className="sov-cab__metrics">
            <div className="sov-cab__metric">
              <b>74%</b>
              <span>верных ответов</span>
            </div>
            <div className="sov-cab__metric">
              <b>86</b>
              <span>минут занятий</span>
            </div>
            <div className="sov-cab__metric">
              <b>3</b>
              <span>темы пройдено</span>
            </div>
          </div>
          <div className="sov-cab__risk">
            <em>Зона риска</em>
            <strong>Вычитание до 20</strong>
            <div className="sov-mono" style={{ marginTop: 3 }}>52% верных ответов</div>
          </div>
          <p className="sov-cab__note">
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
    // согласие подписывает родитель, а не педагог
    icon: guardIcon(
      <>
        <rect x="3" y="4" width="7" height="7" rx="2" />
        <path d="M5 7.5 6.5 9 9 6" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <path d="M5 17.5 6.5 19 9 16" />
        <path d="M13 7h8M13 17h8" />
      </>,
    ),
    title: "Согласие даёт родитель",
    text: "Репетитор заводит профиль ученика, но согласие на обработку его данных подписывает законный представитель, когда открывает приглашение.",
  },
  {
    icon: guardIcon(
      <>
        <rect x="4" y="10" width="16" height="10" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
      </>,
    ),
    title: "Ученики не пересекаются",
    text: "Доступ к профилю проверяется на каждом запросе: чужой репетитор и чужая семья не увидят вашего ученика.",
  },
  {
    icon: guardIcon(
      <>
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h9M18 12v3.5M15 12v2.5" />
      </>,
    ),
    title: "Пароли не хранятся",
    text: "В базе лежит только хеш. Пароль родителя репетитор не задаёт и не видит — родитель придумывает его сам.",
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
    <section className="sov-section sov-shell">
      <h2>Данные детей под защитой</h2>
      <p className="sov-section__lead">
        Репетитор работает с данными чужих детей, поэтому цепочка согласий здесь построена
        отдельно от удобства: подписывает её родитель, а не педагог.
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

      <div className="sov-data">
        <h3>Что знает система об ученике</h3>
        <div className="sov-data__col sov-data__col--yes">
          <b>Хранит</b>
          <ul>
            <li>Имя, которое ввёл взрослый</li>
            <li>Класс и аватар</li>
            <li>Ответы и время занятий</li>
          </ul>
        </div>
        <div className="sov-data__col sov-data__col--no">
          <b>Не спрашивает</b>
          <ul>
            <li>Почту и телефон ребёнка</li>
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
    <section className="sov-section sov-shell">
      <h2>Сколько это стоит</h2>
      <p className="sov-section__lead">
        Платит один человек — тот, кто привёл ученика. Обычно это репетитор: его подписка
        открывает все темы сразу всем его ученикам, и семьям платить не нужно.
      </p>
      <div className="sov-plans">
        <div className="sov-plan">
          <h3>Бесплатно</h3>
          <div className="sov-plan__price">0 ₽</div>
          <ul>
            <li>Сколько угодно учеников</li>
            <li>Домашние задания и отчёты</li>
            <li>По одной теме в математике и русском</li>
            <li>Оба тренажёра целиком</li>
            <li>Нулевой урок без регистрации</li>
          </ul>
          <p className="sov-mono" style={{ marginTop: 24, color: "var(--sov-ink-soft)" }}>
            <Link
              to="/registraciya"
              search={{ rol: "repetitor" } as never}
              style={{ color: "var(--sov-cobalt)" }}
            >
              Создать аккаунт репетитора
            </Link>
          </p>
        </div>

        <div className="sov-plan sov-plan--paid">
          <span className="sov-plan__tag">Открывает всё</span>
          <h3>Подписка</h3>
          <div className="sov-plan__price">
            490 ₽ <small>в месяц</small>
          </div>
          <ul>
            <li>Все темы 1 и 2 класса — всем вашим ученикам</li>
            <li>Проверочные работы и звёзды</li>
            <li>Зоны риска по каждой теме</li>
            <li>Отмена в один клик</li>
          </ul>
          <p className="sov-mono" style={{ marginTop: 20, color: "var(--sov-ink-soft)" }}>
            На пилоте оплата подключается промокодом: введите SOVENOK в кабинете.
          </p>
        </div>
      </div>
    </section>
  );
}
