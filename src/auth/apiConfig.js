// ✅ UNIVERSAL API URL HELPER - Use this in ALL components
// Create a new file: src/utils/apiConfig.js

export const getApiUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  const hostname = window.location.hostname;
  
  // More comprehensive localhost detection
  const isLocalhost = 
    hostname === 'localhost' || 
    hostname === '127.0.0.1' || 
    hostname.startsWith('192.168.') || 
    hostname.startsWith('10.') ||
    hostname.includes('local');
  
  console.log('🌐 API URL Detection:', {
    envUrl,
    hostname,
    isLocalhost,
    nodeEnv: process.env.NODE_ENV,
    origin: window.location.origin
  });
  
  // 1. If environment variable is set, use it (highest priority)
  if (envUrl && envUrl.trim()) {
    console.log('✅ Using REACT_APP_API_URL:', envUrl);
    return envUrl.trim();
  }
  
  // 2. For production/Vercel, always use cloud URL
  if (!isLocalhost || process.env.NODE_ENV === 'production') {
    const cloudUrl = 'https://order-management-fbre.onrender.com';
    console.log('☁️ Using cloud URL for production:', cloudUrl);
    return cloudUrl;
  }
  
  // 3. For localhost development
  if (isLocalhost) {
    console.log('🏠 Using localhost API URL');
    return 'http://localhost:5000';
  }
  
  // 4. Final fallback
  const fallbackUrl = 'https://order-management-fbre.onrender.com';
  console.log('⚠️ Using fallback URL:', fallbackUrl);
  return fallbackUrl;
};

// Universal API call function
export const apiCall = async (endpoint, options = {}) => {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}/api${endpoint}`;
  
  console.log('🔗 API Call:', {
    endpoint,
    fullUrl: url,
    method: options.method || 'GET'
  });
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const token = localStorage.getItem('authToken');
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }
  
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, finalOptions);
    
    console.log('📡 API Response:', {
      url,
      status: response.status,
      ok: response.ok
    });
    
    return response;
  } catch (error) {
    console.error('❌ API Call Error:', {
      url,
      error: error.message
    });
    throw error;
  }
};

// ========================================
// FIX FOR AuthContext.jsx
// ========================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiCall } from '../utils/apiConfig'; // Import the new helper

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔐 Checking authentication...');
        const token = localStorage.getItem('authToken');
        
        if (!token) {
          console.log('❌ No token found');
          setLoading(false);
          return;
        }

        console.log('🔍 Verifying token with backend...');
        const response = await apiCall('/auth/me');
        
        if (response.ok) {
          const userData = await response.json();
          console.log('✅ User authenticated:', userData);
          setUser(userData.user || userData);
        } else {
          console.log('❌ Token verification failed:', response.status);
          localStorage.removeItem('authToken');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Auth check error:', error);
        localStorage.removeItem('authToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      console.log('🔐 Attempting login...');
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Login successful:', data);
        
        localStorage.setItem('authToken', data.token);
        setUser(data.user);
        return { success: true };
      } else {
        const errorData = await response.json();
        console.log('❌ Login failed:', errorData);
        return { success: false, message: errorData.message };
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  };

  const logout = () => {
    console.log('🚪 Logging out...');
    localStorage.removeItem('authToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ========================================
// UPDATED OrderSummary.jsx fetchOrders function
// ========================================

import { getApiUrl, apiCall } from '../utils/apiConfig';

const fetchOrders = useCallback(async () => {
  try {
    console.log('🔍 OrderSummary - Starting fetchOrders...');
    setIsLoading(true);
    setError(null);
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('No authentication token found');
      return;
    }

    if (!user) {
      console.log('❌ User not available, skipping fetch');
      setError('User data not loaded');
      return;
    }

    console.log('✅ User data available:', {
      role: user.role,
      branchCode: user.branchCode,
      branch: user.branch
    });

    // Build the correct endpoint path (without base URL)
    let endpointPath;
    if (isAdmin) {
      if (filters.branch) {
        endpointPath = `/orders/${filters.branch.toLowerCase()}`;
      } else {
        endpointPath = `/orders/all`;
      }
    } else {
      if (!user.branchCode) {
        setError('User branch code not available');
        return;
      }
      endpointPath = `/orders/${user.branchCode.toLowerCase()}`;
    }
    
    // Prepare query parameters
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim() && key !== 'branch') {
        if (key === 'startDate') {
          queryParams.append('orderDate', `>=${value}`);
        } else if (key === 'endDate') {
          queryParams.append('orderDate', `<=${value}`);
        } else {
          queryParams.append(key, value.trim());
        }
      }
    });
    
    const fullEndpoint = queryParams.toString() ? 
      `${endpointPath}?${queryParams.toString()}` : 
      endpointPath;
    
    console.log('🔗 Calling API endpoint:', fullEndpoint);
    
    const response = await apiCall(fullEndpoint);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    const ordersData = await response.json();
    console.log('📊 Orders data received:', {
      type: Array.isArray(ordersData) ? 'array' : 'object',
      count: Array.isArray(ordersData) ? ordersData.length : ordersData?.orders?.length || 0
    });
    
    // Process orders data
    let processedOrders = [];
    if (Array.isArray(ordersData)) {
      processedOrders = ordersData.filter(order => 
        order._id && order.customerName && order.customerName.trim() !== ''
      );
    } else if (ordersData && Array.isArray(ordersData.orders)) {
      processedOrders = ordersData.orders.filter(order => 
        order._id && order.customerName && order.customerName.trim() !== ''
      );
    }
    
    console.log('✅ Processed orders:', processedOrders.length);
    setOrders(processedOrders);
    
  } catch (err) {
    console.error('❌ OrderSummary fetch error:', err);
    setError(`Failed to fetch orders: ${err.message}`);
    setOrders([]);
  } finally {
    setIsLoading(false);
  }
}, [filters, isAdmin, user]);

// ========================================
// UPDATED fetchMasterData for OrderSummary
// ========================================

useEffect(() => {
  const fetchMasterData = async () => {
    try {
      console.log('🔍 OrderSummary - Fetching master data...');
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        setError('No authentication token found');
        return;
      }
      
      // Fetch branches (only for admin)
      if (isAdmin) {
        console.log('🏢 Fetching branches for admin...');
        const branchesResponse = await apiCall('/branches');
        
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          const branchesObj = {};
          if (Array.isArray(branchesData)) {
            branchesData.forEach(branch => {
              branchesObj[branch.branchCode] = branch.branchName;
            });
          }
          setBranches(branchesObj);
          console.log('✅ Branches loaded:', Object.keys(branchesObj).length);
        } else {
          console.warn('⚠️ Branches fetch failed:', branchesResponse.status);
        }
      }
      
      // Fetch occasions
      console.log('🎉 Fetching occasions...');
      const occasionsResponse = await apiCall('/occasions');
      
      if (occasionsResponse.ok) {
        const occasionsData = await occasionsResponse.json();
        if (Array.isArray(occasionsData)) {
          const occasionNames = occasionsData.map(occ => occ.name);
          setOccasions(occasionNames);
          console.log('✅ Occasions loaded:', occasionNames.length);
        }
      } else {
        console.warn('⚠️ Occasions fetch failed:', occasionsResponse.status);
      }
      
    } catch (error) {
      console.error('❌ Master data fetch error:', error);
      setError(`Error fetching master data: ${error.message}`);
    }
  };
  
  // Only fetch if user is available
  if (user) {
    fetchMasterData();
  } else {
    console.log('⏳ Waiting for user data...');
  }
}, [isAdmin, user]);