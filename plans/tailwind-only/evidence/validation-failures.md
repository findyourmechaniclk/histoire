# Validation failures

Only completed commands are listed. Initial runs followed interrupted package builds and lacked generated artifacts; rechecks follow completion of existing asset steps. Nested intentionally failing story fixtures are excluded from the failure-name list.

## build

`pnpm run build` — exit 2. Full log

- `packages/histoire-shared build: src/types/command.ts(1,15): error TS2614: Module '"vue-router"' has no exported member 'RouteLocationNormalizedLoaded'. Did you mean to use 'import RouteLocationNormalizedLoaded from "vue-router"' instead?`

## controls-build

`pnpm --filter @histoire/controls build` — exit 2. Full log

- `src/components/BuiltinIcon.vue(3,10): error TS2614: Module '"@iconify/vue"' has no exported member 'Icon'. Did you mean to use 'import Icon from "@iconify/vue"' instead?`

## app-build

`pnpm --filter @histoire/app build` — exit 2. Full log

- `src/embed/adapters/content-view.ts(4,10): error TS2614: Module '"vue"' has no exported member 'createApp'. Did you mean to use 'import createApp from "vue"' instead?`

## controls-test

`pnpm --filter @histoire/controls test` — exit 1. Full log

- Test Files  1 failed | 20 passed (21)
- Tests  80 passed (80)

- `src/compatibility.spec.ts [ src/compatibility.spec.ts ]`

## vue-test

`pnpm --filter @histoire/vue test` — exit 1. Full log

- Test Files  111 failed | 44 passed (155)
- Tests  2 failed | 204 passed (206)

