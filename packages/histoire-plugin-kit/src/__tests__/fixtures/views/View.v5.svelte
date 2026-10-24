<script>
  // Same behavior as every adapter fixture view (see ./probe.ts).
  import { attachProbe } from './probe.ts'

  const { context, host } = $props()
  let clicks = $state(0)

  $effect(() => attachProbe(host))
</script>

<button onclick={() => clicks++}>{context.tag}:{clicks}</button>
