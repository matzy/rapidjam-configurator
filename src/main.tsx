import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LocalizationProvider } from './i18n'
import './styles.css'

const showButtonFaceTuner = import.meta.env.DEV && new URLSearchParams(window.location.search).has('tuner')
const ButtonFaceTunerShell = showButtonFaceTuner
  ? lazy(() => import('./dev/ButtonFaceTuner').then((module) => ({ default: module.ButtonFaceTunerShell })))
  : null

const app = <LocalizationProvider><App /></LocalizationProvider>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {ButtonFaceTunerShell ? <Suspense fallback={null}><ButtonFaceTunerShell>{app}</ButtonFaceTunerShell></Suspense> : app}
  </StrictMode>,
)