- `src/__tests__/agent-pending-input.spec.ts [ src/__tests__/agent-pending-input.spec.ts ]`
- `src/__tests__/agent-questions-attention.spec.ts [ src/__tests__/agent-questions-attention.spec.ts ]`
- `src/__tests__/ai-thread-list.spec.ts [ src/__tests__/ai-thread-list.spec.ts ]`
- `src/__tests__/canvas-frame-budget.spec.ts [ src/__tests__/canvas-frame-budget.spec.ts ]`
- `src/__tests__/canvas-overlay-geometry.spec.ts [ src/__tests__/canvas-overlay-geometry.spec.ts ]`
- `src/__tests__/canvas-overlay-occlusion.spec.ts [ src/__tests__/canvas-overlay-occlusion.spec.ts ]`
- `src/__tests__/canvas-plugin-overlays.spec.ts [ src/__tests__/canvas-plugin-overlays.spec.ts ]`
- `src/__tests__/canvas-plugin-teardown.spec.ts [ src/__tests__/canvas-plugin-teardown.spec.ts ]`
- `src/__tests__/canvas-plugin-view-input.spec.ts [ src/__tests__/canvas-plugin-view-input.spec.ts ]`
- `src/__tests__/canvas-toolbar-overflow.spec.ts [ src/__tests__/canvas-toolbar-overflow.spec.ts ]`
- `src/__tests__/inspector-extensions.spec.ts [ src/__tests__/inspector-extensions.spec.ts ]`
- `src/__tests__/plugin-toolbar.spec.ts [ src/__tests__/plugin-toolbar.spec.ts ]`
- `src/__tests__/source-expansion.spec.ts [ src/__tests__/source-expansion.spec.ts ]`
- `src/__tests__/workbench-content-ownership.spec.ts [ src/__tests__/workbench-content-ownership.spec.ts ]`
- `src/__tests__/workbench-matrix-custom-inspector.spec.ts [ src/__tests__/workbench-matrix-custom-inspector.spec.ts ]`
- `src/__tests__/workbench-matrix-inspector.spec.ts [ src/__tests__/workbench-matrix-inspector.spec.ts ]`
- `src/__tests__/workbench-mcp-activity.spec.ts [ src/__tests__/workbench-mcp-activity.spec.ts ]`
- `src/__tests__/workbench-search-dismissal.spec.ts [ src/__tests__/workbench-search-dismissal.spec.ts ]`
- `src/__tests__/workbench-tests-panel.spec.ts [ src/__tests__/workbench-tests-panel.spec.ts ]`
- `src/__tests__/workbench-visual-approval.spec.ts [ src/__tests__/workbench-visual-approval.spec.ts ]`
- `src/__tests__/ai-thread-view.spec.ts [ src/__tests__/ai-thread-view.spec.ts ]`
- `src/__tests__/canvas-background-capture.spec.ts [ src/__tests__/canvas-background-capture.spec.ts ]`
- `src/__tests__/canvas-background.spec.ts [ src/__tests__/canvas-background.spec.ts ]`
- `src/__tests__/canvas-frame-header.spec.ts [ src/__tests__/canvas-frame-header.spec.ts ]`
- `src/__tests__/canvas-frame-selection.spec.ts [ src/__tests__/canvas-frame-selection.spec.ts ]`
- `src/__tests__/canvas-header-editor.spec.ts [ src/__tests__/canvas-header-editor.spec.ts ]`
- `src/__tests__/canvas-inputs.spec.ts [ src/__tests__/canvas-inputs.spec.ts ]`
- `src/__tests__/canvas-measure-inputs.spec.ts [ src/__tests__/canvas-measure-inputs.spec.ts ]`
- `src/__tests__/canvas-plugin-tools.spec.ts [ src/__tests__/canvas-plugin-tools.spec.ts ]`
- `src/__tests__/canvas-publish-memoization.spec.ts [ src/__tests__/canvas-publish-memoization.spec.ts ]`
- `src/__tests__/canvas-zoom-preferences.spec.ts [ src/__tests__/canvas-zoom-preferences.spec.ts ]`
- `src/__tests__/controls-view-lifecycle.spec.ts [ src/__tests__/controls-view-lifecycle.spec.ts ]`
- `src/__tests__/embed-tests-view.spec.ts [ src/__tests__/embed-tests-view.spec.ts ]`
- `src/__tests__/inspector-tab-overflow.spec.ts [ src/__tests__/inspector-tab-overflow.spec.ts ]`
- `src/__tests__/workbench-matrix-registration.spec.ts [ src/__tests__/workbench-matrix-registration.spec.ts ]`
- `src/__tests__/workbench-matrix.spec.ts [ src/__tests__/workbench-matrix.spec.ts ]`
- `src/__tests__/workbench-tests-visibility.spec.ts [ src/__tests__/workbench-tests-visibility.spec.ts ]`
- `src/__tests__/canvas-frame-leases.spec.ts [ src/__tests__/canvas-frame-leases.spec.ts ]`
- `src/__tests__/canvas-story-frame-lease.spec.ts [ src/__tests__/canvas-story-frame-lease.spec.ts ]`
- `src/__tests__/extension-outlet.spec.ts [ src/__tests__/extension-outlet.spec.ts ]`
- `src/__tests__/standalone-runtime-binding.spec.ts [ src/__tests__/standalone-runtime-binding.spec.ts ]`
- `src/__tests__/workbench-plugin-settings.spec.ts [ src/__tests__/workbench-plugin-settings.spec.ts ]`
- `src/__tests__/workbench-tests-discovery.spec.ts [ src/__tests__/workbench-tests-discovery.spec.ts ]`
- `src/__tests__/workbench-tests-progress.spec.ts [ src/__tests__/workbench-tests-progress.spec.ts ]`
- `src/__tests__/canvas-frame-lifetime.spec.ts [ src/__tests__/canvas-frame-lifetime.spec.ts ]`
- `src/__tests__/canvas-plugin-views.spec.ts [ src/__tests__/canvas-plugin-views.spec.ts ]`
- `src/__tests__/canvas-single-switching.spec.ts [ src/__tests__/canvas-single-switching.spec.ts ]`
- `src/__tests__/comment-attachments.spec.ts [ src/__tests__/comment-attachments.spec.ts ]`
- `src/__tests__/comment-composer.spec.ts [ src/__tests__/comment-composer.spec.ts ]`
- `src/__tests__/comment-pick-lifetime.spec.ts [ src/__tests__/comment-pick-lifetime.spec.ts ]`
- `src/__tests__/comment-prompt.spec.ts [ src/__tests__/comment-prompt.spec.ts ]`
- `src/__tests__/comment-session.spec.ts [ src/__tests__/comment-session.spec.ts ]`
- `src/__tests__/comment-thread.spec.ts [ src/__tests__/comment-thread.spec.ts ]`
- `src/__tests__/content-panels.spec.ts [ src/__tests__/content-panels.spec.ts ]`
- `src/__tests__/controls-edit-ack.spec.ts [ src/__tests__/controls-edit-ack.spec.ts ]`
- `src/__tests__/controls-json-state.spec.ts [ src/__tests__/controls-json-state.spec.ts ]`
- `src/__tests__/controls-prop-values.spec.ts [ src/__tests__/controls-prop-values.spec.ts ]`
- `src/__tests__/controls-panel.spec.ts [ src/__tests__/controls-panel.spec.ts ]`
- `src/__tests__/controls-readiness.spec.ts [ src/__tests__/controls-readiness.spec.ts ]`
- `src/__tests__/controls-width.spec.ts [ src/__tests__/controls-width.spec.ts ]`
- `src/__tests__/controls-replica-lifecycle.spec.ts [ src/__tests__/controls-replica-lifecycle.spec.ts ]`
- `src/__tests__/controls-tooltip.spec.ts [ src/__tests__/controls-tooltip.spec.ts ]`
- `src/__tests__/controls.spec.ts [ src/__tests__/controls.spec.ts ]`
- `src/__tests__/events-panel.spec.ts [ src/__tests__/events-panel.spec.ts ]`
- `src/__tests__/host-form-actions.spec.ts [ src/__tests__/host-form-actions.spec.ts ]`
- `src/__tests__/explorer-preview-transitions.spec.ts [ src/__tests__/explorer-preview-transitions.spec.ts ]`
- `src/__tests__/explorer.spec.ts [ src/__tests__/explorer.spec.ts ]`
- `src/__tests__/native-extensions-placement.spec.ts [ src/__tests__/native-extensions-placement.spec.ts ]`
- `src/__tests__/search-activation.spec.ts [ src/__tests__/search-activation.spec.ts ]`
- `src/__tests__/floating-focus.spec.ts [ src/__tests__/floating-focus.spec.ts ]`
- `src/__tests__/matrix-availability.spec.ts [ src/__tests__/matrix-availability.spec.ts ]`
- `src/__tests__/matrix-entry.spec.ts [ src/__tests__/matrix-entry.spec.ts ]`
- `src/__tests__/native-extensions-ownership.spec.ts [ src/__tests__/native-extensions-ownership.spec.ts ]`
- `src/__tests__/native-extensions.spec.ts [ src/__tests__/native-extensions.spec.ts ]`
- `src/__tests__/navigation.spec.ts [ src/__tests__/navigation.spec.ts ]`
- `src/__tests__/plugin-actions-availability.spec.ts [ src/__tests__/plugin-actions-availability.spec.ts ]`
- `src/__tests__/workbench-search-loading.spec.ts [ src/__tests__/workbench-search-loading.spec.ts ]`
- `src/__tests__/presets-menu.spec.ts [ src/__tests__/presets-menu.spec.ts ]`
- `src/__tests__/presets-ownership.spec.ts [ src/__tests__/presets-ownership.spec.ts ]`
- `src/__tests__/primary-retirement.spec.ts [ src/__tests__/primary-retirement.spec.ts ]`
- `src/__tests__/provider.spec.ts [ src/__tests__/provider.spec.ts ]`
- `src/__tests__/publish-memoization.spec.ts [ src/__tests__/publish-memoization.spec.ts ]`
- `src/__tests__/source-highlighting.spec.ts [ src/__tests__/source-highlighting.spec.ts ]`
- `src/__tests__/standalone-docs-links.spec.ts [ src/__tests__/standalone-docs-links.spec.ts ]`
- `src/__tests__/standalone-folders.spec.ts [ src/__tests__/standalone-folders.spec.ts ]`
- `src/__tests__/standalone-search.spec.ts [ src/__tests__/standalone-search.spec.ts ]`
- `src/__tests__/workbench-search-accessibility.spec.ts [ src/__tests__/workbench-search-accessibility.spec.ts ]`
- `src/__tests__/workbench-search-commands.spec.ts [ src/__tests__/workbench-search-commands.spec.ts ]`
- `src/__tests__/workbench-search-ranking.spec.ts [ src/__tests__/workbench-search-ranking.spec.ts ]`
- `src/__tests__/standalone-tests.spec.ts [ src/__tests__/standalone-tests.spec.ts ]`
- `src/__tests__/workbench-markdown-transition.spec.ts [ src/__tests__/workbench-markdown-transition.spec.ts ]`
- `src/__tests__/workbench-state-components.spec.ts [ src/__tests__/workbench-state-components.spec.ts ]`
- `src/__tests__/workbench-tests-bulk.spec.ts [ src/__tests__/workbench-tests-bulk.spec.ts ]`
- `src/__tests__/workbench-tests.spec.ts [ src/__tests__/workbench-tests.spec.ts ]`
- `src/__tests__/tests.spec.ts [ src/__tests__/tests.spec.ts ]`
- `src/__tests__/toolbar-overflow.spec.ts [ src/__tests__/toolbar-overflow.spec.ts ]`
- `src/__tests__/workbench-agent-settings.spec.ts [ src/__tests__/workbench-agent-settings.spec.ts ]`
- `src/__tests__/workbench-home-rail.spec.ts [ src/__tests__/workbench-home-rail.spec.ts ]`
- `src/__tests__/workbench-loading-state.spec.ts [ src/__tests__/workbench-loading-state.spec.ts ]`
- `src/__tests__/workbench-panel-loading.spec.ts [ src/__tests__/workbench-panel-loading.spec.ts ]`
- `src/__tests__/workbench-plugin-shell.spec.ts [ src/__tests__/workbench-plugin-shell.spec.ts ]`
- `src/__tests__/workbench-screenshot-diagnostics.spec.ts [ src/__tests__/workbench-screenshot-diagnostics.spec.ts ]`
- `src/__tests__/workbench-screenshot-setup.spec.ts [ src/__tests__/workbench-screenshot-setup.spec.ts ]`
- `src/__tests__/workbench-search-focus.spec.ts [ src/__tests__/workbench-search-focus.spec.ts ]`
- `src/__tests__/workbench-tests-tree.spec.ts [ src/__tests__/workbench-tests-tree.spec.ts ]`
- `src/__tests__/workbench-tree-focus.spec.ts [ src/__tests__/workbench-tree-focus.spec.ts ]`
- `src/__tests__/workbench-ui-menu.spec.ts [ src/__tests__/workbench-ui-menu.spec.ts ]`
- `src/__tests__/workbench-ui-visibility.spec.ts [ src/__tests__/workbench-ui-visibility.spec.ts ]`
- `src/__tests__/workbench-visual-progress.spec.ts [ src/__tests__/workbench-visual-progress.spec.ts ]`
- `src/__tests__/imports.spec.ts > native package import contract > imports built native components and peer controls with browser globals absent`
- `src/__tests__/virtual-list-dynamic.spec.ts > reveals measured dynamic rows after delayed native scroll without clearing cached sizes`

