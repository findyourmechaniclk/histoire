<script lang="ts">
  import type { FrameScopedContext } from '@histoire/plugin-kit'
  import type { ReferenceModel } from '../domain/model.js'
  import { diagnosticsState, subscribeViewState } from '../domain/view-state.js'
  import { AUDIT_TAB_ID } from '../workbench/views.js'

  const { context, model }: { context: FrameScopedContext, model: ReferenceModel } = $props()
  let version = $state(0)
  $effect(() => subscribeViewState(model, () => version++))
  const status = $derived((void version, diagnosticsState(model, context).status))
</script>

<div class="hst-ref-panel" data-flush>
  <div class="hst-ref-row">
    <span class="hst-ref-grow">{status}</span>
    <button type="button" class="hst-ref-button" onclick={() => context.navigation.openInspectorTab(AUDIT_TAB_ID)}>Open audit</button>
  </div>
</div>
