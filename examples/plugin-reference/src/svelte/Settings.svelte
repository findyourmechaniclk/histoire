<script lang="ts">
  import type { ReferenceModel } from '../domain/model.js'
  import { settingsState, subscribeViewState } from '../domain/view-state.js'

  const { model }: { model: ReferenceModel } = $props()
  let version = $state(0)
  $effect(() => subscribeViewState(model, () => version++))
  const state = $derived((void version, settingsState(model)))
</script>

<div class="hst-ref-panel">
  <label class="hst-ref-switch">
    <input type="checkbox" checked={state.badges} onchange={event => model.preferences.setBadges(event.currentTarget.checked)} />
    Issue badges
  </label>
  <div class="hst-ref-row">
    <span class="hst-ref-grow">Annotations: {state.annotations}</span>
    <button type="button" class="hst-ref-button" disabled={!state.annotations} onclick={() => model.preferences.clearAnnotations()}>Clear</button>
  </div>
  <div class="hst-ref-muted">Minimum target size: {state.minTargetSize} px</div>
</div>