## histoire-test

`pnpm --filter histoire test` — exit 1. Full log

- Test Files  60 failed | 344 passed | 1 skipped (405)
- Tests  12 failed | 1810 passed | 2 skipped (1824)
- Errors  5 errors

- `src/node/__tests__/browser-collection-channel.spec.ts [ src/node/__tests__/browser-collection-channel.spec.ts ]`
- `src/node/__tests__/build-bundler-options.spec.ts [ src/node/__tests__/build-bundler-options.spec.ts ]`
- `src/node/__tests__/config-watchers.spec.ts [ src/node/__tests__/config-watchers.spec.ts ]`
- `src/node/__tests__/context-screenshot-setup.spec.ts [ src/node/__tests__/context-screenshot-setup.spec.ts ]`
- `src/node/__tests__/markdown.spec.ts [ src/node/__tests__/markdown.spec.ts ]`
- `src/node/__tests__/server-dev-event.spec.ts [ src/node/__tests__/server-dev-event.spec.ts ]`
- `src/node/__tests__/story-collection.spec.ts [ src/node/__tests__/story-collection.spec.ts ]`
- `src/node/__tests__/test-collection-evidence.spec.ts [ src/node/__tests__/test-collection-evidence.spec.ts ]`
- `src/node/__tests__/test-execution-provenance.spec.ts [ src/node/__tests__/test-execution-provenance.spec.ts ]`
- `src/node/__tests__/ui-screenshot-setup-disconnect.spec.ts [ src/node/__tests__/ui-screenshot-setup-disconnect.spec.ts ]`
- `src/node/__tests__/ui-screenshot-setup.spec.ts [ src/node/__tests__/ui-screenshot-setup.spec.ts ]`
- `src/node/__tests__/ui-screenshot-target.spec.ts [ src/node/__tests__/ui-screenshot-target.spec.ts ]`
- `src/node/__tests__/vite.spec.ts [ src/node/__tests__/vite.spec.ts ]`
- `src/node/__tests__/vitest-browser-config.spec.ts [ src/node/__tests__/vitest-browser-config.spec.ts ]`
- `src/node/__tests__/vitest-browser-server.spec.ts [ src/node/__tests__/vitest-browser-server.spec.ts ]`
- `src/node/__tests__/workbench-plugins-config.spec.ts [ src/node/__tests__/workbench-plugins-config.spec.ts ]`
- `src/node/__tests__/workbench-plugins-serve.spec.ts [ src/node/__tests__/workbench-plugins-serve.spec.ts ]`
- `src/node/__tests__/workbench-vue-sfc.spec.ts [ src/node/__tests__/workbench-vue-sfc.spec.ts ]`
- `src/node/__tests__/workbench-vue.spec.ts [ src/node/__tests__/workbench-vue.spec.ts ]`
- `src/node/__tests__/embed/content-services.spec.ts [ src/node/__tests__/embed/content-services.spec.ts ]`
- `src/node/__tests__/embed/framework-roots.spec.ts [ src/node/__tests__/embed/framework-roots.spec.ts ]`
- `src/node/__tests__/embed/local-source.spec.ts [ src/node/__tests__/embed/local-source.spec.ts ]`
- `src/node/__tests__/embed/markdown-links.spec.ts [ src/node/__tests__/embed/markdown-links.spec.ts ]`
- `src/node/__tests__/embed/node-cleanup-quarantine.spec.ts [ src/node/__tests__/embed/node-cleanup-quarantine.spec.ts ]`
- `src/node/__tests__/embed/node-terminal-acquisition.spec.ts [ src/node/__tests__/embed/node-terminal-acquisition.spec.ts ]`
- `src/node/__tests__/embed/preview-cleanup-quarantine.spec.ts [ src/node/__tests__/embed/preview-cleanup-quarantine.spec.ts ]`
- `src/node/__tests__/embed/project-registry.spec.ts [ src/node/__tests__/embed/project-registry.spec.ts ]`
- `src/node/__tests__/embed/source-framing.spec.ts [ src/node/__tests__/embed/source-framing.spec.ts ]`
- `src/node/__tests__/embed/temp-ownership.spec.ts [ src/node/__tests__/embed/temp-ownership.spec.ts ]`
- `src/node/__tests__/markdown/code-blocks.spec.ts [ src/node/__tests__/markdown/code-blocks.spec.ts ]`
- `src/node/__tests__/markdown/discovery.spec.ts [ src/node/__tests__/markdown/discovery.spec.ts ]`
- `src/node/__tests__/markdown/plugins.spec.ts [ src/node/__tests__/markdown/plugins.spec.ts ]`
- `src/node/__tests__/markdown/startup.spec.ts [ src/node/__tests__/markdown/startup.spec.ts ]`
- `src/node/__tests__/markdown/transactions.spec.ts [ src/node/__tests__/markdown/transactions.spec.ts ]`
- `src/node/__tests__/markdown/vite-watcher.spec.ts [ src/node/__tests__/markdown/vite-watcher.spec.ts ]`
- `src/node/__tests__/markdown/watcher.spec.ts [ src/node/__tests__/markdown/watcher.spec.ts ]`
- `src/node/__tests__/mcp/dev-http-lifecycle.spec.ts [ src/node/__tests__/mcp/dev-http-lifecycle.spec.ts ]`
- `src/node/__tests__/mcp/runtime-lifecycle.spec.ts [ src/node/__tests__/mcp/runtime-lifecycle.spec.ts ]`
- `src/node/__tests__/mcp/server-startup.spec.ts [ src/node/__tests__/mcp/server-startup.spec.ts ]`
- `src/node/__tests__/mcp/test-context.spec.ts [ src/node/__tests__/mcp/test-context.spec.ts ]`
- `src/node/__tests__/canvas-registry.spec.ts [ src/node/__tests__/canvas-registry.spec.ts ]`
- `src/node/__tests__/ui-shortcuts.spec.ts [ src/node/__tests__/ui-shortcuts.spec.ts ]`
- `src/node/__tests__/workbench-dev.spec.ts [ src/node/__tests__/workbench-dev.spec.ts ]`
- `src/node/__tests__/ui-frame-channels.spec.ts [ src/node/__tests__/ui-frame-channels.spec.ts ]`
- `src/node/__tests__/ui-mcp-cursor.spec.ts [ src/node/__tests__/ui-mcp-cursor.spec.ts ]`
- `src/node/__tests__/embed/middleware-hosting.spec.ts [ src/node/__tests__/embed/middleware-hosting.spec.ts ]`
- `src/node/__tests__/embed/node-sdk.spec.ts [ src/node/__tests__/embed/node-sdk.spec.ts ]`
- `src/node/__tests__/embed/nuxt-root.spec.ts [ src/node/__tests__/embed/nuxt-root.spec.ts ]`
- `src/node/__tests__/embed/preview-hosting.spec.ts [ src/node/__tests__/embed/preview-hosting.spec.ts ]`
- `src/node/__tests__/embed/project-isolation.spec.ts [ src/node/__tests__/embed/project-isolation.spec.ts ]`
- `src/node/__tests__/acp-config-options.spec.ts > agent model and effort defaults > coalesces identical probes, limits temporary processes to two and closes all peers`
- `src/node/__tests__/acp-elicitation.spec.ts > elicitation over ACP > advertises form and url support and round-trips an answer`
- `src/node/__tests__/acp-manager.spec.ts > aCP agent manager > keeps persistent permission scopes, rejects overlapping prompts and stops on config change`
- `src/node/__tests__/preview-runtime.spec.ts > preview runtime generation > links built runtime and public app entries without the legacy routing state graph`
- `src/node/__tests__/test-lifecycle.spec.ts > runHistoireTests lifecycle > forces single-run invariants and configured worker limit over raw vitest args`
- `src/node/__tests__/test-specs.spec.ts > runHistoireTests generated specs > generates distinct spec paths for variant ids that sanitize identically`
- `src/node/__tests__/test-targeting.spec.ts > runHistoireTests targeting > derives eligibility from collected registrations, not from the story source`
- `src/node/__tests__/mcp/test-cancellation.spec.ts > owned test cancellation > rejects before collection when already aborted`
- `src/node/__tests__/tailwind/plugin.spec.ts > tailwind generation lifecycle > recovers initial compatibility-plugin failure when only its nested import is repaired`
- `src/node/__tests__/tailwind/plugin.spec.ts > tailwind generation lifecycle > awaits initial dev generation, updates dependencies, recovers and removes entries`
- `src/node/__tests__/tailwind/races.spec.ts > tailwind generation ownership > coalesces edits and publishes only latest successful generation`
- `src/node/__tests__/tailwind/races.spec.ts > tailwind generation ownership > fences pending publication on close without affecting another project`

