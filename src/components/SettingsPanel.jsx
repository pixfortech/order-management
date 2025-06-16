import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import './SettingsPanel.css';
import './theme.css';

const SettingsPanel = () => {
  const { user } = useAuth();

  // ✅ ENHANCED API URL HELPER FUNCTION
  const getApiUrl = () => {
    // 1. Check for environment variable first (highest priority)
    if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== 'auto') {
      return process.env.REACT_APP_API_URL.trim();
    }
    
    // 2. Auto-detect based on hostname
    const hostname = window.location.hostname;
    
    // Localhost detection
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    
    // Local network detection (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') || 
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
      return `http://${hostname}:5000`;
    }
    
    // 3. Production fallback
    return 'https://order-management-fbre.onrender.com';
  };

  // ===== ALL STATE VARIABLES FIRST =====
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [message, setMessage] = useState('');
  const [currentUser, setCurrentUser] = useState({
    id: null,
    username: null,
    branch: 'Loading...',
    branchCode: null,
    role: 'staff',
    displayName: null
  });

  // Pagination States
  const [usersPagination, setUsersPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0
  });
  const [itemsPagination, setItemsPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0
  });
  const [occasionsPagination, setOccasionsPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0
  });

  // Brand Details State
  const [brandDetails, setBrandDetails] = useState({
    name: '',
    displayName: '',
    address: '',
    gst: '',
    email: '',
    phone: '',
    logo: null
  });
  const [originalBrandDetails, setOriginalBrandDetails] = useState({});
  
  // Customers Management State
