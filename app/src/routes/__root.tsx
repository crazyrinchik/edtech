import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Owl, SiteFooter, SiteHeader } from "../components/brand";
import { ReportProblem } from "../components/report-problem";
import appCss from "../styles.css?url";
import { reportHiggsfieldError } from "../lib/higgsfield-error-reporting";
// Page metadata (browser <title>/favicon + social og: tags) committed into the
// repo by the marketplace meta API and read at BUILD time — no runtime fetch.
// Editing it via the app settings UI rewrites this file and redeploys the app.
import appMetaJson from "../app-meta.json";
import { SITE_ORIGIN } from "../lib/seo";

declare const __HF_DESIGN_INSPECTOR__: boolean;

// Built-in defaults for any field that isn't set in app-meta.json.
const DEFAULT_TITLE = "Higgsfield App";
const DEFAULT_DESCRIPTION = "Higgsfield Generated Project";

type AppMeta = {
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  favicon_url?: string | null;
  og_video_url?: string | null;
};

const appMeta = appMetaJson as AppMeta;

// Build the document head (title / description / og: / twitter: / favicon) from
// app-meta.json, falling back to the defaults above for any unset field.
// og_title/og_description double as the browser <title> and meta description;
// og_image_url (when set) also drives the twitter card + image. Built from
// inline tag literals (conditional spreads for the optional image/favicon) so
// it matches the head() shape TanStack expects.
// favicon/og images live in THIS app's own /assets, so the host is never
// inherent. app-meta.json may carry an absolute higgsfield-app URL with a STALE
// host — baked from the app this one was copied/remixed/renamed from — which would
// serve the wrong app's favicon/og. Strip any higgsfield-app host (prod
// higgsfield.app + dev higgsfield-dev.app) down to a root-relative path so it
// always resolves against whoever serves THIS page (preview / prod / custom
// domain). Genuinely external URLs (a CDN image the owner set) are left absolute.
const APP_HOST_ZONES = ["higgsfield.app", "higgsfield-dev.app"];

function toOwnAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value; // already root-relative
  try {
    const u = new URL(value);
    const isAppHost = APP_HOST_ZONES.some(
      (zone) => u.hostname === zone || u.hostname.endsWith(`.${zone}`),
    );
    if (isAppHost) return u.pathname + u.search;
    return value; // external host (CDN, etc.) — keep absolute
  } catch {
    return value; // not a parseable URL — leave as-is
  }
}

/**
 * Картинка для мессенджера — абсолютным адресом.
 *
 * В <link rel="icon"> корневой путь работает: его разбирает браузер,
 * который и так знает, откуда пришла страница. Превью ссылки собирает не
 * браузер, а Telegram, VK или WhatsApp, и по спецификации Open Graph они
 * ждут в og:image полный адрес — от относительного превью у части из них
 * просто не появится картинки. Хост берём канонический (lib/seo.ts): та же
 * акварель лежит на всех стендах, и показать прод-адрес честнее, чем
 * превью-домен, который завтра погаснет.
 */
function toAbsolute(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("/") ? `${SITE_ORIGIN}${value}` : value;
}

function buildHead(meta: AppMeta) {
  const title = meta.og_title ?? DEFAULT_TITLE;
  const description = meta.og_description ?? DEFAULT_DESCRIPTION;
  const ogImage = toAbsolute(toOwnAssetUrl(meta.og_image_url));
  const favicon = toOwnAssetUrl(meta.favicon_url);
  const ogVideo = toAbsolute(toOwnAssetUrl(meta.og_video_url));

  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      // Автор и подпись карточки — Совёнок, а не шаблон маркетплейса, из
      // которого выросло приложение. Аккаунта в X у проекта нет, поэтому
      // twitter:site убран совсем: пустая или чужая ссылка в карточке
      // хуже, чем её отсутствие.
      { name: "author", content: "Совёнок" },
      { property: "og:site_name", content: "Совёнок" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      // Язык страницы для превью: по нему мессенджер выбирает, каким
      // шрифтом и в какую сторону рисовать текст карточки.
      { property: "og:locale", content: "ru_RU" },
      { name: "twitter:card", content: ogImage ? "summary_large_image" : "summary" },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            // Размеры кадра избавляют мессенджер от догадок: без них
            // Telegram и VK сначала показывают ссылку без картинки и
            // дорисовывают её, только когда скачают файл целиком.
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: title },
            { name: "twitter:image", content: ogImage },
          ]
        : []),
      // Cover video (og:video) — the animated counterpart of og:image; the
      // Higgsfield feed cards also play it on hover.
      ...(ogVideo ? [{ property: "og:video", content: ogVideo }] : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Фавикон — тот же совёнок, что и маскот, поэтому он векторный: на 16 px
      // пух не должен превращаться в кашу. Порядок важен — браузер берёт
      // последнюю иконку, которую понимает, так что PNG идёт первым запасным
      // для тех, кто SVG в rel="icon" не умеет (Safari до 16.4).
      ...(favicon
        ? favicon.endsWith(".svg")
          ? [
              { rel: "icon", href: favicon.replace(/\.svg$/, ".png") },
              { rel: "icon", type: "image/svg+xml", href: favicon },
            ]
          : [{ rel: "icon", href: favicon }]
        : []),
    ],
  };
}

