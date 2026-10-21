import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Polices variables locales (fonctionnent sans connexion Internet)
import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'

// Styles Araho
import './styles/tokens.css'
import './styles/base.css'
import './components/components.css'
import './styles/pages.css'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
