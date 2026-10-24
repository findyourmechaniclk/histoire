# @histoire/plugin-kit

Contracts and helpers for Histoire workbench plugins (`defineWorkbenchPlugin`) and frame plugins (`defineFramePlugin`), plus the extension host that embedding hosts use to run workbench plugins themselves.

This document covers **hosts**: apps that embed a Histoire book through `@histoire/sdk` and want plugin UI. Plugin authoring is documented separately.

## Who evaluates what

- The standalone workbench and the book's own source-origin explorer (`surface: 'explorer'`) load the book's plugin manifest, like any page the book serves.
- A remote host (your app on another origin) **never** evaluates modules provided by the book. The book descriptor lists frame plugins as data only (`session.plugins.frames()`). To get workbench UI, the host imports the plugin's `client` module itself and passes it to its own extension host.
- Frame plugins always run inside the book's story documents. A host-imported workbench plugin talks to them through the SDK session (`session.plugins`), across origins.

## Creating a host

```ts
import { createExtensionHost, createSessionContext, createSessionFrameService } from '@histoire/plugin-kit'
import { createHistoireSession } from '@histoire/sdk'
import acme from 'acme-histoire-plugin/client'

const session = createHistoireSession({ url: 'https://book.example.com/' })
await session.connect()

// Root context from public session methods; `frames` adds the `frames` capability.
const root = createSessionContext({
  session,
  frames: session.plugins ? createSessionFrameService(session.plugins) : undefined,
  // mode: 'remote' by default, so `devOnly` contributions stay hidden.
  // navigation: defaults to story selection only; other destinations are ignored.
})

const host = createExtensionHost({
  plugins: [acme, { definition: other, options: { theme: 'compact' } }],
  services: {
    context: root.context,
    // Optional. Without storage, plugin preferences live in memory only.
    storage: window.localStorage,
    storageNamespace: 'my-app',
  },
})
await host.ready // every setup settled (failures become diagnostics, never throws)
```

The host belongs to you: dispose it (and close the root context) when your page or view goes away.

```ts
await host.dispose()
root.close()
```

Two hosts on one page are fully isolated: registries, preferences overlays, diagnostics and frame channels are per host.

## Reading contributions

```ts
// Committed contributions of one kind, registry order (built-ins keep theirs, plugins by
// `order`, then config order, then registration order).
host.contributions('inspector.tab')

// Same list filtered for a surface context: `available` predicates and `devOnly`.
host.available('toolbar.item', root.context)

// Re-read after registry commits, root context changes and new diagnostics.
const stop = host.subscribe(() => render())
```

Contexts by surface:

| Kinds | Context |
| --- | --- |
| `toolbar.item`, `command`, `shortcut`, `shell.pane`, `settings.section`, `home.section` | root context (`root.context`) |
| `inspector.tab`, `inspector.section`, `frame-menu.item`, `canvas.frame-overlay` | frame-scoped: root fields plus `frame: { key, target }` and `runtime: { getSnapshot, subscribe }` |
| `canvas.*` | canvas-scoped (`canvas` service); not available outside the standalone canvas |

For native hosts, use the target key (`getHistoireTargetKey(target)` from `@histoire/protocol`) as `frame.key`; that is what `createSessionFrameService` uses, so `api.frames.open(context.frame)` reaches the frame your session mounted.

## Mounting views

Every view-bearing contribution has either a Vue `component` (rendered by a Vue app, see below) or a framework-neutral `mount`. Hosts mount the latter through the host, which owns lifecycle, update ordering and late disposal:

```ts
const [tab] = host.available('inspector.tab', frameContext)
const view = host.mount(tab.id, container, frameContext, {
  overlayRoot, // optional: popover root inside your theme scope
  onError: (error, phase) => showErrorFor(tab, error),
  renderState, // optional: (element, state | null) => void, your styled empty/loading/error states
})
await view.ready
view.update(nextFrameContext) // pushes a snapshot, never remounts
await view.dispose() // idempotent; also happens when the plugin or host retires
```

React host:

```tsx
function PluginTab({ host, id, context }) {
  const container = useRef(null)
  const view = useRef()
  useEffect(() => {
    view.current = host.mount(id, container.current, context)
    return () => void view.current.dispose()
  }, [host, id])
  useEffect(() => view.current?.update(context), [context])
  return <div ref={container} />
}
```

Plain DOM host:

