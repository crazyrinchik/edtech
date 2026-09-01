/**
 * Security headers applied to every Worker response. Import in app/src/server.ts
 * and wrap the final response: `return applySecurityHeaders(response)`.
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  // Framing: the Supercomputer Design-mode inspector + preview render this app
  // cross-origin inside an iframe. The Higgsfield hosting platform injects the
  // canonical `frame-ancestors` allowlist on every app response, so this app
  // MUST NOT set its own — browsers intersect multiple CSP headers, so a second
  // (stricter) list here can only ever subtract from the platform's allowlist
  // and silently block the embed. We also deliberately do NOT set
  // `X-Frame-Options` (no cross-origin allowlist; SAMEORIGIN/DENY would blank
  // the preview) and leave framing entirely to the platform.

  // Yandex.Metrika needs three of these directives to work at all: `script-src`
  // for tag.js, and `frame-src` for the hidden cookie-sync iframe the counter
  // drops on mc.yandex.ru (without it the counter loads but loses returning
  // visitors). Data goes out over `connect-src`/`img-src`, both already open to
  // https:. The `.com` host is the mirror Metrika falls back to outside RU.
  const YANDEX_METRIKA = 'https://mc.yandex.ru https://mc.yandex.com';
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
      `script-src 'self' 'unsafe-inline' ${YANDEX_METRIKA}; ` +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; media-src 'self' https:; " +
      "connect-src 'self' https:; " +
      `frame-src 'self' ${YANDEX_METRIKA}; ` +
      "base-uri 'self'; form-action 'self'",
  );
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-XSS-Protection', '0');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
