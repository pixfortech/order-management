import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaEdit } from 'react-icons/fa';
import '../appResponsive.css';
import FancyButton from './FancyButton';
import styled from 'styled-components';

// ============================================================================
// GLOBAL VARIABLES & UTILITIES
// ============================================================================

// Global data cache - populated from API
let branchPrefixes = {};
let occasionMap = {};
let itemList = [];

// Authentication helper
const getAuthToken = () => localStorage.getItem('authToken');

// ============================================================================
// API UTILITIES
// ============================================================================

const apiCall = async (endpoint, options = {}) => {
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
  
  const baseUrl = `${getApiUrl()}/api`;
  const url = `${baseUrl}${endpoint}`;
  
  const defaultOptions = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const token = getAuthToken();
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }
  
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: { ...defaultOptions.headers, ...options.headers },
  };
  
  return await fetch(url, finalOptions);
};

// ============================================================================
// DATA CREATION UTILITIES
// ============================================================================

const createInitialItem = () => ({
  id: uuidv4(),
  name: '',
  qty: 1,
  price: 0,
  amount: 0,
  unit: 'pcs'
});

const createInitialBox = () => ({
  id: uuidv4(),
  items: [createInitialItem()],
  discount: 0,
  boxCount: 1,
  total: 0,
});

// ============================================================================
// MAIN ORDERFORM COMPONENT
// ============================================================================

