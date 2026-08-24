import { createFileRoute } from "@tanstack/react-router";

import { SITE_ORIGIN } from "../lib/seo";

const CANONICAL_HOST = new URL(SITE_ORIGIN).hostname;

/**
 * Тот же образ приложения отвечает и на прод-домене, и на превью-домене
 * платформы, и на localhost. Пускать робота на всё, что отвечает, нельзя:
 * превью — точная копия витрины, и в индексе она конкурирует с прод-адресом
 * за те же слова.
 *
 * Поэтому обход разрешён только с канонического хоста и его поддоменов
 * (www уводится редиректом в Caddyfile, но robots.txt он всё равно
 * запрашивает первым). Всё остальное получает полный запрет.
 *
 * Закрытые страницы — кабинеты, вход, оплата — здесь не перечислены
 * намеренно: им поставлен `noindex` в `head` (см. `lib/seo.ts`), а запрет
 * обхода помешал бы роботу этот `noindex` прочитать. Запрещено только то,
 * что страницами и не является: вебхуки, здоровье и серверные функции.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Хост берётся так же, как в счёте на оплату (api/billing.functions.ts):
        // до воркера запрос доходит через Caddy, и настоящее имя домена лежит
        // в X-Forwarded-Host. В request.url в этот момент стоит адрес, на
        // котором воркер слушает внутри контейнера, — по нему прод не отличить
        // от превью, и разрешение на обход получил бы кто угодно или никто.
        const forwarded = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        const hostname = (forwarded ?? new URL(request.url).host).split(":")[0].toLowerCase();
        const canonical = hostname === CANONICAL_HOST || hostname.endsWith(`.${CANONICAL_HOST}`);
        const body = canonical
          ? [
              "User-agent: *",
              "Allow: /",
              "Disallow: /api/",
              "Disallow: /_serverFn/",
              "",
              `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
            ].join("\n")
          : ["User-agent: *", "Disallow: /"].join("\n");
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