const [customers, setCustomers] = useState([]);
const [customersPagination, setCustomersPagination] = useState({
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0
});
const [newCustomer, setNewCustomer] = useState({
  name: '',
  phone: '',
  email: '',
  address: '',
  branch: currentUser.role === 'admin' ? '' : currentUser.branch
});
const [editingCustomerId, setEditingCustomerId] = useState(null);
const [selectedCustomer, setSelectedCustomer] = useState(null);
const [customerOrders, setCustomerOrders] = useState([]);
const [customerStats, setCustomerStats] = useState({
  totalOrders: 0,
  distinctBoxes: 0,
  totalBoxes: 0,
  totalAmount: 0
});

  // Theme State
  const [themeColor, setThemeColor] = useState('#49488D');
  const [originalThemeColor, setOriginalThemeColor] = useState('#49488D');

  // Users Management State
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState({});
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    branch: '', 
    role: 'staff',
    displayName: ''
  });
  const [editingUserId, setEditingUserId] = useState(null);

  // Items Management State
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    price: '', 
    unit: 'pcs', 
    vendor: '',
    category: 'General'
  });
  const [editingItemId, setEditingItemId] = useState(null);

  // Occasions Management State
  const [occasions, setOccasions] = useState([]);
  const [newOccasion, setNewOccasion] = useState({
    name: '',
    code: ''
  });
  const [editingOccasionId, setEditingOccasionId] = useState(null);

  // Logo Upload State
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Validation State
  const [validationErrors, setValidationErrors] = useState({});
  
  // ===== HELPER FUNCTIONS =====
  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setTimeout(() => setMessage(''), 5000);
  };

  // Pagination helper functions
  const getPaginatedData = (data, pagination) => {
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems, itemsPerPage) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const handlePageChange = (type, newPage) => {
  if (type === 'users') {
    setUsersPagination(prev => ({ ...prev, currentPage: newPage }));
  } else if (type === 'items') {
    setItemsPagination(prev => ({ ...prev, currentPage: newPage }));
  } else if (type === 'occasions') {
    setOccasionsPagination(prev => ({ ...prev, currentPage: newPage }));
  } else if (type === 'customers') {
    setCustomersPagination(prev => ({ ...prev, currentPage: newPage }));
  }
};

  const handleItemsPerPageChange = (type, itemsPerPage) => {
  if (type === 'users') {
    setUsersPagination(prev => ({ ...prev, itemsPerPage: parseInt(itemsPerPage), currentPage: 1 }));
  } else if (type === 'items') {
    setItemsPagination(prev => ({ ...prev, itemsPerPage: parseInt(itemsPerPage), currentPage: 1 }));
  } else if (type === 'occasions') {
    setOccasionsPagination(prev => ({ ...prev, itemsPerPage: parseInt(itemsPerPage), currentPage: 1 }));
  } else if (type === 'customers') {
    setCustomersPagination(prev => ({ ...prev, itemsPerPage: parseInt(itemsPerPage), currentPage: 1 }));
  }
};

  const normalizeBranchName = (branch, availableBranches = {}) => {
    if (!branch) return Object.keys(availableBranches)[0] || 'Head Office';
    
    // First, check if branch exists directly
    if (availableBranches[branch]) return branch;
    
    // Create a mapping for common branch name variations
    const branchMap = {};
    Object.keys(availableBranches).forEach(branchName => {
      branchMap[branchName.toLowerCase()] = branchName;
      branchMap[branchName.toLowerCase().replace(/\s/g, '')] = branchName;
      branchMap[branchName.toLowerCase().replace(/\s+/g, '-')] = branchName;
      branchMap[branchName.toLowerCase().replace(/\s+/g, '_')] = branchName;
    });
    
    // Try normalized versions
    const normalized = branchMap[branch.toLowerCase()] || 
                      branchMap[branch.toLowerCase().replace(/\s/g, '')] ||
                      branch;
    
    return normalized;
  };

  const isValidBranch = (branch, availableBranches = {}) => {
    if (!branch || !availableBranches) return false;
    
    const normalizedBranch = normalizeBranchName(branch, availableBranches);
    return Object.keys(availableBranches).includes(normalizedBranch);
  };

  const validateBrandDetails = () => {
  const errors = {};
  
  if (!brandDetails.name?.trim()) errors.name = 'Brand name is required';
  if (!brandDetails.displayName?.trim()) errors.displayName = 'Display name is required';
  
  // Phone validation - must be exactly 10 digits
  if (!brandDetails.phone?.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!/^[0-9]{10}$/.test(brandDetails.phone.trim())) {
    errors.phone = 'Phone number must be exactly 10 digits';
  }
  
  // Email validation
  if (brandDetails.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brandDetails.email)) {
    errors.email = 'Invalid email format';
  }
  
  setValidationErrors(errors);
  return Object.keys(errors).length === 0;
};

  const validateUser = () => {
    const errors = {};
    
    if (!newUser.username?.trim()) errors.username = 'Username is required';
    if (!newUser.password?.trim() && !editingUserId) errors.password = 'Password is required';
    if (!newUser.branch?.trim()) errors.branch = 'Branch is required';
    if (!newUser.displayName?.trim()) errors.displayName = 'Display name is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateItem = () => {
    const errors = {};
    
    if (!newItem.name?.trim()) errors.itemName = 'Item name is required';
    if (!newItem.price || isNaN(newItem.price) || newItem.price <= 0) errors.itemPrice = 'Valid price is required';
    if (!newItem.vendor?.trim()) errors.itemVendor = 'Vendor is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateOccasion = () => {
    const errors = {};
    
    if (!newOccasion.name?.trim()) errors.occasionName = 'Occasion name is required';
    if (!newOccasion.code?.trim()) errors.occasionCode = 'Occasion code is required';
    if (newOccasion.code && newOccasion.code.length !== 3) errors.occasionCode = 'Code must be exactly 3 characters';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const validateCustomer = () => {
    const errors = {};
    
    if (!newCustomer.name?.trim()) errors.customerName = 'Customer name is required';
    
    // Phone validation - must be exactly 10 digits
    if (!newCustomer.phone?.trim()) {
      errors.customerPhone = 'Phone number is required';
    } else if (!/^[0-9]{10}$/.test(newCustomer.phone.trim())) {
      errors.customerPhone = 'Phone number must be exactly 10 digits';
    }
    
    // Email validation (optional)
    if (newCustomer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email)) {
      errors.customerEmail = 'Invalid email format';
    }
    
    if (!newCustomer.branch?.trim()) errors.customerBranch = 'Branch is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // ===== API FUNCTIONS =====

  // Replace the fetchMasterData function in SettingsPanel.jsx with this:

const fetchMasterData = async () => {
  try {
    setIsLoadingData(true);
    const token = localStorage.getItem('authToken');

    console.log('🔍 Fetching settings data...');

    // ✅ HELPER FUNCTION FOR API URL
    const getApiUrl = () => {
      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      return isLocalhost ? 'http://localhost:5000' : 'https://order-management-fbre.onrender.com';
    };

    const apiUrl = getApiUrl();
    console.log('🌐 Using API URL:', apiUrl);

    // Fetch branches first to have the mapping available
    try {
      console.log('🏢 Fetching branches...');
      const branchesResponse = await fetch(`${apiUrl}/api/branches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (branchesResponse.ok) {
        const contentType = branchesResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const branchesData = await branchesResponse.json();
          console.log('🏢 Raw branches data:', branchesData);
          
          const branchesObj = {};
          if (Array.isArray(branchesData)) {
            branchesData.forEach(branch => {
              branchesObj[branch.branchName] = branch.branchCode;
            });
          }
          
          console.log('🏢 Processed branches object:', branchesObj);
          setBranches(branchesObj);
        } else {
          console.warn('⚠️ Branches API returned non-JSON response');
          setBranches({});
        }
      } else {
        console.warn('⚠️ Branches API response not OK:', branchesResponse.status);
        setBranches({});
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch branches:', error);
      setBranches({});
    }

    // Fetch user profile
    console.log('👤 Fetching user profile...');
    try {
      const userResponse = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (userResponse.ok) {
        const contentType = userResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const userDataResponse = await userResponse.json();
          const userData = userDataResponse.user || userDataResponse;
          
          console.log('👤 Raw user data:', userData);
          
          // Get the branch name - try different possible field names
          const userBranchName = userData.branchName || 
                                userData.branch || 
                                userData.branchId || 
                                'Head Office';
          
          console.log('🏢 User branch from API:', userBranchName);
          
          setCurrentUser({
            id: userData.id || userData._id,
            username: userData.username,
            branch: userBranchName,
            branchCode: userData.branchCode,
            role: userData.role,
            displayName: userData.displayName || userData.username
          });
        } else {
          console.warn('⚠️ User API returned non-JSON response');
        }
      } else {
        console.warn('⚠️ User API response not OK:', userResponse.status);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch user data:', error);
    }

    // Fetch brand details
    try {
      console.log('🏷️ Fetching brand details...');
      const brandResponse = await fetch(`${apiUrl}/api/brand`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (brandResponse.ok) {
        const contentType = brandResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const brandData = await brandResponse.json();
          console.log('🏷️ Brand data:', brandData);
          setBrandDetails(brandData);
          setOriginalBrandDetails(brandData);
          if (brandData.logo) {
            setLogoPreview(brandData.logo);
          }
        } else {
          console.warn('⚠️ Brand API returned non-JSON response');
          setBrandDetails({ displayName: 'Brand', name: 'Brand' });
        }
      } else {
        console.warn('⚠️ Brand API response not OK:', brandResponse.status);
        setBrandDetails({ displayName: 'Brand', name: 'Brand' });
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch brand data:', error);
      setBrandDetails({ displayName: 'Brand', name: 'Brand' });
    }

    // Fetch theme settings
    try {
      console.log('🎨 Fetching theme settings...');
      const themeResponse = await fetch(`${apiUrl}/api/theme`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (themeResponse.ok) {
        const themeData = await themeResponse.json();
        console.log('🎨 Theme data:', themeData);
        setThemeColor(themeData.color || '#49488D');
        setOriginalThemeColor(themeData.color || '#49488D');
        document.documentElement.style.setProperty('--theme-color', themeData.color || '#49488D');
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch theme data:', error);
    }

    // Fetch users (for all roles, but show management options only for admin)
    try {
      console.log('👥 Fetching users...');
      const usersResponse = await fetch(`${apiUrl}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        console.log('👥 Users data:', usersData);
        setUsers(usersData || []);
        setUsersPagination(prev => ({ ...prev, totalItems: (usersData || []).length }));
      } else {
        console.warn('⚠️ Users API response not OK:', usersResponse.status);
        setUsers([]);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch users:', error);
      setUsers([]);
    }

    // Fetch items
    try {
      console.log('📦 Fetching items...');
      const itemsResponse = await fetch(`${apiUrl}/api/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        console.log('📦 Items data length:', itemsData.length);
        setItems(itemsData || []);
        setItemsPagination(prev => ({ ...prev, totalItems: (itemsData || []).length }));
      } else {
        console.warn('⚠️ Items API response not OK:', itemsResponse.status);
        setItems([]);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch items:', error);
      setItems([]);
    }

    // Fetch occasions
    try {
      console.log('🎉 Fetching occasions...');
      const occasionsResponse = await fetch(`${apiUrl}/api/occasions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (occasionsResponse.ok) {
        const occasionsData = await occasionsResponse.json();
        console.log('🎉 Occasions data:', occasionsData);
        setOccasions(occasionsData || []);
        setOccasionsPagination(prev => ({ ...prev, totalItems: (occasionsData || []).length }));
      } else {
        console.warn('⚠️ Occasions API response not OK:', occasionsResponse.status);
        setOccasions([]);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch occasions:', error);
      setOccasions([]);
    }

    // Fetch customers
    try {
      console.log('👥 Fetching customers...');
      let customersUrl = `${apiUrl}/api/customers`;
      
      // For non-admin users, fetch only their branch customers
      if (currentUser.role !== 'admin' && currentUser.branch) {
        const branchCode = branches[currentUser.branch];
        if (branchCode) {
          customersUrl += `?branch=${branchCode}`;
        }
      }
      
      const customersResponse = await fetch(customersUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        console.log('👥 Customers data:', customersData);
        setCustomers(customersData || []);
        setCustomersPagination(prev => ({ ...prev, totalItems: (customersData || []).length }));
      } else {
        console.warn('⚠️ Customers API response not OK:', customersResponse.status);
        setCustomers([]);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch customers:', error);
      setCustomers([]);
    }

    console.log('✅ Settings data fetch completed');
    setIsLoadingData(false);
    
    // If no branches were loaded, use fallback data for development
    if (Object.keys(branches).length === 0) {
      console.log('🔧 Using fallback branch data for development');
      const fallbackBranches = {
        'Head Office': 'HO',
        'Misti Hub': 'MH',
        'Chowringhee': 'CW',
        'Beadon Street': 'BS',
        'Baranagar': 'BN'
      };
      setBranches(fallbackBranches);
    }
    
    // If no current user branch set, use Head Office
    if (!currentUser.branch || currentUser.branch === 'Loading...') {
      setCurrentUser(prev => ({
        ...prev,
        branch: 'Head Office',
        role: 'admin',
        displayName: 'System Administrator',
        username: 'admin'
      }));
    }
    
  } catch (error) {
    console.error('❌ Error fetching settings data:', error);
    showMessage('⚠️ Failed to load settings data. Using fallback data for development.', 'error');
    setIsLoadingData(false);
    
    // Set fallback data
    setBranches({
      'Head Office': 'HO',
      'Misti Hub': 'MH',
      'Chowringhee': 'CH',
      'Beadon Street': 'BD',
      'Baranagar': 'BN',
	  'Ariadaha': 'AR'
    });
    setCurrentUser({
      id: 'fallback-user',
      username: 'admin',
      branch: 'Head Office',
      branchCode: 'HO',
      role: 'admin',
      displayName: 'System Administrator'
    });
    setBrandDetails({ displayName: 'Brand Name', name: 'Brand' });
  }
};
  
  // Replace your saveBrandDetails function with this enhanced version:

// Replace your saveBrandDetails function in SettingsPanel.jsx with this:

const saveBrandDetails = async () => {
  if (!validateBrandDetails()) {
    showMessage('❌ Please correct the errors before saving.', 'error');
    return;
  }

  try {
    const token = localStorage.getItem('authToken');
    console.log('💾 Saving brand details:', brandDetails);
    
    const response = await fetch(`${getApiUrl()}/api/brand`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(brandDetails)
    });

    console.log('📡 Brand save response status:', response.status);

    if (response.ok) {
      const updatedBrand = await response.json();
      console.log('✅ Brand updated:', updatedBrand);
      setBrandDetails(updatedBrand);
      setOriginalBrandDetails(updatedBrand);
      
      showMessage('✅ Brand details saved successfully! Header will update momentarily.', 'success');
      
      // Trigger a custom event to notify MainLayout to update header
      window.dispatchEvent(new CustomEvent('brandUpdated', { 
        detail: updatedBrand 
      }));
      
      // Clear validation errors after successful save
      setValidationErrors({});
      
    } else {
      const errorText = await response.text();
      console.error('❌ Brand save error response:', errorText);
      throw new Error(`Failed to save brand details: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Error saving brand details:', error);
    showMessage(`❌ Failed to save brand details: ${error.message}`, 'error');
  }
};

  const saveThemeColor = async () => {
    try {
      const token = localStorage.getItem('authToken');
      console.log('🎨 Saving theme color:', themeColor);
      
      const response = await fetch(`${getApiUrl()}/api/theme`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ color: themeColor })
      });

      console.log('📡 Theme save response status:', response.status);

      if (response.ok) {
        setOriginalThemeColor(themeColor);
        document.documentElement.style.setProperty('--theme-color', themeColor);
        showMessage('✅ Theme color saved successfully!', 'success');
        
        // Trigger a custom event to notify other components
        window.dispatchEvent(new CustomEvent('themeUpdated', { detail: { color: themeColor } }));
      } else {
        const errorText = await response.text();
        console.error('❌ Theme save error response:', errorText);
        throw new Error(`Failed to save theme color: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error saving theme color:', error);
      showMessage(`❌ Failed to save theme color: ${error.message}`, 'error');
    }
  };

  const saveUser = async () => {
    if (!validateUser()) {
      showMessage('❌ Please correct the errors before saving.', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const method = editingUserId ? 'PUT' : 'POST';
      const url = editingUserId 
        ? `${getApiUrl()}/api/users/${editingUserId}`
        : `${getApiUrl()}/api/users`;

      const userData = { ...newUser };
      if (editingUserId && !userData.password) {
        delete userData.password; // Don't update password if not provided
      }

      console.log('👤 Saving user:', userData);

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      console.log('📡 User save response status:', response.status);

      if (response.ok) {
        const savedUser = await response.json();
        console.log('✅ User saved:', savedUser);
        
        if (editingUserId) {
          setUsers(users.map(u => u._id === editingUserId ? savedUser : u));
          showMessage('✅ User updated successfully!', 'success');
          setEditingUserId(null);
        } else {
          setUsers([...users, savedUser]);
          showMessage('✅ User created successfully!', 'success');
        }
        
        setNewUser({ username: '', password: '', branch: '', role: 'staff', displayName: '' });
        setValidationErrors({});
      } else {
        const errorData = await response.json();
        console.error('❌ User save error:', errorData);
        throw new Error(errorData.message || 'Failed to save user');
      }
    } catch (error) {
      console.error('❌ Error saving user:', error);
      showMessage(`❌ ${error.message}`, 'error');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${getApiUrl()}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setUsers(users.filter(u => u._id !== userId));
        showMessage('✅ User deleted successfully!', 'success');
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      showMessage('❌ Failed to delete user. Please try again.', 'error');
    }
  };
  
  const saveItem = async () => {
    if (!validateItem()) {
      showMessage('❌ Please correct the errors before saving.', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const method = editingItemId ? 'PUT' : 'POST';
      const url = editingItemId 
        ? `${getApiUrl()}/api/items/${editingItemId}`
        : `${getApiUrl()}/api/items`;

      console.log('📦 Saving item:', newItem);

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newItem)
      });

      if (response.ok) {
        const savedItem = await response.json();
        
        if (editingItemId) {
          setItems(items.map(i => i._id === editingItemId ? savedItem : i));
          showMessage('✅ Item updated successfully!', 'success');
          setEditingItemId(null);
        } else {
          setItems([...items, savedItem]);
          showMessage('✅ Item created successfully!', 'success');
        }
        
        setNewItem({ name: '', price: '', unit: 'pcs', vendor: '', category: 'General' });
        setValidationErrors({});
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to save item: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error saving item:', error);
      showMessage(`❌ Failed to save item: ${error.message}`, 'error');
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${getApiUrl()}/api/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setItems(items.filter(i => i._id !== itemId));
        showMessage('✅ Item deleted successfully!', 'success');
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (error) {
      console.error('❌ Error deleting item:', error);
      showMessage('❌ Failed to delete item. Please try again.', 'error');
    }
  };

  const saveOccasion = async () => {
    if (!validateOccasion()) {
      showMessage('❌ Please correct the errors before saving.', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const method = editingOccasionId ? 'PUT' : 'POST';
      const url = editingOccasionId 
        ? `${getApiUrl()}/api/occasions/${editingOccasionId}`
        : `${getApiUrl()}/api/occasions`;

      console.log('🎉 Saving occasion:', newOccasion);

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newOccasion)
      });

      if (response.ok) {
        const savedOccasion = await response.json();
        
        if (editingOccasionId) {
          setOccasions(occasions.map(o => o._id === editingOccasionId ? savedOccasion : o));
          showMessage('✅ Occasion updated successfully!', 'success');
          setEditingOccasionId(null);
        } else {
          setOccasions([...occasions, savedOccasion]);
          showMessage('✅ Occasion created successfully!', 'success');
        }
        
        setNewOccasion({ name: '', code: '' });
        setValidationErrors({});
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to save occasion: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error saving occasion:', error);
      showMessage(`❌ Failed to save occasion: ${error.message}`, 'error');
    }
  };

  const deleteOccasion = async (occasionId) => {
    if (!window.confirm('Are you sure you want to delete this occasion?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${getApiUrl()}/api/occasions/${occasionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setOccasions(occasions.filter(o => o._id !== occasionId));
        showMessage('✅ Occasion deleted successfully!', 'success');
      } else {
        throw new Error('Failed to delete occasion');
      }
    } catch (error) {
      console.error('❌ Error deleting occasion:', error);
      showMessage('❌ Failed to delete occasion. Please try again.', 'error');
    }
  };
  
  const fetchCustomers = async () => {
  try {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      console.error('❌ No authentication token found');
      setCustomers([]);
      return;
    }
    
    console.log('👥 Fetching customers...');
    
    let url = `${window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://order-management-fbre.onrender.com'}/api/customers`;
    
    // For non-admin users, fetch only their branch customers
    if (currentUser.role !== 'admin' && currentUser.branch && Object.keys(branches).length > 0) {
      const branchCode = branches[currentUser.branch];
      if (branchCode) {
        url += `?branch=${branchCode}`;
      }
    }
    
    console.log('🔗 Fetching from URL:', url);
    console.log('🔑 Using token:', token ? 'Token present' : 'No token');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const customersData = await response.json();
      console.log('👥 Customers data received:', customersData);
      console.log('👥 Customers count:', customersData?.length || 0);
      setCustomers(customersData || []);
      setCustomersPagination(prev => ({ ...prev, totalItems: (customersData || []).length }));
    } else {
      console.error('⚠️ Customers API response not OK:', response.status);
      const errorText = await response.text();
      console.error('⚠️ Error details:', errorText);
      setCustomers([]);
    }
  } catch (error) {
    console.error('⚠️ Failed to fetch customers:', error);
    setCustomers([]);
  }
};

  const saveCustomer = async () => {
  if (!validateCustomer()) {
    showMessage('❌ Please correct the errors before saving.', 'error');
    return;
  }

  try {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      showMessage('❌ Authentication required. Please log in again.', 'error');
      return;
    }
    
    const method = editingCustomerId ? 'PUT' : 'POST';
    const url = editingCustomerId 
      ? `${getApiUrl()}/api/customers/${editingCustomerId}`
      : `${getApiUrl()}/api/customers`;

    const customerData = { 
      ...newCustomer,
      branchCode: branches[newCustomer.branch]
    };

    console.log('👥 Saving customer:', customerData);

    const response = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customerData)
    });

    if (response.ok) {
      const savedCustomer = await response.json();
      
      if (editingCustomerId) {
        setCustomers(customers.map(c => c._id === editingCustomerId ? savedCustomer : c));
        showMessage('✅ Customer updated successfully!', 'success');
        setEditingCustomerId(null);
      } else {
        setCustomers([...customers, savedCustomer]);
        showMessage('✅ Customer created successfully!', 'success');
      }
      
      setNewCustomer({
        name: '',
        phone: '',
        email: '',
        address: '',
        branch: currentUser.role === 'admin' ? '' : currentUser.branch
      });
      setValidationErrors({});
    } else {
      const errorText = await response.text();
      throw new Error(`Failed to save customer: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Error saving customer:', error);
    showMessage(`❌ Failed to save customer: ${error.message}`, 'error');
  }
};

  const deleteCustomer = async (customerId) => {
  if (!window.confirm('Are you sure you want to delete this customer?')) return;

  try {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      showMessage('❌ Authentication required. Please log in again.', 'error');
      return;
    }
    
    const response = await fetch(`${getApiUrl()}/api/customers/${customerId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      setCustomers(customers.filter(c => c._id !== customerId));
      showMessage('✅ Customer deleted successfully!', 'success');
    } else {
      throw new Error('Failed to delete customer');
    }
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    showMessage('❌ Failed to delete customer. Please try again.', 'error');
  }
};

  const fetchCustomerDetails = async (customerId) => {
  try {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      showMessage('❌ Authentication required. Please log in again.', 'error');
      return;
    }
    
    console.log('📊 Fetching customer details for:', customerId);
    
    const response = await fetch(`${getApiUrl()}/api/customers/${customerId}/details`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const customerData = await response.json();
      console.log('📊 Raw customer details received:', customerData);
      console.log('📋 Orders array:', customerData.orders);
      console.log('📊 Raw stats object:', customerData.stats);
      
      // Debug the specific stats values
      console.log('🔍 Stats breakdown:');
      console.log('  - totalOrders:', customerData.stats?.totalOrders);
      console.log('  - distinctBoxes:', customerData.stats?.distinctBoxes);
      console.log('  - totalBoxes:', customerData.stats?.totalBoxes);
      console.log('  - totalAmount:', customerData.stats?.totalAmount);
      console.log('  - totalAmount type:', typeof customerData.stats?.totalAmount);
      
      // Create the stats object with debugging
      const newStats = {
        totalOrders: customerData.stats?.totalOrders || 0,
        distinctBoxes: customerData.stats?.distinctBoxes || 0,
        totalBoxes: customerData.stats?.totalBoxes || 0,
        totalAmount: customerData.stats?.totalAmount || 0
      };
      
      console.log('💾 Setting customerStats to:', newStats);
      console.log('💰 Final totalAmount value:', newStats.totalAmount);
      console.log('💰 Final totalAmount type:', typeof newStats.totalAmount);
      
      setCustomerOrders(customerData.orders || []);
      setCustomerStats(newStats);
      
      // Debug what was actually set
      setTimeout(() => {
        console.log('✅ CustomerStats state after setting:', customerStats);
      }, 100);
      
    } else {
      throw new Error('Failed to fetch customer details');
    }
  } catch (error) {
    console.error('❌ Error fetching customer details:', error);
    showMessage('❌ Failed to fetch customer details.', 'error');
  }
};
  
  // ===== EVENT HANDLERS =====
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showMessage('❌ Image size should be less than 5MB', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setLogoPreview(base64String);
        setBrandDetails({
          ...brandDetails,
          logo: base64String
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditUser = (user) => {
    setNewUser({
      username: user.username,
      password: '', // Don't prefill password
      branch: user.branchName || user.branch,
      role: user.role,
      displayName: user.displayName || user.username
    });
    setEditingUserId(user._id);
    setValidationErrors({});
  };

  const handleEditItem = (item) => {
    setNewItem({
      name: item.name,
      price: item.price,
      unit: item.unit,
      vendor: item.vendor,
      category: item.category || 'General'
    });
    setEditingItemId(item._id);
    setValidationErrors({});
  };

  const handleEditOccasion = (occasion) => {
    setNewOccasion({
      name: occasion.name,
      code: occasion.code
    });
    setEditingOccasionId(occasion._id);
    setValidationErrors({});
  };
  
  const handleEditCustomer = (customer) => {
    setNewCustomer({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      branch: customer.branchName || customer.branch
    });
    setEditingCustomerId(customer._id);
    setValidationErrors({});
  };

  const handleCustomerClick = async (customer) => {
    setSelectedCustomer(customer);
    await fetchCustomerDetails(customer._id);
  };

  const closeCustomerDetails = () => {
  setSelectedCustomer(null);
  setCustomerOrders([]);
  setCustomerStats({
    totalOrders: 0,
    distinctBoxes: 0,
    totalBoxes: 0,
    totalAmount: 0
  });
};

  const cancelEdit = () => {
  setNewUser({ username: '', password: '', branch: '', role: 'staff', displayName: '' });
  setNewItem({ name: '', price: '', unit: 'pcs', vendor: '', category: 'General' });
  setNewOccasion({ name: '', code: '' });
  setNewCustomer({
    name: '',
    phone: '',
    email: '',
    address: '',
    branch: currentUser.role === 'admin' ? '' : currentUser.branch
  });
  setEditingUserId(null);
  setEditingItemId(null);
  setEditingOccasionId(null);
  setEditingCustomerId(null);
  setValidationErrors({});
};
  
  // ===== EFFECTS =====
  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    document.title = `Settings - ${brandDetails.displayName || 'Brand'} Order Management`;
  }, [brandDetails.displayName]);

  // Update current user branch when branches are loaded
  useEffect(() => {
    if (Object.keys(branches).length > 0 && currentUser.branch && currentUser.branch !== 'Loading...') {
      const normalizedBranch = normalizeBranchName(currentUser.branch, branches);
      if (normalizedBranch !== currentUser.branch) {
        console.log('🏢 Normalizing branch from:', currentUser.branch, 'to:', normalizedBranch);
        setCurrentUser(prev => ({
          ...prev,
          branch: normalizedBranch
        }));
      }
    }
  }, [branches, currentUser.branch]);
  
  // Update newCustomer branch when currentUser changes
useEffect(() => {
  if (currentUser.role !== 'admin' && currentUser.branch) {
    setNewCustomer(prev => ({
      ...prev,
      branch: currentUser.branch
    }));
  }
}, [currentUser.role, currentUser.branch]);
  
  // ===== RENDER =====
  
  // Pagination Component
  const PaginationComponent = ({ type, data, pagination, children }) => {
    const totalPages = getTotalPages(pagination.totalItems, pagination.itemsPerPage);
    const paginatedData = getPaginatedData(data, pagination);
    
    const renderPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            className={`pagination-button ${i === pagination.currentPage ? 'active' : ''}`}
            onClick={() => handlePageChange(type, i)}
          >
            {i}
          </button>
        );
      }
      return pages;
    };
    
    return (
      <div>
        {children(paginatedData)}
        
        {pagination.totalItems > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
              {pagination.totalItems} entries
            </div>
            
            <div className="pagination-controls">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Show:</span>
                <select
                  className="pagination-select"
                  value={pagination.itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(type, e.target.value)}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              
              <div className="pagination-buttons">
                <button
                  className="pagination-button"
                  onClick={() => handlePageChange(type, 1)}
                  disabled={pagination.currentPage === 1}
                >
                  First
                </button>
                <button
                  className="pagination-button"
                  onClick={() => handlePageChange(type, pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                >
                  Previous
                </button>
                
                {renderPageNumbers()}
                
                <button
                  className="pagination-button"
                  onClick={() => handlePageChange(type, pagination.currentPage + 1)}
                  disabled={pagination.currentPage === totalPages}
                >
                  Next
                </button>
                <button
                  className="pagination-button"
                  onClick={() => handlePageChange(type, totalPages)}
                  disabled={pagination.currentPage === totalPages}
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="form-wrapper">
      {isLoadingData && (
        <div className="loading-message">
          🔄 Loading settings data...
        </div>
      )}

      {!isLoadingData && !isValidBranch(currentUser.branch, branches) && (
        <div className="warning-message">
          ⚠️ Warning: Invalid branch detected ({currentUser.branch}). Available branches: {Object.keys(branches).join(', ')}. Please contact administrator.
        </div>
      )}

      <div className="card">
        <h2>
          ⚙️ Settings - {brandDetails.displayName || 'Loading...'}
          <div className="user-info-badge">
            👤 {currentUser.displayName || currentUser.username} ({currentUser.role})
          </div>
        </h2>

        {message && (
          <div className={message.startsWith('✅') ? 'success' : 'error'}>
            {message}
          </div>
        )}
      </div>
	  
	  {/* Brand Details Section */}
      <div className="card">
        <h3>🏢 Brand Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Brand Name<span className="required">*</span></label>
            <input 
              value={brandDetails.name} 
              onChange={(e) => setBrandDetails({ ...brandDetails, name: e.target.value })}
              className={validationErrors.name ? 'error-field' : ''}
              placeholder="Enter brand name"
            />
            {validationErrors.name && <div className="error-message">❌ {validationErrors.name}</div>}
          </div>

          <div className="form-group">
            <label>Display Name<span className="required">*</span></label>
            <input 
              value={brandDetails.displayName} 
              onChange={(e) => setBrandDetails({ ...brandDetails, displayName: e.target.value })}
              className={validationErrors.displayName ? 'error-field' : ''}
              placeholder="Enter display name"
            />
            {validationErrors.displayName && <div className="error-message">❌ {validationErrors.displayName}</div>}
          </div>
		  
<div className="form-group">
  <label>Phone Number<span className="required">*</span></label>
  <input 
    value={brandDetails.phone} 
    onChange={(e) => {
      const value = e.target.value;
      // Allow only numbers and limit to 10 digits
      const numbersOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
      
      setBrandDetails({ ...brandDetails, phone: numbersOnly });
      
      // Real-time validation - clear errors immediately when valid
      if (numbersOnly.length === 10) {
        // Valid phone number - clear error
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.phone;
          return newErrors;
        });
      } else if (numbersOnly.length > 0) {
        // Invalid length - show error
        setValidationErrors(prev => ({
          ...prev,
          phone: 'Phone number must be exactly 10 digits'
        }));
      } else {
        // Empty field - show required error
        setValidationErrors(prev => ({
          ...prev,
          phone: 'Phone number is required'
        }));
      }
    }}
    className={validationErrors.phone ? 'error-field' : ''}
    placeholder="Enter 10-digit phone number"
    maxLength={10}
  />
  {validationErrors.phone && <div className="error-message">❌ {validationErrors.phone}</div>}
</div>

          <div className="form-group">
            <label>Email</label>
            <input 
              type="email"
              value={brandDetails.email} 
              onChange={(e) => setBrandDetails({ ...brandDetails, email: e.target.value })}
              className={validationErrors.email ? 'error-field' : ''}
              placeholder="Enter email address"
            />
            {validationErrors.email && <div className="error-message">❌ {validationErrors.email}</div>}
          </div>

          <div className="form-group">
            <label>GST Number</label>
            <input 
              value={brandDetails.gst} 
              onChange={(e) => setBrandDetails({ ...brandDetails, gst: e.target.value })}
              placeholder="Enter GST number"
            />
          </div>

          <div className="form-group">
            <label>Brand Logo</label>
            {logoPreview && (
              <img src={logoPreview} alt="Brand Logo Preview" className="logo-preview" />
            )}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleLogoUpload}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea 
            value={brandDetails.address} 
            onChange={(e) => setBrandDetails({ ...brandDetails, address: e.target.value })}
            placeholder="Enter complete address"
            rows="3"
          />
        </div>

        <div className="button-group">
          <button onClick={saveBrandDetails}>💾 Save Brand Details</button>
        </div>
      </div>

      {/* Theme Settings Section */}
      <div className="card">
        <h3>🎨 Theme Settings</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Theme Color</label>
            <div className="color-picker-group">
              <input 
                type="color" 
                value={themeColor} 
                onChange={(e) => setThemeColor(e.target.value)}
              />
              <input 
                type="text" 
                value={themeColor} 
                onChange={(e) => setThemeColor(e.target.value)}
                placeholder="#49488D"
              />
            </div>
          </div>
        </div>
        
        <div className="button-group">
          <button onClick={saveThemeColor}>💾 Save Theme Color</button>
        </div>
      </div>
	  
	  {/* Users Management Section - Admin Only */}
      {currentUser.role === 'admin' && (
        <div className="card">
          <h3>👥 User Management</h3>
          
          {/* Add/Edit User Form */}
          <div style={{ marginBottom: '30px' }}>
            <h4>{editingUserId ? '✏️ Edit User' : '➕ Add New User'}</h4>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Username<span className="required">*</span></label>
                <input 
                  value={newUser.username} 
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className={validationErrors.username ? 'error-field' : ''}
                  placeholder="Enter username"
                />
                {validationErrors.username && <div className="error-message">❌ {validationErrors.username}</div>}
              </div>

              <div className="form-group">
                <label>Password{!editingUserId && <span className="required">*</span>}</label>
                <input 
                  type="password"
                  value={newUser.password} 
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className={validationErrors.password ? 'error-field' : ''}
                  placeholder={editingUserId ? "Leave blank to keep current" : "Enter password"}
                />
                {validationErrors.password && <div className="error-message">❌ {validationErrors.password}</div>}
              </div>

              <div className="form-group">
                <label>Display Name<span className="required">*</span></label>
                <input 
                  value={newUser.displayName} 
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  className={validationErrors.displayName ? 'error-field' : ''}
                  placeholder="Enter display name"
                />
                {validationErrors.displayName && <div className="error-message">❌ {validationErrors.displayName}</div>}
              </div>

              <div className="form-group">
                <label>Branch<span className="required">*</span></label>
                <select 
                  value={newUser.branch} 
                  onChange={(e) => setNewUser({ ...newUser, branch: e.target.value })}
                  className={validationErrors.branch ? 'error-field' : ''}
                >
                  <option value="">Select Branch</option>
                  {Object.keys(branches).map((branchName) => (
                    <option key={branchName} value={branchName}>{branchName}</option>
                  ))}
                </select>
                {validationErrors.branch && <div className="error-message">❌ {validationErrors.branch}</div>}
              </div>

              <div className="form-group">
                <label>Role</label>
                <select 
                  value={newUser.role} 
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="button-group">
              <button onClick={saveUser}>💾 {editingUserId ? 'Update User' : 'Add User'}</button>
              {editingUserId && (
                <button onClick={cancelEdit} className="btn-secondary">❌ Cancel</button>
              )}
            </div>
          </div>

          {/* Users List */}
          <div>
            <h4>📋 Current Users ({users.length})</h4>
            <PaginationComponent type="users" data={users} pagination={usersPagination}>
              {(paginatedUsers) => (
                paginatedUsers.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Display Name</th>
                        <th>Branch</th>
                        <th>Role</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((user) => (
                        <tr key={user._id}>
                          <td>{user.username}</td>
                          <td>{user.displayName || user.username}</td>
                          <td>{user.branchName || user.branch}</td>
                          <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                          <td>
                            <button 
                              onClick={() => handleEditUser(user)}
                              className="btn-secondary"
                              style={{ fontSize: '12px', padding: '6px 10px', marginRight: '5px' }}
                            >
                              ✏️ Edit
                            </button>
                            {user._id !== currentUser.id && (
                              <button 
                                onClick={() => deleteUser(user._id)}
                                className="btn-danger"
                                style={{ fontSize: '12px', padding: '6px 10px' }}
                              >
                                🗑️ Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No users found. Try refreshing the page.</p>
                )
              )}
            </PaginationComponent>
          </div>
        </div>
      )}
	  
	  {/* Items Management Section */}
      <div className="card">
        <h3>🍬 Items Management</h3>
        
        {/* Add/Edit Item Form */}
        <div style={{ marginBottom: '30px' }}>
          <h4>{editingItemId ? '✏️ Edit Item' : '➕ Add New Item'}</h4>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Item Name<span className="required">*</span></label>
              <input 
                value={newItem.name} 
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className={validationErrors.itemName ? 'error-field' : ''}
                placeholder="Enter item name"
              />
              {validationErrors.itemName && <div className="error-message">❌ {validationErrors.itemName}</div>}
            </div>

            <div className="form-group">
              <label>Price<span className="required">*</span></label>
              <input 
                type="number"
                step="0.01"
                value={newItem.price} 
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                className={validationErrors.itemPrice ? 'error-field' : ''}
                placeholder="Enter price"
              />
              {validationErrors.itemPrice && <div className="error-message">❌ {validationErrors.itemPrice}</div>}
            </div>

            <div className="form-group">
              <label>Unit</label>
              <select 
                value={newItem.unit} 
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              >
                <option value="pcs">Pieces</option>
                <option value="kg">Kilogram</option>
                <option value="g">Gram</option>
                <option value="dozen">Dozen</option>
                <option value="box">Box</option>
                <option value="pack">Pack</option>
              </select>
            </div>

            <div className="form-group">
              <label>Vendor<span className="required">*</span></label>
              <input 
                value={newItem.vendor} 
                onChange={(e) => setNewItem({ ...newItem, vendor: e.target.value })}
                className={validationErrors.itemVendor ? 'error-field' : ''}
                placeholder="Enter vendor name"
              />
              {validationErrors.itemVendor && <div className="error-message">❌ {validationErrors.itemVendor}</div>}
            </div>

            <div className="form-group">
              <label>Category</label>
              <input 
                value={newItem.category} 
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                placeholder="Enter category"
              />
            </div>
          </div>

          <div className="button-group">
            <button onClick={saveItem}>💾 {editingItemId ? 'Update Item' : 'Add Item'}</button>
            {editingItemId && (
              <button onClick={cancelEdit} className="btn-secondary">❌ Cancel</button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div>
          <h4>📋 Current Items ({items.length})</h4>
          <PaginationComponent type="items" data={items} pagination={itemsPagination}>
            {(paginatedItems) => (
              paginatedItems.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Price</th>
                      <th>Unit</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>₹{item.price}</td>
                        <td>{item.unit}</td>
                        <td>{item.vendor}</td>
                        <td>{item.category || 'General'}</td>
                        <td>
                          <button 
                            onClick={() => handleEditItem(item)}
                            className="btn-secondary"
                            style={{ fontSize: '12px', padding: '6px 10px', marginRight: '5px' }}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={() => deleteItem(item._id)}
                            className="btn-danger"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No items found. Add some items to get started.</p>
              )
            )}
          </PaginationComponent>
        </div>
      </div>
	  
	  {/* Occasions Management Section */}
      <div className="card">
        <h3>🎉 Occasions Management</h3>
        
        {/* Add/Edit Occasion Form */}
        <div style={{ marginBottom: '30px' }}>
          <h4>{editingOccasionId ? '✏️ Edit Occasion' : '➕ Add New Occasion'}</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Occasion Name<span className="required">*</span></label>
              <input 
                value={newOccasion.name} 
                onChange={(e) => setNewOccasion({ ...newOccasion, name: e.target.value })}
                className={validationErrors.occasionName ? 'error-field' : ''}
                placeholder="Enter occasion name"
              />
              {validationErrors.occasionName && <div className="error-message">❌ {validationErrors.occasionName}</div>}
            </div>

            <div className="form-group">
              <label>Code (3 characters)<span className="required">*</span></label>
              <input 
                value={newOccasion.code} 
                onChange={(e) => setNewOccasion({ ...newOccasion, code: e.target.value.toUpperCase() })}
                className={validationErrors.occasionCode ? 'error-field' : ''}
                placeholder="Enter 3-letter code"
                maxLength={3}
              />
              {validationErrors.occasionCode && <div className="error-message">❌ {validationErrors.occasionCode}</div>}
            </div>
          </div>

          <div className="button-group">
            <button onClick={saveOccasion}>💾 {editingOccasionId ? 'Update Occasion' : 'Add Occasion'}</button>
            {editingOccasionId && (
              <button onClick={cancelEdit} className="btn-secondary">❌ Cancel</button>
            )}
          </div>
        </div>

        {/* Occasions List */}
        <div>
          <h4>📋 Current Occasions ({occasions.length})</h4>
          <PaginationComponent type="occasions" data={occasions} pagination={occasionsPagination}>
            {(paginatedOccasions) => (
              paginatedOccasions.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Occasion Name</th>
                      <th>Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOccasions.map((occasion) => (
                      <tr key={occasion._id}>
                        <td>{occasion.name}</td>
                        <td><strong>{occasion.code}</strong></td>
                        <td>
                          <button 
                            onClick={() => handleEditOccasion(occasion)}
                            className="btn-secondary"
                            style={{ fontSize: '12px', padding: '6px 10px', marginRight: '5px' }}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={() => deleteOccasion(occasion._id)}
                            className="btn-danger"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No occasions found. Add some occasions to get started.</p>
              )
            )}
          </PaginationComponent>
        </div>
      </div>
	  
	  {/* Customers Management Section */}
<div className="card">
  <h3>👥 Customers Management</h3>
  
  {/* Add/Edit Customer Form */}
  <div style={{ marginBottom: '30px' }}>
    <h4>{editingCustomerId ? '✏️ Edit Customer' : '➕ Add New Customer'}</h4>
    <div className="form-grid-3">
      <div className="form-group">
        <label>Customer Name<span className="required">*</span></label>
        <input 
          value={newCustomer.name} 
          onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
          className={validationErrors.customerName ? 'error-field' : ''}
          placeholder="Enter customer name"
        />
        {validationErrors.customerName && <div className="error-message">❌ {validationErrors.customerName}</div>}
      </div>

      <div className="form-group">
        <label>Phone Number<span className="required">*</span></label>
        <input 
          value={newCustomer.phone} 
          onChange={(e) => {
            const value = e.target.value;
            const numbersOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
            
            setNewCustomer({ ...newCustomer, phone: numbersOnly });
            
            if (numbersOnly.length === 10) {
              setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.customerPhone;
                return newErrors;
              });
            } else if (numbersOnly.length > 0) {
              setValidationErrors(prev => ({
                ...prev,
                customerPhone: 'Phone number must be exactly 10 digits'
              }));
            } else {
              setValidationErrors(prev => ({
                ...prev,
                customerPhone: 'Phone number is required'
              }));
            }
          }}
          className={validationErrors.customerPhone ? 'error-field' : ''}
          placeholder="Enter 10-digit phone number"
          maxLength={10}
        />
        {validationErrors.customerPhone && <div className="error-message">❌ {validationErrors.customerPhone}</div>}
      </div>

      <div className="form-group">
        <label>Email</label>
        <input 
          type="email"
          value={newCustomer.email} 
          onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
          className={validationErrors.customerEmail ? 'error-field' : ''}
          placeholder="Enter email address"
        />
        {validationErrors.customerEmail && <div className="error-message">❌ {validationErrors.customerEmail}</div>}
      </div>

      {currentUser.role === 'admin' && (
        <div className="form-group">
          <label>Branch<span className="required">*</span></label>
          <select 
            value={newCustomer.branch} 
            onChange={(e) => setNewCustomer({ ...newCustomer, branch: e.target.value })}
            className={validationErrors.customerBranch ? 'error-field' : ''}
          >
            <option value="">Select Branch</option>
            {Object.keys(branches).map((branchName) => (
              <option key={branchName} value={branchName}>{branchName}</option>
            ))}
          </select>
          {validationErrors.customerBranch && <div className="error-message">❌ {validationErrors.customerBranch}</div>}
        </div>
      )}
    </div>

    <div className="form-group">
      <label>Address</label>
      <textarea 
        value={newCustomer.address} 
        onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
        placeholder="Enter customer address"
        rows="2"
      />
    </div>

    <div className="button-group">
      <button onClick={saveCustomer}>💾 {editingCustomerId ? 'Update Customer' : 'Add Customer'}</button>
      {editingCustomerId && (
        <button onClick={cancelEdit} className="btn-secondary">❌ Cancel</button>
      )}
    </div>
  </div>

  {/* Customers List */}
  <div>
    <h4>📋 Current Customers ({customers.length})</h4>
    <PaginationComponent type="customers" data={customers} pagination={customersPagination}>
      {(paginatedCustomers) => (
        paginatedCustomers.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                {currentUser.role === 'admin' && <th>Branch</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer) => (
                <tr key={customer._id}>
                  <td>
                    <button 
                      onClick={() => handleCustomerClick(customer)}
                      className="customer-name-button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#49488D',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {customer.name}
                    </button>
                  </td>
                  <td>{customer.phone}</td>
                  <td>{customer.email || 'N/A'}</td>
                  <td>{customer.address ? customer.address.substring(0, 50) + (customer.address.length > 50 ? '...' : '') : 'N/A'}</td>
                  {currentUser.role === 'admin' && <td>{customer.branchName || customer.branch}</td>}
                  <td>
                    <button 
                      onClick={() => handleEditCustomer(customer)}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 10px', marginRight: '5px' }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      onClick={() => deleteCustomer(customer._id)}
                      className="btn-danger"
                      style={{ fontSize: '12px', padding: '6px 10px' }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No customers found. Add some customers to get started.</p>
        )
      )}
    </PaginationComponent>
  </div>
</div>

{/* Customer Details Modal */}
{selectedCustomer && (
  <div className="modal-overlay" onClick={closeCustomerDetails}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh' }}>
      <div className="modal-header">
        <h3>📊 Customer Details: {selectedCustomer.name}</h3>
        <button className="modal-close" onClick={closeCustomerDetails}>×</button>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div className="customer-stats" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div className="stat-card" style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#49488D' }}>📦 Total Orders</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{customerStats.totalOrders || 0}</p>
          </div>
          <div className="stat-card" style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#49488D' }}>🎁 Distinct Boxes</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{customerStats.distinctBoxes || 0}</p>
          </div>
          <div className="stat-card" style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#49488D' }}>📊 Total Boxes</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{customerStats.totalBoxes || 0}</p>
          </div>
          <div className="stat-card" style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#49488D' }}>💰 Total Spent</h4>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              ₹{(customerStats.totalAmount || 0).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="customer-info" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px',
          marginBottom: '20px',
          padding: '15px',
          background: '#f1f3f4',
          borderRadius: '8px'
        }}>
          <div><strong>📞 Phone:</strong> {selectedCustomer.phone}</div>
          <div><strong>📧 Email:</strong> {selectedCustomer.email || 'N/A'}</div>
          <div><strong>🏢 Branch:</strong> {selectedCustomer.branchName || selectedCustomer.branch}</div>
          <div><strong>📍 Address:</strong> {selectedCustomer.address || 'N/A'}</div>
        </div>
      </div>
      
      <div>
        <h4>📋 Order History ({customerOrders.length} orders)</h4>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {customerOrders.length > 0 ? (
            <table className="data-table" style={{ fontSize: '14px' }}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Branch</th>
                </tr>
              </thead>
              <tbody>
                {customerOrders.map((order) => (
                  <tr key={order._id}>
                    <td>{order.orderNumber || order._id.slice(-6)}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{order.boxes?.length || 0} boxes ({order.totalBoxCount || 0} total)</td>
                    <td>₹{(order.grandTotal || 0).toLocaleString()}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        backgroundColor: order.status === 'completed' ? '#d4edda' : 
                                       order.status === 'saved' ? '#fff3cd' : '#f8d7da',
                        color: order.status === 'completed' ? '#155724' : 
                               order.status === 'saved' ? '#856404' : '#721c24'
                      }}>
                        {order.status || 'pending'}
                      </span>
                    </td>
                    <td>{order.branch || order.branchName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ textAlign: 'center', color: '#6c757d', fontStyle: 'italic' }}>No orders found for this customer.</p>
          )}
        </div>
      </div>
    </div>
  </div>
)}

      {/* System Information Section */}
      <div className="card">
        <h3>ℹ️ System Information</h3>
        <div className="system-info-grid">
          <div className="system-info-item">
            <strong>Current User:</strong><br />
            {currentUser.displayName} ({currentUser.username})
          </div>
          <div className="system-info-item">
            <strong>User Role:</strong><br />
            {currentUser.role}
          </div>
          <div className="system-info-item">
            <strong>Current Branch:</strong><br />
            {currentUser.branch}
          </div>
          <div className="system-info-item">
            <strong>Branch Code:</strong><br />
            {branches[currentUser.branch] || 'N/A'}
          </div>
          <div className="system-info-item">
            <strong>Total Items:</strong><br />
            {items.length}
          </div>
          <div className="system-info-item">
            <strong>Total Occasions:</strong><br />
            {occasions.length}
          </div>
          <div className="system-info-item">
            <strong>Total Users:</strong><br />
            {users.length}
          </div>
		  <div className="system-info-item">
  <strong>Total Customers:</strong><br />
  {customers.length}
</div>
          <div className="system-info-item">
            <strong>Total Branches:</strong><br />
            {Object.keys(branches).length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;