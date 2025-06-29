// AuthContext.jsx - Clean version without debug components
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simple API URL detection
  const getApiUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    } else {
      return 'https://order-management-fbre.onrender.com';
    }
  };

  const API_URL = getApiUrl();

  // Simple fetch function with auth
  const fetchWithAuth = async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    
    const url = `${API_URL}${endpoint}`;
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Fetch error:', error.message);
      throw error;
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
  const token = localStorage.getItem('authToken');
  
  // ✅ ADD: Debug logging
  console.log('🔍 Checking auth - Token exists:', !!token);
  console.log('🔍 Token preview:', token ? token.substring(0, 20) + '...' : 'No token');
  console.log('🔍 API URL:', process.env.REACT_APP_API_URL || 'Using fallback URL');
  
  if (!token) {
    console.log('❌ No token found, user not authenticated');
    setUser(null);
    setIsAuthenticated(false);
    setLoading(false);
    return;
  }

  try {
    // Make sure we're using the correct API URL
    const apiUrl = process.env.REACT_APP_API_URL || 'https://order-management-fbre.onrender.com';
    console.log('🌐 Making auth check request to:', `${apiUrl}/api/auth/me`);
    
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Auth response status:', response.status);

    if (response.ok) {
      const userData = await response.json();
      console.log('✅ Auth successful, user:', userData.username);
      setUser(userData);
      setIsAuthenticated(true);
    } else {
      const errorData = await response.text();
      console.log('❌ Auth failed:', response.status, errorData);
      
      // Clear invalid token
      localStorage.removeItem('authToken');
      setUser(null);
      setIsAuthenticated(false);
    }
  } catch (error) {
    console.error('❌ Auth check error:', error);
    localStorage.removeItem('authToken');
    setUser(null);
    setIsAuthenticated(false);
  } finally {
    setLoading(false);
  }
};

    checkAuth();
  }, []);

  const login = async (username, password) => {
  try {
    setLoading(true);
    
    // ✅ Use consistent API URL logic
    const apiUrl = process.env.REACT_APP_API_URL || 'https://order-management-fbre.onrender.com';
    console.log('🔐 Login attempt to:', `${apiUrl}/api/auth/login`);
    
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful');
      localStorage.setItem('authToken', data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } else {
      console.log('❌ Login failed:', data.message);
      return { success: false, message: data.message || 'Login failed' };
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  } finally {
    setLoading(false);
  }
};

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    fetchWithAuth,
    API_URL
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};