## vue-tsc

`pnpm exec vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json` — exit 254. Full log

- `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "vue-tsc" not found`

## lint

`pnpm run lint` — exit 1. Full log

## embed-integration

`pnpm --filter histoire test:embed:integration` — exit 1. Full log

- Test Files  48 failed (48)
- Tests  no tests

- `src/node/__tests__/embed/integration/bridge-lifecycle.spec.ts [ src/node/__tests__/embed/integration/bridge-lifecycle.spec.ts ]`
- `src/node/__tests__/embed/integration/bridge-origins.spec.ts [ src/node/__tests__/embed/integration/bridge-origins.spec.ts ]`
- `src/node/__tests__/embed/integration/canvas-content-observer.spec.ts [ src/node/__tests__/embed/integration/canvas-content-observer.spec.ts ]`
- `src/node/__tests__/embed/integration/canvas-content-sizing.spec.ts [ src/node/__tests__/embed/integration/canvas-content-sizing.spec.ts ]`
- `src/node/__tests__/embed/integration/catalog-navigation.spec.ts [ src/node/__tests__/embed/integration/catalog-navigation.spec.ts ]`
- `src/node/__tests__/embed/integration/controls-overlays.spec.ts [ src/node/__tests__/embed/integration/controls-overlays.spec.ts ]`
- `src/node/__tests__/embed/integration/controls-provider-isolation.spec.ts [ src/node/__tests__/embed/integration/controls-provider-isolation.spec.ts ]`
- `src/node/__tests__/embed/integration/controls-static.spec.ts [ src/node/__tests__/embed/integration/controls-static.spec.ts ]`
- `src/node/__tests__/embed/integration/docs-source.spec.ts [ src/node/__tests__/embed/integration/docs-source.spec.ts ]`
- `src/node/__tests__/embed/integration/explorer-surfaces.spec.ts [ src/node/__tests__/embed/integration/explorer-surfaces.spec.ts ]`
- `src/node/__tests__/embed/integration/frame-plugins.spec.ts [ src/node/__tests__/embed/integration/frame-plugins.spec.ts ]`
- `src/node/__tests__/embed/integration/host-channels-frameworks.spec.ts [ src/node/__tests__/embed/integration/host-channels-frameworks.spec.ts ]`
- `src/node/__tests__/embed/integration/host-channels.spec.ts [ src/node/__tests__/embed/integration/host-channels.spec.ts ]`
- `src/node/__tests__/embed/integration/independent-panels.spec.ts [ src/node/__tests__/embed/integration/independent-panels.spec.ts ]`
- `src/node/__tests__/embed/integration/inspector-plugin-tab.spec.ts [ src/node/__tests__/embed/integration/inspector-plugin-tab.spec.ts ]`
- `src/node/__tests__/embed/integration/markdown-nuxt.spec.ts [ src/node/__tests__/embed/integration/markdown-nuxt.spec.ts ]`
- `src/node/__tests__/embed/integration/markdown-startup.spec.ts [ src/node/__tests__/embed/integration/markdown-startup.spec.ts ]`
- `src/node/__tests__/embed/integration/matrix-custom.spec.ts [ src/node/__tests__/embed/integration/matrix-custom.spec.ts ]`
- `src/node/__tests__/embed/integration/matrix-numeric.spec.ts [ src/node/__tests__/embed/integration/matrix-numeric.spec.ts ]`
- `src/node/__tests__/embed/integration/native-host-plugins.spec.ts [ src/node/__tests__/embed/integration/native-host-plugins.spec.ts ]`
- `src/node/__tests__/embed/integration/node-capture.spec.ts [ src/node/__tests__/embed/integration/node-capture.spec.ts ]`
- `src/node/__tests__/embed/integration/nuxt-ui.spec.ts [ src/node/__tests__/embed/integration/nuxt-ui.spec.ts ]`
- `src/node/__tests__/embed/integration/plugin-channels.spec.ts [ src/node/__tests__/embed/integration/plugin-channels.spec.ts ]`
- `src/node/__tests__/embed/integration/portable-limits.spec.ts [ src/node/__tests__/embed/integration/portable-limits.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-async-readiness.spec.ts [ src/node/__tests__/embed/integration/preview-async-readiness.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-failure.spec.ts [ src/node/__tests__/embed/integration/preview-failure.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-frameworks.spec.ts [ src/node/__tests__/embed/integration/preview-frameworks.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-grid.spec.ts [ src/node/__tests__/embed/integration/preview-grid.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-hmr.spec.ts [ src/node/__tests__/embed/integration/preview-hmr.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-static-mocks.spec.ts [ src/node/__tests__/embed/integration/preview-static-mocks.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-svelte.spec.ts [ src/node/__tests__/embed/integration/preview-svelte.spec.ts ]`
- `src/node/__tests__/embed/integration/preview-vanilla.spec.ts [ src/node/__tests__/embed/integration/preview-vanilla.spec.ts ]`
- `src/node/__tests__/embed/integration/sandbox-module-graph.spec.ts [ src/node/__tests__/embed/integration/sandbox-module-graph.spec.ts ]`
- `src/node/__tests__/embed/integration/scoped-embed-dialog.spec.ts [ src/node/__tests__/embed/integration/scoped-embed-dialog.spec.ts ]`
- `src/node/__tests__/embed/integration/scoped-embeds.spec.ts [ src/node/__tests__/embed/integration/scoped-embeds.spec.ts ]`
- `src/node/__tests__/embed/integration/small-capture-viewport.spec.ts [ src/node/__tests__/embed/integration/small-capture-viewport.spec.ts ]`
- `src/node/__tests__/embed/integration/source-documents.spec.ts [ src/node/__tests__/embed/integration/source-documents.spec.ts ]`
- `src/node/__tests__/embed/integration/source-modes.spec.ts [ src/node/__tests__/embed/integration/source-modes.spec.ts ]`
- `src/node/__tests__/embed/integration/standalone-adoption.spec.ts [ src/node/__tests__/embed/integration/standalone-adoption.spec.ts ]`
- `src/node/__tests__/embed/integration/standalone-docs-routing.spec.ts [ src/node/__tests__/embed/integration/standalone-docs-routing.spec.ts ]`
- `src/node/__tests__/embed/integration/standalone-runtime-input.spec.ts [ src/node/__tests__/embed/integration/standalone-runtime-input.spec.ts ]`
- `src/node/__tests__/embed/integration/tests-execution.spec.ts [ src/node/__tests__/embed/integration/tests-execution.spec.ts ]`
- `src/node/__tests__/embed/integration/tests-surfaces.spec.ts [ src/node/__tests__/embed/integration/tests-surfaces.spec.ts ]`
- `src/node/__tests__/embed/integration/visual-recovery.spec.ts [ src/node/__tests__/embed/integration/visual-recovery.spec.ts ]`
- `src/node/__tests__/embed/integration/visual-regression.spec.ts [ src/node/__tests__/embed/integration/visual-regression.spec.ts ]`
- `src/node/__tests__/embed/integration/visual-transport.spec.ts [ src/node/__tests__/embed/integration/visual-transport.spec.ts ]`
- `src/node/__tests__/embed/integration/vue-host-isolation.spec.ts [ src/node/__tests__/embed/integration/vue-host-isolation.spec.ts ]`
- `src/node/__tests__/embed/integration/workbench-vue-plugin.spec.ts [ src/node/__tests__/embed/integration/workbench-vue-plugin.spec.ts ]`

