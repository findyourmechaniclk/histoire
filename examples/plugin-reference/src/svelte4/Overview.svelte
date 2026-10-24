<script>
  import { onDestroy } from 'svelte'
  import { overviewRows, subscribeViewState } from '../domain/view-state.js'

  /** @type {import('@histoire/plugin-kit').WorkbenchContext} */
  export let context
  /** @type {import('../domain/model.js').ReferenceModel} */
  export let model
  let version = 0
  onDestroy(subscribeViewState(model, () => version++))
  $: rows = (void version, overviewRows(model))
</script>

<div class="hst-ref-panel">
  {#if !rows.length}
    <div class="hst-ref-empty">No audited frames</div>
  {:else}
    <ul class="hst-ref-list">
      {#each rows as row (row.key)}
        <li>
          <button type="button" class="hst-ref-item" on:click={() => void context.navigation.selectStory(row.target)}>
            <span class="hst-ref-grow">{row.name}</span>
            <span class="hst-ref-chip" data-tone={row.warn ? 'warn' : undefined}>{row.count}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
