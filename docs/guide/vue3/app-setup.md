# App setup

## Global setup

You can define a setup function globally in your setup file defined by the `setupFile` option in the global configuration ([learn more](../config.md#global-js-and-css)).

For Vue 3, it must be called `setupVue3`. Histoire provides an optional `defineSetupVue3` helper to have better types in your IDE:

```ts
import { defineSetupVue3 } from '@histoire/plugin-vue'
import { createPinia } from 'pinia'

export const setupVue3 = defineSetupVue3(({ app, story, variant }) => {
  // Vue plugin
  app.use(createPinia())

  // Global component
  app.component('GlobalComponent', MyGlobalComponent)

  // Global property
  app.config.globalProperties.$t = key => translate(key)

  // Provide
  app.provide('key', 'meow')
})
```

::: tip
You can also import global CSS files or JS files in this setup file.
:::

## Local setup

Inside each story, you can define a `setupApp` prop that will be called by Histoire allowing you to configure the sandbox application as well. It will **not** override the global setup function, but will be called after it. It works the same way with the same parameters.

```vue{17}
<script setup>
import InjectDemo from './InjectDemo.vue'

function mySetupApp ({ app, story, variant }) {
  app.provide('demo', 'meow')
}
</script>

<template>
  <Story title="Story setup">
    <Variant title="Global setup">
      <InjectDemo />
    </Variant>

    <Variant
      title="Local setup"
      :setup-app="mySetupApp"
    >
      <InjectDemo />
    </Variant>
  </Story>
</template>
```

You can put the prop on the `<Story>` component too, so that `<Variant>` will have a default value for it. Redefining the prop on a `<Variant>` will **override** the function though.

## Dark mode <Badge type="tip" text="1.0-beta.2+" />

`onDarkChange` calls your listener with Histoire's current dark mode, then again each time it changes. The listener stops when the story app is unmounted. Use it to sync the theme of a UI library:

```ts
import { defineSetupVue3 } from '@histoire/plugin-vue'
import { createVuetify } from 'vuetify'

export const setupVue3 = defineSetupVue3(({ app, onDarkChange }) => {
  const vuetify = createVuetify()
  app.use(vuetify)

  onDarkChange((dark) => {
    vuetify.theme.change(dark ? 'dark' : 'light')
  })
})
```

Outside of setup functions, use [`onDarkChange` from `histoire/client`](../../reference/client.md#ondarkchange).

## Lifecycle hooks <Badge type="tip" text="1.0-beta.2+" />

Each variant renders in its own Vue app. `hooks` lets setup code (and framework plugins) follow that app's lifecycle:

| Hook | Called |
| --- | --- |
| `onBeforeMount(cb)` | After all setup functions, right before the app mounts. |
| `onMounted(cb)` | Once the story finished rendering, including async setup. |
| `onReady(cb)` | After `onMounted` callbacks, before the variant is reported ready. |
| `onCleanup(cb)` | Once, when the app is unmounted or its setup failed. Use it to release resources. |
| `setRunWithContext(runner)` | Wraps the next setup functions (setup file, `setupApp`) in a context, for example an injection context. Several runners compose. |

Stage callbacks can be async. Histoire waits for them in order. Register `onCleanup` right after acquiring a resource: if the story is closed while setup is still running, cleanup callbacks registered later still run once setup finishes. After that, `onCleanup` runs the callback right away.

While Histoire collects stories (on Node.js), setup functions run but stage hooks don't, and `onDarkChange` listeners are never called.

```ts
import { defineSetupVue3 } from '@histoire/plugin-vue'

export const setupVue3 = defineSetupVue3(({ hooks }) => {
  const socket = new WebSocket('ws://localhost:1234')
  hooks.onCleanup(() => socket.close())
})
```

## Examples

### Vue Router

```vue{5-11,18}
<script setup>
import { createRouter, createMemoryHistory } from 'vue-router'

function setupApp ({ app, story, variant }) {
  // Router mock
  app.use(createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { render: () => null } },
    ],
  }))
}
</script>

<template>
  <Story
    title="Vue router example"
    :setup-app="setupApp"
  >
    <pre>{{ $route }}</pre>
  </Story>
</template>
```

### Pinia

In global setup file:

```ts{6}
import { createPinia } from 'pinia'
import { defineSetupVue3 } from '@histoire/plugin-vue'

export const setupVue3 = defineSetupVue3(({ app, story, variant }) => {
  // Vue plugin
  app.use(createPinia())
})
```

In component:

```vue
<script setup>
import { useItemStore } from '../stores/item.js'

const itemStore = useItemStore()
</script>

<template>
  <pre>{{ itemStore.items }}</pre>
</template>
```

In story file:

```vue
<script setup>
import MyItems from './MyItems.vue'
</script>

<template>
  <Story
    title="Pinia example"
  >
    <MyItems />
  </Story>
</template>
```

### Vuex

```vue{5-10,17}
<script setup>
import { createStore } from 'vuex'

function setupApp ({ app, story, variant }) {
  // Store mock
  app.use(createStore({
    state: () => ({
      hello: 'meow',
    }),
  }))
}
</script>

<template>
  <Story
    title="Vuex example"
    :setup-app="setupApp"
  >
    <pre>{{ $store.state }}</pre>
  </Story>
</template>
```
