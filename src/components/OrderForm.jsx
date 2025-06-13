import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaEdit } from 'react-icons/fa';
import './OrderForm.css';

// Dynamic data will be fetched from API
let branchPrefixes = {};
let occasionMap = {};
let itemList = [];
// API helper function to replace localStorage usage
const getAuthToken = () => localStorage.getItem('authToken');

// Replace the existing apiCall function in OrderForm.jsx with this:
const apiCall = async (endpoint, options = {}) => {
  // Use the same API URL logic as orderApi.js
  const getApiUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  console.log('🌐 API URL Debug:', {
    envUrl,
    hostname,
    isLocalhost,
    nodeEnv: process.env.NODE_ENV,
    fullURL: window.location.href
  });
  
  // Force cloud URL if we're on a deployed domain (not localhost)
  if (!isLocalhost) {
    const cloudUrl = 'https://order-management-fbre.onrender.com';
    console.log('☁️ Deployed environment detected, using cloud URL:', cloudUrl);
    return cloudUrl;
  }
  
  if (envUrl) {
    console.log('✅ Using environment API URL:', envUrl);
    return envUrl;
  }
  
  if (isLocalhost) {
    console.log('🏠 Using localhost API URL');
    return 'http://localhost:5000';
  }
  
  const cloudUrl = 'https://order-management-fbre.onrender.com';
  console.log('☁️ Fallback to cloud API URL:', cloudUrl);
  return cloudUrl;
};
  
  const baseUrl = `${getApiUrl()}/api`;
  const url = `${baseUrl}${endpoint}`;
  
  // ADD THIS DEBUG LOG:
  console.log('🔗 Final API URL:', url);
  console.log('🔗 Endpoint:', endpoint);
  console.log('🔗 Base URL:', baseUrl);
  
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
  
  return await fetch(url, finalOptions);
};

const user = {
  branch: 'Loading...', // Will be updated from API
  role: 'staff'        // Will be updated from API
};

// In OrderForm.jsx, replace the normalizeBranchName function with:
const normalizeBranchName = (branch, availableBranches = {}) => {
  console.log('🔍 Normalizing branch:', branch, 'Available:', Object.keys(availableBranches));
  
  if (!branch) {
    const firstBranch = Object.keys(availableBranches)[0] || 'Head Office';
    console.log('🔄 No branch provided, using first available:', firstBranch);
    return firstBranch;
  }
  
  // First, check if branch exists directly
  if (availableBranches[branch]) {
    console.log('✅ Branch found directly:', branch);
    return branch;
  }
  
  // Try to find a match by comparing branch codes or partial names
  for (const [branchName, branchCode] of Object.entries(availableBranches)) {
    if (branchName.toLowerCase().includes(branch.toLowerCase()) || 
        branchCode.toLowerCase() === branch.toLowerCase()) {
      console.log('✅ Branch found by match:', branchName);
      return branchName;
    }
  }
  
  console.log('⚠️ Branch not found, returning original:', branch);
  return branch;
};

// Function to validate if user has valid branch
const isValidBranch = (branch) => {
  return Object.keys(branchPrefixes).includes(branch);
};

// Initial state objects
const initialItem = {
  id: uuidv4(),
  name: '',
  qty: 1,
  price: 0,
  amount: 0,
  unit: 'pcs'
};

const initialBox = {
  id: uuidv4(),
  items: [{ ...initialItem, id: uuidv4() }],
  discount: 0,
  boxCount: 1,
  total: 0,
};

