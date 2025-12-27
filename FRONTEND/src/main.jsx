import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AppConfigProvider } from './context/AppConfigContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento raíz para montar la aplicación.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppConfigProvider>
          <ToastProvider>
            <AuthProvider>
              <NotificationsProvider>
                <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
                <App />
              </NotificationsProvider>
            </AuthProvider>
          </ToastProvider>
        </AppConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
