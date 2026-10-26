# Native panel styling

Native `@histoire/vue` panels accept an optional typed `classes` object. Values are literal class strings appended to existing marker classes. Omitted parts retain package defaults. Root `class` and `style` attributes still fall through; use `style` for runtime CSS variables.

| Component | `classes` parts |
| --- | --- |
| `HistoireEvents` | `root`, `count`, `loadMore`, `list`, `row`, `heading`, `time`, `argument` |
| `HistoireDocs` | `root` |
| `HistoireTests` | `root`, `state` |
| `HistoireControls` | `root`, `fieldset`, `legend`, `reset`, `presets`, `presetTrigger`, `state` |
| `StatePresets` (internal) | `root`, `trigger` |
| `PresetMenu` (internal) | `trigger` |
| `GenericControls` (internal) | `fieldset`, `legend` |
| `HistoireSource` | `root`, `pre`, `alert` |
| `HistoireExtensionView` (internal) | `root`, `mount` |

`HistoirePartClasses<Part>` is exported for host-side types. Internal components remain available only from their existing internal module paths or `@histoire/vue/internal` exports; this styling API does not promote them to public components.

`loadMore` names the events panel's existing **Clear** button for compatibility with the migration's part contract; it does not load or paginate events. `list` reaches the native `ol` inside the virtual scroller. Event spacing uses the existing `--histoire-virtual-item-gap` variable on the root, so measured rows include their gap.

`HistoireControls` forwards `fieldset` and `legend` to generic controls, and `presets`/`presetTrigger` to preset management. Its `state` applies to loading/unavailable content. `HistoireTests.state` applies to its empty/loading slot content. These state parts add a wrapper only when supplied; omitted parts preserve existing slot DOM.

```vue
<HistoireSource
  :show-actions="false"
  :classes="{ root: 'host-source', pre: 'host-code', alert: 'host-error' }"
/>

<HistoireEvents
  :classes="{ list: 'host-event-list', row: 'host-event' }"
  style="--histoire-virtual-item-gap: 8px"
/>
```

`HistoireSource.showActions` defaults to `true`. Setting it to `false` removes built-in Raw, Dynamic and Copy buttons while preserving source rendering, events, and controlled `mode` updates. The `pre` part reaches both Shiki's generated element and the plain-text fallback. Shiki owns individual code lines; use descendant utilities on `pre` for line styling. Rendered documentation similarly accepts descendant utilities on its `root`.

`HistoireExtensionView.interactive` is optional: omission preserves host pointer behavior. Set it to `false` for passive overlays: the entire view becomes inert, excluding descendant pointer input and keyboard focus even if plugin content sets its own pointer styles. Setting it to `true` enables the existing content without remounting it, including beneath a pointer-transparent canvas layer. The package enables direct plugin children while leaving an empty mount container transparent. This does not position or stretch the view. The workbench's app-local `ExtensionView` exposes the same additive hooks; canvas placement remains the owning canvas component's responsibility.

## Cascade

Native defaults retain their existing provider-scoped specificity. Histoire's Tailwind build currently flattens CSS layers for compatibility with host Tailwind v3 and host resets. Class order alone does not override a more specific default. Use Tailwind's important modifier on conflicting declarations, for example `htw:p-0!` or `htw:bg-transparent!` for Shiki's inline background. Avoid targeting package marker classes from host selectors.

## Controls

`HstButton` accepts `tone="accent"` with `color="flat"` for an accent-text flat action. Its default tone leaves existing appearance unchanged. Use this variant for flat actions in empty states. Error-state actions retain danger text through `tone="danger"`; home cards use root utility classes.

`HstButtonGroup` accepts `block` to stretch the wrapper, content, value, and option container to available width. `HstWrapper` also accepts `block` for composed controls. Group choices keep their existing equal-flex behavior and keyboard semantics.

`HstTextarea.inputClass` targets its native textarea, including clipboard-recovery sizing.

`HstSelect` and `HstSwitch` already forward root classes/styles through `HstWrapper`; no new prop is needed for root sizing. `CustomSelect` forwards attributes to its actual trigger. Icon-only `HstButton` size remains controlled by `--histoire-icon-button-size` on that button.
