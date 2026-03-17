import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import Footer from './components/footer';

import 'bootstrap/dist/css/bootstrap.css';
import './index.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    bootstrap: any;
  }
}

const initBootstrap = async () => {
  const bootstrap = await import('bootstrap/dist/js/bootstrap.bundle.js');
  window.bootstrap = bootstrap;
};

initBootstrap();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

const footerElement = document.getElementById('footer');
if (footerElement) {
  createRoot(footerElement).render(
    <StrictMode>
      <Footer />
    </StrictMode>
  );
}