## tailwind-integration

`pnpm --filter histoire test:tailwind:integration` — exit 1. Full log

- Test Files  4 failed | 1 passed (5)
- Tests  1 passed (1)

- `src/node/__tests__/tailwind/integration/background.spec.ts [ src/node/__tests__/tailwind/integration/background.spec.ts ]`
- `src/node/__tests__/tailwind/integration/browser.spec.ts [ src/node/__tests__/tailwind/integration/browser.spec.ts ]`
- `src/node/__tests__/tailwind/integration/nuxt.spec.ts [ src/node/__tests__/tailwind/integration/nuxt.spec.ts ]`
- `src/node/__tests__/tailwind/integration/single-variant.spec.ts [ src/node/__tests__/tailwind/integration/single-variant.spec.ts ]`

## examples-test

`pnpm run test:examples` — exit 1. Full log

- `Error: Cannot find module '/home/akryum/Projects/histoire/packages/histoire/node_modules/@histoire/app/dist/bundle-index.js'`

## vue3-build

`pnpm -C examples/vue3 story:build` — exit 1. Full log

- `Error: Cannot find module '/home/akryum/Projects/histoire/packages/histoire/node_modules/@histoire/app/dist/bundle-index.js'`

## nuxt-ui-build

`pnpm -C examples/nuxt-ui story:build` — exit 1. Full log

