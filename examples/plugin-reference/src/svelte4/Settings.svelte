<script>
  import { onDestroy } from 'svelte'
  import { settingsState, subscribeViewState } from '../domain/view-state.js'

  /** @type {import('../domain/model.js').ReferenceModel} */
  export let model
  let version = 0
  onDestroy(subscribeViewState(model, () => version++))
  $: state = (void version, settingsState(model))
</script>

<div class="hst-ref-panel">
  <label class="hst-ref-switch">
    <input type="checkbox" checked={state.badges} on:change={event => model.preferences.setBadges(event.currentTarget.checked)} />
    Issue badges
  </label>
  <div class="hst-ref-row">
    <span class="hst-ref-grow">Annotations: {state.annotations}</span>
    <button type="button" class="hst-ref-button" disabled={!state.annotations} on:click={() => model.preferences.clearAnnotations()}>Clear</button>
  </div>
  <div class="hst-ref-muted">Minimum target size: {state.minTargetSize} px</div>
</div>
