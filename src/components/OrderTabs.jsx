import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  FaTrash, FaEye, FaEdit, FaPrint, FaSearch,
  FaScroll, FaChevronDown, FaChevronRight, FaCheck, FaEllipsisV
} from 'react-icons/fa';
import './OrderTabs.css';
import './ChangelogModal.css';
import { useAuth } from '../auth/AuthContext';
import ViewOrderModal from './ViewOrderModal';
import PrintOrderModal from './PrintOrderModal';
import ChangelogModal from './ChangelogModal';

const displayName = localStorage.getItem('displayName') || '{displayName}';
const stripTime = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ✅ NEW: Enhanced delivery status calculation
const getDeliveryTagWithEmoji = (dateStr, orderProgress, completedDate) => {
  const today = stripTime(new Date());
  const delivery = stripTime(new Date(dateStr));
  const diff = Math.floor((delivery - today) / (1000 * 60 * 60 * 24));
  
  // ✅ NEW: If order is completed, show delivery status
  if (orderProgress === 'Completed' && completedDate) {
    const completed = stripTime(new Date(completedDate));
    const deliveryDiff = Math.floor((completed - delivery) / (1000 * 60 * 60 * 24));
    
    if (deliveryDiff === 0) {
      return '✅ Delivered [on time]';
    } else if (deliveryDiff > 0) {
      return `⚠️ Delivered [${deliveryDiff} day${deliveryDiff > 1 ? 's' : ''} late]`;
    } else {
      return `🚀 Delivered [${Math.abs(deliveryDiff)} day${Math.abs(deliveryDiff) > 1 ? 's' : ''} early]`;
    }
  }
  
  // Original logic for non-completed orders
  if (diff === 0) return '📦 Today';
  if (diff === 1) return '📦 Tomorrow';
  if (diff > 1) return `📅 Upcoming (${diff} days)`;
  if (diff < 0) return `⚠️ Due (${Math.abs(diff)} days ago)`;
  return '';
};

// ✅ FIXED: Enhanced balance calculation function
const calculateBalance = (order) => {
  const grandTotal = Number(order.grandTotal) || 0;
  const advancePaid = Number(order.advancePaid) || 0;
  const balancePaid = Number(order.balancePaid) || 0;
  
  const remainingBalance = Number(order.balance) || 0;
  const totalPaid = advancePaid + balancePaid;
  
  return {
    grandTotal,
    advancePaid,
    balancePaid,
    totalPaid,
    balance: remainingBalance,
    isFullyPaid: remainingBalance <= 0.01,
    hasAdvance: advancePaid > 0,
    hasBalancePayment: balancePaid > 0,
    hasAnyPayment: totalPaid > 0
  };
};

// ✅ SIMPLIFIED: Balance cell with clear display logic
const renderBalanceCell = (order) => {
  const payment = calculateBalance(order);
  
  if (payment.isFullyPaid) {
    return (
      <div className="balance-cell fully-paid" style={{ 
        backgroundColor: '#e8f5e9', 
        color: '#2e7d32',
        padding: '8px',
        borderRadius: '4px',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '0.85rem'
      }}>
        <FaCheck style={{ marginRight: '5px' }} />
        Fully Paid
      </div>
    );
  }
  
  return (
    <div className="balance-cell pending-payment" style={{ 
      textAlign: 'center',
      fontWeight: 'bold',
      color: '#d32f2f',
      fontSize: '0.9rem'
    }}>
      ₹{payment.balance.toFixed(2)}
    </div>
  );
};

