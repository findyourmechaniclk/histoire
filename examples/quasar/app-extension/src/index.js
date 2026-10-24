/** Adds a boot file and a Quasar plugin, like published App Extensions do. */
export default function (api) {
  api.extendQuasarConf((conf) => {
    conf.boot.push('~quasar-app-extension-histoire-demo/src/boot/register.js')
    conf.framework.plugins.push('Dialog')
  })
}