- `Error: Cannot find module '/home/akryum/Projects/histoire/packages/histoire/node_modules/@histoire/app/dist/bundle-index.js'`

## embed-integration-recheck

`pnpm --filter histoire test:embed:integration` — exit 1. Full log

- Test Files  8 failed | 40 passed (48)
- Tests  13 failed | 80 passed (93)

- `src/node/__tests__/embed/integration/canvas-content-sizing.spec.ts > content-sized workbench browser acceptance > fits distinct variants, tracks growth/shrink without remounting, and retains mode across layouts/reload`
- `src/node/__tests__/embed/integration/independent-panels.spec.ts > independent native and iframe parts > isolates host navigation/focus/settings and attributes single/grid events through retained iframe replay`
- `src/node/__tests__/embed/integration/matrix-custom.spec.ts > custom matrix browser acceptance > renders JSON props, persists structural filters and restores defaults in static books`
- `src/node/__tests__/embed/integration/preview-async-readiness.spec.ts > actual Vue Suspense readiness > keeps primary pending until async child resolves, then publishes ready rendered owner`
- `src/node/__tests__/embed/integration/visual-recovery.spec.ts > durable visual recovery consumer > restores interrupted captures, approves retained bytes, merges targeted runs and invalidates only changed story`
- `src/node/__tests__/embed/integration/visual-recovery.spec.ts > durable visual recovery consumer > restores workbench review after actual server restart and reruns only selected comparison`
- `src/node/__tests__/embed/integration/visual-recovery.spec.ts > durable visual recovery consumer > restores finished comparison after CLI is killed before report publication`
- `src/node/__tests__/embed/integration/visual-regression.spec.ts > visual consumer acceptance > saves displayed filtered Matrix cells with complete props through real UI`
- `src/node/__tests__/embed/integration/visual-regression.spec.ts > visual consumer acceptance > captures canonical and two durable Matrix cases, approves, reruns, and rejects stale approval`
- `src/node/__tests__/embed/integration/visual-regression.spec.ts > visual consumer acceptance > cLI produces missing, approved, passing, and changed reports with meaningful exit codes`
- `src/node/__tests__/embed/integration/visual-regression.spec.ts > visual consumer acceptance > workbench captures, reviews, approves selected results, then passes next run`
- `src/node/__tests__/embed/integration/visual-transport.spec.ts > visual browser ownership > reviews and approves large saved props and axes through bounded pages`
- `src/node/__tests__/embed/integration/vue-host-isolation.spec.ts > native Vue host isolation > keeps host router/form/styles, two sessions, scoped themes/overlays and runtime cleanup independent`

