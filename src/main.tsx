import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Styles Araho (police système Apple : aucune police à embarquer)
import './styles/tokens.css'
import './styles/base.css'
import './components/components.css'
import './styles/pages.css'
import './lib/theme'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
