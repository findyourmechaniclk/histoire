<script lang="ts">
  import type { WorkbenchContext } from '@histoire/plugin-kit'
  import type { ReferenceModel } from '../domain/model.js'
  import { overviewRows, subscribeViewState } from '../domain/view-state.js'

  const { context, model }: { context: WorkbenchContext, model: ReferenceModel } = $props()
  let version = $state(0)
  $effect(() => subscribeViewState(model, () => version++))
  const rows = $derived((void version, overviewRows(model)))
</script>

<div class="hst-ref-panel">
  {#if !rows.length}
    <div class="hst-ref-empty">No audited frames</div>
  {:else}
    <ul class="hst-ref-list">
      {#each rows as row (row.key)}
        <li>
          <button type="button" class="hst-ref-item" onclick={() => void context.navigation.selectStory(row.target)}>
            <span class="hst-ref-grow">{row.name}</span>
            <span class="hst-ref-chip" data-tone={row.warn ? 'warn' : undefined}>{row.count}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
