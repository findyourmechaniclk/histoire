import { mountMainApp } from './bundled/index.js'
// Shared component defaults load before the app's utility overrides.
import './bundled/app.css'
import './style.css'

mountMainApp()