// Define the OrderForm component
const OrderForm = React.forwardRef(({ selectedOrder, setSelectedOrder }, ref) => {
  // State for dynamic data
  const [branches, setBranches] = useState({});
  const [occasions, setOccasions] = useState({});
  const [items, setItems] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [brandDetails, setBrandDetails] = useState({ displayName: 'Loading...', name: 'Brand' });
  const [selectedBranch, setSelectedBranch] = useState(null); // Add this line

  // ===== ALL STATE VARIABLES FIRST =====
  const [extraDiscount, setExtraDiscount] = useState({ value: 0, type: 'value' });
  const [advancePaid, setAdvancePaid] = useState(0);
  const [boxes, setBoxes] = useState([{ ...initialBox, id: uuidv4() }]);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [customOccasionModal, setCustomOccasionModal] = useState(false);
  const [newOccasion, setNewOccasion] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [availableOccasions, setAvailableOccasions] = useState([]);
  const [isOrderSummaryMinimized, setIsOrderSummaryMinimized] = useState(false);
  const [originalSubtotal, setOriginalSubtotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [editOrderNumber, setEditOrderNumber] = useState(false);
  const [orderNumberError, setOrderNumberError] = useState(false);
  const [isCheckingOrderNumber, setIsCheckingOrderNumber] = useState(false);
  const [orderNumberStatus, setOrderNumberStatus] = useState('idle');
  const [validationErrors, setValidationErrors] = useState({});
  const [currentUser, setCurrentUser] = useState({
    id: null,
    username: null,
    branch: 'Loading...',
    branchCode: null,
    role: 'staff',
    displayName: null
  });
  const [customer, setCustomer] = useState({ 
    name: '', 
    phone: '', 
    address: '', 
    pincode: '',
    city: '',
    state: '',
    email: '' 
  });
  const [orderInfo, setOrderInfo] = useState({
    occasion: 'General',
    orderPrefix: 'XX-GEN',
    orderNumber: '001',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    deliveryTime: '10:00'
  });

  // ===== CALCULATE FUNCTIONS =====
  const calculateBoxTotal = (box) => {
    const itemsSubtotal = box.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const boxSubtotal = itemsSubtotal * box.boxCount;
    const boxDiscount = box.discount > 0 ? box.discount * box.boxCount : 0;
    return boxSubtotal - boxDiscount;
  };

  const calculateSubtotal = () => {
    try {
      const boxTotals = boxes.map((box) => {
        const subtotal = box.items.reduce((sum, item) => sum + (item.qty * item.price), 0) * box.boxCount;
        return subtotal - (box.discount * box.boxCount);
      });
      return boxTotals.reduce((a, b) => a + b, 0);
    } catch (e) {
      return 0;
    }
  };

  const calculateGrandTotal = () => {
    const boxTotals = boxes.map((box) => calculateBoxTotal(box));
    const subtotal = boxTotals.reduce((a, b) => a + b, 0);

    const extra = extraDiscount.value > 0
      ? (extraDiscount.type === 'percentage'
        ? (extraDiscount.value / 100) * subtotal
        : extraDiscount.value)
      : 0;

    return subtotal - extra;
  };

  // Calculate totals for a box
  const calculateTotals = (box) => {
    const itemsSubtotal = box.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const boxSubtotal = itemsSubtotal * box.boxCount;
    const boxDiscount = box.discount > 0 ? box.discount * box.boxCount : 0;
    return {
      ...box,
      total: boxSubtotal - boxDiscount,
    };
  };

  // Calculate the total number of boxes across all box types
  const calculateTotalBoxCount = () => {
    if (boxes.length === 1) return 1;
    return boxes.reduce((sum, box) => sum + (box.boxCount || 1), 0);
  };

  // ===== HELPER FUNCTIONS =====
  const hasFormData = useCallback(() => {
    const hasCustomerData = customer.name.trim() !== '' || 
                            customer.phone.trim() !== '' || 
                            customer.email.trim() !== '' || 
                            customer.address.trim() !== '' ||
                            customer.pincode.trim() !== '' ||
                            customer.city.trim() !== '' ||
                            customer.state.trim() !== '';
                            
    const hasItemData = boxes.some(box => 
      box.items.some(item => item.name && item.name !== '')
    );
    
    const hasSpecialSettings = extraDiscount.value > 0 || 
                               advancePaid > 0 || 
                               notes.trim() !== '' ||
                               orderInfo.occasion !== 'General';
    
    return hasCustomerData || hasItemData || hasSpecialSettings;
  }, [customer, boxes, extraDiscount, advancePaid, notes, orderInfo.occasion]);
  
// Enhanced email service function with PDF attachment
// Replace your sendOrderEmail function with this version that has better error handling:
// Replace your sendOrderEmail function with this debug version:
const sendOrderEmail = async (orderData, isModification = false, changes = null) => {
  // Check if email is provided and valid
  if (!orderData.email || !orderData.email.trim()) {
    console.log('📧 No email provided, skipping email send');
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(orderData.email.trim())) {
    console.log('📧 Invalid email format, skipping email send');
    return;
  }

  try {
    console.log('📧 Starting email sending process...');
    
    // Step 1: Test if email service is accessible
    console.log('🔍 Step 1: Testing email service accessibility...');
    const debugResponse = await apiCall('/emails/debug');
    
    if (!debugResponse.ok) {
      throw new Error(`Email service not accessible: ${debugResponse.status}`);
    }
    
    const debugData = await debugResponse.json();
    console.log('✅ Email service accessible:', debugData);
    
    // Step 2: Test email authentication
    console.log('🔍 Step 2: Testing email authentication...');
    const authResponse = await apiCall('/emails/test-auth', {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    if (!authResponse.ok) {
      const authError = await authResponse.json().catch(() => ({ error: 'Unknown auth error' }));
      console.error('❌ Email authentication failed:', authError);
      throw new Error(`Email authentication failed: ${authError.message || authError.error}`);
    }
    
    const authData = await authResponse.json();
    console.log('✅ Email authentication successful:', authData);
    
    // Step 3: Prepare email data
    console.log('🔍 Step 3: Preparing email data...');
    
    // Calculate totals for email
    const calculateBoxTotal = (box) => {
      const itemsSubtotal = box.items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const boxSubtotal = itemsSubtotal * box.boxCount;
      const boxDiscount = box.discount > 0 ? box.discount * box.boxCount : 0;
      return boxSubtotal - boxDiscount;
    };

    const subtotal = orderData.boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0);
    const extraDiscountAmount = orderData.extraDiscount?.value > 0
      ? (orderData.extraDiscount.type === 'percentage'
        ? (orderData.extraDiscount.value / 100) * subtotal
        : orderData.extraDiscount.value)
      : 0;
    const finalTotal = subtotal - extraDiscountAmount;
    const balance = finalTotal - (orderData.advancePaid || 0);

    const emailPayload = {
      to: orderData.email.trim(),
      customerName: orderData.customerName,
      orderNumber: orderData.orderNumber,
      orderData: {
        ...orderData,
        calculatedTotals: {
          subtotal,
          extraDiscountAmount,
          finalTotal,
          balance
        }
      },
      isModification,
      changes: changes || [],
      brandDetails: brandDetails,
      fromEmail: 'ganguramonline@gmail.com'
    };
    
    console.log('✅ Email data prepared for:', orderData.email);

    // Step 4: Send the actual email
    console.log('🔍 Step 4: Sending actual email...');
    const response = await apiCall('/emails/send-order-email', {
      method: 'POST',
      body: JSON.stringify(emailPayload)
    });

    console.log('📥 Email response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Email sent successfully:', result);
      
      // Update the message to show email was sent
      setMessage(prev => {
        const baseMessage = prev || '';
        const emailSuffix = isModification 
          ? ' 📧 Order update email sent to customer.'
          : ' 📧 Order confirmation email sent to customer.';
        
        return baseMessage.includes('📧') ? baseMessage : baseMessage + emailSuffix;
      });
    } else {
      const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('⚠️ Email sending failed:', {
        status: response.status,
        error: errorResult
      });
      
      // Show detailed error for debugging
      console.error('📧 Email Error Details:', errorResult);
    }
  } catch (error) {
    console.error('❌ Email service error:', error);
    console.log('📧 Order saved successfully, email notification failed');
    
    // Log the full error for debugging
    console.error('📧 Full Email Error:', {
      message: error.message,
      stack: error.stack
    });
  }
};

// Enhanced function to detect changes between original and new order
const detectOrderChanges = (original, current) => {
  const changes = [];
  
  // Customer information changes
  if (original.customerName !== current.customerName) {
    changes.push(`Customer name: "${original.customerName}" → "${current.customerName}"`);
  }
  
  if (original.phone !== current.phone) {
    changes.push(`Phone number: ${original.phone} → ${current.phone}`);
  }
  
  if (original.email !== current.email) {
    changes.push(`Email: ${original.email || 'None'} → ${current.email || 'None'}`);
  }
  
  if (original.address !== current.address) {
    changes.push(`Address: "${original.address || 'None'}" → "${current.address || 'None'}"`);
  }
  
  // Order information changes
  if (original.occasion !== current.occasion) {
    changes.push(`Occasion: ${original.occasion} → ${current.occasion}`);
  }
  
  if (original.orderDate !== current.orderDate) {
    changes.push(`Order date: ${new Date(original.orderDate).toLocaleDateString()} → ${new Date(current.orderDate).toLocaleDateString()}`);
  }
  
  if (original.deliveryDate !== current.deliveryDate) {
    changes.push(`Delivery date: ${new Date(original.deliveryDate).toLocaleDateString()} → ${new Date(current.deliveryDate).toLocaleDateString()}`);
  }
  
  if (original.deliveryTime !== current.deliveryTime) {
    changes.push(`Delivery time: ${original.deliveryTime} → ${current.deliveryTime}`);
  }
  
  // Financial changes
  if (Math.abs(original.grandTotal - current.grandTotal) > 0.01) {
    changes.push(`Total amount: ₹${original.grandTotal.toFixed(2)} → ₹${current.grandTotal.toFixed(2)}`);
  }
  
  if (Math.abs((original.advancePaid || 0) - (current.advancePaid || 0)) > 0.01) {
    changes.push(`Advance paid: ₹${(original.advancePaid || 0).toFixed(2)} → ₹${(current.advancePaid || 0).toFixed(2)}`);
  }
  
  // Extra discount changes
  const origDiscount = original.extraDiscount?.value || 0;
  const currDiscount = current.extraDiscount?.value || 0;
  if (Math.abs(origDiscount - currDiscount) > 0.01) {
    changes.push(`Extra discount: ₹${origDiscount.toFixed(2)} → ₹${currDiscount.toFixed(2)}`);
  }
  
  // Items changes - more detailed comparison
  const originalItems = original.boxes.flatMap((box, boxIndex) => 
    box.items.map(item => `Box ${boxIndex + 1}: ${item.name} x${item.qty} @ ₹${item.price}`)
  ).sort();
  
  const currentItems = current.boxes.flatMap((box, boxIndex) => 
    box.items.map(item => `Box ${boxIndex + 1}: ${item.name} x${item.qty} @ ₹${item.price}`)
  ).sort();
  
  if (JSON.stringify(originalItems) !== JSON.stringify(currentItems)) {
    changes.push('Order items, quantities, or prices have been modified');
  }
  
  // Box count changes
  if (original.boxes.length !== current.boxes.length) {
    changes.push(`Number of boxes: ${original.boxes.length} → ${current.boxes.length}`);
  }
  
  // Notes changes
  if ((original.notes || '') !== (current.notes || '')) {
    changes.push(`Notes: "${original.notes || 'None'}" → "${current.notes || 'None'}"`);
  }
  
  return changes;
};

  // Function to check if order number exists before submitting
  const checkOrderNumberUnique = async (orderPrefix, orderNumber) => {
  try {
    const fullOrderNumber = `${orderPrefix}-${orderNumber}`;
    const response = await apiCall(`/orders/check-number?orderNumber=${encodeURIComponent(fullOrderNumber)}`);
    
    if (!response.ok) {
      console.error(`Check order number failed with status: ${response.status}`);
      return true;
    }
    
    const data = await response.json();
    return !data.exists;
  } catch (error) {
    console.error('Error in order number uniqueness check:', error);
    return true;
  }
};
  
  // Replace your generateUniqueOrderNumber function with this:
const generateUniqueOrderNumber = async () => {
  if (editingOrderId) return;

  let activeBranch;
  let branchCode;
  
  if (currentUser.role === 'admin') {
    if (selectedBranch) {
      activeBranch = selectedBranch;
      branchCode = branches[selectedBranch];
    } else {
      // ✅ FIXED: Default to BD (Beadon Street) for admin
      activeBranch = 'Beadon Street';
      branchCode = 'BD';
      setSelectedBranch('Beadon Street');
    }
  } else {
    activeBranch = currentUser.branch;
    branchCode = branches[currentUser.branch];
  }
  
  console.log('🔢 Generating order number:', {
    userRole: currentUser.role,
    activeBranch,
    branchCode,
    selectedBranch
  });
    
  if (!activeBranch || activeBranch === 'Loading...' || !branchCode) {
    console.log('❌ Cannot generate order number - invalid branch info');
    setOrderInfo(prev => ({ 
      ...prev, 
      orderPrefix: 'BD-GEN', // Default to BD-GEN for admin
      orderNumber: '001' 
    }));
    return;
  }
  
  const currentOccasion = orderInfo.occasion || 'General';
  const occasionPrefix = occasions[currentOccasion] || 'GEN';
  const prefix = `${branchCode}-${occasionPrefix}`;

  console.log('🔢 Using prefix:', prefix);

  try {
    const response = await apiCall(`/orders/last-number/${encodeURIComponent(prefix)}`);
    
    if (response.ok) {
      const data = await response.json();
      const nextNumber = ((data?.lastNumber || 0) + 1).toString().padStart(3, '0');
      setOrderInfo(prev => ({ 
        ...prev, 
        orderPrefix: prefix, 
        orderNumber: nextNumber 
      }));
      console.log('✅ Generated order number:', `${prefix}-${nextNumber}`);
    } else {
      console.log('⚠️ API call failed, using default');
      setOrderInfo(prev => ({ 
        ...prev, 
        orderPrefix: prefix, 
        orderNumber: '001' 
      }));
    }
    setOrderNumberError(false);
  } catch (error) {
    console.error("❌ Failed to fetch last order number:", error);
    setOrderInfo(prev => ({ 
      ...prev, 
      orderPrefix: prefix, 
      orderNumber: '001' 
    }));
    setMessage('⚠️ Could not auto-generate order number. Using default 001.');
  }
};

  // Validate the form
  const validateForm = () => {
    const errors = {};
    
    if (!customer.name?.trim?.()) errors.name = 'Name is required';
    if (!customer.phone?.trim?.()) errors.phone = 'Phone is required';
    if (!orderInfo.orderPrefix || !orderInfo.orderNumber) errors.orderNumber = 'Order number is required';
    
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      errors.email = "Invalid email format";
    }
    
    if (customer.pincode && customer.pincode.length !== 6) {
      errors.pincode = "PIN code must be 6 digits";
    }
    
    let hasEmptyItems = false;
    boxes.forEach(box => {
      box.items.forEach(item => {
        if (!item.name || item.name === "" || (item.name === "__custom__" && !item.customName)) {
          hasEmptyItems = true;
        }
      });
    });
    
    if (hasEmptyItems) {
      errors.items = "All items must have names";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ===== EXPOSE RESET FORM VIA REF =====
  React.useImperativeHandle(ref, () => ({
    resetForm: () => {
      setCustomer({ 
        name: '', 
        phone: '', 
        address: '', 
        pincode: '',
        city: '',
        state: '',
        email: '' 
      });

      setOrderInfo({
        occasion: 'General',
        orderPrefix: 'XX-GEN',
        orderNumber: '001',
        orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        deliveryTime: '10:00'
      });

      setBoxes([{ ...initialBox, id: uuidv4() }]);
      setNotes('');
      setExtraDiscount({ value: 0, type: 'value' });
      setAdvancePaid(0);
      setMessage('');
      setValidationErrors({});
      setEditingOrderId(null);
      
      // Clear the selected order in parent
      if (setSelectedOrder) {
        setSelectedOrder(null);
      }
      
      generateUniqueOrderNumber();
    }
  }));

  // ===== EVENT HANDLERS =====
  const handleNewOrderClick = () => {
    if (hasFormData()) {
      setShowConfirmationModal(true);
      setPendingAction('newOrder');
    } else {
      ref?.current?.resetForm();
    }
  };
  
  const toggleEditOrderNumber = () => setEditOrderNumber(!editOrderNumber);
  const toggleOrderSummary = () => setShowOrderSummary(!showOrderSummary);
  const toggleOrderSummaryMinimize = () => setIsOrderSummaryMinimized(!isOrderSummaryMinimized);

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    
    let validatedValue = value;
    let isValid = true;
    
    if (name === 'name') {
      if (!/^[A-Za-z\s.]*$/.test(value)) {
        isValid = false;
      }
    } else if (name === 'phone') {
      const numbersOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
      validatedValue = numbersOnly;
      isValid = numbersOnly.length === 10 || numbersOnly.length === 0;
    } else if (name === 'email' && value) {
      isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    } else if (name === 'pincode') {
      const numbersOnly = value.replace(/[^0-9]/g, '').slice(0, 6);
      validatedValue = numbersOnly;
      
      if (numbersOnly.length === 6) {
        const pincodeMap = {
          '700006': { city: 'Kolkata', state: 'West Bengal' },
          '110001': { city: 'New Delhi', state: 'Delhi' },
          '400001': { city: 'Mumbai', state: 'Maharashtra' }
        };
        
        if (pincodeMap[numbersOnly]) {
          setCustomer(prev => ({
            ...prev,
            city: pincodeMap[numbersOnly].city,
            state: pincodeMap[numbersOnly].state
          }));
        } else {
          setCustomer(prev => ({
            ...prev,
            city: '',
            state: ''
          }));
        }
      } else {
        setCustomer(prev => ({
          ...prev,
          city: '',
          state: ''
        }));
      }
    }
    
    setCustomer(prev => ({ ...prev, [name]: validatedValue }));
    
    if (!isValid && value) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: `Invalid ${name}`
      }));
    } else if (value && validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    } else if (!value) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: `${name.charAt(0).toUpperCase() + name.slice(1)} is required`
      }));
    }
  };
  
  // Also fix your handleOrderChange function:
