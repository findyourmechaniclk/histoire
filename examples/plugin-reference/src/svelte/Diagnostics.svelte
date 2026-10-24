<script lang="ts">
  import type { FrameScopedContext } from '@histoire/plugin-kit'
  import type { ReferenceModel } from '../domain/model.js'
  import { diagnosticsState, subscribeViewState } from '../domain/view-state.js'

  /** `context` is a reactive getter fed by `svelte5View`; `model` is added by `views.ts`. */
  const { context, model }: { context: FrameScopedContext, model: ReferenceModel } = $props()
  let version = $state(0)
  // The model is not reactive: its subscription bumps a counter the derived state reads.
  $effect(() => subscribeViewState(model, () => version++))
  const state = $derived((void version, diagnosticsState(model, context)))
</script>

<div class="hst-ref-panel">
  <div class="hst-ref-row">
    <span class="hst-ref-grow">{state.status}</span>
    <button type="button" class="hst-ref-button" onclick={() => model.audits.rerun(state.frameKey)}>Run again</button>
  </div>
  {#if state.ready && !state.issues.length}
    <div class="hst-ref-empty">No issues</div>
  {:else}
    <ul class="hst-ref-list">
      {#each state.issues as issue (issue.index)}
        <li>
          <button type="button" class="hst-ref-item" title="Highlight in frame" onclick={() => model.audits.highlight(state.frameKey, issue.index)}>
            <span class="hst-ref-chip" data-tone="warn">{issue.rule}</span>
            <span class="hst-ref-grow">{issue.element}</span>
            <span class="hst-ref-muted">{issue.message}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
