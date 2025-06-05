import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './components/LoginPage';
import MainLayout from './components/MainLayout';

const AppContent = () => {
  const { isAuthenticated, isLoading, user } = useAuth(); // Added 'user' to get user data

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Poppins, sans-serif'
      }}>
        <div>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔄</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} 
      />
      <Route 
        path="/" 
        element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/current-order" 
        element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/orders" 
        element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/summary" 
        element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />} 
      />
      
      {/* Protected Settings route - only accessible by admin */}
      <Route 
        path="/settings" 
        element={
          !isAuthenticated ? <Navigate to="/login" /> :
          (user?.role === 'admin' ? <MainLayout /> : <Navigate to="/" replace />)
        } 
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;