import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

console.log('Starting Kiwix USB Updater renderer...');
console.log('window.electronAPI defined:', typeof window.electronAPI !== 'undefined');
console.log('window.electronAPI:', window.electronAPI);
console.log('Looking for root element:', document.getElementById('root'));

try {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('Root element not found!');
    document.body.innerHTML = '<h1 style="color: red;">Error: Root element not found</h1>';
  } else {
    console.log('Creating React root...');
    const root = ReactDOM.createRoot(rootElement);

    console.log('Rendering App...');
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    console.log('Kiwix USB Updater renderer initialized successfully!');
  }
} catch (error) {
  console.error('Error initializing renderer:', error);
  document.body.innerHTML = `<h1 style="color: red;">Error: ${error.message}</h1><pre>${error.stack}</pre>`;
}