/*
 * Тупиковые экраны — 404 и падение — написаны на языке Совёнка, а не на
 * остатках шаблона.
 *
 * До этой правки оба открывались чёрной страницей с салатовой кнопкой и
 * английским текстом: «Page not found», «Go home». Сюда попадают не по
 * своей воле — по устаревшей ссылке из переписки, по опечатке в адресе,
 * по сбою. И человек, который платит за занятия ребёнка, видел в этот
 * момент не «страница не найдена», а «это какой-то другой сайт».
 *
 * Поэтому здесь та же бумага, тот же совёнок и тот же выход, что и
 * везде: одна кнопка на главную. Подвал стоит намеренно — на этих
 * экранах чаще всего и ищут, кому написать.
 */
function NotFoundComponent() {
  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-narrow sov-oops">
        <Owl size={104} />
        <h1>Такой страницы нет</h1>
        <p>
          Ссылка устарела или в адресе опечатка. Занятия, тренажёры и кабинет никуда не делись — они
          на главной.
        </p>
        <Link to="/" className="sov-act-child">
          На главную
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportHiggsfieldError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="sov">
      <SiteHeader />
      <main className="sov-narrow sov-oops">
        <Owl size={104} />
        <h1>Страница не открылась</h1>
        {/* Что именно сломалось, человеку здесь не поможет: он не чинит
            сервер. Помогает знать, что это не он виноват и что данные на
            месте. Техническую подробность уносит reportHiggsfieldError. */}
        <p>
          Это сбой на нашей стороне, а не у вас. Занятия и результаты ребёнка сохранены. Попробуйте
          открыть ещё раз.
        </p>
        <div className="sov-oops__actions">
          <button
            type="button"
            className="sov-act-child"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Попробовать ещё раз
          </button>
          <a href="/" className="sov-act-quiet">
            На главную
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Read the committed page metadata at build time (no runtime fetch).
  head: () => buildHead(appMeta),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    /* Совёнок — светлый продукт на бумаге, и это его единственная тема.

       Здесь стояло data-theme="default-dark" с colorScheme: "dark" от
       шаблона маркетплейса: тёмная подложка сидела под каждым экраном и
       вылезала везде, куда не дотягивался .sov — на 404, на падении
       роутера и при оттягивании страницы на телефоне. Тёмной темы у
       Совёнка нет и не планируется, поэтому подложка теперь одна и
       объявлена в brand.css (html, body { background: var(--sov-paper) }).

       lang="ru" — не косметика: от него зависят переносы и то, каким
       голосом экранный диктор прочитает страницу. */
    <html lang="ru" style={{ colorScheme: "light" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (!__HF_DESIGN_INSPECTOR__) {
      return;
    }

    void import("../module/design-inspector/runtime")
      .then(({ installHiggsfieldDesignInspector }) => {
        installHiggsfieldDesignInspector();
      })
      .catch((error) => {
        reportHiggsfieldError(
          error instanceof Error ? error : new Error("Failed to load design inspector"),
          {
            boundary: "higgsfield_design_inspector_import",
          },
        );
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* Кнопка «Сообщить об ошибке» — здесь, а не в подвале: подвала нет
          на четырёх экранах, и среди них занятие ребёнка и нулевой урок,
          то есть ровно те, где поломку и увидят. Стоит внутри Outlet-узла
          намеренно — 404 и экран падения рисуются тем же деревом, а на
          них ищут, кому написать, чаще всего. */}
      <ReportProblem />
    </QueryClientProvider>
  );
}