const OrderForm = React.forwardRef(({ selectedOrder, setSelectedOrder, onOrderUpdate }, ref) => {
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  // Master Data States
  const [branches, setBranches] = useState({});
  const [occasions, setOccasions] = useState({});
  const [items, setItems] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [brandDetails, setBrandDetails] = useState({ displayName: 'Loading...', name: 'Brand' });
  const [selectedBranch, setSelectedBranch] = useState(null);
  
  const [buttonState, setButtonState] = useState({
    saved: false,
    held: false,
    newOrder: false,
  });
  
  const [saved, setSaved] = useState(false);
const [held, setHeld] = useState(false);
const [newOrder, setNewOrder] = useState(false);

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;

  button {
    transition: background-color 0.5s ease, color 0.5s ease;
  }

  .button-inner-static {
    display: inline-block;
    position: relative;
    transition: opacity 0.5s ease, transform 0.5s ease;
    white-space: nowrap;
  }
`;

  
  // User Information
  const [currentUser, setCurrentUser] = useState({
    id: null,
    username: null,
    branch: 'Loading...',
    branchCode: null,
    role: 'staff',
    displayName: null
  });
  
  // Customer Information
  const [customer, setCustomer] = useState({ 
    name: '', 
    phone: '', 
    address: '', 
    pincode: '',
    city: '',
    state: '',
    email: '' 
  });
  
  // Order Information
  const [orderInfo, setOrderInfo] = useState({
    occasion: 'General',
    orderPrefix: 'XX-GEN',
    orderNumber: '001',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    deliveryTime: '10:00'
  });
  
  // Order Items & Pricing
  const [boxes, setBoxes] = useState(() => [createInitialBox()]);
  const [extraDiscount, setExtraDiscount] = useState({ value: 0, type: 'value' });
  const [advancePaid, setAdvancePaid] = useState(0);
  const [balancePaid, setBalancePaid] = useState(0);
  const [notes, setNotes] = useState('');
  
  // UI Control States
  const [message, setMessage] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [customOccasionModal, setCustomOccasionModal] = useState(false);
  const [newOccasion, setNewOccasion] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isOrderSummaryMinimized, setIsOrderSummaryMinimized] = useState(false);
  const [editOrderNumber, setEditOrderNumber] = useState(false);
  const [orderNumberError, setOrderNumberError] = useState(false);
  const [isCheckingOrderNumber, setIsCheckingOrderNumber] = useState(false);
  const [orderNumberStatus, setOrderNumberStatus] = useState('idle');
  const [validationErrors, setValidationErrors] = useState({});
  const [availableOccasions, setAvailableOccasions] = useState([]);
  
  // ==========================================================================
  // CALCULATION FUNCTIONS
  // ==========================================================================
  
  const calculateBoxTotal = useCallback((box) => {
    const itemsSubtotal = box.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const boxSubtotal = itemsSubtotal * box.boxCount;
    const boxDiscount = box.discount > 0 ? box.discount * box.boxCount : 0;
    return boxSubtotal - boxDiscount;
  }, []);

  const calculateGrandTotal = useCallback(() => {
    const boxTotals = boxes.map(calculateBoxTotal);
    const subtotal = boxTotals.reduce((a, b) => a + b, 0);
    const extraDiscountAmount = extraDiscount.value > 0
      ? (extraDiscount.type === 'percentage' ? (extraDiscount.value / 100) * subtotal : extraDiscount.value)
      : 0;
    return subtotal - extraDiscountAmount;
  }, [boxes, extraDiscount, calculateBoxTotal]);

  const calculateTotalBoxCount = useCallback(() => {
    return boxes.reduce((sum, box) => sum + (box.boxCount || 1), 0);
  }, [boxes]);

  // ==========================================================================
  // VALIDATION FUNCTIONS
  // ==========================================================================
  
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!customer.name?.trim()) errors.name = 'Name is required';
    if (!customer.phone?.trim()) errors.phone = 'Phone is required';
    if (!orderInfo.orderPrefix || !orderInfo.orderNumber) errors.orderNumber = 'Order number is required';
    
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      errors.email = "Invalid email format";
    }
    
    if (customer.pincode && customer.pincode.length !== 6) {
      errors.pincode = "PIN code must be 6 digits";
    }
    
    const hasEmptyItems = boxes.some(box => 
      box.items.some(item => !item.name || item.name === "" || (item.name === "__custom__" && !item.customName))
    );
    
    if (hasEmptyItems) {
      errors.items = "All items must have names";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customer, orderInfo, boxes]);

  const hasFormData = useCallback(() => {
    const hasCustomerData = Object.values(customer).some(value => value?.trim?.() !== '');
    const hasItemData = boxes.some(box => box.items.some(item => item.name && item.name !== ''));
    const hasSpecialSettings = extraDiscount.value > 0 || advancePaid > 0 || notes.trim() !== '' || orderInfo.occasion !== 'General';
    return hasCustomerData || hasItemData || hasSpecialSettings;
  }, [customer, boxes, extraDiscount, advancePaid, notes, orderInfo.occasion]);

  // ==========================================================================
  // ORDER NUMBER MANAGEMENT
  // ==========================================================================
  
  const checkOrderNumberUnique = async (orderPrefix, orderNumber) => {
    try {
      const fullOrderNumber = `${orderPrefix}-${orderNumber}`;
      const response = await apiCall(`/orders/check-number?orderNumber=${encodeURIComponent(fullOrderNumber)}`);
      if (!response.ok) return true;
      const data = await response.json();
      return !data.exists;
    } catch (error) {
      console.error('Error checking order number uniqueness:', error);
      return true;
    }
  };

  const generateUniqueOrderNumber = async () => {
  // Don't generate if editing an existing order
  if (editingOrderId || selectedOrder) {
    console.log('Skipping order number generation - editing existing order');
    return;
  }

  let activeBranch, branchCode;
  
  if (currentUser.role === 'admin') {
    activeBranch = selectedBranch || 'Beadon Street';
    branchCode = branches[activeBranch] || 'BD';
    if (!selectedBranch) setSelectedBranch('Beadon Street');
  } else {
    activeBranch = currentUser.branch;
    branchCode = branches[currentUser.branch];
  }
  
  if (!activeBranch || activeBranch === 'Loading...' || !branchCode) {
    setOrderInfo(prev => ({ ...prev, orderPrefix: 'BD-GEN', orderNumber: '001' }));
    return;
  }
  
  const currentOccasion = orderInfo.occasion || 'General';
  const occasionPrefix = occasions[currentOccasion] || 'GEN';
  const prefix = `${branchCode}-${occasionPrefix}`;

  try {
    const response = await apiCall(`/orders/last-number/${encodeURIComponent(prefix)}`);
    if (response.ok) {
      const data = await response.json();
      const nextNumber = ((data?.lastNumber || 0) + 1).toString().padStart(3, '0');
      setOrderInfo(prev => ({ ...prev, orderPrefix: prefix, orderNumber: nextNumber }));
    } else {
      setOrderInfo(prev => ({ ...prev, orderPrefix: prefix, orderNumber: '001' }));
    }
    setOrderNumberError(false);
  } catch (error) {
    console.error("Failed to fetch last order number:", error);
    setOrderInfo(prev => ({ ...prev, orderPrefix: prefix, orderNumber: '001' }));
    setMessage('⚠️ Could not auto-generate order number. Using default 001.');
  }
};

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    let validatedValue = value;
    let isValid = true;
    
    switch (name) {
      case 'name':
        validatedValue = value.toLowerCase().split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        isValid = /^[A-Za-z\s.]*$/.test(value);
        break;
        
      case 'phone':
        validatedValue = value.replace(/[^0-9]/g, '').slice(0, 10);
        isValid = validatedValue.length === 10 || validatedValue.length === 0;
        break;
        
      case 'email':
        validatedValue = value.toLowerCase();
        isValid = !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validatedValue);
        break;
        
      case 'pincode':
        validatedValue = value.replace(/[^0-9]/g, '').slice(0, 6);
        // Auto-populate city/state for known PIN codes
        if (validatedValue.length === 6) {
          const pincodeMap = {
            '700006': { city: 'Kolkata', state: 'West Bengal' },
            '110001': { city: 'New Delhi', state: 'Delhi' },
            '400001': { city: 'Mumbai', state: 'Maharashtra' }
          };
          if (pincodeMap[validatedValue]) {
            setCustomer(prev => ({ ...prev, ...pincodeMap[validatedValue] }));
          }
        }
        break;
        
      default:
        // For address, city, state - apply proper case formatting
        if (['address', 'city', 'state'].includes(name)) {
          validatedValue = value.toLowerCase().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
        }
    }
    
    setCustomer(prev => ({ ...prev, [name]: validatedValue }));
    
    // Update validation errors
    if (!isValid && value) {
      setValidationErrors(prev => ({ ...prev, [name]: `Invalid ${name}` }));
    } else if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleOrderChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'occasion') {
      if (value === '__add_new__') {
        setCustomOccasionModal(true);
        return;
      }
      
      let branchCode;
      if (currentUser.role === 'admin' && selectedBranch) {
        branchCode = branches[selectedBranch];
      } else {
        branchCode = branches[currentUser.branch];
      }
      
      const finalBranchCode = branchCode || 'XX';
      const occasionPrefix = occasions[value] || value.slice(0, 3).toUpperCase();
      const fullPrefix = `${finalBranchCode}-${occasionPrefix}`;
      
      setOrderInfo({ ...orderInfo, occasion: value, orderPrefix: fullPrefix });
    } else {
      setOrderInfo({ ...orderInfo, [name]: value });
    }
  };

  // ==========================================================================
  // ITEM & BOX MANAGEMENT
  // ==========================================================================

  const handleItemChange = (boxId, itemId, field, value) => {
    setBoxes(prevBoxes => {
      return prevBoxes.map((box) => {
        if (box.id !== boxId) return box;
        
        const updatedItems = box.items.map((item) => {
          if (item.id !== itemId) return item;
          
          let processedValue = value;
          
          if (field === 'qty' || field === 'price') {
            if (value === "") {
              processedValue = "";
            } else {
              processedValue = parseFloat(value);
              if (isNaN(processedValue)) {
                processedValue = field === 'qty' ? 1 : 0;
              }
            }
          }
          
          const updatedItem = { ...item, [field]: processedValue };
          
          // Recalculate amount
          if (field === 'qty' || field === 'price') {
            const qty = typeof updatedItem.qty === 'number' ? updatedItem.qty : (parseFloat(updatedItem.qty) || 0);
            const price = typeof updatedItem.price === 'number' ? updatedItem.price : (parseFloat(updatedItem.price) || 0);
            updatedItem.amount = qty * price;
          }
          
          return updatedItem;
        });
        
        return { ...box, items: updatedItems };
      });
    });
  };

  const addItem = (boxId) => {
    setBoxes(prevBoxes => 
      prevBoxes.map(box =>
        box.id === boxId
          ? { ...box, items: [...box.items, createInitialItem()] }
          : box
      )
    );
  };

  const removeItem = (boxId, itemId) => {
    setBoxes(boxes.map(box =>
      box.id === boxId
        ? { ...box, items: box.items.filter(item => item.id !== itemId) }
        : box
    ));
  };

  const addBox = () => {
    setBoxes([...boxes, createInitialBox()]);
  };

  const removeBox = (boxId) => {
    setBoxes(boxes.filter(box => box.id !== boxId));
  };

  const handleBoxCountChange = (boxId, count) => {
    const newCount = Number(count) || 1;
    setBoxes(prevBoxes => 
      prevBoxes.map((box) => 
        box.id === boxId ? { ...box, boxCount: newCount } : box
      )
    );
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

  // ==========================================================================
  // EMAIL SERVICE
  // ==========================================================================

  const sendOrderEmail = async (orderData, isModification = false, changes = null) => {
    if (!orderData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderData.email.trim())) {
      return; // Skip if no valid email
    }

    try {
      const subtotal = orderData.boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0);
      const extraDiscountAmount = orderData.extraDiscount?.value > 0
        ? (orderData.extraDiscount.type === 'percentage'
          ? (orderData.extraDiscount.value / 100) * subtotal
          : orderData.extraDiscount.value)
        : 0;
      const finalTotal = subtotal - extraDiscountAmount;
      const balance = finalTotal - (orderData.advancePaid || 0) - (orderData.balancePaid || 0);

      const emailPayload = {
        to: orderData.email.trim(),
        customerName: orderData.customerName,
        orderNumber: orderData.orderNumber,
        orderData: {
          ...orderData,
          calculatedTotals: { subtotal, extraDiscountAmount, finalTotal, balance }
        },
        isModification,
        changes: changes || [],
        brandDetails: brandDetails,
        fromEmail: 'ganguramonline@gmail.com'
      };

      const response = await apiCall('/emails/send-order-email', {
        method: 'POST',
        body: JSON.stringify(emailPayload)
      });

      if (response.ok) {
        setMessage(prev => {
          const baseMessage = prev || '';
          const emailSuffix = isModification 
            ? ' 📧 Order update email sent to customer.'
            : ' 📧 Order confirmation email sent to customer.';
          return baseMessage.includes('📧') ? baseMessage : baseMessage + emailSuffix;
        });
      }
    } catch (error) {
      console.error('Email service error:', error);
    }
  };

  // ==========================================================================
  // FORM SUBMISSION
  // ==========================================================================

  // Fixed handleSubmit function with proper error handling and data validation

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
  
  // Validation checks
  if (!currentUser.branch || currentUser.branch === 'Loading...') {
    setMessage('❌ Cannot save order: User branch information not loaded');
    return;
  }

  if (calculateGrandTotal() <= 0) {
    setMessage('❌ Cannot save order: Total amount must be greater than 0');
    return;
  }

  // ✅ DEFINE fullOrderNumber HERE - BEFORE using it in orderData
  const fullOrderNumber = `${orderInfo.orderPrefix}-${orderInfo.orderNumber}`;

  // Check for uniqueness on new orders
  if (!editingOrderId) {
    const isUnique = await checkOrderNumberUnique(orderInfo.orderPrefix, orderInfo.orderNumber);
    if (!isUnique) {
      setOrderNumberError(true);
      setMessage('❌ This order number already exists. Please choose a different one.');
      setEditOrderNumber(true);
      return;
    }
  }

  // ✅ FIXED: Calculate balance properly and handle payment timestamps
  const grandTotal = calculateGrandTotal();
  const finalAdvancePaid = Number(advancePaid) || 0;
  const finalBalancePaid = Number(balancePaid) || 0;
  const calculatedBalance = Math.max(0, grandTotal - finalAdvancePaid - finalBalancePaid);

  // ✅ NEW: Handle payment timestamps
  const currentTimestamp = new Date().toISOString();
  const existingOrder = selectedOrder || {};
  
  // Payment timestamp logic
  let advancePaidDate = existingOrder.advancePaidDate;
  let balancePaidDate = existingOrder.balancePaidDate;
  
  // Set advance paid timestamp if advance is being added for the first time
  if (finalAdvancePaid > 0 && !existingOrder.advancePaid) {
    advancePaidDate = currentTimestamp;
  }
  
  // Set balance paid timestamp if balance payment is being added/updated
  if (finalBalancePaid > 0 && finalBalancePaid !== (existingOrder.balancePaid || 0)) {
    balancePaidDate = currentTimestamp;
  }

  // ✅ FIXED: Ensure proper branch code extraction
  const branchCodeForAPI = currentUser.role === 'admin' ? 
    orderInfo.orderPrefix.split('-')[0]?.toLowerCase() : 
    (branches[currentUser.branch] || 'bd').toLowerCase();

  // Create order data
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
    branch: currentUser.role === 'admin' ? 
      (Object.keys(branches).find(name => branches[name] === orderInfo.orderPrefix.split('-')[0]) || 'Beadon Street') :
      currentUser.branch,
    branchCode: currentUser.role === 'admin' ? 
      orderInfo.orderPrefix.split('-')[0] : 
      branches[currentUser.branch],
    createdBy: currentUser.displayName || currentUser.username || 'Unknown',
    boxes: boxes.map(box => ({ 
      ...box, 
      total: calculateBoxTotal(box),
      // Ensure all items have proper IDs
      items: box.items.map(item => ({
        ...item,
        id: item.id || uuidv4(),
        amount: Number(item.amount) || 0,
        qty: Number(item.qty) || 1,
        price: Number(item.price) || 0
      }))
    })),
    notes,
    extraDiscount: { 
      value: Number(extraDiscount.value) || 0, 
      type: extraDiscount.type || 'value' 
    },
    
    // ✅ CRITICAL FIX: Ensure all payment fields are included with timestamps
    advancePaid: finalAdvancePaid,
    balancePaid: finalBalancePaid,
    balance: calculatedBalance,
    
    // ✅ NEW: Payment timestamps
    advancePaidDate: finalAdvancePaid > 0 ? advancePaidDate : null,
    balancePaidDate: finalBalancePaid > 0 ? balancePaidDate : null,
    
    totalBoxCount: calculateTotalBoxCount(),
    grandTotal: grandTotal,
    status: status,
    isDraft: false
  };

  // ✅ IMPORTANT: Add the order ID if editing
  if (editingOrderId) {
    orderData._id = editingOrderId;
  }

  // 🔍 DEBUG: Log the order data being sent
  console.log('📤 Sending order data to API:', {
    orderId: editingOrderId,
    orderNumber: fullOrderNumber,
    branchCodeForAPI: branchCodeForAPI,
    endpoint: editingOrderId ? `PUT /api/orders/${branchCodeForAPI}/${editingOrderId}` : `POST /api/orders/${branchCodeForAPI}`,
    orderData: orderData
  });

  // Replace the try-catch block in handleSubmit with this enhanced version for precise debugging

try {
  let saveResponse;
  
  // ✅ Log the exact data being sent to identify the problematic field
  console.log('🔍 ORDER DATA BEING SENT:', JSON.stringify(orderData, null, 2));
  console.log('🔍 EDITING ORDER ID:', editingOrderId);
  console.log('🔍 BRANCH CODE FOR API:', branchCodeForAPI);
  
  if (editingOrderId) {
    // ✅ Check if we're accidentally including fields that shouldn't be updated
    const { _id, createdAt, updatedAt, __v, ...updateOnlyData } = orderData;
    
    console.log('🔍 UPDATE DATA (without system fields):', JSON.stringify(updateOnlyData, null, 2));
    
    console.log(`🔄 Updating existing order via PUT: /api/orders/${branchCodeForAPI}/${editingOrderId}`);
    saveResponse = await apiCall(`/orders/${branchCodeForAPI}/${editingOrderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateOnlyData) // Send data without system fields
    });
  } else {
    console.log(`🆕 Creating new order via POST: /api/orders/${branchCodeForAPI}`);
    saveResponse = await apiCall(`/orders/${branchCodeForAPI}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
  }

  // ✅ Enhanced response logging
  console.log('📥 API Response:', {
    status: saveResponse.status,
    statusText: saveResponse.statusText,
    headers: Object.fromEntries(saveResponse.headers.entries()),
    url: saveResponse.url
  });
  
  if (!saveResponse.ok) {
    // ✅ Get the exact error from the server
    let errorData;
    const contentType = saveResponse.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      errorData = await saveResponse.json();
    } else {
      const errorText = await saveResponse.text();
      errorData = { message: errorText || `HTTP ${saveResponse.status} Error` };
    }
    
    // ✅ Log the complete error context
    console.error('❌ COMPLETE ERROR CONTEXT:', {
      status: saveResponse.status,
      statusText: saveResponse.statusText,
      errorData: errorData,
      requestData: editingOrderId ? 'UPDATE_DATA_LOGGED_ABOVE' : orderData,
      endpoint: saveResponse.url
    });
    
    throw new Error(errorData.message || `Server responded with ${saveResponse.status}: ${saveResponse.statusText}`);
  }

  // Success handling remains the same...
  const responseData = await saveResponse.json().catch(() => ({}));
  console.log('✅ Order saved successfully, response data:', responseData);

  setMessage(`✅ Order ${status === 'held' ? 'held' : 'saved'} successfully!`);

  if (onOrderUpdate) {
    onOrderUpdate();
  }

  // Enhanced event dispatch for better communication
  window.dispatchEvent(new CustomEvent('orderUpdated', { 
    detail: { 
      orderNumber: fullOrderNumber, 
      orderId: editingOrderId || responseData._id || 'new',
      action: status,
      balanceUpdated: editingOrderId && (balancePaid > 0),
      timestamp: Date.now()
    } 
  }));

  // Also trigger a storage event for cross-tab communication
  localStorage.setItem('orderUpdated', Date.now().toString());
  localStorage.removeItem('orderUpdated');

  // Send email notification
  await sendOrderEmail(orderData, !!editingOrderId);

  // Auto-increment order number for new saves
  if (status === 'saved' && !editingOrderId) {
    const current = parseInt(orderInfo.orderNumber);
    const next = (current + 1).toString().padStart(3, '0');
    setOrderInfo(prev => ({ ...prev, orderNumber: next }));
    setEditOrderNumber(false);
  }

} catch (err) {
  // ✅ Enhanced error logging to pinpoint the exact issue
  console.error('❌ DETAILED SAVE ERROR:', {
    errorMessage: err.message,
    errorStack: err.stack,
    orderDataKeys: Object.keys(orderData),
    editingOrderId: editingOrderId,
    fullOrderNumber: fullOrderNumber,
    branchCodeForAPI: branchCodeForAPI,
    currentUser: currentUser,
    // Log specific fields that commonly cause issues
    suspiciousFields: {
      hasInvalidIds: orderData.boxes?.some(box => 
        !box.id || box.items?.some(item => !item.id)
      ),
      hasEmptyNames: orderData.boxes?.some(box => 
        box.items?.some(item => !item.name || item.name.trim() === '')
      ),
      hasInvalidNumbers: orderData.boxes?.some(box => 
        box.items?.some(item => 
          isNaN(item.qty) || isNaN(item.price) || isNaN(item.amount)
        )
      ),
      orderNumberFormat: fullOrderNumber,
      branchCode: orderData.branchCode,
      grandTotal: orderData.grandTotal,
      advancePaid: orderData.advancePaid,
      balancePaid: orderData.balancePaid
    }
  });
  
  const errorMessage = err.message || '';
  
  if (errorMessage.includes('unique') || errorMessage.includes('duplicate') || err.status === 409) {
    setOrderNumberError(true);
    setMessage('❌ This order number already exists. Please use a different number.');
    setEditOrderNumber(true);
  } else if (errorMessage.includes('Plan executor')) {
    setMessage('❌ Database constraint error. Check console for details. This usually means duplicate data or invalid field values.');
  } else {
    setMessage('❌ Failed to save order: ' + (errorMessage || 'Unknown error occurred. Check console for details.'));
  }
}
};

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsLoadingData(true);
        const token = localStorage.getItem('authToken');
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        // Fetch user profile
        const userResponse = await apiCall('/auth/me');
        if (!userResponse.ok) {
          throw new Error(`Failed to fetch user data: ${userResponse.status}`);
        }
        
        const userDataResponse = await userResponse.json();
        const userData = userDataResponse.user || userDataResponse;

        if (!userData.username) {
          throw new Error('Invalid user data: missing username');
        }

        // Fetch branches
        const branchesResponse = await apiCall('/branches');
        if (!branchesResponse.ok) {
          throw new Error(`Failed to fetch branches: ${branchesResponse.status}`);
        }
        
        const branchesData = await branchesResponse.json();
        const branchesObj = {};
        
        if (Array.isArray(branchesData)) {
          branchesData.forEach(branch => {
            if (branch.branchName && branch.branchCode) {
              branchesObj[branch.branchName] = branch.branchCode;
            }
          });
        }

        // Process user branch data
        const userBranchName = userData.branchName || userData.branch;
        const userBranchCode = userData.branchCode;

        if (!userBranchName || !userBranchCode) {
          setMessage('❌ Your account is missing branch assignment. Please contact administrator.');
          setIsLoadingData(false);
          return;
        }

        // Add user branch to mapping if not present
        if (!branchesObj[userBranchName]) {
          branchesObj[userBranchName] = userBranchCode;
        }

        const finalUserData = {
          id: userData.id,
          username: userData.username,
          branch: userBranchName,
          branchCode: userBranchCode,
          role: userData.role || 'staff',
          displayName: userData.displayName || userData.username
        };

        setCurrentUser(finalUserData);
        setBranches(branchesObj);
        branchPrefixes = branchesObj;

        // Set default branch for admin users
        if (finalUserData.role === 'admin' && !selectedBranch) {
          const defaultBranchName = Object.keys(branchesObj).find(name => branchesObj[name] === 'BD') || Object.keys(branchesObj)[0];
          if (defaultBranchName) {
            setSelectedBranch(defaultBranchName);
          }
        }

        // Fetch brand details
        try {
          const brandResponse = await apiCall('/brand');
          if (brandResponse.ok) {
            const brandData = await brandResponse.json();
            setBrandDetails({
              displayName: brandData.displayName || brandData.name || 'Order Management',
              name: brandData.name || 'Brand'
            });
          }
        } catch (brandError) {
          setBrandDetails({ displayName: 'Order Management', name: 'Brand' });
        }

        // Fetch occasions
        try {
          const occasionsResponse = await apiCall('/occasions');
          if (occasionsResponse.ok) {
            const occasionsData = await occasionsResponse.json();
            const occasionsObj = {};
            
            if (Array.isArray(occasionsData)) {
              occasionsData.forEach(occasion => {
                if (occasion.name && occasion.code) {
                  occasionsObj[occasion.name] = occasion.code;
                }
              });
            }
            
            if (!occasionsObj['General']) {
              occasionsObj['General'] = 'GEN';
            }
            
            setOccasions(occasionsObj);
            occasionMap = occasionsObj;
          }
        } catch (occasionError) {
          const defaultOccasions = { 'General': 'GEN' };
          setOccasions(defaultOccasions);
          occasionMap = defaultOccasions;
        }

        // Fetch items
        try {
          const itemsResponse = await apiCall('/items');
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            if (Array.isArray(itemsData)) {
              const sortedItems = itemsData.sort((a, b) => 
                (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
              );
              setItems(sortedItems);
              itemList = sortedItems;
            }
          }
        } catch (itemsError) {
          setItems([]);
          itemList = [];
        }

        setIsLoadingData(false);
        
      } catch (error) {
        console.error('Error in fetchMasterData:', error);
        setMessage(`⚠️ Failed to load system data: ${error.message}`);
        setIsLoadingData(false);
        
        // Set fallback values
        setBrandDetails({ displayName: 'Order Management', name: 'Brand' });
        setCurrentUser(prev => ({
          ...prev,
          branch: prev.branch || 'Unknown Branch',
          branchCode: prev.branchCode || 'XX',
          role: prev.role || 'staff'
        }));
        
        if (Object.keys(occasions).length === 0) {
          const minimalOccasions = { 'General': 'GEN' };
          setOccasions(minimalOccasions);
          occasionMap = minimalOccasions;
        }
      }
    };
    
    fetchMasterData();
  }, []);

  // ==========================================================================
  // SIDE EFFECTS & WATCHERS
  // ==========================================================================

  // Load selected order for editing
  useEffect(() => {
    if (selectedOrder && selectedOrder._id) {
      setCustomer({
        name: selectedOrder.customerName || '',
        phone: selectedOrder.phone || '',
        address: selectedOrder.address || '',
        pincode: selectedOrder.pincode || '',
        city: selectedOrder.city || '',
        state: selectedOrder.state || '',
        email: selectedOrder.email || ''
      });

      const orderNumberParts = selectedOrder.orderNumber?.split('-') || [];
      let extractedPrefix = 'XX-GEN';
      let extractedNumber = '001';
      
      if (orderNumberParts.length >= 3) {
        extractedPrefix = `${orderNumberParts[0]}-${orderNumberParts[1]}`;
        extractedNumber = orderNumberParts[2];
      }

      setOrderInfo({
        occasion: selectedOrder.occasion || 'General',
        orderPrefix: extractedPrefix,
        orderNumber: extractedNumber,
        orderDate: selectedOrder.orderDate || new Date().toISOString().split('T')[0],
        deliveryDate: selectedOrder.deliveryDate || '',
        deliveryTime: selectedOrder.deliveryTime || ''
      });

      // Ensure all boxes and items have IDs
      const boxesWithIds = (selectedOrder.boxes || []).map(box => ({
        ...box,
        id: box.id || uuidv4(),
        items: (box.items || []).map(item => ({
          ...item,
          id: item.id || uuidv4()
        }))
      }));
      
      setBoxes(boxesWithIds);
      setExtraDiscount(selectedOrder.extraDiscount || { value: 0, type: 'value' });
      setAdvancePaid(selectedOrder.advancePaid || 0);
      setBalancePaid(selectedOrder.balancePaid || 0);
      setNotes(selectedOrder.notes || '');
      setMessage('');
      setEditOrderNumber(false);
      setEditingOrderId(selectedOrder._id);
    }
  }, [selectedOrder]);

  // Validate discount and balance payments
  useEffect(() => {
    const subtotal = boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0);
    
    // Validate extra discount
    if (extraDiscount.type === 'percentage') {
      if (extraDiscount.value > 100) {
        setExtraDiscount(prev => ({ ...prev, value: 100 }));
        setMessage('⚠️ Percentage discount cannot exceed 100%.');
      } else if (extraDiscount.value < 0) {
        setExtraDiscount(prev => ({ ...prev, value: 0 }));
        setMessage('⚠️ Discount cannot be negative.');
      }
    }

    if (extraDiscount.type === 'value') {
      if (extraDiscount.value > subtotal) {
        setExtraDiscount(prev => ({ ...prev, value: subtotal }));
        setMessage('⚠️ Discount cannot exceed order subtotal.');
      } else if (extraDiscount.value < 0) {
        setExtraDiscount(prev => ({ ...prev, value: 0 }));
        setMessage('⚠️ Discount cannot be negative.');
      }
    }

    // Validate balance paid
    const total = calculateGrandTotal();
    const maxBalancePayment = Math.max(0, total - (advancePaid || 0));
    if ((balancePaid || 0) > maxBalancePayment) {
      setBalancePaid(maxBalancePayment);
      setMessage('⚠️ Balance paid exceeds remaining balance.');
    }
  }, [extraDiscount, advancePaid, balancePaid, boxes, calculateGrandTotal, calculateBoxTotal]);

  // Generate order number when conditions change
  useEffect(() => {
  if (!editingOrderId && !selectedOrder) {
    generateUniqueOrderNumber();
  }
}, [editingOrderId, selectedOrder, currentUser.branch, selectedBranch, branches, occasions]);

// Separate useEffect for occasion changes that only affects new orders
useEffect(() => {
  if (!editingOrderId && !selectedOrder && orderInfo.occasion) {
    generateUniqueOrderNumber();
  }
}, [orderInfo.occasion]);

  // Update available occasions
  useEffect(() => {
    if (Object.keys(occasions).length > 0) {
      setAvailableOccasions(Object.keys(occasions).sort());
    }
  }, [occasions]);

  // Order number validation
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

  // Before unload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasFormData()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasFormData]);

  // Update document title
  useEffect(() => {
    document.title = `${brandDetails.displayName} - Order Management`;
  }, [brandDetails.displayName]);

  // ==========================================================================
  // REF EXPOSURE FOR PARENT COMPONENT
  // ==========================================================================

  React.useImperativeHandle(ref, () => ({
    resetForm: () => {
      setCustomer({ name: '', phone: '', address: '', pincode: '', city: '', state: '', email: '' });
      setOrderInfo({
        occasion: 'General',
        orderPrefix: 'XX-GEN',
        orderNumber: '001',
        orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        deliveryTime: '10:00'
      });
      setBoxes([createInitialBox()]);
      setNotes('');
      setExtraDiscount({ value: 0, type: 'value' });
      setAdvancePaid(0);
      setBalancePaid(0);
      setMessage('');
      setValidationErrors({});
      setEditingOrderId(null);
      
      if (setSelectedOrder) {
        setSelectedOrder(null);
      }
      
      generateUniqueOrderNumber();
    }
  }));

  // ==========================================================================
  // UTILITY FUNCTIONS FOR RENDER
  // ==========================================================================

  const totalBoxCount = calculateTotalBoxCount();
  const hasMultipleBoxes = boxes.length > 1 || boxes.some(box => box.boxCount > 1);
  const balance = calculateGrandTotal() - (advancePaid || 0) - (balancePaid || 0);
  const hasAdvance = advancePaid > 0;
  const hasBalancePayment = balancePaid > 0;
  const hasDiscount = extraDiscount.value > 0;

  const toggleOrderSummary = () => setShowOrderSummary(!showOrderSummary);
  const toggleOrderSummaryMinimize = () => setIsOrderSummaryMinimized(!isOrderSummaryMinimized);
  const toggleEditOrderNumber = () => setEditOrderNumber(!editOrderNumber);
  
  const handleNewOrderClick = () => {
    if (hasFormData()) {
      setShowConfirmationModal(true);
      setPendingAction('newOrder');
    } else {
      ref?.current?.resetForm();
    }
  };
  
  const animateButton = useCallback((key) => {
    setButtonState((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setButtonState((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  }, []);

  const handleSaveOrder = async () => {
    await new Promise((res) => setTimeout(res, 500));
    animateButton('saved');
    return true;
  };

  const handleHoldOrder = async () => {
    await new Promise((res) => setTimeout(res, 500));
    animateButton('held');
    return true;
  };

  const handleNewOrder = async () => {
    await new Promise((res) => setTimeout(res, 500));
    animateButton('newOrder');
    return true;
  };


  // ==========================================================================
  // RENDER COMPONENT
  // ==========================================================================

  return (
    <div className="form-wrapper">
      {/* Loading State */}
      {isLoadingData && (
        <div className="loading-message">
          🔄 Loading master data (branches, occasions, items)...
        </div>
      )}

      {/* Floating Order Summary for Multiple Boxes */}
      {hasMultipleBoxes && (
        <div className="floating-summary" style={{ height: isOrderSummaryMinimized ? 'auto' : 'unset' }}>
          <div className="summary-header">
            <h4 style={{ margin: 0 }}>
              Order Summary 
              <span className="summary-badge">{boxes.length} types, {totalBoxCount} total</span>
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
                <table style={{ marginBottom: '10px' }}>
                  <thead>
                    <tr>
                      <th>Box Type</th>
                      <th>Count</th>
                      <th>Discount</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boxes.map((box, index) => (
                      <tr key={box.id}>
                        <td>Box #{index + 1}</td>
                        <td>{box.boxCount}</td>
                        <td>₹{box.discount > 0 ? (box.discount * box.boxCount).toFixed(2) : '0'}</td>
                        <td>₹{calculateBoxTotal(box).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ marginBottom: '10px' }}>
                  {boxes.map((box, index) => (
                    <div className="summary-row" key={box.id}>
                      <span>Box #{index + 1} ({box.boxCount} boxes)</span>
                      <span>₹{calculateBoxTotal(box).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {hasDiscount && (
                <div className="summary-row">
                  <span>Discount:</span>
                  <span>- ₹{extraDiscount.type === 'percentage' 
                    ? (calculateGrandTotal() * extraDiscount.value / (100 - extraDiscount.value)).toFixed(2)
                    : extraDiscount.value.toFixed(2)}
                  </span>
                </div>
              )}
              
              <div className="summary-row summary-total">
                <span>Amount Payable:</span>
                <span>₹{calculateGrandTotal().toFixed(2)}</span>
              </div>
              
              {(hasAdvance || hasBalancePayment) && (
                <>
                  {hasAdvance && (
                    <div className="summary-row">
                      <span>Advance Paid:</span>
                      <span>₹{advancePaid.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {hasBalancePayment && (
                    <div className="summary-row">
                      <span>Balance Paid:</span>
                      <span>₹{balancePaid.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="summary-row summary-total">
                    <span>{balance > 0 ? 'Balance Remaining:' : 'Status:'}</span>
                    <span>{balance > 0 ? `₹${balance.toFixed(2)}` : 'Fully Paid ✅'}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Customer Information Section */}
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
              autoComplete="name"
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
              autoComplete="tel"
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
              autoComplete="email"
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
              autoComplete="street-address"
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
              autoComplete="postal-code"
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
              autoComplete="address-level2"
            />
          </div>
          
          <div className="form-group">
            <label>State</label>
            <input 
              name="state" 
              value={customer.state} 
              onChange={handleCustomerChange}
              placeholder="State"
              autoComplete="address-level1"
            />
          </div>
        </div>
      </div>

      {/* Order Information Section */}
      <div className="card">
        <h2>Order Information</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Occasion</label>
            <select name="occasion" value={orderInfo.occasion} onChange={handleOrderChange}>
              <option value="General">General</option>
              <option disabled>────────────</option>
              {availableOccasions.filter(o => o !== 'General').map((occasion) => (
                <option key={occasion} value={occasion}>{occasion}</option>
              ))}
              <option value="__add_new__">+ Add Custom Occasion</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Order Number</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Branch Code */}
              {currentUser.role === 'admin' ? (
                <select
                  value={orderInfo.orderPrefix.split('-')[0] || 'XX'}
                  onChange={(e) => {
                    const newPrefix = e.target.value;
                    const occasionCode = orderInfo.orderPrefix.split('-')[1] || 'GEN';
                    const fullPrefix = `${newPrefix}-${occasionCode}`;
                    
                    const selectedBranchName = Object.keys(branches).find(
                      name => branches[name] === newPrefix
                    );
                    
                    setSelectedBranch(selectedBranchName);
                    setOrderInfo(prev => ({ ...prev, orderPrefix: fullPrefix }));
                  }}
                  disabled={!editOrderNumber}
                  style={{ width: '80px' }}
                  className={orderNumberError ? 'error-field' : ''}
                >
                  {Object.entries(branches)
                    .sort(([,a], [,b]) => a.localeCompare(b))
                    .map(([branchName, branchCode]) => (
                      <option key={branchCode} value={branchCode}>{branchCode}</option>
                    ))}
                </select>
              ) : (
                <input
                  value={orderInfo.orderPrefix.split('-')[0] || 'XX'}
                  disabled={true}
                  style={{ width: '80px', backgroundColor: '#f0f0f0' }}
                  className={orderNumberError ? 'error-field' : ''}
                />
              )}
              
              <span>-</span>
              
              {/* Occasion Code */}
              {currentUser.role === 'admin' ? (
                <select
                  value={orderInfo.orderPrefix.split('-')[1] || 'GEN'}
                  onChange={(e) => {
                    const branchCode = orderInfo.orderPrefix.split('-')[0] || 'XX';
                    const newOccasionCode = e.target.value;
                    const fullPrefix = `${branchCode}-${newOccasionCode}`;
                    
                    const occasionName = Object.keys(occasions).find(
                      name => occasions[name] === newOccasionCode
                    ) || 'General';
                    
                    setOrderInfo(prev => ({
                      ...prev,
                      orderPrefix: fullPrefix,
                      occasion: occasionName
                    }));
                  }}
                  disabled={!editOrderNumber}
                  style={{ width: '80px' }}
                  className={orderNumberError ? 'error-field' : ''}
                >
                  {Object.entries(occasions)
                    .sort(([,a], [,b]) => a.localeCompare(b))
                    .map(([occasionName, occasionCode]) => (
                      <option key={occasionCode} value={occasionCode}>{occasionCode}</option>
                    ))}
                </select>
              ) : (
                <input
                  value={orderInfo.orderPrefix.split('-')[1] || 'GEN'}
                  disabled={true}
                  style={{ width: '80px', backgroundColor: '#f0f0f0' }}
                  className={orderNumberError ? 'error-field' : ''}
                />
              )}
              
              <span>-</span>
              
              {/* Order Number */}
              <input
                name="orderNumber"
                value={orderInfo.orderNumber}
                onChange={handleOrderChange}
                disabled={!editOrderNumber}
                style={{ width: '80px' }}
                className={orderNumberError ? 'error-field' : ''}
                placeholder="001"
                autoComplete="off"
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
            <input 
              type="date" 
              name="orderDate" 
              value={orderInfo.orderDate} 
              onChange={handleOrderChange}
            />
          </div>
          
          <div className="form-group">
            <label>Delivery Date</label>
            <input 
              type="date" 
              name="deliveryDate" 
              value={orderInfo.deliveryDate} 
              onChange={handleOrderChange}
            />
          </div>
          
          <div className="form-group">
            <label>Delivery Time</label>
            <input 
              type="time" 
              name="deliveryTime" 
              value={orderInfo.deliveryTime} 
              onChange={handleOrderChange}
            />
          </div>
        </div>
      </div>

      {/* Order Items & Boxes */}
      {boxes.map((box, boxIndex) => (
        <div className="card" key={box.id}>
          <h2>Box #{boxIndex + 1} Items</h2>
          
          {/* Items List */}
          {box.items.map((item, itemIndex) => (
            <div 
              className="item-row" 
              key={item.id}
              style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}
            >
              {/* Item Name Selection */}
              {!item.name || item.name !== '__custom__' ? (
                <select
                  value={item.name || ""}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    setBoxes(prevBoxes => prevBoxes.map(b => {
                      if (b.id !== box.id) return b;
                      const updatedItems = b.items.map(i => {
                        if (i.id !== item.id) return i;
                        if (selectedValue === "__custom__") {
                          return { ...i, name: "__custom__", customName: false };
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
                        return { ...i, name: selectedValue, customName: false };
                      });
                      return { ...b, items: updatedItems };
                    }));
                  }}
                  style={{ flex: 2 }}
                  className={(!item.name || (item.name === "__custom__" && !item.customName)) ? 'error-field' : ''}
                >
                  <option value="">Select Item</option>
                  {itemList.map((i, index) => (
                    <option key={`item-${i.name}-${index}`} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                  <option value="__custom__">+ Custom Item</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter custom item name"
                  value={item.name === '__custom__' ? '' : item.name || ''}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setBoxes(prevBoxes => prevBoxes.map(b => {
                      if (b.id !== box.id) return b;
                      const updatedItems = b.items.map(i => {
                        if (i.id !== item.id) return i;
                        return { ...i, name: newValue, customName: newValue.length > 0 };
                      });
                      return { ...b, items: updatedItems };
                    }));
                  }}
                  style={{ flex: 2 }}
                  className={(!item.customName || !item.name) ? 'error-field' : ''}
                  autoFocus
                />
              )}
              
              {/* Quantity */}
              <input
                type="number"
                placeholder="Qty"
                min="0.001"
                step="0.001"
                value={item.qty === 0 ? "" : (item.qty || "")}
                onChange={(e) => handleItemChange(box.id, item.id, 'qty', e.target.value)}
                onBlur={(e) => {
                  if (e.target.value === "" || parseFloat(e.target.value) <= 0) {
                    handleItemChange(box.id, item.id, 'qty', 1);
                  }
                }}
                style={{ flex: 1, width: '60px' }}
              />
              
              {/* Price */}
              <input
                type="number"
                placeholder="Price"
                min="0"
                step="0.01"
                value={item.price === 0 ? "" : (item.price || "")}
                onChange={(e) => handleItemChange(box.id, item.id, 'price', e.target.value)}
                onBlur={(e) => {
                  if (e.target.value === "") {
                    handleItemChange(box.id, item.id, 'price', 0);
                  }
                }}
                style={{ flex: 1 }}
              />
              
              {/* Unit */}
              {item.name === '__custom__' ? (
                <select 
                  value={item.unit || 'pcs'}
                  onChange={(e) => handleItemChange(box.id, item.id, 'unit', e.target.value)}
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
                <div style={{ flex: 1 }}>{item.unit || 'pcs'}</div>
              )}
              
              {/* Amount */}
              <div style={{ flex: 1 }}>₹{(item.amount || 0).toFixed(2)}</div>
              
              {/* Remove Button */}
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
            <p>Subtotal: ₹{box.items.reduce((sum, i) => sum + (i.amount || 0), 0).toFixed(2)}</p>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <label>Box Count: </label>
              <input
                type="number"
                min="1"
                value={box.boxCount || 1}
                onChange={(e) => handleBoxCountChange(box.id, e.target.value)}
                style={{ width: '80px' }}
              />
              <span>boxes</span>
            </div>
            
            <p>Box Subtotal: ₹{(box.items.reduce((sum, i) => sum + (i.amount || 0), 0) * (box.boxCount || 1)).toFixed(2)}</p>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label>Discount: </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={box.discount}
                onChange={(e) => handleBoxDiscountChange(box.id, Number(e.target.value))}
                style={{ width: '100px' }}
              />
            </div>
            
            {box.discount > 0 && (
              <div style={{ margin: '4px 0', fontWeight: 'bold', color: '#444' }}>
                Box Discount: ₹{(box.discount * box.boxCount).toFixed(2)}
              </div>
            )}
            
            <div><strong>Total: ₹{calculateBoxTotal(box).toFixed(2)}</strong></div>
            
            <button 
              onClick={() => removeBox(box.id)} 
              style={{ backgroundColor: '#ea5454', marginTop: '10px' }}
              disabled={boxes.length <= 1}
            >
              🗑 Remove Box
            </button>
          </div>
        </div>
      ))}
      
      <button onClick={addBox} style={{ margin: '10px 0' }}>+ Add Box</button>

      {/* Order Summary - Discount & Payment */}
      <div className="card">
        <h3>Order Discount & Payment</h3>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          {/* Extra Discount */}
          <div style={{ flex: 1 }}>
            <h4>Extra Discount</h4>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                step="0.01"
                max={extraDiscount.type === 'percentage' ? 100 : calculateGrandTotal()}
                value={extraDiscount.value}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  const grandTotal = calculateGrandTotal();

                  if (extraDiscount.type === 'percentage') {
                    if (value > 100) {
                      setExtraDiscount(prev => ({ ...prev, value: 100 }));
                      setMessage('⚠️ Percentage discount cannot exceed 100%.');
                      return;
                    }
                    if (value < 0) {
                      setExtraDiscount(prev => ({ ...prev, value: 0 }));
                      setMessage('⚠️ Discount cannot be negative.');
                      return;
                    }
                  }

                  if (extraDiscount.type === 'value') {
                    if (value > grandTotal) {
                      setExtraDiscount(prev => ({ ...prev, value: grandTotal }));
                      setMessage('⚠️ Discount cannot exceed order total.');
                      return;
                    }
                    if (value < 0) {
                      setExtraDiscount(prev => ({ ...prev, value: 0 }));
                      setMessage('⚠️ Discount cannot be negative.');
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
                autoComplete="off"
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
          
          {/* Advance Paid */}
          <div style={{ flex: 1 }}>
            <h4>Advance Paid</h4>
            <input
              type="number"
              min="0"
              step="0.01"
              value={advancePaid}
              onChange={(e) => setAdvancePaid(Number(e.target.value))}
              autoComplete="off"
            />
          </div>
          
          {/* Balance Paid - Only show when editing existing orders */}
          {editingOrderId && (
            <div style={{ flex: 1 }}>
              <h4>Balance Paid</h4>
              <input
                type="number"
                min="0"
                step="0.01"
                max={Math.max(0, calculateGrandTotal() - (advancePaid || 0))}
                value={balancePaid}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  const maxBalance = Math.max(0, calculateGrandTotal() - (advancePaid || 0));
                  
                  if (value > maxBalance) {
                    setBalancePaid(maxBalance);
                    setMessage('⚠️ Balance paid cannot exceed remaining balance.');
                  } else if (value < 0) {
                    setBalancePaid(0);
                    setMessage('⚠️ Balance paid cannot be negative.');
                  } else {
                    setBalancePaid(value);
                    setMessage('');
                  }
                }}
                autoComplete="off"
                placeholder="Enter balance payment"
              />
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                Max: ₹{Math.max(0, calculateGrandTotal() - (advancePaid || 0)).toFixed(2)}
              </div>
            </div>
          )}
        </div>
        
        {/* Payment Summary - Only show when there are payments */}
        {(advancePaid > 0 || balancePaid > 0) && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>💰 Payment Summary</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <strong>Order Total:</strong> ₹{calculateGrandTotal().toFixed(2)}
              </div>
              <div>
                <strong>Total Paid:</strong> ₹{((advancePaid || 0) + (balancePaid || 0)).toFixed(2)}
              </div>
            </div>
            
            {advancePaid > 0 && (
              <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#28a745' }}>✓ Advance Paid:</span> ₹{(advancePaid || 0).toFixed(2)}
              </div>
            )}
            
            {balancePaid > 0 && (
              <div style={{ marginBottom: '5px' }}>
                <span style={{ color: '#28a745' }}>✓ Balance Paid:</span> ₹{(balancePaid || 0).toFixed(2)}
              </div>
            )}
            
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: balance > 0.01 ? '#fff3cd' : '#d4edda',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              {balance > 0.01 
                ? `💳 Remaining Balance: ₹${balance.toFixed(2)}` 
                : '🎉 Fully Paid!'}
            </div>
          </div>
        )}
      </div>

      {/* Order Totals Summary */}
      <div className="card" style={{ backgroundColor: '#f9f9f9', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0 }}>Order Totals</h3>
        
        {/* Box count summary for multiple boxes */}
        {hasMultipleBoxes && (
          <div style={{ marginBottom: '15px' }}>
            <p><strong>Distinct Box Types: </strong>{boxes.length}</p>
            <p><strong>Total Boxes: </strong>
              {boxes.map((box, index) => `Box ${index + 1}: ${box.boxCount || 1}`).join(' + ')} = {totalBoxCount}
            </p>
          </div>
        )}
        
        {/* Discount summary */}
        {hasDiscount && (
          <div style={{ marginBottom: '10px' }}>
            <p>
              <strong>Discount: </strong>
              {extraDiscount.type === 'percentage' 
                ? `${extraDiscount.value}% (₹${(calculateGrandTotal() * extraDiscount.value / (100 - extraDiscount.value)).toFixed(2)})`
                : `₹${extraDiscount.value}`}
            </p>
          </div>
        )}
        
        {/* Grand total */}
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '4px',
          marginBottom: hasAdvance || hasBalancePayment ? '10px' : '0'
        }}>
          <h3 style={{ margin: '0' }}>Grand Total: ₹{calculateGrandTotal().toFixed(2)}</h3>
        </div>
        
        {/* Payment breakdown */}
        {(hasAdvance || hasBalancePayment) && (
          <div style={{ marginTop: '10px' }}>
            {hasAdvance && (
              <p><strong>Advance Paid: </strong>₹{(advancePaid || 0).toFixed(2)}</p>
            )}
            
            {hasBalancePayment && (
              <p><strong>Balance Paid: </strong>₹{(balancePaid || 0).toFixed(2)}</p>
            )}
            
            <div style={{ 
              padding: '10px', 
              backgroundColor: balance > 0 ? '#fff8e1' : '#e8f5e9', 
              borderRadius: '4px' 
            }}>
              <h3 style={{ margin: '0' }}>
                {balance > 0 
                  ? `Balance Remaining: ₹${balance.toFixed(2)}` 
                  : 'Fully Paid ✅'}
              </h3>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div className="button-group">
  <ButtonContainer>
      <FancyButton
        defaultText="Save Order"
        hoverText="Click to save"
        successText="Saved"
        defaultColor="#49488D"
        hoverColor="#FFD700"
        successColor="#28a745"
        onClick={handleSaveOrder}
        isSuccess={buttonState.saved}
      />

      <FancyButton
        defaultText="Hold Order"
        hoverText="Temporarily hold"
        successText="Held"
        defaultColor="#8884D8"
        hoverColor="#FFD700"
        successColor="#FFA500"
        onClick={handleHoldOrder}
        isSuccess={buttonState.held}
      />

      <FancyButton
        defaultText="New Order"
        hoverText="Start fresh"
        successText="Reset"
        defaultColor="#764ba2"
        hoverColor="#FFD700"
        successColor="#20B2AA"
        onClick={handleNewOrder}
        isSuccess={buttonState.newOrder}
      />
    </ButtonContainer>
</div>
      </div>
      
      {/* Notes Section */}
      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label>Order Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions or notes..."
          rows={3}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
      </div>
      
      {/* Status Messages */}
      {message && (
        <div 
          className={message.startsWith('✅') ? 'success' : 'error'} 
          style={{ 
            padding: '10px', 
            borderRadius: '4px', 
            backgroundColor: message.startsWith('✅') ? '#e8f5e9' : '#ffebee',
            marginBottom: '20px'
          }}
        >
          {message}
        </div>
      )}

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
              autoComplete="off"
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <input
                placeholder="Prefix (3 letters)"
                value={newPrefix}
                maxLength={3}
                onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                required
                autoComplete="off"
              />
              <FaEdit style={{ cursor: 'pointer' }} title="Edit Prefix" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={async () => {
                  try {
                    // Save custom occasion to database
                    const response = await apiCall('/occasions', {
                      method: 'POST',
                      body: JSON.stringify({ name: newOccasion, code: newPrefix })
                    });

                    if (!response.ok) {
                      throw new Error(`Failed to save occasion: ${response.status}`);
                    }
                    
                    // Update local state
                    const updatedOccasions = [...new Set([...availableOccasions, newOccasion])].sort();
                    const updatedOccasionsObj = { ...occasions, [newOccasion]: newPrefix };
                    
                    setOccasions(updatedOccasionsObj);
                    occasionMap[newOccasion] = newPrefix;
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
              >
                Save
              </button>
              <button className="btn-secondary" onClick={() => setCustomOccasionModal(false)}>
                Cancel
              </button>
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
    </div>
  );
});

export default OrderForm;