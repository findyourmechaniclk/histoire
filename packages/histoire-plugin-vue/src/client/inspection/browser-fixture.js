import { createApp, defineComponent, Fragment, h, nextTick, ref } from 'vue'
import { createVueInspectionProvider } from './provider.ts'

const visible = ref(true)
const Child = defineComponent({ name: 'BrowserChild', props: ['label'], setup: props => () => h(Fragment, [h('button', { 'data-label': props.label }, props.label), h('span', 'Sibling')]) })
const app = createApp(defineComponent({ name: 'BrowserRoot', setup: () => () => h('section', [h(Child, { label: 'first' }), visible.value && h(Child, { label: 'second' })]) }))
const root = document.getElementById('story')
app.mount(root)
const provider = createVueInspectionProvider(app, root)
for (const element of root.querySelectorAll('*')) {
  delete element.__vueParentComponent
  delete element.__vnode
}
window.fixture = {
  inspect: selector => provider.componentForElement(selector),
  component: id => provider.component(id),
  hide: async () => {
    visible.value = false
    await nextTick()
  },
  dispose: () => {
    provider.dispose()
    app.unmount()
  },
}
