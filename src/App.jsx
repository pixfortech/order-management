// App.jsx - Clean version without debug components
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './components/LoginPage';
import MainLayout from './components/MainLayout';
import './App.css';

// Simple loading component
const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white'
  }}>
    <div style={{ fontSize: '24px', marginBottom: '20px' }}>
      🔄 Loading...
    </div>
    <div style={{ fontSize: '14px', opacity: 0.8 }}>
      Connecting to server...
    </div>
  </div>
);

// Simple error component
const ErrorScreen = ({ error, onRetry }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '20px',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '48px', marginBottom: '20px' }}>
      ⚠️
    </div>
    <div style={{ fontSize: '24px', marginBottom: '15px' }}>
      Connection Error
    </div>
    <div style={{ 
      fontSize: '14px', 
      marginBottom: '20px', 
      maxWidth: '500px',
      background: 'rgba(0, 0, 0, 0.3)',
      padding: '15px',
      borderRadius: '8px'
    }}>
      {error}
    </div>
    <button 
      onClick={onRetry}
      style={{
        padding: '12px 24px',
        fontSize: '16px',
        background: 'rgba(255, 255, 255, 0.2)',
        color: 'white',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '8px',
        cursor: 'pointer'
      }}
    >
      🔄 Retry Connection
    </button>
  </div>
);

// Main App content
const AppContent = () => {
  const { user, loading, error } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !user) {
    return <ErrorScreen error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/dashboard" 
        element={user ? <MainLayout /> : <Navigate to="/login" replace />} 
      />
      <Route 
        path="/" 
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
      />
    </Routes>
  );
};

// Main App component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;