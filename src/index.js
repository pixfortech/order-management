import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Remove this line: import { BrowserRouter } from 'react-router-dom';
// Remove this line: import { AuthProvider } from './auth/AuthContext';

// Apply saved theme color on app load
const savedTheme = localStorage.getItem('themeColor');
if (savedTheme) {
  document.documentElement.style.setProperty('--theme-color', savedTheme);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // Remove BrowserRouter and AuthProvider from here since App.jsx has them
  <App />
);