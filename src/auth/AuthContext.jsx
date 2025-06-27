// AuthContext.jsx - Enhanced with better error handling and debugging
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

  // Enhanced API URL detection with debugging
  const getApiUrl = () => {
    const hostname = window.location.hostname;
    console.log('🌐 Current hostname:', hostname);
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('🏠 Using local API URL');
      return 'http://localhost:5000';
    } else {
      console.log('☁️ Using production API URL');
      return 'https://order-management-fbre.onrender.com';
    }
  };

  const API_URL = getApiUrl();
  console.log('🔗 Final API URL:', API_URL);

  // Enhanced fetch function with better error handling
  const fetchWithAuth = async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    console.log('🔐 Token exists:', !!token);
    
    const url = `${API_URL}${endpoint}`;
    console.log('📡 Making request to:', url);
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      console.log('⏳ Sending request...');
      const response = await fetch(url, config);
      
      console.log('📊 Response status:', response.status);
      console.log('📊 Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Request successful');
      return data;
    } catch (error) {
      console.error('🚨 Fetch error details:', {
        message: error.message,
        stack: error.stack,
        url: url,
        config: config
      });
      throw error;
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 Checking authentication...');
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.log('❌ No token found');
        setLoading(false);
        return;
      }

      try {
        console.log('👤 Token found, fetching user data...');
        setError(null);
        
        const userData = await fetchWithAuth('/api/auth/me');
        console.log('✅ User data received:', userData);
        
        setUser(userData);
      } catch (error) {
        console.error('❌ Auth check failed:', error);
        setError(error.message);
        
        // Clear invalid token
        localStorage.removeItem('authToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    console.log('🚪 Attempting login for:', username);
    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      console.log('✅ Login successful:', response);
      
      const { token, user: userData } = response;
      
      if (token) {
        localStorage.setItem('authToken', token);
        setUser(userData);
        console.log('💾 Token saved, user set');
        return { success: true };
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log('🚪 Logging out...');
    localStorage.removeItem('authToken');
    setUser(null);
    setError(null);
  };

  // Test server connectivity
  const testConnection = async () => {
    console.log('🔌 Testing server connection...');
    try {
      const response = await fetch(`${API_URL}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Server is healthy:', data);
        return true;
      } else {
        console.error('❌ Server health check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  };

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    fetchWithAuth,
    testConnection,
    API_URL
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};