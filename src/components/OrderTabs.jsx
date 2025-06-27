import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  FaTrash, FaEye, FaEdit, FaPrint, FaSearch,
  FaScroll, FaChevronDown, FaChevronRight, FaCheck
} from 'react-icons/fa';
import './OrderTabs.css';
import './ChangelogModal.css'; // ✅ ADD: Import the CSS file
import { useAuth } from '../auth/AuthContext';
import ViewOrderModal from './ViewOrderModal';
import PrintOrderModal from './PrintOrderModal';
import ChangelogModal from './ChangelogModal';

const displayName = localStorage.getItem('displayName') || '{displayName}';
const stripTime = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const getDeliveryTagWithEmoji = (dateStr) => {
  const today = stripTime(new Date());
  const delivery = stripTime(new Date(dateStr));
  const diff = Math.floor((delivery - today) / (1000 * 60 * 60 * 24));
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
  
  // ✅ USE THE BALANCE FIELD FROM DATABASE instead of calculating
  const remainingBalance = Number(order.balance) || 0;
  
  const totalPaid = advancePaid + balancePaid;
  
  console.log('💰 Balance info for order:', order.orderNumber, {
    orderId: order._id,
    grandTotal,
    advancePaid,
    balancePaid,
    totalPaid,
    remainingBalance, // This comes from database
    isFullyPaid: remainingBalance <= 0.01,
    orderData: {
      rawAdvancePaid: order.advancePaid,
      rawBalancePaid: order.balancePaid,
      rawGrandTotal: order.grandTotal,
      rawBalance: order.balance // This is the key field
    }
  });
  
  return {
    grandTotal,
    advancePaid,
    balancePaid,
    totalPaid,
    balance: remainingBalance, // Use database value directly
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
        fontWeight: 'bold'
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
      color: '#d32f2f'
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
  
  // ✅ NEW: Changelog state
  const [changelogData, setChangelogData] = useState({});
  const [viewChangelog, setViewChangelog] = useState(null);
  
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
      
      console.log('📋 Fetching changelog summary for orders:', orderIds);
      
      const response = await fetch(`${getApiUrl()}/api/changelog/summary?orderIds=${orderIds.join(',')}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Changelog summary received:', data);
        setChangelogData(data);
      } else {
        console.error('❌ Failed to fetch changelog summary:', response.status);
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
      
      console.log('🔍 OrderTabs - Fetching from endpoint:', endpoint, 'with params:', queryParams);
      
      const response = await fetch(endpoint + (Object.keys(queryParams).length ? '?' + new URLSearchParams(queryParams) : ''), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 OrderTabs - Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OrderTabs - API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const ordersData = await response.json();
      console.log('📊 OrderTabs - Raw orders data:', ordersData);
      
      if (Array.isArray(ordersData)) {
        const realOrders = ordersData.filter(order => 
          order._id && 
          order.customerName && 
          order.customerName.trim() !== ''
        );
        console.log('📋 OrderTabs - Filtered orders count:', realOrders.length);
        setOrders(realOrders);
        
        // ✅ NEW: Fetch changelog data for admin users
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
        console.log('📋 OrderTabs - Filtered orders count:', realOrders.length);
        setOrders(realOrders);
        
        // ✅ NEW: Fetch changelog data for admin users
        if (isAdmin && realOrders.length > 0) {
          const orderIds = realOrders.map(order => order._id);
          await fetchChangelogData(orderIds);
        }
      } else {
        console.warn('❌ OrderTabs - API returned unexpected data format:', ordersData);
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

  // ✅ FIXED: Force refresh when orders change
  useEffect(() => {
    console.log('📊 Orders updated, count:', orders.length);
    setRefreshKey(prev => prev + 1);
  }, [orders.length]);
  
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 OrderTabs refreshing due to trigger:', refreshTrigger);
      fetchOrders();
    }
  }, [refreshTrigger, fetchOrders]);

  useEffect(() => {
  const handleOrderUpdate = async (event) => {
    console.log('🔄 Order updated event received in OrderTabs:', event.detail);
    
    // Force refresh of both orders and changelog data
    try {
      await fetchOrders(); // This should also trigger fetchChangelogData via the fetchOrders callback
      
      // ✅ ADDITIONAL: Force changelog refresh separately for admin users
      if (isAdmin && orders.length > 0) {
        console.log('📋 Forcing changelog data refresh after order update');
        const orderIds = orders.map(order => order._id);
        await fetchChangelogData(orderIds);
      }
    } catch (error) {
      console.error('❌ Error refreshing after order update:', error);
    }
  };

  const handleStorageChange = async (event) => {
    // Listen for localStorage changes that might indicate order updates
    if (event.key === 'orderUpdated' || event.key === 'lastOrderUpdate') {
      console.log('🔄 Storage change detected, refreshing orders and changelog');
      try {
        await fetchOrders();
        
        // ✅ ADDITIONAL: Force changelog refresh
        if (isAdmin && orders.length > 0) {
          const orderIds = orders.map(order => order._id);
          await fetchChangelogData(orderIds);
        }
      } catch (error) {
        console.error('❌ Error refreshing after storage change:', error);
      }
    }
  };

  // Listen for multiple event types to ensure we catch the update
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
      
      console.log('🗑️ Deleting order from:', endpoint);
      
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
      
      console.log('✅ Order deleted successfully');
      await fetchOrders(); // ✅ FIXED: Wait for refresh
      
    } catch (err) {
      console.error('❌ Delete failed:', err);
      alert(`Failed to delete order: ${err.message}`);
    }
  };

  const handlePrint = (order) => {
    setPrintOrder(order);
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);
    switchToFormTab();
  };

  // ✅ NEW: Handle changelog view - FIXED with debugging
  const handleViewChangelog = (order) => {
    console.log('🔍 Attempting to view changelog for order:', order._id, order.orderNumber);
    setViewChangelog({
      orderId: order._id,
      orderNumber: order.orderNumber
    });
    console.log('✅ Changelog modal state set:', { orderId: order._id, orderNumber: order.orderNumber });
  };

  const handleProgressChange = async (order, value) => {
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
      
      console.log('🔄 Updating order progress:', endpoint, { orderProgress: value });
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderProgress: value })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Progress update failed: ${response.status} - ${errorText}`);
      }
      
      console.log('✅ Order progress updated successfully');
      
      // ✅ IMPROVED: Force immediate refresh without delay
      await fetchOrders();
      
      // Also dispatch the orderUpdated event for other components
      window.dispatchEvent(new CustomEvent('orderUpdated', { 
        detail: { orderId: order._id, action: 'progress_update' } 
      }));
      
    } catch (err) {
      console.error('❌ Progress update failed:', err);
      alert(`Failed to update progress: ${err.message}`);
    }
  };

  // ✅ NEW: Check if order has changelog entries
  const hasChangelog = (orderId) => {
    return changelogData && changelogData[orderId] && changelogData[orderId] > 0;
  };

  const processOrders = () => {
    if (!Array.isArray(orders)) {
      console.warn('Orders is not an array:', orders);
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
    
    console.log('📋 Processed unique orders:', uniqueOrders.length);
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

  // ✅ DEBUG: Log modal state
  console.log('🔍 Current modal states:', {
    viewOrder: !!viewOrder,
    printOrder: !!printOrder,
    viewChangelog: !!viewChangelog,
    changelogData: Object.keys(changelogData).length
  });

  return (
    <div className="order-tabs">
      <div className="filters-bar">
        {/* Customer Name Filter */}
        <div className="filter-group">
          <label>Customer Name</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="Enter customer name"
            className="filter-input short"
          />
        </div>

        {/* Phone Filter */}
        <div className="filter-group">
          <label>Phone</label>
          <input
            type="text"
            value={filters.phone}
            onChange={(e) => handleFilterChange('phone', e.target.value)}
            placeholder="Enter phone number"
            className="filter-input short"
          />
        </div>

        {/* Email Filter */}
        <div className="filter-group">
          <label>Email</label>
          <input
            type="text"
            value={filters.email}
            onChange={(e) => handleFilterChange('email', e.target.value)}
            placeholder="Enter email"
            className="filter-input short"
          />
        </div>

        {/* Item Filter */}
        <div className="filter-group">
          <label>Item</label>
          <input
            type="text"
            value={filters.item}
            onChange={(e) => handleFilterChange('item', e.target.value)}
            placeholder="Enter item name"
            className="filter-input short"
          />
        </div>

        {/* Order Date Filter */}
        <div className="filter-group">
          <label>Order Date</label>
          <input
            type="date"
            value={filters.orderDate}
            onChange={(e) => handleFilterChange('orderDate', e.target.value)}
            className="filter-input short"
          />
        </div>

        {/* Delivery Date Filter */}
        <div className="filter-group">
          <label>Delivery Date</label>
          <input
            type="date"
            value={filters.deliveryDate}
            onChange={(e) => handleFilterChange('deliveryDate', e.target.value)}
            className="filter-input short"
          />
        </div>

        {/* Occasion Filter */}
        <div className="filter-group">
          <label>Occasion</label>
          <select 
            className="filter-input medium" 
            value={filters.occasion}
            onChange={(e) => handleFilterChange('occasion', e.target.value)}
          >
            <option value="">-- All Occasions --</option>
            {occasions.map(occasion => (
              <option key={occasion} value={occasion}>{occasion}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <label>Status</label>
          <select 
            className="filter-input medium" 
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">-- All Status --</option>
            <option value="saved">Saved</option>
            <option value="held">Held</option>
            <option value="auto-saved">Auto-Saved</option>
          </select>
        </div>

        {/* Branch Filter - Only for Admin */}
        {isAdmin && (
          <div className="filter-group">
            <label>Branch</label>
            <select 
              className="filter-input medium" 
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
            >
              <option value="">-- All Branches --</option>
              {Object.entries(branches).map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="filter-group">
          <label>&nbsp;</label>
          <div className="filter-actions">
            <button 
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                fetchOrders();
              }} 
              title="Refresh Orders" 
              className="search-btn"
              disabled={isLoading}
            >
              {isLoading ? '...' : '🔄'} Refresh
            </button>
            <button 
              onClick={fetchOrders} 
              title="Search" 
              className="search-btn"
              disabled={isLoading}
            >
              {isLoading ? '...' : <FaSearch />} Search
            </button>
            <button 
              onClick={clearFilters} 
              title="Clear Filters" 
              className="clear-btn"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-container">
          Loading orders...
        </div>
      ) : processedOrders.length === 0 ? (
        <div className="empty-state">
          No orders found
        </div>
      ) : (
        <div className="table-container" key={refreshKey}>
          <table>
            <thead>
              <tr>
                <th>Order No.</th>
                <th>Box Count</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Delivery</th>
                <th>Time</th>
                <th>Occasion</th>
                {isAdmin && <th>Branch</th>}
                <th>Total</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Order Progress</th>
                <th>Actions</th>
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
                  <tr key={orderNumber} className={rowClassName}>
                    <td 
                      onClick={() => hasMultipleBoxes && setExpandedOrders(prev => ({ ...prev, [orderNumber]: !prev[orderNumber] }))}
                      style={{ cursor: hasMultipleBoxes ? 'pointer' : 'default' }}
                    >
                      {hasMultipleBoxes && (expanded ? <FaChevronDown /> : <FaChevronRight />)} 
                      {orderNumber}
                    </td>
                    <td>
                      <strong>{totalBoxCount}</strong>
                      {hasMultipleBoxes && <small> ({order.boxes.length} types)</small>}
                    </td>
                    <td className="customer-cell">{order.customerName}</td>
                    <td className="phone-cell">{order.phone}</td>
                    <td>
                      <div className="delivery-cell">
                        <span className="delivery-date">{order.deliveryDate}</span>
                        <span className="badge tag">{getDeliveryTagWithEmoji(order.deliveryDate)}</span>
                      </div>
                    </td>
                    <td>{order.deliveryTime}</td>
                    <td>{order.occasion}</td>
                    
                    {isAdmin && (
                      <td>{branches[order.branchCode] || order.branch || 'Unknown'}</td>
                    )}
                    
                    <td>₹{(order.grandTotal || 0).toFixed(2)}</td>
                    <td><span className={`badge ${order.status}`}>{order.status}</span></td>
                    
                    {/* ✅ SIMPLIFIED: Clean balance display */}
                    <td>{renderBalanceCell(order)}</td>
                    
                    <td>
                      <select
                        value={order.orderProgress || ''}
                        className="progress-select"
                        onChange={(e) => handleProgressChange(order, e.target.value)}
                      >
                        <option value="">⏳ Pending</option>
                        <option value="Packed">📦 Packed</option>
                        <option value="Delivered">🚚 Delivered</option>
                        <option value="Completed">✅ Completed</option>
                        <option value="Cancelled">❌ Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={() => handleEdit(order)} title="Edit"><FaEdit /></button>
                        <button onClick={() => setViewOrder({ ...order, boxViewMode: 'all' })} title="View"><FaEye /></button>
                        <button onClick={() => handlePrint({ ...order, boxViewMode: 'all' })} title="Print All"><FaPrint /></button>
                        
                        {/* ✅ NEW: Changelog button for admin with indicator - FIXED */}
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('📋 Changelog button clicked for order:', order._id, order.orderNumber);
                              handleViewChangelog(order);
                            }} 
                            title="View Order History"
                            className={hasChangelog(order._id) ? 'changelog-active' : 'changelog-inactive'}
                            style={{
                              position: 'relative',
                              background: hasChangelog(order._id) ? '#667eea' : '#f0f0f0',
                              color: hasChangelog(order._id) ? 'white' : '#666',
                              border: 'none',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <FaScroll />
                            {hasChangelog(order._id) && (
                              <span className="changelog-badge" style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
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
                        )}
                        
                        {isAdmin && (
                          <button onClick={() => deleteOrder(order)} title="Delete"><FaTrash /></button>
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
                      <tr key={`${orderNumber}-${subOrder.subLabel}`} className={subRowClassName}>
                        <td title={`Box ${index + 1}: ${subOrder.box.items.map(it => `${it.name} x${it.qty}`).join(', ')}`}>
                          &nbsp;&nbsp;&nbsp;&nbsp;↳ {orderNumber}{subOrder.subLabel}
                        </td>
                        <td>
                          <strong>{subOrder.box.boxCount || 1}</strong>
                          <small> (Box {index + 1})</small>
                        </td>
                        <td className="customer-cell">{subOrder.customerName}</td>
                        <td className="phone-cell">{subOrder.phone}</td>
                        <td>
                          <div className="delivery-cell">
                            <span className="delivery-date">{subOrder.deliveryDate}</span>
                            <span className="badge tag">{getDeliveryTagWithEmoji(subOrder.deliveryDate)}</span>
                          </div>
                        </td>
                        <td>{subOrder.deliveryTime}</td>
                        <td>{subOrder.occasion}</td>
                        
                        {isAdmin && (
                          <td>{branches[subOrder.branchCode] || subOrder.branch || 'Unknown'}</td>
                        )}
                        
                        <td>₹{subOrder.grandTotal.toFixed(2)}</td>
                        <td><span className={`badge ${subOrder.status}`}>{subOrder.status}</span></td>
                        
                        {/* ✅ SIMPLIFIED: Sub-order balance display */}
                        <td>{renderBalanceCell(subOrder)}</td>
                        
                        <td>
                          <select
                            value={subOrder.orderProgress || ''}
                            className="progress-select"
                            onChange={(e) => handleProgressChange(subOrder, e.target.value)}
                          >
                            <option value="">⏳ Pending</option>
                            <option value="Packed">📦 Packed</option>
                            <option value="Delivered">🚚 Delivered</option>
                            <option value="Completed">✅ Completed</option>
                            <option value="Cancelled">❌ Cancelled</option>
                          </select>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button onClick={() => handlePrint({ ...subOrder, boxViewMode: index })} title="Print Box"><FaPrint /></button>
                            <button onClick={() => setViewOrder({ ...subOrder, boxViewMode: index })} title="View"><FaEye /></button>
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

      {/* ✅ FIXED: Debug the modal rendering */}
      {console.log('🔍 About to render modals:', {
        viewOrder: !!viewOrder,
        printOrder: !!printOrder,
        viewChangelog: !!viewChangelog
      })}

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
      
      {/* ✅ NEW: Changelog Modal - FIXED with explicit check */}
      {viewChangelog && viewChangelog.orderId && (
        <ChangelogModal
          orderId={viewChangelog.orderId}
          orderNumber={viewChangelog.orderNumber}
          onClose={() => {
            console.log('📋 Closing changelog modal');
            setViewChangelog(null);
          }}
        />
      )}
    </div>
  );
};

export default OrderTabs;