## tailwind-integration-recheck

`pnpm --filter histoire test:tailwind:integration` — exit 1. Full log

- Test Files  2 failed | 3 passed (5)
- Tests  6 failed | 8 passed (14)

- `src/node/__tests__/tailwind/integration/browser.spec.ts > automatic Tailwind token books > renders dev token stories with Tailwind v4`
- `src/node/__tests__/tailwind/integration/browser.spec.ts > automatic Tailwind token books > renders static token stories with Tailwind v4`
- `src/node/__tests__/tailwind/integration/single-variant.spec.ts > tailwind Single variant workbench > uses native Single view in dev Tailwind v3 books`
- `src/node/__tests__/tailwind/integration/single-variant.spec.ts > tailwind Single variant workbench > uses native Single view in static Tailwind v3 books`
- `src/node/__tests__/tailwind/integration/single-variant.spec.ts > tailwind Single variant workbench > uses native Single view in dev Tailwind v4 books`
- `src/node/__tests__/tailwind/integration/single-variant.spec.ts > tailwind Single variant workbench > uses native Single view in static Tailwind v4 books`

## examples-test-recheck

`pnpm run test:examples` — exit 1. Full log

- `Error: EROFS: read-only file system, open '/home/akryum/.config/Cypress/cy/production/cache'`

