<script>
  // Svelte 4 syntax in plain JavaScript: the Svelte 4 compiler takes no TypeScript without a preprocessor.
  import { onDestroy } from 'svelte'
  import { diagnosticsState, subscribeViewState } from '../domain/view-state.js'

  /** @type {import('@histoire/plugin-kit').FrameScopedContext} Updated by `svelte4View` through `$set`. */
  export let context
  /** @type {import('../domain/model.js').ReferenceModel} Added by `views.ts`. */
  export let model
  let version = 0
  // The model is not reactive: its subscription bumps a counter the reactive statement reads.
  onDestroy(subscribeViewState(model, () => version++))
  $: state = (void version, diagnosticsState(model, context))
</script>

<div class="hst-ref-panel">
  <div class="hst-ref-row">
    <span class="hst-ref-grow">{state.status}</span>
    <button type="button" class="hst-ref-button" on:click={() => model.audits.rerun(state.frameKey)}>Run again</button>
  </div>
  {#if state.ready && !state.issues.length}
    <div class="hst-ref-empty">No issues</div>
  {:else}
    <ul class="hst-ref-list">
      {#each state.issues as issue (issue.index)}
        <li>
          <button type="button" class="hst-ref-item" title="Highlight in frame" on:click={() => model.audits.highlight(state.frameKey, issue.index)}>
            <span class="hst-ref-chip" data-tone="warn">{issue.rule}</span>
            <span class="hst-ref-grow">{issue.element}</span>
            <span class="hst-ref-muted">{issue.message}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
