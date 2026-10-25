# Inventory

Generated 2026-10-24 from `packages/histoire-app/src` (uncommitted tree on `main` at `e42bad8f`). Slice 01 regenerates it against the baseline and records drift here.

Paths are relative to `packages/histoire-app/src`; `components/` is `app/components/`. Bytes count the `<style>` blocks of a `.vue` file, or the whole `.css`/`.pcss` file. "Hard patterns" counts: `deep` = `:deep()`, `container` = `@container`, `media` = `@media`, `data` = `[data-*]` selectors, `has` = `:has()`, `v-bind` = `v-bind()` in CSS, `pseudo` = `::before/::after`, `calc/mix` = `calc()` or `color-mix()`, `v-html` = template renders raw HTML.

Totals: 136 `.vue` files with `<style>` plus 16 CSS files (152 rows). Files already on utilities without `<style>` are listed under [Already on utilities](#already-on-utilities).

| Slice | Files | Bytes |
|---|---|---|
| 03/11 globals (`app/style`) | 6 | 10313 |
| 05 shell, base, menu, misc, story, agents | 23 | 17237 |
| 06 canvas core, overlays, tools, views | 22 | 17956 |
| 07 canvas matrix, toolbar | 19 | 15069 |
| 08 panes | 31 | 34482 |
| 09 comments | 25 | 23540 |
| 10 inspector, embed dialog, pages | 24 | 38737 |
| 11 embed document | 2 | 410 |

Every row belongs to exactly one slice. A slice that finds a file outside its rows (moved, new) adds it here under its own section before editing.

## Files by slice

### Slice 03/11

| File | Bytes | Hard patterns |
|---|---|---|
| `app/style/controls.css` | 872 | data×5, important |
| `app/style/density.css` | 1603 | data×1, calc/mix×1 |
| `app/style/document.pcss` | 830 | media×1, pseudo |
| `app/style/fonts.pcss` | 51 |  |
| `app/style/main.pcss` | 889 |  |
| `app/style/tokens.pcss` | 6068 | media×1, data×2, pseudo, important |

### Slice 05

| File | Bytes | Hard patterns |
|---|---|---|
| `components/agents/AgentLogo.vue` | 218 |  |
| `components/agents/agents.css` | 1383 | calc/mix×1 |
| `components/base/overflow/BaseOverflowToolbar.vue` | 441 |  |
| `components/base/overflow/BaseOverflowToolbarItem.vue` | 2137 | deep×9, data×13, pseudo |
| `components/base/popover/BasePopover.vue` | 840 | deep×5, calc/mix×1 |
| `components/menu/ContextMenu.vue` | 914 | deep×1, calc/mix×3 |
| `components/menu/MenuItem.vue` | 523 | deep×2 |
| `components/menu/SubMenu.vue` | 141 | calc/mix×1 |
| `components/misc/HatchedPattern.vue` | 185 |  |
| `components/shell/AppRail.vue` | 1259 | container×1, calc/mix×1 |
| `components/shell/InspectorFrame.vue` | 1043 | container×1, calc/mix×1 |
| `components/shell/PanelResizeHandle.vue` | 884 | data×3, pseudo, calc/mix×1 |
| `components/shell/PluginPane.vue` | 297 |  |
| `components/shell/RailButton.vue` | 1231 | data×3 |
| `components/shell/ShellLayout.vue` | 1235 | deep×1, container×1, data×4 |
| `components/shell/SidePanelHost.vue` | 765 | container×1, calc/mix×1 |
| `components/shell/workbench-pane.css` | 1073 |  |
| `components/shell/workbench-state.css` | 724 |  |
| `components/shell/WorkbenchEmptyState.vue` | 219 | deep×1, data×1 |
| `components/shell/WorkbenchErrorState.vue` | 260 | deep×1, data×1 |
| `components/shell/WorkbenchLoadingSkeleton.vue` | 653 | media×1, keyframes |
| `components/shell/WorkbenchPanelAction.vue` | 652 |  |
| `components/story/StoryVariantGridSandboxItem.vue` | 160 | v-bind |

### Slice 06

| File | Bytes | Hard patterns |
|---|---|---|
| `components/canvas/AgentCursor.vue` | 592 |  |
| `components/canvas/CanvasFrame.vue` | 3300 | pseudo |
| `components/canvas/CanvasHeader.vue` | 1811 | container×1 |
| `components/canvas/CanvasLoadingIndicator.vue` | 149 |  |
| `components/canvas/CanvasMatrixPrimary.vue` | 193 |  |
| `components/canvas/CanvasMeasureHint.vue` | 1451 | container×1 |
| `components/canvas/CanvasReplicaPreview.vue` | 389 |  |
| `components/canvas/CanvasSingleVariant.vue` | 480 | deep×1 |
| `components/canvas/CanvasStatus.vue` | 2199 | deep×3, container×1, calc/mix×1 |
| `components/canvas/CanvasViewport.vue` | 1751 | deep×2, media×1, calc/mix×3 |
| `components/canvas/CollectErrorCard.vue` | 604 | calc/mix×1 |
| `components/canvas/FrameGrid.vue` | 177 | deep×1 |
| `components/canvas/FrameList.vue` | 130 |  |
| `components/canvas/MeasureBoxModel.vue` | 297 |  |
| `components/canvas/MeasureGuides.vue` | 528 | data×2 |
| `components/canvas/MeasureOverlay.vue` | 694 | data×1 |
| `components/canvas/overlays/FrameLayer.vue` | 218 |  |
| `components/canvas/overlays/OverlayItem.vue` | 528 | deep×5, important |
| `components/canvas/overlays/OverlayLayer.vue` | 145 |  |
| `components/canvas/SingleVariantResizeHandles.vue` | 1771 | data×2, pseudo, calc/mix×1 |
| `components/canvas/tools/PluginToolLayer.vue` | 119 |  |
| `components/canvas/views/PluginCanvasView.vue` | 430 | deep×1 |

### Slice 07

| File | Bytes | Hard patterns |
|---|---|---|
| `components/canvas/matrix/matrix-axis-form.css` | 946 |  |
| `components/canvas/matrix/MatrixAxisBar.vue` | 762 | container×1 |
| `components/canvas/matrix/MatrixAxisEntry.vue` | 1184 | data×1 |
| `components/canvas/matrix/MatrixBaseProp.vue` | 576 |  |
| `components/canvas/matrix/MatrixCell.vue` | 1260 | data×1 |
| `components/canvas/matrix/MatrixCustomAxes.vue` | 361 |  |
| `components/canvas/matrix/MatrixInspector.vue` | 1897 |  |
| `components/canvas/matrix/MatrixNumericValues.vue` | 125 |  |
| `components/canvas/matrix/MatrixView.vue` | 1444 | deep×3, calc/mix×2 |
| `components/canvas/matrix/MatrixVisualActions.vue` | 453 |  |
| `components/canvas/toolbar/BackgroundPicker.vue` | 945 |  |
| `components/canvas/toolbar/CanvasToolbar.vue` | 513 | deep×1, data×1 |
| `components/canvas/toolbar/ScreenshotPopover.vue` | 1296 | deep×2 |
| `components/canvas/toolbar/ScreenshotSetup.vue` | 1397 |  |
| `components/canvas/toolbar/SearchMatchStepper.vue` | 268 |  |
| `components/canvas/toolbar/ToolbarButton.vue` | 747 | deep×1 |
| `components/canvas/toolbar/ToolbarPopover.vue` | 74 |  |
| `components/canvas/toolbar/ViewportMenu.vue` | 576 | important |
| `components/canvas/toolbar/ZoomMenu.vue` | 245 | important |

### Slice 08

| File | Bytes | Hard patterns |
|---|---|---|
| `components/panes/ai/AiCreatedStories.vue` | 208 |  |
| `components/panes/ai/AiPanel.vue` | 309 |  |
| `components/panes/ai/AiThreadComposer.vue` | 167 |  |
| `components/panes/ai/AiThreadHeader.vue` | 447 | deep×1 |
| `components/panes/ai/AiThreadList.vue` | 1370 | data×2 |
| `components/panes/ai/AiThreadView.vue` | 313 |  |
| `components/panes/mcp/McpActivity.vue` | 2977 | data×2 |
| `components/panes/mcp/McpClients.vue` | 1145 | data×2 |
| `components/panes/mcp/McpContent.vue` | 849 | data×1 |
| `components/panes/mcp/McpCurrentOperation.vue` | 1231 |  |
| `components/panes/mcp/McpEndpoint.vue` | 882 |  |
| `components/panes/mcp/McpHistory.vue` | 1216 | data×2 |
| `components/panes/search/SearchPanel.vue` | 1929 | deep×1 |
| `components/panes/search/SearchResultItem.vue` | 887 |  |
| `components/panes/search/SearchScopes.vue` | 340 | deep×4 |
| `components/panes/stories/StoriesPanel.vue` | 1925 |  |
| `components/panes/tests/FunctionalTestsPanel.vue` | 1327 | deep×1 |
| `components/panes/tests/TestsPanel.vue` | 326 |  |
| `components/panes/tests/TestsSummary.vue` | 1080 |  |
| `components/panes/tests/TestsTree.vue` | 1099 | data×2 |
| `components/panes/tests/TestsTreeRow.vue` | 1113 | deep×4 |
| `components/panes/visual/VisualImageLabel.vue` | 412 |  |
| `components/panes/visual/VisualResultRow.vue` | 1845 | data×3 |
| `components/panes/visual/VisualResultsList.vue` | 802 |  |
| `components/panes/visual/VisualSlider.vue` | 1066 | pseudo, calc/mix×3 |
| `components/panes/visual/VisualTestsPanel.vue` | 1151 | deep×1 |
| `components/panes/visual/VisualTestsSummary.vue` | 1509 | data×7 |
| `components/panes/visual/VisualViewer.vue` | 2711 | deep×7, container×2, calc/mix×1 |
| `components/panes/visual/VisualViewerActions.vue` | 764 | deep×1, container×1 |
| `components/panes/visual/VisualViewerDock.vue` | 871 | deep×2, container×1 |
| `components/panes/visual/VisualViewerHeader.vue` | 2211 | container×1, data×5, calc/mix×3 |

### Slice 09

| File | Bytes | Hard patterns |
|---|---|---|
| `components/comments/CommentComposer.vue` | 611 | deep×1, calc/mix×1 |
| `components/comments/CommentContext.vue` | 1551 | deep×1 |
| `components/comments/CommentPin.vue` | 793 |  |
| `components/comments/CommentsCanvasOverlay.vue` | 1386 | deep×2, media×1, calc/mix×1 |
| `components/comments/CommentThread.vue` | 425 | calc/mix×1 |
| `components/comments/prompt/AgentPrompt.vue` | 1815 | deep×1, data×1 |
| `components/comments/prompt/AttachmentStrip.vue` | 317 |  |
| `components/comments/prompt/AttachmentTile.vue` | 2105 |  |
| `components/comments/prompt/AttachmentViewer.vue` | 1061 | calc/mix×1 |
| `components/comments/prompt/AttachMenuPanel.vue` | 549 |  |
| `components/comments/prompt/ContextChip.vue` | 540 |  |
| `components/comments/prompt/PromptAttachMenu.vue` | 70 |  |
| `components/comments/prompt/PromptMenu.vue` | 128 |  |
| `components/comments/prompt/PromptSuggestions.vue` | 1030 | calc/mix×1 |
| `components/comments/prompt/SessionPicker.vue` | 427 |  |
| `components/comments/prompt/SessionRadioList.vue` | 563 | deep×2 |
| `components/comments/prompt/SessionSettings.vue` | 609 |  |
| `components/comments/thread/AgentActivityPhase.vue` | 1249 | media×1 |
| `components/comments/thread/AgentLiveTail.vue` | 313 |  |
| `components/comments/thread/AgentMarkdown.vue` | 962 | deep×9, v-html |
| `components/comments/thread/AgentPlan.vue` | 1099 | media×1, data×3 |
| `components/comments/thread/AgentPlanDecision.vue` | 1045 | media×1, data×1 |
| `components/comments/thread/questions/ElicitationForm.vue` | 71 |  |
| `components/comments/thread/questions/questions.css` | 3503 |  |
| `components/comments/thread/ThreadMessage.vue` | 1318 |  |

### Slice 10

| File | Bytes | Hard patterns |
|---|---|---|
| `components/embed/EmbedDialog.vue` | 4384 | data×4, has, calc/mix×2 |
| `components/inspector/EventsBadge.vue` | 138 |  |
| `components/inspector/InspectorHeader.vue` | 962 |  |
| `components/inspector/InspectorTabs.vue` | 1630 | deep×1 |
| `components/inspector/PropsTab.vue` | 1144 | deep×7, calc/mix×1 |
| `components/inspector/SourceDrawer.vue` | 2207 | deep×6, data×1, important, calc/mix×1 |
| `components/inspector/StoryInspector.vue` | 2923 | deep×17, data×2 |
| `components/inspector/TestsBadge.vue` | 270 |  |
| `components/pages/home/BrowseSections.vue` | 1350 | media×2, calc/mix×1 |
| `components/pages/home/GuidesList.vue` | 206 |  |
| `components/pages/home/home.css` | 1928 | data×1 |
| `components/pages/home/HomeHeader.vue` | 505 |  |
| `components/pages/home/HomePage.vue` | 1570 | media×2 |
| `components/pages/home/HomeSearch.vue` | 467 |  |
| `components/pages/home/NeedsAttention.vue` | 678 |  |
| `components/pages/home/UpdatesList.vue` | 605 | data×1, calc/mix×1 |
| `components/pages/markdown/markdown.css` | 3102 | media×2, data×1 |
| `components/pages/markdown/MarkdownOutline.vue` | 786 | media×1 |
| `components/pages/markdown/MarkdownPager.vue` | 540 |  |
| `components/pages/settings/agents-settings.css` | 7944 | media×2, data×4, has, pseudo |
| `components/pages/settings/BackgroundsSection.vue` | 627 |  |
| `components/pages/settings/ProjectSourceBadge.vue` | 255 |  |
| `components/pages/settings/settings.css` | 4130 | media×2, calc/mix×1 |
| `components/pages/settings/ViewportsSection.vue` | 386 |  |

### Slice 11

| File | Bytes | Hard patterns |
|---|---|---|
| `embed/document.css` | 199 |  |
| `embed/EmbedDocument.vue` | 211 |  |

## Already on utilities

Prefix change only (`htw-x` → `htw:x`), owned by slice 03:

- `components/command/CommandPrompts.vue`, `components/command/PromptSelect.vue`, `components/command/PromptText.vue`
- `components/toolbar/ToolbarNewTab.vue`, `components/base/BaseKeyboardShortcut.vue`
- `components/story/StoryVariantGridSandbox.vue`, `components/story/StoryVariantGridSandboxItem.vue` (also has a style block, slice 05; legacy, may be deleted instead)

`@histoire/controls`: 14 `.vue` files use `htw-` utilities, owned by slice 02.

## Cross-package selectors

App rules that target classes owned by `@histoire/vue` (`histoire-vue/src`) or `@histoire/controls` (`histoire-controls/src`). Slice 04 adds the hook; the slice owning the app file switches to it.

| Target | Owner | App files |
|---|---|---|
| `.histoire-events`, `.histoire-event-row`, `.histoire-event-heading`, `.histoire-event-argument`, `.histoire-events-count`, `.histoire-events ol/time/> button` | vue `HistoireEvents.ts` | `components/inspector/StoryInspector.vue` |
| `.histoire-docs`, `.histoire-docs table` | vue `HistoireDocs.ts` | `StoryInspector.vue`, `components/pages/markdown/markdown.css` |
| `.histoire-tests`, `.histoire-tests .workbench-state` | vue `HistoireTests.ts` | `StoryInspector.vue` |
| `.histoire-controls`, `fieldset`, `legend`, `.histoire-controls-reset` | vue `HistoireControls.ts` | `components/inspector/PropsTab.vue` |
| `.histoire-state-presets`, `.histoire-preset-trigger` | vue `StatePresets.ts`, `PresetMenu.ts` | `PropsTab.vue` |
| `.histoire-source`, `.histoire-content-actions`, `pre`, `.line[data-source-changed]`, `[role="alert"]` | vue `HistoireSource.ts` | `components/inspector/SourceDrawer.vue` |
| `.histoire-extension-view`, `.histoire-extension-mount` | vue `HistoireExtensionView.ts` | `components/canvas/overlays/OverlayItem.vue`, `components/canvas/views/PluginCanvasView.vue`, `StoryInspector.vue` |
| `.histoire-select` | controls `HstSelect.vue`, `CustomSelect.vue` | `components/panes/visual/VisualTestsPanel.vue`, `components/canvas/matrix/MatrixAxisBar.vue`, `components/canvas/matrix/MatrixInspector.vue`, `components/pages/settings/agents-settings.css` |
| `.histoire-switch` | controls `HstSwitch.vue` | `components/panes/tests/FunctionalTestsPanel.vue`, `agents-settings.css` |
| `.histoire-button[data-color="flat"]` | controls `HstButton.vue` | `components/shell/WorkbenchEmptyState.vue`, `components/shell/WorkbenchErrorState.vue`, `components/pages/home/home.css` |
| `.histoire-button-group`, `.histoire-button-group-options` | controls `HstButtonGroup.vue` | `components/panes/search/SearchScopes.vue`, `components/shell/workbench-pane.css`, `agents-settings.css`, `ArrangeSwitch.vue`, `EmbedDialog.vue`, `InspectorTabs.vue`, `MatrixAxisEntry.vue`, `ToolSwitch.vue` |
| `.histoire-control-content`, `.histoire-control-value` | controls `HstWrapper.vue` | `SearchScopes.vue` |
| `.histoire-icon-button` (and `--histoire-icon-button-size`) | controls `HstButton.vue` | `components/panes/visual/VisualViewerDock.vue`, `components/canvas/toolbar/ToolbarButton.vue`, `components/inspector/InspectorHeader.vue` |

Slice 04 re-greps (`:deep(`, plus plain descendant selectors in `.css` files) before closing; the table above is the starting point, not a proof of completeness.

## Marker classes

Keep on the same element, unstyled. Remove one only after grepping all consumers below.

Runtime JS hooks (`closest`/`querySelector`/`matches` in app source):
`histoire-canvas-viewport`, `histoire-canvas-toolbar`, `histoire-context-menu`, `histoire-submenu-panel`, `histoire-docs`, `header-anchor`, `histoire-controls`, `histoire-story-controls`, `histoire-provider` (vue-owned).

Test selectors (`histoire-vue/src/__tests__`, `histoire/src/node/__tests__`, `examples/*/cypress`) on app-owned elements:
`histoire-app`, `histoire-canvas-frame`, `is-selected` (with `histoire-canvas-frame`), `histoire-frame-content` (with `aria-busy`), `histoire-frame-title`, `histoire-frame-label`, `histoire-frame-select`, `histoire-canvas-header`, `histoire-canvas-status`, `histoire-canvas-info`, `histoire-canvas-hint`, `histoire-canvas-file`, `histoire-canvas-replica`, `histoire-single-variant`, `histoire-single-frame-shell`, `histoire-generic-render-story`, `histoire-inspector-frame`, `histoire-measure-hit`, `histoire-measure-box`, `histoire-matrix-board`, `histoire-matrix-cell`, `histoire-matrix-cell-content`, `histoire-matrix-cell-select`, `histoire-matrix-base-prop`, `histoire-matrix-axis-position`, `histoire-markdown-path`, `histoire-settings-content`, `histoire-base-popover`, `overflow-toolbar-items`, `inspector-source`, `inspector-source-retry`, `agent-markdown`, `agent-prompt`, `tests-panel`, `test-row`, `test-story-heading`, `collection-progress`, `stories-tree`, `stories-count`, `phase-steps`, `phase-row`, `capture-message`, `screenshot-setup`, `recent-capture`.

Public theming and runtime roots:
`histoire-app`, `histoire-workbench`, `histoire-root` (`histoire/src/node/virtual/resolved-theme.ts:21`), `histoire-shell-layout` with `data-density`, `htw-dark` (dark class, also `sandboxDarkClass` default context), `htw-sandbox-hidden`, `__histoire-render-story`, `__histoire-render-custom-controls`, `[data-histoire-controls]`.

Dynamic class bindings (`:class` with computed names) must be checked by hand; known one: `` `inspector-test-${status}` `` (slice 10).
