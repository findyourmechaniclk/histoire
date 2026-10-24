<script>
  import { onDestroy } from 'svelte'
  import { diagnosticsState, subscribeViewState } from '../domain/view-state.js'
  import { AUDIT_TAB_ID } from '../workbench/views.js'

  /** @type {import('@histoire/plugin-kit').FrameScopedContext} */
  export let context
  /** @type {import('../domain/model.js').ReferenceModel} */
  export let model
  let version = 0
  onDestroy(subscribeViewState(model, () => version++))
  $: status = (void version, diagnosticsState(model, context).status)
</script>

<div class="hst-ref-panel" data-flush>
  <div class="hst-ref-row">
    <span class="hst-ref-grow">{status}</span>
    <button type="button" class="hst-ref-button" on:click={() => context.navigation.openInspectorTab(AUDIT_TAB_ID)}>Open audit</button>
  </div>
</div>
