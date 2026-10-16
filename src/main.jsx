import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PwaPrompts } from './components/pwa/PwaPrompts.jsx'
import { startResponsiveTables } from './lib/responsiveTables.js'

startResponsiveTables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PwaPrompts />
  </StrictMode>,
)
