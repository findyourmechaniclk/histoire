# Devframe example

From the repository root, build the workspace and start the example:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm --filter histoire-example-vue3 run dev:devframe
```

Open `http://127.0.0.1:4638/`. Wait for the connected status, then click the counter. This embedded story demonstrates the MCP connection and does not show the floating Devframe toolbar.

The example registers `HstVueDevtools` from `@histoire/plugin-vue-devtools` in its Histoire configuration. It runs during normal development; the demo command also creates a temporary token.

To use Vue DevTools, run `pnpm --filter histoire-example-vue3 run story:dev`, select a story variant, and open **Vue DevTools** in the right inspector. Select **RenderStorySubApp** to inspect its Vue component tree and state. This uses Vue DevTools 9.0.0-rc.2 and Vite DevTools 0.8.0. Set `HISTOIRE_VUE_DEVTOOLS=false` to disable it.

The command also prints an MCP endpoint and a temporary `Authorization: Bearer …` header. Configure an MCP client with that URL and header. List resources, read the `histoire://live/` resource, and pass its `attachmentId`, `owner.target`, and `owner` as `expectedOwner` to `histoire_inspect_session` with `kind: "variant"`. The returned live `state.count` reflects the counter. The same resource supplies the owner for component inspection, accessibility and highlighting tools. Vue DevTools' own MCP endpoint is disabled in this example; this endpoint is the authenticated Histoire adapter.

The Histoire server and Devframe host run on loopback; the example host uses port 4638 and chooses a free port for the Histoire source. Set `HISTOIRE_DEVFRAME_PORT` to choose another host port. Stop it with Ctrl+C. Refresh the page if a source change retires the attachment. Credentials change on each server restart.

Run the browser and MCP smoke test with `pnpm --filter histoire-example-vue3 run test:devframe`.

This is a local demonstration: it trusts its own temporary browser and agent credentials and does not verify document identity against a production identity service. Do not expose it to a network or reuse its policy in production. A production host must authenticate both parties, verify document ownership and invalidate changed authority as described in the [Devframe reference](../../../docs/reference/devframe.md).
