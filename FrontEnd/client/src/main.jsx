import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@flaticon/flaticon-uicons/css/regular/rounded.css'
import '@flaticon/flaticon-uicons/css/solid/rounded.css'
import '@flaticon/flaticon-uicons/css/brands/all.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { FavoritosProvider } from './context/FavoritosContext.jsx'
import { TemaProvider } from './context/TemaContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

const BASE_URL = import.meta.env.BASE_URL || '/'
const BASENAME = BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={BASENAME}>
      <TemaProvider>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <FavoritosProvider>
                <App />
              </FavoritosProvider>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </TemaProvider>
    </BrowserRouter>
  </StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_DEMO !== '1') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE_URL}sw.js`).catch(() => {})
  })
}