## workbench-types

`pnpm --filter @histoire/app exec vue-tsc --noEmit -p tsconfig.workbench.json` — exit 254. Full log

- `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "vue-tsc" not found`

## lint-recheck

`pnpm run lint` — exit 1. Full log

## workbench-types-controls-bin

`packages/histoire-controls/node_modules/.bin/vue-tsc --noEmit -p packages/histoire-app/tsconfig.workbench.json` — exit 2. Full log

- `packages/histoire-app/src/app/components/agents/AgentLogo.vue(3,10): error TS2614: Module '"vue"' has no exported member 'computed'. Did you mean to use 'import computed from "vue"' instead?`

## capture-compare

`node plans/tailwind-only/evidence/compare.mjs plans/tailwind-only/evidence/baseline /tmp/histoire-tailwind-repeat --out /tmp/histoire-tailwind-diffs` — exit 1. Full log

## capture-stable-compare

`node plans/tailwind-only/evidence/compare.mjs plans/tailwind-only/evidence/baseline /tmp/histoire-tailwind-repeat --out /tmp/histoire-tailwind-diffs` — exit 1. Full log

## capture-final-compare

`node plans/tailwind-only/evidence/compare.mjs plans/tailwind-only/evidence/baseline /tmp/histoire-tailwind-repeat --out /tmp/histoire-tailwind-diffs` — exit 1. Full log