const OrderTabs = ({ setSelectedOrder, switchToFormTab, refreshTrigger }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [orders, setOrders] = useState([]);
  const [branches, setBranches] = useState({});
  const [occasions, setOccasions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // ✅ NEW: Changelog state with viewed tracking
  const [changelogData, setChangelogData] = useState({});
  const [viewChangelog, setViewChangelog] = useState(null);
  const [viewedChangelogs, setViewedChangelogs] = useState(new Set());
  
  // ✅ NEW: Completion date picker state
  const [showCompletionModal, setShowCompletionModal] = useState(null);
  const [completionDate, setCompletionDate] = useState('');
  
  // ✅ NEW: Action dropdown state
  const [activeDropdown, setActiveDropdown] = useState(null);
  
  const [filters, setFilters] = useState({
    name: '', 
    phone: '', 
    email: '', 
    item: '', 
    occasion: '',
    orderDate: '', 
    deliveryDate: '', 
    status: '',
    branch: ''
  });
  
  const [expandedOrders, setExpandedOrders] = useState({});
  const [printOrder, setPrintOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);

  // ✅ NEW: Fetch changelog data for admin users
  const fetchChangelogData = useCallback(async (orderIds) => {
    if (!isAdmin || !orderIds.length) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const getApiUrl = () => {
        if (window.location.hostname === 'localhost') {
          return 'http://localhost:5000';
        }
        return 'https://order-management-fbre.onrender.com';
      };
      
      const response = await fetch(`${getApiUrl()}/api/changelog/summary?orderIds=${orderIds.join(',')}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setChangelogData(data);
      }
    } catch (error) {
      console.error('❌ Error fetching changelog data:', error);
    }
  }, [isAdmin]);

  // Fetch master data (branches and occasions)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        if (isAdmin) {
          const branchesResponse = await axios.get('/api/branches', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const branchesObj = {};
          if (Array.isArray(branchesResponse.data)) {
            branchesResponse.data.forEach(branch => {
              branchesObj[branch.branchCode] = branch.branchName;
            });
          }
          setBranches(branchesObj);
        }
        
        const occasionsResponse = await axios.get('/api/occasions', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (Array.isArray(occasionsResponse.data)) {
          setOccasions(occasionsResponse.data.map(occ => occ.name));
        }
        
      } catch (error) {
        console.error('Error fetching master data:', error);
      }
    };
    
    fetchMasterData();
  }, [isAdmin]);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      
      const getApiUrl = () => {
        if (process.env.REACT_APP_API_URL) {
          return process.env.REACT_APP_API_URL;
        }
        if (window.location.hostname === 'localhost') {
          return 'http://localhost:5000';
        }
        return 'https://order-management-fbre.onrender.com';
      };
      
      const baseUrl = getApiUrl();
      
      let endpoint;
      if (isAdmin) {
        if (filters.branch) {
          endpoint = `${baseUrl}/api/orders/${filters.branch.toLowerCase()}`;
        } else {
          endpoint = `${baseUrl}/api/orders/all`;
        }
      } else {
        endpoint = `${baseUrl}/api/orders/${user?.branchCode?.toLowerCase()}`;
      }
      
      const queryParams = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() && key !== 'branch') {
          queryParams[key] = value.trim();
        }
      });
      
      const response = await fetch(endpoint + (Object.keys(queryParams).length ? '?' + new URLSearchParams(queryParams) : ''), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const ordersData = await response.json();
      
      if (Array.isArray(ordersData)) {
        const realOrders = ordersData.filter(order => 
          order._id && 
          order.customerName && 
          order.customerName.trim() !== ''
        );
        setOrders(realOrders);
        
        if (isAdmin && realOrders.length > 0) {
          const orderIds = realOrders.map(order => order._id);
          await fetchChangelogData(orderIds);
        }
      } else if (ordersData && Array.isArray(ordersData.orders)) {
        const realOrders = ordersData.orders.filter(order => 
          order._id && 
          order.customerName && 
          order.customerName.trim() !== ''
        );
        setOrders(realOrders);
        
        if (isAdmin && realOrders.length > 0) {
          const orderIds = realOrders.map(order => order._id);
          await fetchChangelogData(orderIds);
        }
      } else {
        setOrders([]);
      }
      
    } catch (err) {
      console.error('❌ OrderTabs - Error fetching orders:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, isAdmin, user?.branchCode, fetchChangelogData]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [orders.length]);
  
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchOrders();
    }
  }, [refreshTrigger, fetchOrders]);

  useEffect(() => {
    const handleOrderUpdate = async (event) => {
      try {
        await fetchOrders();
        
        if (isAdmin && orders.length > 0) {
          const orderIds = orders.map(order => order._id);
          await fetchChangelogData(orderIds);
        }
      } catch (error) {
        console.error('❌ Error refreshing after order update:', error);
      }
    };

    const handleStorageChange = async (event) => {
      if (event.key === 'orderUpdated' || event.key === 'lastOrderUpdate') {
        try {
          await fetchOrders();
          
          if (isAdmin && orders.length > 0) {
            const orderIds = orders.map(order => order._id);
            await fetchChangelogData(orderIds);
          }
        } catch (error) {
          console.error('❌ Error refreshing after storage change:', error);
        }
      }
    };

    const eventTypes = ['orderUpdated', 'orderSaved', 'orderChanged', 'order-update'];
    
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleOrderUpdate);
    });
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleOrderUpdate);
      });
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchOrders, fetchChangelogData, isAdmin, orders.length]);

  const deleteOrder = async (order) => {
    if (!window.confirm(`Delete order ${order.orderNumber}?`)) return;
    
    try {
      const token = localStorage.getItem('authToken');
      
      const getApiUrl = () => {
        if (process.env.REACT_APP_API_URL) {
          return process.env.REACT_APP_API_URL;
        }
        if (window.location.hostname === 'localhost') {
          return 'http://localhost:5000';
        }
        return 'https://order-management-fbre.onrender.com';
      };
      
      const baseUrl = getApiUrl();
      const branchCode = order.branchCode?.toLowerCase() || user?.branchCode?.toLowerCase();
      const endpoint = `${baseUrl}/api/orders/${branchCode}/${order._id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} - ${errorText}`);
      }
      
      await fetchOrders();
      
    } catch (err) {
      console.error('❌ Delete failed:', err);
      alert(`Failed to delete order: ${err.message}`);
    }
  };

  const handlePrint = (order) => {
    setPrintOrder(order);
  };

  // ✅ FIXED: Edit button function
  const handleEdit = (order) => {
    if (typeof setSelectedOrder === 'function') {
      setSelectedOrder(order);
      if (typeof switchToFormTab === 'function') {
        switchToFormTab();
      }
    } else {
      console.error('setSelectedOrder is not a function:', setSelectedOrder);
    }
  };

  // ✅ NEW: Handle changelog view with notification removal
  const handleViewChangelog = (order) => {
    setViewChangelog({
      orderId: order._id,
      orderNumber: order.orderNumber
    });
    
    // ✅ NEW: Mark changelog as viewed
    setViewedChangelogs(prev => new Set([...prev, order._id]));
  };

  // ✅ NEW: Enhanced progress change with completion date picker
const handleProgressChange = async (order, value) => {
  // ✅ NEW: Prevent non-admin users from modifying completed orders
  if (!isAdmin && order.orderProgress === 'Completed') {
    alert('This order is completed and cannot be modified.');
    return;
  }
  
  // ✅ NEW: Show date picker when admin marks order as completed
  if (value === 'Completed' && isAdmin) {
    setShowCompletionModal(order);
    setCompletionDate(order.deliveryDate || new Date().toISOString().split('T')[0]);
    return;
  }
  
  try {
    const token = localStorage.getItem('authToken');
    
    const getApiUrl = () => {
      if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
      }
      if (window.location.hostname === 'localhost') {
        return 'http://localhost:5000';
      }
      return 'https://order-management-fbre.onrender.com';
    };
    
    const baseUrl = getApiUrl();
    const branchCode = order.branchCode?.toLowerCase() || user?.branchCode?.toLowerCase();
    const endpoint = `${baseUrl}/api/orders/${branchCode}/${order._id}`;
    
    const updateData = { orderProgress: value };
    
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Progress update failed: ${response.status} - ${errorText}`);
    }
    
    await fetchOrders();
    
    window.dispatchEvent(new CustomEvent('orderUpdated', { 
      detail: { orderId: order._id, action: 'progress_update' } 
    }));
    
  } catch (err) {
    console.error('❌ Progress update failed:', err);
    alert(`Failed to update progress: ${err.message}`);
  }
};

  // ✅ NEW: Handle completion with custom date
const handleCompleteOrder = async (customDate) => {
  if (!showCompletionModal) return;
  
  try {
    const token = localStorage.getItem('authToken');
    
    const getApiUrl = () => {
      if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
      }
      if (window.location.hostname === 'localhost') {
        return 'http://localhost:5000';
      }
      return 'https://order-management-fbre.onrender.com';
    };
    
    const baseUrl = getApiUrl();
    const branchCode = showCompletionModal.branchCode?.toLowerCase() || user?.branchCode?.toLowerCase();
    const endpoint = `${baseUrl}/api/orders/${branchCode}/${showCompletionModal._id}`;
    
    const updateData = { 
      orderProgress: 'Completed',
      completedDate: new Date(customDate).toISOString()
    };
    
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Completion failed: ${response.status} - ${errorText}`);
    }
    
    setShowCompletionModal(null);
    setCompletionDate('');
    await fetchOrders();
    
    window.dispatchEvent(new CustomEvent('orderUpdated', { 
      detail: { orderId: showCompletionModal._id, action: 'completion' } 
    }));
    
  } catch (err) {
    console.error('❌ Order completion failed:', err);
    alert(`Failed to complete order: ${err.message}`);
  }
};

// ✅ NEW: Check if order has unviewed changelog entries
const hasUnviewedChangelog = (orderId) => {
  return changelogData && 
         changelogData[orderId] && 
         changelogData[orderId] > 0 && 
         !viewedChangelogs.has(orderId);
};

  // ✅ NEW: Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-dropdown')) {
        setActiveDropdown(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ✅ NEW: Toggle dropdown
  const toggleDropdown = (orderId) => {
    setActiveDropdown(activeDropdown === orderId ? null : orderId);
  };

  // ✅ NEW: Check if order can be edited
  const canEditOrder = (order) => {
    if (isAdmin) return true;
    return order.orderProgress !== 'Completed';
  };

  const processOrders = () => {
    if (!Array.isArray(orders)) {
      return [];
    }
    
    const orderMap = {};
    
    orders.forEach(order => {
      const orderNumber = order.orderNumber;
      
      if (!orderMap[orderNumber]) {
        orderMap[orderNumber] = order;
      } else {
        if (new Date(order.createdAt) > new Date(orderMap[orderNumber].createdAt)) {
          orderMap[orderNumber] = order;
        }
      }
    });
    
    const uniqueOrders = Object.values(orderMap).sort((a, b) => {
      return new Date(b.createdAt || b.orderDate) - new Date(a.createdAt || a.orderDate);
    });
    
    return uniqueOrders;
  };

  const createBoxBreakdown = (order) => {
    if (!order.boxes || order.boxes.length <= 1) {
      return null;
    }
    
    const breakdown = [];
    const totalBoxCount = order.boxes.reduce((sum, box) => sum + (box.boxCount || 1), 0);
    const orderPayment = calculateBalance(order);
    
    const advancePerBox = orderPayment.advancePaid / totalBoxCount;
    const balancePerBox = orderPayment.balancePaid / totalBoxCount;
    
    order.boxes.forEach((box, index) => {
      const boxSubtotal = box.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
      const boxTotal = (boxSubtotal * (box.boxCount || 1)) - ((box.discount || 0) * (box.boxCount || 1));
      const boxAdvance = advancePerBox * (box.boxCount || 1);
      const boxBalancePaid = balancePerBox * (box.boxCount || 1);
      
      breakdown.push({
        ...order,
        boxIndex: index,
        subLabel: `-${chars[index] || index}`,
        grandTotal: boxTotal,
        advancePaid: boxAdvance,
        balancePaid: boxBalancePaid,
        balance: boxTotal - boxAdvance - boxBalancePaid,
        box: box,
        isSubOrder: true
      });
    });
    
    return breakdown;
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      name: '', 
      phone: '', 
      email: '', 
      item: '', 
      occasion: '',
      orderDate: '', 
      deliveryDate: '', 
      status: '',
      branch: ''
    });
  };

  const processedOrders = processOrders();

  return (
    <div className="order-tabs">
      {/* ✅ IMPROVED: Fixed filters bar layout */}
      <div className="filters-bar" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '10px', 
        alignItems: 'end',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Customer Name</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="Enter customer name"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Phone</label>
          <input
            type="text"
            value={filters.phone}
            onChange={(e) => handleFilterChange('phone', e.target.value)}
            placeholder="Enter phone number"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Email</label>
          <input
            type="text"
            value={filters.email}
            onChange={(e) => handleFilterChange('email', e.target.value)}
            placeholder="Enter email"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Item</label>
          <input
            type="text"
            value={filters.item}
            onChange={(e) => handleFilterChange('item', e.target.value)}
            placeholder="Enter item name"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Order Date</label>
          <input
            type="date"
            value={filters.orderDate}
            onChange={(e) => handleFilterChange('orderDate', e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Delivery Date</label>
          <input
            type="date"
            value={filters.deliveryDate}
            onChange={(e) => handleFilterChange('deliveryDate', e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Occasion</label>
          <select 
            value={filters.occasion}
            onChange={(e) => handleFilterChange('occasion', e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">-- All Occasions --</option>
            {occasions.map(occasion => (
              <option key={occasion} value={occasion}>{occasion}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Status</label>
          <select 
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="">-- All Status --</option>
            <option value="saved">Saved</option>
            <option value="held">Held</option>
            <option value="auto-saved">Auto-Saved</option>
          </select>
        </div>

        {isAdmin && (
          <div className="filter-group">
            <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Branch</label>
            <select 
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">-- All Branches --</option>
              {Object.entries(branches).map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>
        )}

        {/* ✅ FIXED: Action buttons layout */}
        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>&nbsp;</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={fetchOrders} 
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              {isLoading ? '...' : '🔄'} Refresh
            </button>
            <button 
              onClick={fetchOrders} 
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              {isLoading ? '...' : <FaSearch />} Search
            </button>
            <button 
              onClick={clearFilters}
              style={{
                padding: '8px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container" style={{ 
          textAlign: 'center', 
          padding: '40px', 
          fontSize: '1.1rem' 
        }}>
          Loading orders...
        </div>
      ) : processedOrders.length === 0 ? (
        <div className="empty-state" style={{ 
          textAlign: 'center', 
          padding: '40px', 
          fontSize: '1.1rem',
          color: '#666' 
        }}>
          No orders found
        </div>
      ) : (
        <div className="table-container" key={refreshKey} style={{ 
          overflowX: 'auto',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {/* ✅ IMPROVED: Responsive table with better column sizing */}
          <table style={{ 
            width: '100%', 
            minWidth: '1200px', 
            borderCollapse: 'collapse',
            fontSize: '0.9rem'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '120px' }}>Order No.</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '100px' }}>Box Count</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '150px' }}>Customer</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '120px' }}>Phone</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '180px' }}>Delivery</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '80px' }}>Time</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '100px' }}>Occasion</th>
                {isAdmin && <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '100px' }}>Branch</th>}
                <th style={{ padding: '12px 8px', textAlign: 'right', minWidth: '100px' }}>Total</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '80px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '120px' }}>Balance</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '140px' }}>Order Progress</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', minWidth: '200px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processedOrders.flatMap(order => {
                const orderNumber = order.orderNumber;
                const boxBreakdown = createBoxBreakdown(order);
                const hasMultipleBoxes = boxBreakdown && boxBreakdown.length > 1;
                const expanded = expandedOrders[orderNumber];
                const totalBoxCount = order.boxes ? order.boxes.reduce((sum, box) => sum + (box.boxCount || 1), 0) : 1;
                
                const orderPayment = calculateBalance(order);
                const rowClassName = `main-order ${orderPayment.isFullyPaid ? 'fully-paid-row' : ''}`;
                
                const mainRow = (
                  <tr key={orderNumber} className={rowClassName} style={{ 
                    borderBottom: '1px solid #eee',
                    backgroundColor: order.orderProgress === 'Completed' ? '#f0f8f0' : 'white'
                  }}>
                    <td 
                      onClick={() => hasMultipleBoxes && setExpandedOrders(prev => ({ ...prev, [orderNumber]: !prev[orderNumber] }))}
                      style={{ 
                        cursor: hasMultipleBoxes ? 'pointer' : 'default',
                        padding: '12px 8px',
                        fontWeight: '600'
                      }}
                    >
                      {hasMultipleBoxes && (expanded ? <FaChevronDown /> : <FaChevronRight />)} 
                      {orderNumber}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                      <strong>{totalBoxCount}</strong>
                      {hasMultipleBoxes && <div style={{ fontSize: '0.75rem', color: '#666' }}>({order.boxes.length} types)</div>}
                    </td>
                    <td style={{ padding: '12px 8px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.customerName}>
                      {order.customerName}
                    </td>
                    <td style={{ padding: '12px 8px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.phone}>
                      {order.phone}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{order.deliveryDate}</div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          padding: '2px 6px', 
                          backgroundColor: order.orderProgress === 'Completed' ? '#d4edda' : '#fff3cd',
                          color: order.orderProgress === 'Completed' ? '#155724' : '#856404',
                          borderRadius: '12px',
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}>
                          {getDeliveryTagWithEmoji(order.deliveryDate, order.orderProgress, order.completedDate)}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>{order.deliveryTime}</td>
                    <td style={{ padding: '12px 8px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.occasion}>
                      {order.occasion}
                    </td>
                    
                    {isAdmin && (
                      <td style={{ padding: '12px 8px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={branches[order.branchCode] || order.branch}>
                        {branches[order.branchCode] || order.branch || 'Unknown'}
                      </td>
                    )}
                    
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600' }}>
                      ₹{(order.grandTotal || 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: order.status === 'saved' ? '#d4edda' : order.status === 'held' ? '#fff3cd' : '#f8d7da',
                        color: order.status === 'saved' ? '#155724' : order.status === 'held' ? '#856404' : '#721c24'
                      }}>
                        {order.status}
                      </span>
                    </td>
                    
                    <td style={{ padding: '12px 8px' }}>{renderBalanceCell(order)}</td>
                    
                    <td style={{ padding: '12px 8px' }}>
                      <select
                        value={order.orderProgress || ''}
                        onChange={(e) => handleProgressChange(order, e.target.value)}
                        disabled={!canEditOrder(order)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          fontSize: '0.85rem',
                          backgroundColor: !canEditOrder(order) ? '#f8f9fa' : 'white',
                          cursor: !canEditOrder(order) ? 'not-allowed' : 'pointer',
                          width: '130px'
                        }}
                      >
                        <option value="">⏳ Pending</option>
                        <option value="Packed">📦 Packed</option>
                        <option value="Delivered">🚚 Delivered</option>
                        <option value="Completed">✅ Completed</option>
                        <option value="Cancelled">❌ Cancelled</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {/* ✅ NEW: Dropdown action menu */}
                      <div className="action-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={() => toggleDropdown(order._id)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          Actions <FaEllipsisV />
                        </button>
                        
                        {activeDropdown === order._id && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '160px',
                            marginTop: '4px'
                          }}>
                            {/* Edit Option */}
                            <button
                              onClick={() => {
                                handleEdit(order);
                                setActiveDropdown(null);
                              }}
                              disabled={!canEditOrder(order)}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                textAlign: 'left',
                                cursor: !canEditOrder(order) ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: !canEditOrder(order) ? '#999' : '#333',
                                borderBottom: '1px solid #f0f0f0'
                              }}
                              onMouseEnter={(e) => {
                                if (canEditOrder(order)) {
                                  e.target.style.backgroundColor = '#f8f9fa';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'transparent';
                              }}
                            >
                              <FaEdit style={{ color: !canEditOrder(order) ? '#999' : '#007bff' }} />
                              {!canEditOrder(order) ? 'Edit (Locked)' : 'Edit Order'}
                            </button>
                            
                            {/* View Option */}
                            <button
                              onClick={() => {
                                setViewOrder({ ...order, boxViewMode: 'all' });
                                setActiveDropdown(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#333',
                                borderBottom: '1px solid #f0f0f0'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              <FaEye style={{ color: '#28a745' }} />
                              View Order
                            </button>
                            
                            {/* Print Option */}
                            <button
                              onClick={() => {
                                handlePrint({ ...order, boxViewMode: 'all' });
                                setActiveDropdown(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#333',
                                borderBottom: isAdmin ? '1px solid #f0f0f0' : 'none'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              <FaPrint style={{ color: '#6c757d' }} />
                              Print Order
                            </button>
                            
                            {/* Admin-only options */}
                            {isAdmin && (
                              <>
                                {/* Changelog Option */}
                                <button
                                  onClick={() => {
                                    handleViewChangelog(order);
                                    setActiveDropdown(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: '#333',
                                    borderBottom: '1px solid #f0f0f0',
                                    position: 'relative'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                >
                                  <FaScroll style={{ color: hasUnviewedChangelog(order._id) ? '#667eea' : '#666' }} />
                                  Order History
                                  {hasUnviewedChangelog(order._id) && (
                                    <span style={{
                                      marginLeft: 'auto',
                                      background: '#ff4444',
                                      color: 'white',
                                      borderRadius: '50%',
                                      width: '18px',
                                      height: '18px',
                                      fontSize: '0.7rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold'
                                    }}>
                                      {changelogData[order._id]}
                                    </span>
                                  )}
                                </button>
                                
                                {/* Delete Option */}
                                <button
                                  onClick={() => {
                                    deleteOrder(order);
                                    setActiveDropdown(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: '#dc3545'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                >
                                  <FaTrash style={{ color: '#dc3545' }} />
                                  Delete Order
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                
                const subRows = (hasMultipleBoxes && expanded && boxBreakdown) ? 
                  boxBreakdown.map((subOrder, index) => {
                    const subOrderPayment = calculateBalance(subOrder);
                    const subRowClassName = `sub-order ${subOrderPayment.isFullyPaid ? 'fully-paid-row' : ''}`;
                    
                    return (
                      <tr key={`${orderNumber}-${subOrder.subLabel}`} className={subRowClassName} style={{ 
                        backgroundColor: '#f8f9fa',
                        borderBottom: '1px solid #eee'
                      }}>
                        <td style={{ padding: '12px 8px', paddingLeft: '30px' }} title={`Box ${index + 1}: ${subOrder.box.items.map(it => `${it.name} x${it.qty}`).join(', ')}`}>
                          ↳ {orderNumber}{subOrder.subLabel}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                          <strong>{subOrder.box.boxCount || 1}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>(Box {index + 1})</div>
                        </td>
                        <td style={{ padding: '12px 8px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subOrder.customerName}
                        </td>
                        <td style={{ padding: '12px 8px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subOrder.phone}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div>
                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{subOrder.deliveryDate}</div>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              padding: '2px 6px', 
                              backgroundColor: '#fff3cd',
                              color: '#856404',
                              borderRadius: '12px',
                              display: 'inline-block'
                            }}>
                              {getDeliveryTagWithEmoji(subOrder.deliveryDate, subOrder.orderProgress, subOrder.completedDate)}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px 8px' }}>{subOrder.deliveryTime}</td>
                        <td style={{ padding: '12px 8px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subOrder.occasion}
                        </td>
                        
                        {isAdmin && (
                          <td style={{ padding: '12px 8px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {branches[subOrder.branchCode] || subOrder.branch || 'Unknown'}
                          </td>
                        )}
                        
                        <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600' }}>
                          ₹{subOrder.grandTotal.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: subOrder.status === 'saved' ? '#d4edda' : subOrder.status === 'held' ? '#fff3cd' : '#f8d7da',
                            color: subOrder.status === 'saved' ? '#155724' : subOrder.status === 'held' ? '#856404' : '#721c24'
                          }}>
                            {subOrder.status}
                          </span>
                        </td>
                        
                        <td style={{ padding: '12px 8px' }}>{renderBalanceCell(subOrder)}</td>
                        
                        <td style={{ padding: '12px 8px' }}>
                          <select
                            value={subOrder.orderProgress || ''}
                            onChange={(e) => handleProgressChange(subOrder, e.target.value)}
                            disabled={!canEditOrder(subOrder)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              fontSize: '0.85rem',
                              backgroundColor: !canEditOrder(subOrder) ? '#f8f9fa' : 'white',
                              cursor: !canEditOrder(subOrder) ? 'not-allowed' : 'pointer',
                              width: '130px'
                            }}
                          >
                            <option value="">⏳ Pending</option>
                            <option value="Packed">📦 Packed</option>
                            <option value="Delivered">🚚 Delivered</option>
                            <option value="Completed">✅ Completed</option>
                            <option value="Cancelled">❌ Cancelled</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div className="action-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              onClick={() => toggleDropdown(`${orderNumber}-${subOrder.subLabel}`)}
                              style={{
                                padding: '6px 10px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <FaEllipsisV />
                            </button>
                            
                            {activeDropdown === `${orderNumber}-${subOrder.subLabel}` && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '0',
                                backgroundColor: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 1000,
                                minWidth: '140px',
                                marginTop: '4px'
                              }}>
                                <button
                                  onClick={() => {
                                    handlePrint({ ...subOrder, boxViewMode: index });
                                    setActiveDropdown(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: '#333',
                                    borderBottom: '1px solid #f0f0f0'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                >
                                  <FaPrint style={{ color: '#6c757d' }} />
                                  Print Box
                                </button>
                                <button
                                  onClick={() => {
                                    setViewOrder({ ...subOrder, boxViewMode: index });
                                    setActiveDropdown(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: '#333'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                >
                                  <FaEye style={{ color: '#28a745' }} />
                                  View Box
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }) : [];
                
                return [mainRow, ...subRows];
              })}
            </tbody>
          </table>
        </div>
      )}
	  
	  {/* ✅ NEW: Completion Date Modal */}
{showCompletionModal && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }}>
    <div style={{
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxWidth: '400px',
      width: '90%'
    }}>
      <h3 style={{ 
        marginTop: 0, 
        marginBottom: '20px',
        color: '#333',
        textAlign: 'center'
      }}>
        Complete Order {showCompletionModal.orderNumber}
      </h3>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '8px',
          fontWeight: '600',
          color: '#555'
        }}>
          Completion Date:
        </label>
        <input
          type="date"
          value={completionDate}
          onChange={(e) => setCompletionDate(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem'
          }}
        />
        <small style={{ 
          color: '#666', 
          fontSize: '0.85rem',
          marginTop: '4px',
          display: 'block'
        }}>
          Original delivery date: {showCompletionModal.deliveryDate}
        </small>
      </div>
      
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        justifyContent: 'flex-end' 
      }}>
        <button
          onClick={() => {
            setShowCompletionModal(null);
            setCompletionDate('');
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => handleCompleteOrder(completionDate)}
          disabled={!completionDate}
          style={{
            padding: '10px 20px',
            backgroundColor: !completionDate ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !completionDate ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Complete Order
        </button>
      </div>
    </div>
  </div>
)}

      {/* Modals */}
      {viewOrder && (
        <ViewOrderModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
          onPrint={handlePrint}
        />
      )}
      
      {printOrder && (
        <PrintOrderModal
          order={printOrder}
          onClose={() => setPrintOrder(null)}
        />
      )}
      
      {/* ✅ FIXED: Changelog Modal */}
      {viewChangelog && viewChangelog.orderId && (
        <ChangelogModal
          orderId={viewChangelog.orderId}
          orderNumber={viewChangelog.orderNumber}
          onClose={() => {
            setViewChangelog(null);
          }}
        />
      )}
    </div>
  );
};

export default OrderTabs;