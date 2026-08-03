import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const today = new Date().toISOString().split('T')[0]
        // Страницы, открытые без аккаунта: витрина, нулевой урок и тренажёры.
        // Всё остальное живёт за входом и в поиске не нужно.
        const pages: [string, string][] = [
          ['/', '1.0'],
          ['/demo', '0.9'],
          ['/schet', '0.8'],
          ['/chtenie', '0.8'],
        ]
        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...pages.flatMap(([path, priority]) => [
            '  <url>',
            `    <loc>${origin}${path}</loc>`,
            `    <lastmod>${today}</lastmod>`,
            '    <changefreq>weekly</changefreq>',
            `    <priority>${priority}</priority>`,
            '  </url>',
          ]),
          '</urlset>',
        ].join('\n')
        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
