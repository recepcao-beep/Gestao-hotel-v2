
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const root = ReactDOM.createRoot(rootElement);

if (!clientId || clientId === "1046714072844-3n5n7t9o22s12j4m9p9s8h6v7f4d3a2b.apps.googleusercontent.com") {
  root.render(
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1 style={{ color: '#ef4444' }}>Configuração do Google Login Ausente</h1>
      <p style={{ marginTop: '1rem', color: '#475569' }}>
        Para que o login com o Google funcione, você precisa configurar a variável de ambiente <strong>VITE_GOOGLE_CLIENT_ID</strong>.
      </p>
      <p style={{ marginTop: '1rem', color: '#475569' }}>
        Acesse o menu de configurações do AI Studio e adicione a variável com o seu Client ID do Google Cloud Console.
      </p>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
}
