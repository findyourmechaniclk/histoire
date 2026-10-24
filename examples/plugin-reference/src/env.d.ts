// Ambient module types for precompiled sources.
declare module '*.vue' {
  import type { Component } from 'vue'

  const component: Component
  export default component
}

declare module '*.svelte' {
  import type { Component } from 'svelte'

  const component: Component<any>
  export default component
}