const handleOrderChange = (e) => {
  const { name, value } = e.target;
  if (name === 'occasion') {
    if (value === '__add_new__') {
      setCustomOccasionModal(true);
      return;
    }
    
    // ✅ FIXED: Simplified branch logic
    let activeBranch;
    let branchCode;
    
    if (currentUser.role === 'admin' && selectedBranch) {
      activeBranch = selectedBranch;
      branchCode = branches[selectedBranch];
    } else {
      activeBranch = currentUser.branch;
      branchCode = branches[currentUser.branch];
    }
    
    console.log('🎉 Occasion changed:', {
      newOccasion: value,
      activeBranch,
      branchCode
    });
      
    const finalBranchCode = branchCode || 'XX';
    const occasionPrefix = occasions[value] || value.slice(0, 3).toUpperCase();
    const fullPrefix = `${finalBranchCode}-${occasionPrefix}`;
    
    setOrderInfo({ ...orderInfo, occasion: value, orderPrefix: fullPrefix });
  } else {
    setOrderInfo({ ...orderInfo, [name]: value });
  }
};

  const handleItemChange = (boxId, itemId, field, value) => {
    const updatedBoxes = boxes.map((box) => {
      if (box.id !== boxId) return box;
      const updatedItems = box.items.map((item) => {
        if (item.id !== itemId) return item;
        const updatedItem = { ...item, [field]: field === 'qty' ? Number(value) : value };
        
        if (field === 'qty' || field === 'price') {
          updatedItem.amount = updatedItem.qty * updatedItem.price;
        }
        
        return updatedItem;
      });
      return { ...box, items: updatedItems };
    });
    setBoxes(updatedBoxes);
  };
  
  const handleCustomItemInput = (boxId, itemId, value) => {
    if (value.trim() === '') return;
    
    const updatedBoxes = boxes.map(box => {
      if (box.id !== boxId) return box;
      
      const updatedItems = box.items.map(item => {
        if (item.id !== itemId) return item;
        
        return {
          ...item,
          name: value,
          customName: true
        };
      });
      
      return { ...box, items: updatedItems };
    });
    
    setBoxes(updatedBoxes);
  };

  const handleItemPriceChange = (boxId, itemId, price) => {
    const numericPrice = parseFloat(price) || 0;
    
    const updatedBoxes = boxes.map(box => {
      if (box.id !== boxId) return box;
      
      const updatedItems = box.items.map(item => {
        if (item.id !== itemId) return item;
        
        return {
          ...item,
          price: numericPrice,
          amount: item.qty * numericPrice
        };
      });
      
      return { ...box, items: updatedItems };
    });
    
    setBoxes(updatedBoxes);
  };

  const handleBoxCountChange = (boxId, count) => {
    const updatedBoxes = boxes.map((box) => {
      if (box.id === boxId) {
        return { ...box, boxCount: Number(count) || 1 };
      }
      return box;
    });
    setBoxes(updatedBoxes);
  };
  
  const handleBoxDiscountChange = (boxId, newDiscount) => {
    setBoxes(prev =>
      prev.map(box => {
        if (box.id !== boxId) return box;

        const singleBoxSubtotal = box.items.reduce((sum, item) => sum + item.qty * item.price, 0);

        if (newDiscount > singleBoxSubtotal) {
          setMessage(`⚠️ Discount per box exceeds single box value. Max allowed is ₹${singleBoxSubtotal}`);
          return { ...box, discount: singleBoxSubtotal };
        }

        if (newDiscount < 0) {
          setMessage('⚠️ Discount cannot be negative. Reset to 0.');
          return { ...box, discount: 0 };
        }

        setMessage('');
        return { ...box, discount: newDiscount };
      })
    );
  };

  const addBox = () => {
    setBoxes([...boxes, { ...initialBox, id: uuidv4() }]);
  };
  
  const removeBox = (boxId) => {
    setBoxes(boxes.filter(box => box.id !== boxId));
  };

  const addItem = (boxId) => {
    setBoxes(boxes.map(box =>
      box.id === boxId
        ? { ...box, items: [...box.items, { ...initialItem, id: uuidv4() }] }
        : box
    ));
  };
  
  const removeItem = (boxId, itemId) => {
    setBoxes(boxes.map(box =>
      box.id === boxId
        ? { ...box, items: box.items.filter(item => item.id !== itemId) }
        : box
    ));
  };

  const handleSubmit = async (event, status = 'saved') => {
  event.preventDefault();
  setMessage('');
  
  if (status === 'newOrder') {
    setShowConfirmationModal(false);
    setPendingAction(null);
    ref?.current?.resetForm();
    return;
  }

  if (status === 'saved') {
    if (!orderInfo.orderPrefix || !orderInfo.orderNumber) {
      setOrderNumberError(true);
      setMessage('❌ Order number is required.');
      return;
    }
    
    if (!validateForm()) {
      setMessage('❌ Please correct the errors before saving.');
      return;
    }
  }
  
  setOrderNumberError(false);

  // ===== VALIDATION =====
  if (!currentUser.branch || currentUser.branch === 'Loading...') {
    setMessage('❌ Cannot save order: User branch information not loaded');
    return;
  }

  if (!orderInfo.orderPrefix || orderInfo.orderPrefix === 'XX-GEN') {
    setMessage('❌ Cannot save order: Invalid order prefix. Please wait for system to load.');
    return;
  }

  if (calculateGrandTotal() <= 0) {
    setMessage('❌ Cannot save order: Total amount must be greater than 0');
    return;
  }

  const fullOrderNumber = `${orderInfo.orderPrefix}-${orderInfo.orderNumber}`;

  // ===== DRAFT HANDLING LOGIC =====
  let existingDraftId = null;
  
  // ✅ FIXED: Only check for drafts if we're NOT editing an existing order
  if (!editingOrderId && status === 'saved') {
    try {
      console.log('🔍 Checking for existing draft:', fullOrderNumber);
      const checkResponse = await apiCall(`/orders/check-draft?orderNumber=${encodeURIComponent(fullOrderNumber)}`);
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        existingDraftId = checkData.draftId;
        if (existingDraftId) {
          console.log('📝 Found existing draft to convert:', existingDraftId);
        }
      }
    } catch (error) {
      console.log('⚠️ Draft check failed (continuing anyway):', error);
    }
  }

  // ===== CREATE ORDER DATA =====
  const orderData = {
    customerName: customer.name,
    phone: customer.phone,
    address: customer.address,
    email: customer.email,
    pincode: customer.pincode,
    city: customer.city,
    state: customer.state,
    ...orderInfo,
    orderNumber: fullOrderNumber,
    branch: (() => {
      if (currentUser.role === 'admin') {
        // For admin, use the branch from the order prefix
        const prefixBranch = orderInfo.orderPrefix.split('-')[0];
        const branchName = Object.keys(branches).find(name => branches[name] === prefixBranch);
        return branchName || 'Beadon Street'; // Default to BD for admin
      } else {
        return currentUser.branch;
      }
    })(),
    branchCode: (() => {
      if (currentUser.role === 'admin') {
        return orderInfo.orderPrefix.split('-')[0];
      } else {
        return branches[currentUser.branch];
      }
    })(),
    createdBy: currentUser.displayName || currentUser.username || 'Unknown',
    boxes: boxes.map(calculateTotals),
    notes,
    extraDiscount: {
      value: extraDiscount.value || 0,
      type: extraDiscount.type || 'value'
    },
    advancePaid: advancePaid || 0,
    totalBoxCount: calculateTotalBoxCount(),
    grandTotal: calculateGrandTotal(),
    balance: calculateGrandTotal() - (advancePaid || 0),
    status: status,
    isDraft: false
  };

  // ===== SET ORDER ID FOR UPDATE =====
  if (editingOrderId) {
    orderData._id = editingOrderId;
    console.log('✏️ Updating existing order:', editingOrderId);
  } else if (existingDraftId) {
    orderData._id = existingDraftId;
    console.log('🔄 Converting draft to saved order:', existingDraftId);
  }

  try {
    // ===== CHECK FOR CHANGES (EDIT MODE) =====
    if (editingOrderId) {
      console.log('📝 Edit mode detected - skipping duplicate check');
      // In edit mode, we don't need to check for duplicates
    } else {
      // ===== CHECK ORDER NUMBER UNIQUENESS (NEW ORDERS ONLY) =====
      if (!existingDraftId) {
        console.log('🔍 Checking order number uniqueness for new order...');
        const isUnique = await checkOrderNumberUnique(orderInfo.orderPrefix, orderInfo.orderNumber);
        if (!isUnique) {
          setOrderNumberError(true);
          setMessage('❌ This order number already exists. Please choose a different one.');
          setEditOrderNumber(true);
          return;
        }
      }
    }

    // ===== SAVE THE ORDER =====
    console.log('💾 Saving order:', {
      isEdit: !!editingOrderId,
      isDraftConversion: !!existingDraftId,
      orderNumber: fullOrderNumber,
      status: status,
      branchCode: orderData.branchCode,
      orderId: orderData._id
    });

    const branchCodeForAPI = orderData.branchCode.toLowerCase();
    
    // ✅ FIXED: Use PUT for existing orders, POST for new orders
    let saveResponse;
    if (editingOrderId) {
      // Use PUT for updating existing orders
      saveResponse = await apiCall(`/orders/${branchCodeForAPI}/${editingOrderId}`, {
        method: 'PUT',
        body: JSON.stringify(orderData)
      });
    } else {
      // Use POST for new orders (including draft conversions)
      saveResponse = await apiCall(`/orders/${branchCodeForAPI}`, {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
    }

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json().catch(() => ({}));
      throw new Error(errorData.message || `Server responded with ${saveResponse.status}`);
    }

    const savedOrderResult = await saveResponse.json();
    console.log('✅ Order saved successfully:', savedOrderResult);

    // ===== SUCCESS HANDLING =====
    setMessage(`✅ Order ${status === 'held' ? 'held' : 'saved'} successfully!`);
    setLastSavedTime(new Date().toLocaleTimeString());

    // ===== EMAIL HANDLING =====
    try {
      if (editingOrderId && selectedOrder) {
        const changes = detectOrderChanges(selectedOrder, orderData);
        if (changes.length > 0) {
          await sendOrderEmail(orderData, true, changes);
        }
      } else {
        await sendOrderEmail(orderData, false);
      }
    } catch (emailError) {
      console.warn('Email sending failed but order was saved:', emailError);
    }

    // ===== AUTO-INCREMENT ORDER NUMBER (NEW SAVES ONLY) =====
    if (status === 'saved' && !editingOrderId) {
      const current = parseInt(orderInfo.orderNumber);
      const next = (current + 1).toString().padStart(3, '0');
      setOrderInfo(prev => ({ ...prev, orderNumber: next }));
      setEditOrderNumber(false);
      console.log('🔢 Auto-incremented order number to:', next);
    }

    // ===== CLEAR EDITING STATE =====
    if (editingOrderId || existingDraftId) {
      setEditOrderNumber(false);
    }

  } catch (err) {
    console.error('❌ Save order error:', err);
    
    const errorMessage = err.message || '';
    
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate') || err.status === 409) {
      setOrderNumberError(true);
      setMessage('❌ This order number already exists. Please use a different number.');
      setEditOrderNumber(true);
    } else if (err.status === 500) {
      setMessage('❌ Server error occurred. Please try again or contact support.');
    } else {
      setMessage('❌ Failed to save order: ' + (errorMessage || 'Unknown error'));
    }
  }
};

  // ===== EFFECTS =====
  // Fetch all dynamic data on component mount
  // Add this debugging code to your OrderForm component's fetchMasterData function
