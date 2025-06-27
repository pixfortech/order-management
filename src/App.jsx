// App.jsx - Enhanced with connection debugging
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import './App.css';

// Debug component to show connection status
const ConnectionDebug = () => {
  const { API_URL, testConnection, error } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [lastChecked, setLastChecked] = useState(null);

  const checkConnection = async () => {
    setConnectionStatus('checking');
    const isConnected = await testConnection();
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    setLastChecked(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    checkConnection();
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4caf50';
      case 'disconnected': return '#f44336';
      case 'checking': return '#ff9800';
      default: return '#9e9e9e';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'checking': return 'Checking...';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div style={{ marginBottom: '5px' }}>
        <span style={{ color: getStatusColor(), fontWeight: 'bold' }}>
          ● {getStatusText()}
        </span>
        {lastChecked && (
          <span style={{ marginLeft: '10px', color: '#ccc' }}>
            Last: {lastChecked}
          </span>
        )}
      </div>
      <div style={{ fontSize: '10px', color: '#ccc' }}>
        API: {API_URL}
      </div>
      {error && (
        <div style={{ 
          marginTop: '5px', 
          padding: '5px', 
          background: 'rgba(244, 67, 54, 0.2)', 
          borderRadius: '4px',
          fontSize: '10px'
        }}>
          Error: {error}
        </div>
      )}
      <button 
        onClick={checkConnection}
        style={{
          marginTop: '5px',
          padding: '2px 6px',
          fontSize: '10px',
          background: '#666',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Recheck
      </button>
    </div>
  );
};

// Loading component with better UX
const LoadingScreen = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <div style={{
        fontSize: '24px',
        marginBottom: '20px'
      }}>
        🔄 Loading{dots}
      </div>
      <div style={{
        fontSize: '14px',
        opacity: 0.8
      }}>
        Connecting to server...
      </div>
    </div>
  );
};

// Error component
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
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
      onMouseOver={(e) => {
        e.target.style.background = 'rgba(255, 255, 255, 0.3)';
      }}
      onMouseOut={(e) => {
        e.target.style.background = 'rgba(255, 255, 255, 0.2)';
      }}
    >
      🔄 Retry Connection
    </button>
  </div>
);

// Main App content
const AppContent = () => {
  const { user, loading, error } = useAuth();

  console.log('🎯 App render state:', { user: !!user, loading, error });

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !user) {
    return <ErrorScreen error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <>
      <ConnectionDebug />
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
        />
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/" 
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
        />
      </Routes>
    </>
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