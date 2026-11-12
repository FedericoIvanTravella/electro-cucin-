import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@flaticon/flaticon-uicons/css/regular/rounded.css'
import '@flaticon/flaticon-uicons/css/solid/rounded.css'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { FavoritosProvider } from './context/FavoritosContext.jsx'
import { TemaProvider } from './context/TemaContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
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
