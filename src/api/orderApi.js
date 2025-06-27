// src/api/orderApi.js
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    console.log('🌐 Using environment API URL:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }

  if (window.location.hostname === 'localhost') {
    console.log('🏠 Using localhost API URL');
    return 'http://localhost:5000';
  }

  const renderUrl = 'https://order-management-fbre.onrender.com';
  console.log('☁️ Using Render URL:', renderUrl);
  return renderUrl;
};

const API_BASE = `${getApiUrl()}/api`;

const getAuthToken = () => {
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

  console.log('🔗 API Call to:', url);

  try {
    const response = await fetch(url, finalOptions);
    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
    }

    return response;
  } catch (error) {
    console.error('❌ Network error:', error);
    throw error;
  }
};

export const saveOrder = async (orderData, editingOrderId = null) => {
  try {
    console.log('🔍 === FRONTEND API DEBUG ===');
    console.log('📊 Order data branchCode:', orderData.branchCode);
    console.log('📊 Order data branch:', orderData.branch);
    console.log('📊 Is draft:', orderData.isDraft);
    console.log('🔍 === END FRONTEND DEBUG ===');

    const branchCode = orderData.branchCode ? orderData.branchCode.toLowerCase() : '';
    if (!branchCode) throw new Error('Branch code is missing from order data');

    // Ensure balancePaid field is present
    const finalOrderData = {
      ...orderData,
      balancePaid: orderData.balancePaid !== undefined ? orderData.balancePaid : 0,
    };

    console.log('💾 Saving order to branch collection:', `orders_${branchCode}`);
    console.log('🔗 API endpoint will be:', `/orders/${branchCode}`);

    const endpoint = editingOrderId
      ? `/orders/${branchCode}/${editingOrderId}`
      : `/orders/${branchCode}`;

    const method = editingOrderId ? 'PUT' : 'POST';

    const response = await apiCall(endpoint, {
      method,
      body: JSON.stringify(finalOrderData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error(`❌ ${method === 'POST' ? 'Save' : 'Update'} order error response:`, errorData);
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Save order error:', error);
    throw error;
  }
};
