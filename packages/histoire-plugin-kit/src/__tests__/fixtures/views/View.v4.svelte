<script>
  // Same behavior as every adapter fixture view (see ./probe.ts).
  import { onDestroy, onMount } from 'svelte4'
  import { attachProbe } from './probe.ts'

  export let context
  export let host
  let clicks = 0
  let detach

  onMount(() => {
    detach = attachProbe(host)
  })
  onDestroy(() => detach?.())
</script>

<button on:click={() => clicks++}>{context.tag}:{clicks}</button>
