<script setup>
function playAudio () {
  document.querySelector('#histoire-audio').play()
}
</script>

<audio id="histoire-audio">
  <source src="/histoire.mp3" type="audio/mpeg">
</audio>

# Getting started with Histoire

## Overview

> Histoire is the French word for "Story" and is pronounced `/is.twaʁ/`, like "is·twar" <button class="btn p-1 leading-none" v-on:click="playAudio"><Icon icon="carbon:volume-up-filled" class="w-4 h-4 align-middle"/></button>

Histoire is a tool to generate stories applications (or "books").

[Learn more about Histoire here &raquo;](../index.md)

<DemoLinks framework="vue3" />

## Sponsors

Histoire is an Open-Source project supported by our sponsors - thank you!

<div class="flex justify-center mt-6 mb-12 gap-2">
  <SponsorButton/>
  <a
    href="./index.html#sponsors"
    class="px-4 py-2 btn inline-flex items-center gap-2 !font-normal"
  >
    See our sponsors &raquo;
  </a>
</div>

## Installation

Install the `histoire` and `@histoire/plugin-vue` packages into your project:

```shell
pnpm i -D histoire @histoire/plugin-vue
# OR
npm i -D histoire @histoire/plugin-vue
# OR
yarn add -D histoire @histoire/plugin-vue
```

Create an `histoire.config.js` or `histoire.config.ts` file in your project root to enable the Vue plugin:

```ts
import { HstVue } from '@histoire/plugin-vue'
import { defineConfig } from 'histoire'

export default defineConfig({
  plugins: [
    HstVue(),
  ],
})
```

## Command Line Interface

Histoire provides the following commands:
- `histoire dev`: starts a development server with hot-reload
- `histoire build`: builds the app for production
- `histoire preview`: starts an HTTP server that serves the built app

You can add these to your `package.json` like this:

```json
{
  "scripts": {
    "story:dev": "histoire dev",
    "story:build": "histoire build",
    "story:preview": "histoire preview"
  }
}
```

And then run them with `npm run story:dev` or `npm run story:build`.

You can specify additional CLI options like `--port`. For a full list of CLI options, run `npx histoire --help` in your project.

## TypeScript

To enable the global components types in your project, create an `env.d.ts` file at the root of your project if it doesn't already exist.

```ts
/// <reference types="@histoire/plugin-vue/components" />
```

And add it in the `include` field of your `tsconfig.json`.

Example:

```json
{
  "compilerOptions": {
    "target": "es2017",
    "module": "esnext",
    "lib": ["esnext"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "strictNullChecks": true,
    "resolveJsonModule": true,
    "jsx": "preserve"
  },
  "include": [
    "env.d.ts",
    "src/**/*",
    "src/**/*.vue"
  ]
}
```

## Nuxt

<DemoLinks framework="nuxt3" />

Histoire supports Nuxt 3 and 4 with the `@histoire/plugin-nuxt` package.

```bash
pnpm add -D @histoire/plugin-nuxt
```

Add the plugin in histoire config:

```js
import { HstNuxt } from '@histoire/plugin-nuxt'
import { HstVue } from '@histoire/plugin-vue'
import { defineConfig } from 'histoire'

export default defineConfig({
  plugins: [
    HstVue(),
    HstNuxt(),
  ],
})
```

Histoire generates its Nuxt build files in `.histoire/nuxt`, so it can run next to `nuxt dev` without sharing `.nuxt`. Change it with `HstNuxt({ buildDir: '.my-dir' })` (relative to the Nuxt root).

## Quasar CLI <Badge type="tip" text="1.0-beta.2+" />

Quasar CLI projects (`@quasar/app-vite`) don't have a `vite.config` file. The `@histoire/plugin-quasar` package reads your `quasar.config` file instead.

```bash
pnpm add -D @histoire/plugin-quasar
```

```js
import { HstQuasar } from '@histoire/plugin-quasar'
import { HstVue } from '@histoire/plugin-vue'
import { defineConfig } from 'histoire'

export default defineConfig({
  storyMatch: ['src/**/*.story.vue'],
  plugins: [
    HstVue(),
    HstQuasar(),
  ],
})
```

The plugin:

- reuses the Vite config Quasar CLI generates (aliases, `build.env`, `build.vitePlugins`, Sass variables, `extendViteConf`...),
- loads Quasar CSS, `extras`, `animations` and `css` entries,
- installs Quasar with your `framework` options (config, plugins, lang, icon set),
- installs your store from `src/stores/index`,
- runs client boot files in order. They receive a router using memory history, so they never change the URL of the story,
- syncs Quasar's `Dark` plugin with Histoire's dark mode.

App Extensions apply too: their boot files, CSS and `framework` options are loaded like the project's own.

While Histoire loads it, `quasar.config` sees your project folder as the working directory (`process.cwd()`, `path.resolve`), even if Histoire was started from another folder. Relative `fs` paths aren't covered: build them from `__dirname` or `ctx.appPaths`.

::: tip
The plugin reads the config through Quasar CLI's own loader. If your `@quasar/app-vite` version doesn't expose it, Histoire warns and evaluates `quasar.config` directly, without App Extension additions. Add those in your [setup file](./app-setup.md#global-setup) if your stories need them.
:::

For other UI libraries, see [Ecosystem](./ecosystem.md).

## Configuration

Learn more about configuring Histoire [here](../config.md).

## Community

If you have questions or need help, reach out to the community at [Discord](https://discord.gg/KpCnT72rJk) and [GitHub Discussions](https://github.com/histoire-dev/histoire/discussions).