// Replace the existing fetchMasterData function with this enhanced version:

// Function to save custom occasion to database
const saveCustomOccasion = async (occasionName, occasionCode) => {
  try {
    const response = await apiCall('/occasions', {
      method: 'POST',
      body: JSON.stringify({
        name: occasionName,
        code: occasionCode
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save occasion: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving custom occasion:', error);
    throw error;
  }
};

useEffect(() => {
  const fetchMasterData = async () => {
    try {
      setIsLoadingData(true);
      const token = localStorage.getItem('authToken');
      
      console.log('🔍 Starting fetchMasterData...');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // ===== FETCH USER PROFILE =====
      console.log('👤 Fetching user profile...');
      const userResponse = await apiCall('/auth/me');
      
      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user data: ${userResponse.status}`);
      }
      
      const userDataResponse = await userResponse.json();
      console.log('👤 Raw user data received:', userDataResponse);
      
      const userData = userDataResponse.user || userDataResponse;

      // Validate user has required data
      if (!userData.username) {
        throw new Error('Invalid user data: missing username');
      }

      console.log('👤 Processed user data:', {
        id: userData.id,
        username: userData.username,
        branchName: userData.branchName,
        branchCode: userData.branchCode,
        role: userData.role
      });

      // ===== FETCH BRANCHES =====
      console.log('🏢 Fetching branches...');
      const branchesResponse = await apiCall('/branches');
      
      if (!branchesResponse.ok) {
        throw new Error(`Failed to fetch branches: ${branchesResponse.status}`);
      }
      
      const branchesData = await branchesResponse.json();
      console.log('🏢 Raw branches data:', branchesData);
      
      // Convert branches array to object mapping
      const branchesObj = {};
      if (Array.isArray(branchesData) && branchesData.length > 0) {
        branchesData.forEach(branch => {
          if (branch.branchName && branch.branchCode) {
            branchesObj[branch.branchName] = branch.branchCode;
          }
        });
      } else {
        console.warn('⚠️ No branches data received or invalid format');
      }
      
      console.log('🏢 Processed branches mapping:', branchesObj);

      // ===== PROCESS USER BRANCH ASSIGNMENT =====
      const userBranchName = userData.branchName || userData.branch;
      const userBranchCode = userData.branchCode;

      console.log('🔍 User branch assignment analysis:', {
        userBranchName,
        userBranchCode,
        branchExistsInMapping: !!branchesObj[userBranchName],
        availableBranches: Object.keys(branchesObj)
      });

      // Validate user has branch information
      if (!userBranchName || !userBranchCode) {
        console.error('❌ User missing critical branch information');
        setMessage('❌ Your account is missing branch assignment. Please contact administrator.');
        setIsLoadingData(false);
        return;
      }

      // Handle branch mapping reconciliation
      let finalBranchName = userBranchName;
      let finalBranchCode = userBranchCode;
      let branchMappingUpdated = false;

      // Check if user's branch name exists in branches mapping
      if (!branchesObj[userBranchName]) {
        console.log('⚠️ User branch name not found in branches mapping');
        
        // Try to find a branch with matching code
        const foundBranchName = Object.keys(branchesObj).find(
          name => branchesObj[name] === userBranchCode
        );
        
        if (foundBranchName) {
          console.log('✅ Found existing branch with matching code:', foundBranchName);
          finalBranchName = foundBranchName;
        } else {
          console.log('🔧 User branch not in master branches list, adding it to mapping');
          branchesObj[userBranchName] = userBranchCode;
          branchMappingUpdated = true;
          finalBranchName = userBranchName;
        }
      } else {
        console.log('✅ User branch found in mapping');
      }

      // Final validation
      if (!branchesObj[finalBranchName]) {
        console.error('❌ Could not resolve user branch mapping');
        setMessage('❌ Could not resolve your branch assignment. Please contact administrator.');
        setIsLoadingData(false);
        return;
      }

      console.log('✅ Final branch resolution:', {
        finalBranchName,
        finalBranchCode,
        mappingValue: branchesObj[finalBranchName],
        branchMappingUpdated
      });

      // ===== SET USER DATA =====
      const finalUserData = {
        id: userData.id,
        username: userData.username,
        branch: finalBranchName,
        branchCode: finalBranchCode,
        role: userData.role || 'staff',
        displayName: userData.displayName || userData.username
      };

      setCurrentUser(finalUserData);
      
      // Update global user object
      user.branch = finalBranchName;
      user.role = userData.role || 'staff';

      // Set branches state
      setBranches(branchesObj);
      branchPrefixes = branchesObj;
	  
	  // ADD THIS CODE HERE:
// Replace the admin default branch section in fetchMasterData with this:
if (finalUserData.role === 'admin' && !selectedBranch) {
  // ✅ FIXED: Set default branch for admin users to BD (Beadon Street)
  const defaultBranchName = Object.keys(branchesObj).find(name => branchesObj[name] === 'BD');
  if (defaultBranchName) {
    setSelectedBranch(defaultBranchName);
    console.log('🏢 Admin default branch set to:', defaultBranchName);
  } else {
    // Fallback to first available branch if BD not found
    const firstBranch = Object.keys(branchesObj)[0];
    if (firstBranch) {
      setSelectedBranch(firstBranch);
      console.log('🏢 Admin fallback branch set to:', firstBranch);
    }
  }
}


      if (branchMappingUpdated) {
        setMessage(`ℹ️ Your branch "${finalBranchName}" was added to the system mapping.`);
      }

      // ===== FETCH BRAND DETAILS =====
      try {
        console.log('🏷️ Fetching brand details...');
        const brandResponse = await apiCall('/brand');
        
        if (brandResponse.ok) {
          const brandData = await brandResponse.json();
          console.log('🏷️ Brand data received:', brandData);
          setBrandDetails({
            displayName: brandData.displayName || brandData.name || 'Order Management',
            name: brandData.name || 'Brand'
          });
        } else {
          console.warn('⚠️ Brand fetch failed, using fallback');
          setBrandDetails({ displayName: 'Order Management', name: 'Brand' });
        }
      } catch (brandError) {
        console.warn('⚠️ Brand fetch error:', brandError);
        setBrandDetails({ displayName: 'Order Management', name: 'Brand' });
      }

      // ===== FETCH OCCASIONS =====
      try {
        console.log('🎉 Fetching occasions...');
        const occasionsResponse = await apiCall('/occasions');
        
        if (occasionsResponse.ok) {
          const occasionsData = await occasionsResponse.json();
          console.log('🎉 Occasions data received:', occasionsData);
          
          const occasionsObj = {};
          if (Array.isArray(occasionsData) && occasionsData.length > 0) {
            occasionsData.forEach(occasion => {
              if (occasion.name && occasion.code) {
                occasionsObj[occasion.name] = occasion.code;
              }
            });
          }
          
          // Ensure at least General exists
          if (Object.keys(occasionsObj).length === 0) {
            occasionsObj['General'] = 'GEN';
          } else if (!occasionsObj['General']) {
            occasionsObj['General'] = 'GEN';
          }
          
          console.log('🎉 Processed occasions:', occasionsObj);
          setOccasions(occasionsObj);
          occasionMap = occasionsObj;
        } else {
          console.warn('⚠️ Occasions fetch failed, using minimal default');
          const defaultOccasions = { 'General': 'GEN' };
          setOccasions(defaultOccasions);
          occasionMap = defaultOccasions;
        }
      } catch (occasionError) {
        console.warn('⚠️ Occasions fetch error:', occasionError);
        const defaultOccasions = { 'General': 'GEN' };
        setOccasions(defaultOccasions);
        occasionMap = defaultOccasions;
      }

      // ===== FETCH ITEMS =====
try {
  console.log('📦 Fetching items...');
  const itemsResponse = await apiCall('/items');
  
  if (itemsResponse.ok) {
    const itemsData = await itemsResponse.json();
    console.log('📦 Items data received, count:', Array.isArray(itemsData) ? itemsData.length : 'invalid format');
    
    if (Array.isArray(itemsData)) {
      // ✅ FIXED: Sort items alphabetically by name
      const sortedItems = itemsData.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setItems(sortedItems);
      itemList = sortedItems;
      console.log('✅ Items sorted alphabetically');
    } else {
      console.warn('⚠️ Items data is not an array, using empty array');
      setItems([]);
      itemList = [];
    }
  } else {
    console.warn('⚠️ Items fetch failed');
    setItems([]);
    itemList = [];
  }
} catch (itemsError) {
  console.warn('⚠️ Items fetch error:', itemsError);
  setItems([]);
  itemList = [];
}

      console.log('✅ Master data fetch completed successfully');
      console.log('📊 Final state summary:', {
        user: finalUserData,
        branchesCount: Object.keys(branchesObj).length,
        occasionsCount: Object.keys(occasions).length,
        itemsCount: itemList.length
      });
      
      setIsLoadingData(false);
      
    } catch (error) {
      console.error('❌ Error in fetchMasterData:', error);
      setMessage(`⚠️ Failed to load system data: ${error.message}`);
      setIsLoadingData(false);
      
      // Set minimal fallback values to prevent app from breaking
      setBrandDetails({ displayName: 'Order Management', name: 'Brand' });
      setCurrentUser(prev => ({
        ...prev,
        branch: prev.branch || 'Unknown Branch',
        branchCode: prev.branchCode || 'XX',
        role: prev.role || 'staff'
      }));
      
      // Set minimal occasions if none exist
      if (Object.keys(occasions).length === 0) {
        const minimalOccasions = { 'General': 'GEN' };
        setOccasions(minimalOccasions);
        occasionMap = minimalOccasions;
      }
    }
  };
  
  fetchMasterData();
}, []);

  // Handle selected order changes (populate form when editing)
  // Replace your selectedOrder useEffect with this:
useEffect(() => {
  if (selectedOrder && selectedOrder._id) {
    console.log('📝 Loading order for editing:', selectedOrder);
    
    setCustomer({
      name: selectedOrder.customerName || '',
      phone: selectedOrder.phone || '',
      address: selectedOrder.address || '',
      pincode: selectedOrder.pincode || '',
      city: selectedOrder.city || '',
      state: selectedOrder.state || '',
      email: selectedOrder.email || ''
    });

    // ✅ FIXED: Properly extract order prefix and number
    const orderNumberParts = selectedOrder.orderNumber?.split('-') || [];
    let extractedPrefix = 'XX-GEN';
    let extractedNumber = '001';
    
    if (orderNumberParts.length >= 3) {
      // Format: BD-GEN-001
      extractedPrefix = `${orderNumberParts[0]}-${orderNumberParts[1]}`;
      extractedNumber = orderNumberParts[2];
    } else if (orderNumberParts.length === 2) {
      // Format: BD-001 (fallback)
      extractedPrefix = `${orderNumberParts[0]}-GEN`;
      extractedNumber = orderNumberParts[1];
    }

    setOrderInfo({
      occasion: selectedOrder.occasion || 'General',
      orderPrefix: extractedPrefix,
      orderNumber: extractedNumber,
      orderDate: selectedOrder.orderDate || new Date().toISOString().split('T')[0],
      deliveryDate: selectedOrder.deliveryDate || '',
      deliveryTime: selectedOrder.deliveryTime || ''
    });

    setBoxes(selectedOrder.boxes || []);
    setExtraDiscount(selectedOrder.extraDiscount || { value: 0, type: 'value' });
    setAdvancePaid(selectedOrder.advancePaid || 0);
    setNotes(selectedOrder.notes || '');
    setMessage('');
    setEditOrderNumber(false);
    setEditingOrderId(selectedOrder._id);
    
    console.log('✅ Order loaded for editing:', {
      orderId: selectedOrder._id,
      orderNumber: selectedOrder.orderNumber,
      extractedPrefix,
      extractedNumber
    });
  }
}, [selectedOrder, currentUser.branch]);

  // Update totals when boxes/discounts change
  useEffect(() => {
    const subtotal = calculateSubtotal();
    setOriginalSubtotal(subtotal);

    let extra = 0;
    if (extraDiscount.type === 'percentage') {
      extra = (extraDiscount.value / 100) * subtotal;
    } else {
      extra = extraDiscount.value;
    }

    const total = subtotal - extra;
    setGrandTotal(total);

    // Validate discount inputs
    if (extraDiscount.type === 'percentage') {
      if (extraDiscount.value > 100) {
        setExtraDiscount(prev => ({ ...prev, value: 100 }));
        setMessage('⚠️ Percentage discount cannot exceed 100%. It has been reset to 100%.');
      } else if (extraDiscount.value < 0) {
        setExtraDiscount(prev => ({ ...prev, value: 0 }));
        setMessage('⚠️ Negative percentage is not allowed. Reset to 0%.');
      }
    }

    if (extraDiscount.type === 'value') {
      if (extraDiscount.value > subtotal) {
        setExtraDiscount(prev => ({ ...prev, value: subtotal }));
        setMessage('⚠️ Discount cannot exceed order subtotal. Adjusted to max allowed.');
      } else if (extraDiscount.value < 0) {
        setExtraDiscount(prev => ({ ...prev, value: 0 }));
        setMessage('⚠️ Discount cannot be negative. Reset to 0.');
      }
    }
  }, [extraDiscount, advancePaid, boxes]);

  // Update orderInfo when branches are loaded
  useEffect(() => {
    if (Object.keys(branches).length > 0 && !editingOrderId && currentUser.branch && currentUser.branch !== 'Loading...') {
      const normalizedBranch = normalizeBranchName(currentUser.branch, branches);
      setOrderInfo(prev => ({
        ...prev,
        orderPrefix: `${branches[normalizedBranch] || 'XX'}-GEN`
      }));
    }
  }, [branches, editingOrderId, currentUser.branch]);

  // Update available occasions when occasions data is fetched
  useEffect(() => {
    if (Object.keys(occasions).length > 0) {
      setAvailableOccasions(Object.keys(occasions).sort());
    }
  }, [occasions]);

  // Order number validation effect
useEffect(() => {
  if (!editOrderNumber || editingOrderId) return;

  const { orderPrefix, orderNumber } = orderInfo;
  if (!orderPrefix || !orderNumber) return;

  setIsCheckingOrderNumber(true);
  setOrderNumberStatus('checking');

  const delay = setTimeout(async () => {
    const isUnique = await checkOrderNumberUnique(orderPrefix, orderNumber);
    setIsCheckingOrderNumber(false);
    setOrderNumberStatus(isUnique ? 'available' : 'duplicate');
    setOrderNumberError(!isUnique);
  }, 500);

  return () => clearTimeout(delay);
}, [orderInfo.orderPrefix, orderInfo.orderNumber, editOrderNumber, editingOrderId]);

  // Generate unique order number when not editing
useEffect(() => {
  if (!editingOrderId) {
    generateUniqueOrderNumber();
  }
}, [editingOrderId, currentUser.branch, selectedBranch, branches, occasions, orderInfo.occasion]);

  // Before unload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasFormData()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasFormData]);

  // IMPROVED AUTO-SAVE WITH DRAFT MANAGEMENT - Replace the entire auto-save useEffect
useEffect(() => {
  let isMounted = true;
  let autoSaveTimer;
  
  const performAutoSave = async () => {
    if (!isMounted) return;
    
    // Enhanced conditions for auto-save
    const shouldAutoSave = (
      customer.name?.trim() && 
      customer.phone?.trim() && 
      orderInfo.orderPrefix && 
      orderInfo.orderNumber &&
      !editingOrderId && // Don't auto-save when editing existing orders
      boxes.some(box => box.items.some(item => item.name && item.name !== '')) && // At least one item
      calculateGrandTotal() > 0 && // Total > 0
      currentUser.branch !== 'Loading...' && // User data loaded
      !isCheckingOrderNumber // Don't auto-save while checking order number
    );
    
    if (!shouldAutoSave) {
      console.log('🚫 Auto-save skipped - conditions not met');
      return;
    }
    
    try {
      const draftOrderNumber = `${orderInfo.orderPrefix}-${orderInfo.orderNumber}`;
      
      // Check if a draft already exists for this order number
      const checkResponse = await apiCall(`/orders/check-draft?orderNumber=${encodeURIComponent(draftOrderNumber)}`);
      
      let existingDraftId = null;
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        existingDraftId = checkData.draftId;
      }
      
      // ✅ FIXED: Determine branch correctly for auto-save
      const determineBranch = () => {
        if (currentUser.role === 'admin') {
          // For admin, use the branch from the order prefix
          const prefixBranch = orderInfo.orderPrefix.split('-')[0];
          const branchName = Object.keys(branches).find(name => branches[name] === prefixBranch);
          return branchName || 'Misti Hub';
        } else {
          return currentUser.branch;
        }
      };

      const determineBranchCode = () => {
        if (currentUser.role === 'admin') {
          return orderInfo.orderPrefix.split('-')[0];
        } else {
          return branches[currentUser.branch];
        }
      };
      
      const autoSaveData = {
        customerName: customer.name,
        phone: customer.phone,
        address: customer.address,
        email: customer.email,
        pincode: customer.pincode,
        city: customer.city,
        state: customer.state,
        ...orderInfo,
        orderNumber: draftOrderNumber,
        branch: determineBranch(),
        branchCode: determineBranchCode(),
        createdBy: currentUser.displayName || currentUser.username || 'Unknown',
        boxes: boxes.map(calculateTotals),
        notes,
        extraDiscount: {
          value: extraDiscount.value || 0,
          type: extraDiscount.type || 'value'
        },
        advancePaid: advancePaid || 0,
        totalBoxCount: calculateTotalBoxCount(),
        grandTotal: calculateGrandTotal(),
        balance: calculateGrandTotal() - (advancePaid || 0),
        status: 'auto-saved',
        isDraft: true // Mark as draft
      };
      
      if (existingDraftId) {
        // Update existing draft
        autoSaveData._id = existingDraftId;
      }
      
      // ✅ FIXED: Use correct branch code for API call
      const branchCodeForAPI = autoSaveData.branchCode.toLowerCase();
      const saveResponse = await apiCall(`/orders/${branchCodeForAPI}`, {
        method: 'POST',
        body: JSON.stringify(autoSaveData)
      });
      
      if (saveResponse.ok) {
        if (existingDraftId) {
          console.log('💾 Auto-save: Updated existing draft', existingDraftId);
        } else {
          console.log('💾 Auto-save: Created new draft');
        }
        
        if (isMounted) {
          setLastSavedTime(new Date().toLocaleTimeString());
        }
      } else {
        console.log('❌ Auto-save failed with status:', saveResponse.status);
      }
    } catch (error) {
      console.log('❌ Auto-save failed:', error);
      // Don't show error messages for auto-save failures
    }
  };
  
  // Set up auto-save timer (every 60 seconds)
  if (isMounted) {
    autoSaveTimer = setInterval(performAutoSave, 60000);
  }
  
  return () => {
    isMounted = false;
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
    }
  };
}, [customer, orderInfo, boxes, notes, extraDiscount, advancePaid, currentUser, selectedBranch, branches, branchPrefixes, editingOrderId, isCheckingOrderNumber]);

  // Update document title
  useEffect(() => {
    document.title = `${brandDetails.displayName} - Order Management`;
  }, [brandDetails.displayName]);

  // ===== CALCULATE DISPLAY VALUES =====
  const totalBoxCount = calculateTotalBoxCount();
  const hasMultipleBoxes = boxes.length > 1 || boxes.some(box => box.boxCount > 1);
  const balance = grandTotal - advancePaid;
  const hasAdvance = advancePaid > 0;
  const hasDiscount = extraDiscount.value > 0;

  // ===== RENDER =====
  return (
  <div className="form-wrapper">
    {/* Loading Message */}
    {isLoadingData && (
      <div className="loading-message">
        🔄 Loading master data (branches, occasions, items)...
      </div>
    )}

    {/* Invalid Branch Warning */}
    {!isValidBranch(currentUser.branch) && (
      <div className="warning-message">
        ⚠️ Warning: Invalid branch detected ({currentUser.branch}). Please contact administrator.
      </div>
    )}
    
    {/* Floating Order Summary - Only shown for multiple boxes */}
    {hasMultipleBoxes && (
      <div className="order-float-summary" style={{ height: isOrderSummaryMinimized ? 'auto' : 'unset' }}>
        <div className="summary-header">
          <h4 style={{ margin: 0 }}>
            Order Summary 
            <span className="summary-badge">{totalBoxCount} boxes</span>
          </h4>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={toggleOrderSummaryMinimize} 
              className="btn-secondary" 
              style={{ padding: '5px 10px' }}
              title={isOrderSummaryMinimized ? "Expand" : "Minimize"}
            >
              {isOrderSummaryMinimized ? '⬆️' : '⬇️'}
            </button>
            {!isOrderSummaryMinimized && (
              <button 
                onClick={toggleOrderSummary} 
                className="btn-secondary" 
                style={{ padding: '5px 10px' }}
              >
                {showOrderSummary ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
        </div>
        
        {!isOrderSummaryMinimized && (
          <>
            {showOrderSummary ? (
              <>
                <table style={{ marginBottom: '10px' }}>
                  <thead>
                    <tr>
                      <th>Box Type</th>
                      <th>Box Count</th>
                      <th>Box Discount</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boxes.map((box, index) => (
                      <tr key={box.id}>
                        <td>Box #{index + 1}</td>
                        <td>{box.boxCount}</td>
                        <td>₹{box.discount > 0 ? (box.discount * box.boxCount).toFixed(2) : '0'}</td>
                        <td>₹{calculateBoxTotal(box)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold', backgroundColor: '#eee' }}>
                      <td>Total</td>
                      <td>{totalBoxCount}</td>
                      <td>₹{boxes.reduce((sum, box) => sum + (box.discount * box.boxCount), 0).toFixed(2)}</td>
                      <td>₹{boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <div style={{ marginBottom: '10px' }}>
                {boxes.map((box, index) => (
                  <div className="summary-row" key={box.id}>
                    <span>Box #{index + 1} ({box.boxCount} boxes)</span>
                    <span>₹{calculateTotals(box).total}</span>
                  </div>
                ))}
              </div>
            )}
            
            {hasDiscount && (
              <div className="summary-row">
                <span>Discount:</span>
                <span>- ₹{extraDiscount.type === 'percentage' 
                  ? ((calculateGrandTotal() + extraDiscount.value) * extraDiscount.value / 100).toFixed(2)
                  : extraDiscount.value}
                </span>
              </div>
            )}
            
            <div className="summary-row summary-total">
              <span>Amount Payable:</span>
              <span>₹{balance}</span>
            </div>
            
            {hasAdvance && (
              <>
                <div className="summary-row">
                  <span>Advance Paid:</span>
                  <span>₹{advancePaid}</span>
                </div>
                <div className="summary-row summary-total">
                  <span>Balance:</span>
                  <span>₹{balance}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    )}

    {/* Customer Information Card */}
    <div className="card">
      {editingOrderId && (
        <div className="editing-notice">
          ✏️ You are editing an existing order. Changes will overwrite the previous version.
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>Customer Information</h2>
        <div className="branch-badge">
          📍 {currentUser.branch} ({branches[currentUser.branch] || 'XX'})
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button onClick={handleNewOrderClick} className="btn-secondary">🆕 New Order</button>
      </div>
      
      <div className="form-grid">
        <div className="form-group">
          <label>Name<span className="required">*</span></label>
          <input 
            name="name" 
            value={customer.name} 
            onChange={handleCustomerChange} 
            className={validationErrors.name ? 'error-field' : ''}
            placeholder="Enter full name"
          />
          {validationErrors.name && <div className="error-message">{validationErrors.name}</div>}
        </div>
          <div className="form-group">
            <label>Phone<span className="required">*</span></label>
            <input 
              name="phone" 
              value={customer.phone} 
              onChange={handleCustomerChange} 
              className={validationErrors.phone ? 'error-field' : ''}
              placeholder="10-digit mobile number"
            />
            {validationErrors.phone && <div className="error-message">{validationErrors.phone}</div>}
          </div>
          <div className="form-group">
            <label>Email</label>
            <input 
              name="email" 
              value={customer.email} 
              onChange={handleCustomerChange}
              className={validationErrors.email ? 'error-field' : ''} 
              placeholder="Email address"
            />
            {validationErrors.email && <div className="error-message">{validationErrors.email}</div>}
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label>Address</label>
            <input 
              name="address" 
              value={customer.address} 
              onChange={handleCustomerChange} 
              placeholder="Street address"
            />
          </div>
          <div className="form-group">
            <label>PIN Code</label>
            <input 
              name="pincode" 
              value={customer.pincode} 
              onChange={handleCustomerChange}
              placeholder="6-digit PIN code"
              maxLength={6}
              className={validationErrors.pincode ? 'error-field' : ''}
            />
            {validationErrors.pincode && <div className="error-message">{validationErrors.pincode}</div>}
          </div>
          <div className="form-group">
            <label>City</label>
            <input 
              name="city" 
              value={customer.city} 
              onChange={handleCustomerChange}
              placeholder="City" 
            />
          </div>
          <div className="form-group">
            <label>State</label>
            <input 
              name="state" 
              value={customer.state} 
              onChange={handleCustomerChange}
              placeholder="State"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Order Information</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Occasion</label>
            <select name="occasion" value={orderInfo.occasion} onChange={handleOrderChange}>
              <option value="General">General</option>
              <option disabled>────────────</option>
              {availableOccasions.filter(o => o !== 'General').map((occasion) => (
  <option key={`available-${occasion}`} value={occasion}>{occasion}</option>
))}
              <option value="__add_new__">+ Add Custom Occasion</option>
            </select>
          </div>
          <div className="form-group">
  <label>Order Number</label>
  
  {/* Three separate fields for order number */}
  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
    {/* Prefix Field - Dropdown for admin, disabled input for staff */}
    {currentUser.role === 'admin' ? (
  <select
    value={orderInfo.orderPrefix.split('-')[0] || 'XX'}
    onChange={(e) => {
      const newPrefix = e.target.value;
      const occasionCode = orderInfo.orderPrefix.split('-')[1] || 'GEN';
      const fullPrefix = `${newPrefix}-${occasionCode}`;
      
      // Find the branch name for this code
      const selectedBranchName = Object.keys(branches).find(
        name => branches[name] === newPrefix
      );
      
      console.log('🏢 Admin selected branch:', selectedBranchName, 'Code:', newPrefix);
      
      setSelectedBranch(selectedBranchName); // ADD THIS LINE
      
      setOrderInfo(prev => ({
        ...prev,
        orderPrefix: fullPrefix
      }));
    }}
    disabled={!editOrderNumber}
    style={{ width: '80px' }}
    className={orderNumberError ? 'error-field' : ''}
    title="Branch Code"
  >
        {Object.entries(branches)
  .sort(([,a], [,b]) => a.localeCompare(b))
  .map(([branchName, branchCode]) => (
    <option key={`branch-${branchCode}`} value={branchCode}>
      {branchCode}
    </option>
  ))}
      </select>
    ) : (
      <input
        value={orderInfo.orderPrefix.split('-')[0] || 'XX'}
        disabled={true}
        style={{ width: '80px', backgroundColor: '#f0f0f0' }}
        className={orderNumberError ? 'error-field' : ''}
        title="Branch Code (Auto-set based on your branch)"
      />
    )}
    
    <span>-</span>
    
    {/* Occasion Field - Editable only for admin, disabled for staff */}
    {currentUser.role === 'admin' ? (
      <select
        value={orderInfo.orderPrefix.split('-')[1] || 'GEN'}
        onChange={(e) => {
          const branchCode = orderInfo.orderPrefix.split('-')[0] || 'XX';
          const newOccasionCode = e.target.value;
          const fullPrefix = `${branchCode}-${newOccasionCode}`;
          
          // Find the occasion name that matches this code
          const occasionName = Object.keys(occasions).find(
            name => occasions[name] === newOccasionCode
          ) || 'General';
          
          setOrderInfo(prev => ({
            ...prev,
            orderPrefix: fullPrefix,
            occasion: occasionName  // Sync the main occasion dropdown
          }));
        }}
        disabled={!editOrderNumber}
        style={{ width: '80px' }}
        className={orderNumberError ? 'error-field' : ''}
        title="Occasion Code"
      >
        {Object.entries(occasions)
  .sort(([,a], [,b]) => a.localeCompare(b))
  .map(([occasionName, occasionCode]) => (
    <option key={`occasion-${occasionCode}`} value={occasionCode}>
      {occasionCode}
    </option>
  ))}
      </select>
    ) : (
      <input
        value={orderInfo.orderPrefix.split('-')[1] || 'GEN'}
        disabled={true}
        style={{ width: '80px', backgroundColor: '#f0f0f0' }}
        className={orderNumberError ? 'error-field' : ''}
        title="Occasion Code (Auto-set based on selected occasion)"
      />
    )}
    
    <span>-</span>
    
    {/* Number Field - Editable for both admin and staff when edit is enabled */}
    <input
      name="orderNumber"
      value={orderInfo.orderNumber}
      onChange={handleOrderChange}
      disabled={!editOrderNumber}
      style={{ width: '80px' }}
      className={orderNumberError ? 'error-field' : ''}
      title="Order Number"
      placeholder="001"
    />
    
    <FaEdit 
      style={{ cursor: 'pointer' }} 
      onClick={toggleEditOrderNumber} 
      title="Edit Order Number" 
    />
    
    {editOrderNumber && (
      <div style={{ fontSize: '0.85rem', minWidth: '120px' }}>
        {isCheckingOrderNumber && <span style={{ color: '#888' }}>⏳ Checking...</span>}
        {orderNumberStatus === 'available' && <span style={{ color: 'green' }}>✔ Available</span>}
        {orderNumberStatus === 'duplicate' && <span style={{ color: '#ea5454' }}>❌ Already taken</span>}
      </div>
    )}
  </div>
  
  {orderNumberError && <div className="error-message">Order number is required and must be unique</div>}
</div>
          <div className="form-group">
            <label>Order Date</label>
            <input type="date" name="orderDate" value={orderInfo.orderDate} onChange={handleOrderChange} />
          </div>
          <div className="form-group">
            <label>Delivery Date</label>
            <input type="date" name="deliveryDate" value={orderInfo.deliveryDate} onChange={handleOrderChange} />
          </div>
          <div className="form-group">
            <label>Delivery Time</label>
            <input type="time" name="deliveryTime" value={orderInfo.deliveryTime} onChange={handleOrderChange} />
          </div>
        </div>
      </div>

      {/* Order Items & Boxes */}
      {boxes.map((box, boxIndex) => (
        <div className="card" key={box.id}>
          <h3>Box #{boxIndex + 1}</h3>
          
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Number of Boxes:</label>
            <input
              type="number"
              min="1"
              value={box.boxCount || 1}
              onChange={(e) => handleBoxCountChange(box.id, e.target.value)}
              style={{ width: '80px' }}
            />
          </div>
          
          {/* Item Rows */}
          <div className="item-header">
            <div style={{ flex: 2 }}>Item</div>
            <div style={{ flex: 1, width: '60px' }}>Qty</div>
            <div style={{ flex: 1 }}>Price (₹)</div>
            <div style={{ flex: 1 }}>Unit</div>
            <div style={{ flex: 1 }}>Amount (₹)</div>
            <div style={{ width: '40px' }}></div>
          </div>
          
          {validationErrors.items && (
            <div className="error-message" style={{ marginBottom: '10px' }}>{validationErrors.items}</div>
          )}
          
          {box.items.map((item) => (
            <div className="item-row" key={item.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              {!item.name || item.name !== '__custom__' ? (
                // Regular item dropdown
                // Fix 2: Also update the item dropdown rendering to ensure it stays sorted:
// In your item dropdown section, replace with:
<select
  value={item.name || ""}
  onChange={(e) => {
    const selectedValue = e.target.value;
    
    const updatedBoxes = boxes.map(b => {
      if (b.id !== box.id) return b;
      const updatedItems = b.items.map(i => {
        if (i.id !== item.id) return i;
        
        if (selectedValue === "__custom__") {
          return {
            ...i,
            name: "__custom__",
            customName: false
          };
        } else if (selectedValue) {
          const selected = itemList.find(listItem => listItem.name === selectedValue);
          if (selected) {
            return {
              ...i,
              name: selected.name,
              price: selected.price,
              unit: selected.unit || 'pcs',
              amount: i.qty * selected.price,
              customName: false
            };
          }
        }
        
        return {
          ...i,
          name: selectedValue,
          customName: false
        };
      });
      return { ...b, items: updatedItems };
    });
    
    setBoxes(updatedBoxes);
  }}
  style={{ flex: 2 }}
  className={(!item.name || (item.name === "__custom__" && !item.customName)) ? 'error-field' : ''}
>
  <option value="">Select Item</option>
  {/* ✅ FIXED: Items are already sorted, but ensure they stay sorted in display */}
  {itemList
    .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()))
    .map((i, index) => (
      <option key={`item-${i.name}-${index}`} value={i.name}>
        {i.name}
      </option>
    ))
  }
  <option value="__custom__">+ Custom Item</option>
</select>
) : (
  // ✅ FIXED: Custom item input field
  <input
    type="text"
    placeholder="Enter custom item name"
    value={item.name === '__custom__' ? '' : item.name || ''}
    onChange={(e) => {
      const newValue = e.target.value;
      
      const updatedBoxes = boxes.map(b => {
        if (b.id !== box.id) return b;
        
        const updatedItems = b.items.map(i => {
          if (i.id !== item.id) return i;
          
          return {
            ...i,
            name: newValue,
            customName: newValue.length > 0
          };
        });
        
        return { ...b, items: updatedItems };
      });
      
      setBoxes(updatedBoxes);
    }}
    style={{ flex: 2 }}
    className={(!item.customName || !item.name) ? 'error-field' : ''}
    autoFocus
  />
)}
              
              <input
                type="number"
                placeholder="Qty"
                min="1"
                value={item.qty}
                onChange={(e) => handleItemChange(box.id, item.id, 'qty', e.target.value)}
                style={{ flex: 1, width: '60px' }}
              />
              
              {item.name === '__custom__' ? (
                // Editable price for custom items
                <input
                  type="number"
                  placeholder="Price"
                  value={item.price || 0}
                  onChange={(e) => handleItemPriceChange(box.id, item.id, e.target.value)}
                  style={{ flex: 1 }}
                />
              ) : (
                // Read-only price for predefined items
                <input
                  type="number"
                  placeholder="Price"
                  value={item.price || 0}
                  style={{ flex: 1, backgroundColor: '#f0f0f0' }}
                  readOnly
                />
              )}
              
              {item.name === '__custom__' ? (
                // Unit dropdown for custom items
                <select 
                  value={item.unit || 'pcs'}
                  onChange={(e) => {
                    const updatedBoxes = boxes.map(b => {
                      if (b.id !== box.id) return b;
                      const updatedItems = b.items.map(i => {
                        if (i.id !== item.id) return i;
                        return { ...i, unit: e.target.value };
                      });
                      return { ...b, items: updatedItems };
                    });
                    setBoxes(updatedBoxes);
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="dozen">dozen</option>
                  <option value="box">box</option>
                  <option value="pack">pack</option>
                </select>
              ) : (
                // Read-only unit for predefined items
                <div style={{ flex: 1 }}>{item.unit || 'pcs'}</div>
              )}
              
              <div style={{ flex: 1 }}>₹{item.amount || 0}</div>
              
              <button 
  onClick={() => removeItem(box.id, item.id)} 
  className="remove-btn"
  disabled={box.items.length <= 1}
>
  ❌
</button>
            </div>
          ))}
          
          <button onClick={() => addItem(box.id)}>+ Add Item</button>
          
          {/* Box Summary */}
          <div className="box-summary" style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f7f7f7', borderRadius: '5px' }}>
            <p>Subtotal: ₹{box.items.reduce((sum, i) => sum + (i.amount || 0), 0)}</p>
            <p>Box Count: {box.boxCount || 1}</p>
            <p>Box Subtotal: ₹{box.items.reduce((sum, i) => sum + (i.amount || 0), 0) * (box.boxCount || 1)}</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {box.discount > 0 && (
                <div style={{ margin: '4px 0', fontWeight: 'bold', color: '#444' }}>
                  Box Discount: ₹{(box.discount * box.boxCount).toFixed(2)}
                </div>
              )}
              <label>Discount: </label>
              <input
                type="number"
                value={box.discount}
                onChange={(e) => handleBoxDiscountChange(box.id, Number(e.target.value))}
                style={{ width: '100px' }}
              />
            </div>
            <div><strong>Total: ₹{(calculateBoxTotal(box)).toLocaleString()}</strong></div>
            <button 
              onClick={() => removeBox(box.id)} 
              style={{ backgroundColor: '#ea5454' }}
              disabled={boxes.length <= 1}
            >🗑 Remove Box</button>
          </div>
        </div>
      ))}
      
      <button onClick={addBox} style={{ margin: '10px 0' }}>+ Add Box</button>

      {/* Order Summary */}
      <div className="card">
        <h3>Order Discount & Payment</h3>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <h4>Extra Discount</h4>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                value={extraDiscount.value}
                max={extraDiscount.type === 'percentage' ? 100 : grandTotal}
                onChange={(e) => {
                  const value = Number(e.target.value);

                  if (extraDiscount.type === 'percentage') {
                    if (value > 100) {
                      setExtraDiscount(prev => ({ ...prev, value: 100 }));
                      setMessage('⚠️ Percentage discount cannot exceed 100%. It has been reset to 100%.');
                      return;
                    }
                    if (value < 0) {
                      setExtraDiscount(prev => ({ ...prev, value: 0 }));
                      setMessage('⚠️ Discount cannot be negative. Reset to 0.');
                      return;
                    }
                  }

                  if (extraDiscount.type === 'value') {
                    if (value > grandTotal) {
                      setExtraDiscount(prev => ({ ...prev, value: grandTotal }));
                      setMessage('⚠️ Discount cannot exceed order total. Adjusted to max allowed.');
                      return;
                    }
                    if (value < 0) {
                      setExtraDiscount(prev => ({ ...prev, value: 0 }));
                      setMessage('⚠️ Discount cannot be negative. Reset to 0.');
                      return;
                    }
                  }

                  setMessage('');
                  setExtraDiscount(prev => ({ ...prev, value }));
                }}
                style={{
                  flex: 2,
                  border: message.includes('Discount') ? '1px solid #ea5454' : '',
                  backgroundColor: message.includes('Discount') ? '#ffeeee' : ''
                }}
              />

              <select
                value={extraDiscount.type}
                onChange={(e) => setExtraDiscount({ ...extraDiscount, type: e.target.value, value: 0 })}
                style={{ flex: 1 }}
              >
                <option value="value">₹</option>
                <option value="percentage">%</option>
              </select>
            </div>

            {message.includes('Discount') && (
              <p style={{ color: '#ea5454', fontSize: '0.85rem', marginTop: '5px' }}>
                {message}
              </p>
            )}
          </div>
          
          <div style={{ flex: 1 }}>
            <h4>Advance Paid</h4>
            <input
              type="number"
              value={advancePaid}
              onChange={(e) => setAdvancePaid(Number(e.target.value))}
            />
          </div>
        </div>
        
        {/* Enhanced conditional display of total information */}
        <div className="card" style={{ backgroundColor: '#f9f9f9', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Order Totals</h3>
          
          {/* Only show multiple box info if there are multiple boxes */}
          {hasMultipleBoxes && (
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '5px 0' }}>Box Count Summary</h4>
            </div>
          )}
          
          {/* Discount summary - only shown if there's a discount */}
          {hasDiscount && (
            <div style={{ marginBottom: '10px' }}>
              <p>
                <strong>Discount: </strong>
                {extraDiscount.type === 'percentage' 
                  ? `${extraDiscount.value}% (₹${(originalSubtotal * extraDiscount.value / 100).toFixed(2)})`
                  : `₹${extraDiscount.value}`}
              </p>
            </div>
          )}
          
          {/* Always show grand total */}
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#e8f5e9', 
            borderRadius: '4px',
            marginBottom: hasAdvance ? '10px' : '0'
          }}>
            <h3 style={{ margin: '0' }}>Grand Total: ₹{grandTotal}</h3>
          </div>
          
          {/* Only show advance and balance if advance is given */}
          {hasAdvance && (
            <div style={{ marginTop: '10px' }}>
              <p><strong>Advance Paid: </strong>₹{advancePaid}</p>
              <div style={{ 
                padding: '10px', 
                backgroundColor: balance > 0 ? '#fff8e1' : '#e8f5e9', 
                borderRadius: '4px' 
              }}>
                <h3 style={{ margin: '0' }}>Balance Remaining: ₹{balance}</h3>
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            {/* Box count summary - only shown if there are multiple boxes */}
            {hasMultipleBoxes && (
              <p><strong>Total Boxes: </strong>{totalBoxCount}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={(e) => handleSubmit(e, 'saved')} 
              disabled={isCheckingOrderNumber || isLoadingData}
              style={{ opacity: isCheckingOrderNumber ? 0.6 : 1, cursor: isCheckingOrderNumber ? 'not-allowed' : 'pointer' }}
            >
              💾 Save Order
            </button>
            <button 
              onClick={(e) => handleSubmit(e, 'held')} 
              className="btn-secondary"
              disabled={isCheckingOrderNumber || isLoadingData}
              style={{ opacity: isCheckingOrderNumber ? 0.6 : 1, cursor: isCheckingOrderNumber ? 'not-allowed' : 'pointer' }}
            >
              ✋ Hold Order
            </button>
            <button onClick={handleNewOrderClick} className="btn-secondary">🆕 New Order</button>
          </div>
        </div>
        
        {message && (
          <div className={message.startsWith('✅') ? 'success' : 'error'} 
               style={{ padding: '10px', borderRadius: '4px', backgroundColor: message.startsWith('✅') ? '#e8f5e9' : '#ffebee' }}>
            {message}
          </div>
        )}
      </div>

      {/* Custom Occasion Modal */}
      {customOccasionModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Add Custom Occasion</h3>
            <input
              placeholder="Occasion Name"
              value={newOccasion}
              onChange={(e) => setNewOccasion(e.target.value)}
              onBlur={() => {
                if (newOccasion.trim()) {
                  const words = newOccasion.trim().split(/\s+/);
                  const autoPrefix = words.length === 1
                    ? words[0].slice(0, 3)
                    : words.map(w => w[0]).join('').slice(0, 3);
                  setNewPrefix(autoPrefix.toUpperCase());
                }
              }}
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <input
                placeholder="Prefix (3 letters)"
                value={newPrefix}
                maxLength={3}
                onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                required
              />
              <FaEdit style={{ cursor: 'pointer' }} title="Edit Prefix" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={async () => {
  try {
    // Save to database first
    await saveCustomOccasion(newOccasion, newPrefix);
    
    // Update local state
    const updatedOccasions = [...new Set([...availableOccasions, newOccasion])].sort();
    const updatedOccasionsObj = { ...occasions, [newOccasion]: newPrefix };
    
    setOccasions(updatedOccasionsObj);
    occasionMap[newOccasion] = newPrefix; // Update global variable
    setAvailableOccasions(updatedOccasions);
    
    const branchCode = (currentUser.branch && currentUser.branch !== 'Loading...') 
      ? branches[currentUser.branch] || 'XX' 
      : 'XX';
    const fullPrefix = `${branchCode}-${newPrefix}`;
    
    setOrderInfo({ ...orderInfo, occasion: newOccasion, orderPrefix: fullPrefix });
    setCustomOccasionModal(false);
    setNewOccasion('');
    setNewPrefix('');
    setMessage('✅ Custom occasion saved successfully!');
  } catch (error) {
    setMessage('❌ Failed to save custom occasion. Please try again.');
  }
}}
              >Save</button>
              <button className="btn-secondary" onClick={() => setCustomOccasionModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Unsaved Changes</h3>
            <p>You have unsaved changes. What would you like to do?</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={(e) => handleSubmit(e, pendingAction)}>💾 Save</button>
              <button onClick={(e) => handleSubmit(e, 'held')}>✋ Hold</button>
              <button
                onClick={() => {
                  setShowConfirmationModal(false);
                  setPendingAction(null);
                  ref?.current?.resetForm();
                }}
                className="btn-secondary"
              >
                ❌ Discard
              </button>
              <button onClick={() => setShowConfirmationModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#777' }}>
        {lastSavedTime && <p>💾 Auto-saved at {lastSavedTime}</p>}
      </div>
    </div>
  );
});

export default OrderForm;