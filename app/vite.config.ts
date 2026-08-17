import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
  higgsfieldDesignInspectorVitePlugin,
  higgsfieldDesignSourceBabelPlugin,
} from "./src/module/design-inspector/vite";
import svgr from "vite-plugin-svgr";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

// The vendored @higgsfield/quanta components import their glyphs from the private
// Nexus-only `@higgsfield-ai/icons`. Generated sites build on the PUBLIC npm
// registry, so we redirect every `@higgsfield-ai/icons/*` import to a Material
// Symbols shim instead (see src/lib/quanta-material-icons.ts). tsconfig.json has
// the matching `paths` entry so type-checking resolves it too.
const QUANTA_ICONS_SHIM = fileURLToPath(
  new URL("./src/lib/quanta-material-icons.ts", import.meta.url),
);

/**
 * `cloudflare:workers` — рантаймовый модуль workerd, из него берётся env с
 * биндингами (см. src/lib/bindings.server.ts). В сборке он остаётся внешним:
 * его даёт сам рантайм. Но `vite dev` исполняет SSR в обычном Node, где такого
 * модуля нет, — и дев-сервер падал на первом же импорте bindings.server.ts,
 * ещё до рендера страницы.
 *
 * Поэтому только для dev он подменяется на process.env. Биндингов там всё
 * равно нет: D1 в vite dev не поднимается, поэтому DB останется undefined, и
 * страницы, которым нужна база, честно скажут об этом из db(). Витрина, демо и
 * тренажёры работают — им база не нужна. Полное окружение с базой — это
 * docker compose (см. README).
 */
function cloudflareWorkersDevShim(): Plugin {
  const ID = "cloudflare:workers";
  const RESOLVED = "\0sovenok:cloudflare-workers-dev";
  return {
    name: "sovenok:cloudflare-workers-dev",
    apply: "serve",
    enforce: "pre",
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load: (id) =>
      id === RESOLVED
        ? [
            'import process from "node:process";',
            "export const env = process.env;",
            "export default { env };",
          ].join("\n")
        : undefined,
  };
}

export default defineConfig(({ command, mode }) => {
  const designInspectorEnabled = process.env.HF_DESIGN_INSPECTOR === "1" || mode === "design";

  return {
    resolve: {
      alias: [{ find: /^@higgsfield-ai\/icons(\/.*)?$/, replacement: QUANTA_ICONS_SHIM }],
    },
    // Страница /oferta импортирует свой исходник из docs/legal как есть
    // (?raw): единственная копия оферты в проекте — та, что правит юрист.
    // Корень Vite — app/, поэтому дев-серверу нужно разрешить читать каталог
    // выше, иначе он ответит 403 на этот импорт (в сборке ограничения нет).
    server: { fs: { allow: [".", ".."] } },
    // The server bundle runs as a Cloudflare Worker — there is no node_modules
    // at runtime. Vite's default SSR build leaves npm deps as bare external
    // imports (h3, react, @tanstack/*, seroval, …), which resolve on a Node
    // server but throw "No such module" in a Worker. Bundle them all in.
    // (node: builtins stay external — nodejs_compat provides them.)
    //
    // BUILD ONLY. `vite dev` runs SSR through the module runner, which
    // evaluates every inlined file as ESM — and noExternal pulls in CJS deps
    // too, so `react/index.js` (a CJS file) died on `module is not defined`
    // before the first page ever rendered. In dev those deps stay external and
    // Node's own require handles the CJS; the Worker bundle is unaffected.
    ssr: {
      // Именно undefined, а не false: false Vite принимает не за «выключено», а
      // за шаблон пути, и падает в normalizePath на `filename.replace`.
      noExternal: command === "build" ? true : undefined,
      // `cloudflare:workers` is a workerd runtime built-in that exposes the Worker
      // env / bindings (D1 `DB`, R2 `STORAGE`). Like node: builtins it must NOT be
      // bundled; the runtime provides it. (`ssr.external` is typed string[].)
      //
      // Тоже только для сборки: в dev внешний модуль уходит мимо плагинов прямо
      // в import() Node, где его нет («Cannot find module 'cloudflare:workers'»).
      // Там его подменяет cloudflareWorkersDevShim выше.
      external: command === "build" ? ["cloudflare:workers"] : undefined,
    },
    build: {
      // Keep `cloudflare:*` external in the SSR rollup pass too — `noExternal`
      // above would otherwise try to resolve+bundle it and fail.
      rollupOptions: { external: [/^cloudflare:/] },
    },
    plugins: [
      // Раньше остальных: подменить `cloudflare:workers` нужно до того, как за
      // него возьмётся разрешение внешних модулей.
      cloudflareWorkersDevShim(),
      // Material Symbols SVGs (the app icon set) import as React components via
      // `?react`. `icon: true` sizes them 1em; fill is forced to currentColor so
      // they color like text (the raw SVGs have no fill attribute). Keep the
      // viewBox so CSS sizing scales the glyph.
      svgr({
        svgrOptions: {
          icon: true,
          svgProps: { fill: "currentColor" },
          svgoConfig: {
            plugins: [
              { name: "preset-default", params: { overrides: { removeViewBox: false } } },
            ],
          },
        },
      }),
      // TanStack Start plugin must run before React's plugin.
      //
      // SSR build: `vite build` emits a Workers-shaped server bundle
      // (dist/server/server.js — `export default { fetch }`) plus dist/client
      // (hashed static assets). The platform publishes that as a per-tenant
      // Worker on Workers for Platforms, served at <sub>.higgsfield.app/ (host
      // root, so Vite's default base "/" — no base-path juggling).
      //
      // Rendering happens on the server per request, so site code must be
      // SSR-safe: never touch browser-only globals (window, document,
      // localStorage, navigator) during render or at module top level — only
      // inside effects/handlers, or guarded with `typeof window !== "undefined"`.
      tanstackStart({
        server: { entry: "server" },
      }),
      higgsfieldDesignInspectorVitePlugin(designInspectorEnabled),
      react({
        babel: {
          plugins: designInspectorEnabled ? [higgsfieldDesignSourceBabelPlugin] : [],
        },
      }),
      tailwindcss(),
      tsconfigPaths(),
    ],
  };
});
