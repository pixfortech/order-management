// AuthContext.jsx - Fixed version with proper state management
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
  const [isAuthenticated, setIsAuthenticated] = useState(false); // ✅ ADDED: Missing state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Enhanced API URL detection with environment variable support
  const getApiUrl = () => {
    // First priority: environment variable
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    
    // Second priority: production domain check
    if (window.location.hostname.includes('vercel.app')) {
      return 'https://order-management-fbre.onrender.com';
    }
    
    // Third priority: localhost check
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    
    // Default: production backend
    return 'https://order-management-fbre.onrender.com';
  };

  const API_URL = getApiUrl();

  // Enhanced fetch function with better error handling
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
      console.log(`🌐 Making request to: ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status} - ${errorText}`);
        
        // If 401, clear invalid token
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          setUser(null);
          setIsAuthenticated(false);
        }
        
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
  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    
    console.log('🔍 Checking auth - Token exists:', !!token);
    console.log('🔍 API URL being used:', API_URL);
    
    if (!token) {
      console.log('❌ No token found, user not authenticated');
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      console.log('🌐 Making auth check request to:', `${API_URL}/api/auth/me`);
      
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Auth response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Auth successful, user:', userData.username || userData.name);
        setUser(userData);
        setIsAuthenticated(true);
        setError(null);
      } else {
        const errorData = await response.text();
        console.log('❌ Auth failed:', response.status, errorData);
        
        // Clear invalid token
        localStorage.removeItem('authToken');
        setUser(null);
        setIsAuthenticated(false);
        setError('Authentication failed');
      }
    } catch (error) {
      console.error('❌ Auth check error:', error);
      localStorage.removeItem('authToken');
      setUser(null);
      setIsAuthenticated(false);
      setError('Network error during authentication');
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 Login attempt to:', `${API_URL}/api/auth/login`);
      
      const response = await fetch(`${API_URL}/api/auth/login`, {
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
        setError(null);
        return { success: true };
      } else {
        console.log('❌ Login failed:', data.message);
        setError(data.message || 'Login failed');
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      const errorMessage = 'Network error. Please check your connection and try again.';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    console.log('🚪 User logging out');
    localStorage.removeItem('authToken');
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  // Check auth on component mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isAuthenticated, // ✅ ADDED: Now properly included
    loading,
    error,
    login,
    logout,
    checkAuth,
    fetchWithAuth,
    API_URL
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};