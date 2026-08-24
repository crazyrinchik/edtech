import { createFileRoute } from "@tanstack/react-router";

import { PUBLIC_PAGES, SITE_ORIGIN, type PublicPath } from "../lib/seo";

/**
 * Карта сайта собирается из того же списка, что и `head` страниц
 * (`lib/seo.ts`). Раньше адреса были переписаны здесь руками, и список
 * разъезжался с реальностью молча: страница появлялась, а в карту её никто
 * не добавлял.
 *
 * Адреса — абсолютные и всегда с прод-домена, а не с хоста запроса: карта,
 * отданная превью-доменом, звала бы робота индексировать копию сайта.
 * Документы (`kind: "legal"`) меняются редакциями, поэтому им отдельный
 * `changefreq` — незачем гонять робота к ним каждую неделю.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().split("T")[0];
        const paths = Object.keys(PUBLIC_PAGES) as PublicPath[];
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...paths.flatMap((path) => [
            "  <url>",
            `    <loc>${SITE_ORIGIN}${path}</loc>`,
            `    <lastmod>${today}</lastmod>`,
            `    <changefreq>${PUBLIC_PAGES[path].kind === "legal" ? "monthly" : "weekly"}</changefreq>`,
            `    <priority>${PUBLIC_PAGES[path].priority}</priority>`,
            "  </url>",
          ]),
          "</urlset>",
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
