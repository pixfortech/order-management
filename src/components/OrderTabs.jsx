import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  FaTrash, FaEye, FaEdit, FaPrint, FaSearch,
  FaScroll, FaChevronDown, FaChevronRight
} from 'react-icons/fa';
import './OrderTabs.css';
import { useAuth } from '../auth/AuthContext';
import ViewOrderModal from './ViewOrderModal';
import PrintOrderModal from './PrintOrderModal';

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

const OrderTabs = ({ setSelectedOrder, switchToFormTab, changelogData, viewChangelog }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [orders, setOrders] = useState([]);
  const [branches, setBranches] = useState({});
  const [occasions, setOccasions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    name: '', 
    phone: '', 
    email: '', 
    item: '', 
    occasion: '',
    orderDate: '', 
    deliveryDate: '', 
    status: '',
    branch: '' // Only for admin
  });
  
  const [expandedOrders, setExpandedOrders] = useState({});
  const [printOrder, setPrintOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  

  // Fetch master data (branches and occasions)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        // Fetch branches (only for admin)
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
        
        // Fetch occasions
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
    
    // ✅ ADD PROPER BASE URL LOGIC (same as OrdersList.jsx)
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
    
    // Build the correct endpoint with full URL
    let endpoint;
    if (isAdmin) {
      if (filters.branch) {
        // Admin filtering by specific branch
        endpoint = `${baseUrl}/api/orders/${filters.branch.toLowerCase()}`;
      } else {
        // Admin viewing all orders
        endpoint = `${baseUrl}/api/orders/all`;
      }
    } else {
      // Staff user - only their branch
      endpoint = `${baseUrl}/api/orders/${user?.branchCode?.toLowerCase()}`;
    }
    
    // Prepare query parameters
    const queryParams = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim() && key !== 'branch') {
        queryParams[key] = value.trim();
      }
    });
    
    console.log('🔍 OrderTabs - Fetching from endpoint:', endpoint, 'with params:', queryParams);
    console.log('👤 OrderTabs - User data:', { role: user?.role, branchCode: user?.branchCode });
    
    // ✅ REPLACE AXIOS WITH FETCH for consistency
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
    
    // Ensure we get actual data from database
    if (Array.isArray(ordersData)) {
      // Keep all orders that have an ID and customer name
      const realOrders = ordersData.filter(order => 
        order._id && 
        order.customerName && 
        order.customerName.trim() !== ''
      );
      console.log('📋 OrderTabs - Filtered orders count:', realOrders.length);
      setOrders(realOrders);
    } else if (ordersData && Array.isArray(ordersData.orders)) {
      const realOrders = ordersData.orders.filter(order => 
        order._id && 
        order.customerName && 
        order.customerName.trim() !== ''
      );
      console.log('📋 OrderTabs - Filtered orders count:', realOrders.length);
      setOrders(realOrders);
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
}, [filters, isAdmin, user?.branchCode]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const deleteOrder = async (order) => {
    if (!window.confirm(`Delete order ${order.orderNumber}?`)) return;
    
    try {
      const token = localStorage.getItem('authToken');
      
      // ✅ FIXED: Use proper API URL with branch code like other endpoints
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
      fetchOrders(); // Refresh the list
      
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

  const handleProgressChange = async (order, value) => {
    try {
      const token = localStorage.getItem('authToken');
      
      // ✅ FIXED: Use proper API URL construction like other functions
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
      fetchOrders(); // Refresh the orders list
      
    } catch (err) {
      console.error('❌ Progress update failed:', err);
      alert(`Failed to update progress: ${err.message}`);
    }
  };

  const hasChangelog = (orderId) => changelogData?.[orderId]?.length >= 1;

  // ✅ FIXED: Completely rewritten grouping logic
  const processOrders = () => {
    // Safety check: ensure orders is an array
    if (!Array.isArray(orders)) {
      console.warn('Orders is not an array:', orders);
      return [];
    }
    
    // Group orders by full order number to handle duplicates
    const orderMap = {};
    
    orders.forEach(order => {
      const orderNumber = order.orderNumber;
      
      if (!orderMap[orderNumber]) {
        orderMap[orderNumber] = order;
      } else {
        // If duplicate order number, keep the most recent one
        if (new Date(order.createdAt) > new Date(orderMap[orderNumber].createdAt)) {
          orderMap[orderNumber] = order;
        }
      }
    });
    
    // Convert back to array and sort by order number (newest first)
    const uniqueOrders = Object.values(orderMap).sort((a, b) => {
      // Sort by creation date, newest first
      return new Date(b.createdAt || b.orderDate) - new Date(a.createdAt || a.orderDate);
    });
    
    console.log('📋 Processed unique orders:', uniqueOrders.length);
    return uniqueOrders;
  };

  // ✅ FIXED: New function to create box breakdown for multi-box orders
  const createBoxBreakdown = (order) => {
    if (!order.boxes || order.boxes.length <= 1) {
      return null; // Single box order, no breakdown needed
    }
    
    const breakdown = [];
    const totalBoxCount = order.boxes.reduce((sum, box) => sum + (box.boxCount || 1), 0);
    const advancePerBox = (order.advancePaid || 0) / totalBoxCount;
    
    order.boxes.forEach((box, index) => {
      const boxSubtotal = box.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
      const boxTotal = (boxSubtotal * (box.boxCount || 1)) - ((box.discount || 0) * (box.boxCount || 1));
      const boxAdvance = advancePerBox * (box.boxCount || 1);
      
      breakdown.push({
        ...order,
        boxIndex: index,
        subLabel: `-${chars[index] || index}`,
        grandTotal: boxTotal,
        advancePaid: boxAdvance,
        balance: boxTotal - boxAdvance,
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

  // ✅ FIXED: Process orders for rendering
  const processedOrders = processOrders();

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
          <label>&nbsp;</label> {/* Empty label for alignment */}
          <div className="filter-actions">
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
        <div className="table-container">
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
                {/* Branch Column - Only for Admin */}
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
                
                // Main order row
                const mainRow = (
                  <tr key={orderNumber} className="main-order">
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
                    
                    {/* Branch Column - Only for Admin */}
                    {isAdmin && (
                      <td>{branches[order.branchCode] || order.branch || 'Unknown'}</td>
                    )}
                    
                    <td>₹{(order.grandTotal || 0).toFixed(2)}</td>
                    <td><span className={`badge ${order.status}`}>{order.status}</span></td>
                    <td>₹{((order.grandTotal || 0) - (order.advancePaid || 0)).toFixed(2)}</td>
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
                        {isAdmin && hasChangelog(order._id) && (
                          <button onClick={() => viewChangelog(order._id)} title="Changelog"><FaScroll /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => deleteOrder(order)} title="Delete"><FaTrash /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                
                // Sub-order rows (only if expanded and has multiple boxes)
                const subRows = (hasMultipleBoxes && expanded && boxBreakdown) ? 
                  boxBreakdown.map((subOrder, index) => (
                    <tr key={`${orderNumber}-${subOrder.subLabel}`} className="sub-order">
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
                      
                      {/* Branch Column for sub-orders - Only for Admin */}
                      {isAdmin && (
                        <td>{branches[subOrder.branchCode] || subOrder.branch || 'Unknown'}</td>
                      )}
                      
                      <td>₹{subOrder.grandTotal.toFixed(2)}</td>
                      <td><span className={`badge ${subOrder.status}`}>{subOrder.status}</span></td>
                      <td>₹{subOrder.balance.toFixed(2)}</td>
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
                  )) : [];
                
                return [mainRow, ...subRows];
              })}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
};

export default OrderTabs;