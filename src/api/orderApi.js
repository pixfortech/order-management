// src/api/orderApi.js
// Better API URL handling for different environments
const getApiUrl = () => {
  // Check if we have an environment variable
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Fallback based on current environment
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:5000';
  }
  
  // For production, use your actual backend URL
  return 'https://order-management-fbre.onrender.com'; // Your actual Render backend URL
};

const API_BASE = `${getApiUrl()}/api`;

const getAuthToken = () => {
  // For cloud deployment, still use localStorage but with fallback
  try {
    return localStorage.getItem('authToken');
  } catch (error) {
    console.warn('localStorage not available:', error);
    return null;
  }
};

const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const token = getAuthToken();
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
  
  console.log('🔗 API Call to:', url); // Debug log
  
  return await fetch(url, finalOptions);
};

export const saveOrder = async (orderData, editingOrderId = null) => {
  try {
    // Use the branchCode from orderData to determine which collection to save to
    const branchCode = orderData.branchCode.toLowerCase();
    
    console.log('💾 Saving order to branch collection:', `orders_${branchCode}`);
    console.log('📊 Order data branch:', orderData.branch);
    console.log('🏷️ Order data branchCode:', orderData.branchCode);
    
    if (editingOrderId) {
      // Update existing order
      const response = await apiCall(`/orders/${branchCode}/${editingOrderId}`, {
        method: 'PUT',
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } else {
      // Create new order
      const response = await apiCall(`/orders/${branchCode}`, {
        method: 'POST',
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    }
  } catch (error) {
    console.error('Save order error:', error);
    throw error;
  }
};