```ts
for (const tab of host.available('inspector.tab', frameContext)) {
  const container = panel.appendChild(document.createElement('section'))
  host.mount(tab.id, container, frameContext)
}
```

A Vue `component` view mounted through `host.mount` rejects `ready`: render it with Vue (`HistoireExtensionOutlet`), or have the plugin ship a `vueView(Component)` from `@histoire/plugin-kit/vue/mount`, which creates an isolated app.

## Running actions

```ts
// Captures `context`; aborting `signal` (selection change) discards the result.
await host.run('acme:refresh', root.context, { signal: root.selectionSignal() })
```

`run` rejects with the action error (also recorded as a diagnostic) and resolves without a result when the plugin, the host or the signal retired first. Frame-menu children are addressed as `${itemId}:${childId}`.

## Shortcuts

`shortcut` contributions name a qualified command, keys (`mod` is command or control) and a scope. Hosts without a shortcut registry bind them through `createPluginShortcutBindings`, so registration rules and precedence match the workbench:

```ts
import { createPluginShortcutBindings, isEditableTarget } from '@histoire/plugin-kit'

// Scopes this host routes keys to. Each committed binding is checked once: a scope the host
// lacks, an overlap with a built-in or with an earlier binding of the same scope rejects it with
// one `report` diagnostic (its command stays runnable).
const bindings = createPluginShortcutBindings(host, ['global'])
const available = new Set<string>()

element.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || isEditableTarget(event.target)) return
  available.clear()
  for (const shortcut of host.available('shortcut', root.context)) available.add(shortcut.id)
  // Innermost focus scope first, e.g. ['frame', 'canvas', 'global'] inside a frame.
  const shortcut = bindings.match(event, ['global'], candidate => available.has(candidate.id))
  if (!shortcut) return
  event.preventDefault()
  void host.run(shortcut.command, root.context)
})

// On teardown: bindings.dispose() (the host itself stays caller-owned).
```

`findPluginShortcutConflict(shortcut, { bound, scopes })` exposes the same check for hosts that keep their own registry.

## Diagnostics

```ts
host.diagnostics() // [{ pluginId, contributionId?, phase, error }]
```

Failures are attributed and never retried: a failing setup, view, predicate or action affects only its own plugin or view.

## Vue hosts (`@histoire/vue`)

```vue
<HistoireProvider :session="session" :extensions="host">
  <HistoireExplorer />
</HistoireProvider>
```

- `extensions` is caller-owned: the provider never disposes it and keeps it when `session` is replaced (scoped views of the old session unmount; the host stays).
- Native parts render plugin contributions after their built-ins: `ExplorerPanels` (inspector tabs and sections, same built-in tab descriptors as the standalone inspector) and `HistoireToolbar` (toolbar items after the built-ins of their `group`: `viewport`, `background`, `ui`; other groups and `plugins` trail after the built-in items).
- Plugin shortcuts are bound on the owning provider through `createPluginShortcutBindings` in the `global` (provider root), `canvas` (explorer canvas) and `frame` (its single-variant frame) scopes, innermost first. `comment` bindings have no native surface and are rejected with a diagnostic.
- Pending and failed plugin views, and the `@histoire/plugin-kit/vue` state and pane components, render native workbench state components, unless an enclosing app provides its own under `WORKBENCH_COMPONENTS_KEY`.
- Caller slots win: replacing `HistoireExplorer`'s `panels` or `toolbar` slot replaces the plugin contributions of that surface too.
- Nested providers without `extensions` reuse the nearest host for their surfaces; only the provider receiving the prop binds keys.
- `HistoireExtensionOutlet` places one kind anywhere inside a provider: `<HistoireExtensionOutlet kind="inspector.section" :filter="s => s.tab === 'footer'" />`. Inspector kinds default to the selected variant's context, others to the provider's root context.
- Plugin navigation inside a provider opens inspector tabs in its own explorer panels and selects stories through the session. Panes, settings sections and canvas views do not exist in native hosts: those requests are ignored with a warning, and contributions of these kinds stay registered but unrendered. Nothing touches the host page URL, title, theme or storage.

## Unsupported surfaces

A host renders only the surfaces it has. Contributions for others (rail panes, settings, home, canvas overlays/tools/views, menus) remain registered and visible through `host.contributions()`, are never mounted, and their capabilities (`canvas`, `devEvents`, `frames` without a session plugins API) are absent from `context.capabilities`. Accessing an absent service never throws.
