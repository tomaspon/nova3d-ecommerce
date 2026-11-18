import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans/wght.css'
import './index.css'
import App from './App.jsx'
import { installErrorReporter } from './errorReporter'

installErrorReporter()

// Encuadrada en otra página (la vista en vivo de la página oficial): sin barras de scroll visibles
try {
  if (window.self !== window.top) document.documentElement.classList.add('embedded')
} catch {
  document.documentElement.classList.add('embedded')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
