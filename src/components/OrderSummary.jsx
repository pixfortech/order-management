import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { FaSearch, FaEye, FaChevronDown, FaChevronUp, FaDownload } from 'react-icons/fa';
import { useAuth } from '../auth/AuthContext';
import './OrderSummary.css';

const OrderSummary = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [orders, setOrders] = useState([]);
  const [branches, setBranches] = useState({});
  const [occasions, setOccasions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    occasion: '',
    status: '',
    branch: '',
    vendor: '' // Add vendor filter
  });
  
  // Create item-to-vendor mapping
const createItemVendorMap = useCallback(() => {
  const itemVendorMap = {};
  items.forEach(item => {
    itemVendorMap[item.name] = item.vendor || 'Unknown Vendor';
  });
  return itemVendorMap;
}, [items]);
  
  const [viewMode, setViewMode] = useState('consolidated');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [vendors, setVendors] = useState([]); // Add vendors state

  // ✅ FIXED: Use same API URL logic as AuthContext
  const getApiUrl = () => {
    const envUrl = process.env.REACT_APP_API_URL;
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
    
    console.log('🌐 OrderSummary API URL Detection:', {
      envUrl,
      hostname,
      isLocalhost,
      nodeEnv: process.env.NODE_ENV
    });
    
    // For Vercel deployment, always use cloud URL unless explicitly set
    if (!isLocalhost || process.env.NODE_ENV === 'production') {
      const cloudUrl = 'https://order-management-fbre.onrender.com';
      console.log('☁️ OrderSummary using cloud URL:', cloudUrl);
      return cloudUrl;
    }
    
    if (envUrl) {
      console.log('✅ OrderSummary using environment API URL:', envUrl);
      return envUrl;
    }
    
    if (isLocalhost) {
      console.log('🏠 OrderSummary using localhost API URL');
      return 'http://localhost:5000';
    }
    
    const fallbackUrl = 'https://order-management-fbre.onrender.com';
    console.log('⚠️ OrderSummary using fallback URL:', fallbackUrl);
    return fallbackUrl;
  };

  // Debug: Add console logs to check user state
  useEffect(() => {
    console.log('OrderSummary - User data:', user);
    console.log('OrderSummary - Is Admin:', isAdmin);
    console.log('OrderSummary - User branch:', user?.branchCode);
  }, [user, isAdmin]);

  // Fetch master data (branches and occasions)
  // Fetch master data (branches, occasions, items, vendors)
useEffect(() => {
  const fetchMasterData = async () => {
    try {
      console.log('🔍 OrderSummary - Fetching master data...');
      const token = localStorage.getItem('authToken');
      console.log('Auth token available:', !!token);
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const baseUrl = getApiUrl();
      console.log('🌐 OrderSummary - Using base URL for master data:', baseUrl);
      
      // Fetch branches (only for admin)
      if (isAdmin) {
        console.log('🏢 Fetching branches for admin...');
        try {
          const branchesResponse = await axios.get(`${baseUrl}/api/branches`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          console.log('Branches response:', branchesResponse.data);
          
          const branchesObj = {};
          if (Array.isArray(branchesResponse.data)) {
            branchesResponse.data.forEach(branch => {
              branchesObj[branch.branchCode] = branch.branchName;
            });
          }
          setBranches(branchesObj);
          console.log('✅ Branches loaded:', Object.keys(branchesObj).length);
        } catch (branchError) {
          console.warn('⚠️ Failed to fetch branches:', branchError.message);
        }
      }
      
      // Fetch occasions
      console.log('🎉 Fetching occasions...');
      try {
        const occasionsResponse = await axios.get(`${baseUrl}/api/occasions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Occasions response:', occasionsResponse.data);
        
        if (Array.isArray(occasionsResponse.data)) {
          const occasionNames = occasionsResponse.data.map(occ => occ.name);
          setOccasions(occasionNames);
          console.log('✅ Occasions loaded:', occasionNames.length);
        }
      } catch (occasionError) {
        console.warn('⚠️ Failed to fetch occasions:', occasionError.message);
      }

      // ✅ NEW: Fetch items to get vendor mapping (MOST IMPORTANT)
      console.log('📦 Fetching items for vendor mapping...');
      try {
        const itemsResponse = await axios.get(`${baseUrl}/api/items`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Items response:', itemsResponse.data);
        
        if (Array.isArray(itemsResponse.data)) {
          setItems(itemsResponse.data);
          console.log('✅ Items loaded:', itemsResponse.data.length);
          
          // Extract unique vendors from items collection
          const uniqueVendors = [...new Set(
            itemsResponse.data
              .map(item => item.vendor)
              .filter(vendor => vendor && vendor.trim() !== '')
          )];
          
          console.log('📋 Vendors found in items:', uniqueVendors);
          setVendors(uniqueVendors);
          console.log('✅ Vendors extracted from items:', uniqueVendors.length);
        }
      } catch (itemsError) {
        console.error('❌ Failed to fetch items:', itemsError.message);
        // Items are critical for vendor mapping, so set error but continue
        console.warn('⚠️ Items fetch failed - vendor mapping will not work properly');
      }

      // ✅ BACKUP: Also fetch vendors collection if available
      console.log('🏪 Fetching vendors collection as backup...');
      try {
        const vendorsResponse = await axios.get(`${baseUrl}/api/vendors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Vendors collection response:', vendorsResponse.data);
        
        if (Array.isArray(vendorsResponse.data)) {
          const vendorCollectionNames = vendorsResponse.data.map(vendor => vendor.name);
          console.log('📋 Vendors from collection:', vendorCollectionNames);
          
          // Merge vendors from items and vendors collection (items take priority)
          setVendors(prevVendors => {
            const mergedVendors = [...new Set([...prevVendors, ...vendorCollectionNames])];
            console.log('✅ Final merged vendors:', mergedVendors);
            return mergedVendors;
          });
        }
      } catch (vendorError) {
        console.warn('⚠️ Vendors collection not available:', vendorError.message);
        console.log('ℹ️ Using vendors from items collection only');
      }
      
    } catch (error) {
      console.error('❌ Error fetching master data:', error);
      console.error('❌ Error details:', error.response?.data);
      setError(`Error fetching master data: ${error.response?.data?.message || error.message}`);
    }
  };
  
  // Only fetch if user is available
  if (user) {
    fetchMasterData();
  } else {
    console.log('⏳ User not available yet, waiting...');
  }
}, [isAdmin, user]); // ✅ FIXED: Removed vendors dependency to prevent infinite loop

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
      
      const baseUrl = getApiUrl();
      console.log('🌐 OrderSummary - Using base URL for orders:', baseUrl);
      
      // Build the correct endpoint with absolute URL
      let endpoint;
      if (isAdmin) {
        if (filters.branch) {
          endpoint = `${baseUrl}/api/orders/${filters.branch.toLowerCase()}`;
        } else {
          endpoint = `${baseUrl}/api/orders/all`;
        }
      } else {
        if (!user.branchCode) {
          setError('User branch code not available');
          return;
        }
        endpoint = `${baseUrl}/api/orders/${user.branchCode.toLowerCase()}`;
      }
      
      // Prepare query parameters
      const queryParams = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() && key !== 'branch') {
          if (key === 'startDate') {
            queryParams['orderDate'] = `>=${value}`;
          } else if (key === 'endDate') {
            queryParams['orderDate'] = `<=${value}`;
          } else {
            queryParams[key] = value.trim();
          }
        }
      });
      
      console.log('🔗 OrderSummary Final API endpoint:', endpoint);
      console.log('📝 Query params:', queryParams);
      console.log('👤 User info:', { role: user?.role, branchCode: user?.branchCode });
      
      const response = await axios.get(endpoint, {
        params: queryParams,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('📊 Orders response status:', response.status);
      console.log('📊 Orders data:', response.data);
      
      const ordersData = response.data;
      let processedOrders = [];
      
      if (Array.isArray(ordersData)) {
        processedOrders = ordersData.filter(order => 
          order._id && 
          order.customerName && 
          order.customerName.trim() !== ''
        );
      } else if (ordersData && Array.isArray(ordersData.orders)) {
        processedOrders = ordersData.orders.filter(order => 
          order._id && 
          order.customerName && 
          order.customerName.trim() !== ''
        );
      }
      
      console.log('✅ Processed orders:', processedOrders.length);
      setOrders(processedOrders);
      
    } catch (err) {
      console.error('❌ OrderSummary fetch error:', err);
      console.error('❌ Error response:', err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      setError(`Error fetching orders: ${errorMessage}`);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, isAdmin, user]);

  useEffect(() => {
    // Only fetch orders if user is available
    if (user) {
      fetchOrders();
    }
  }, [fetchOrders, user]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      occasion: '',
      status: '',
      branch: '',
      vendor: '' // Add vendor to clear filters
    });
  };

  // Calculate consolidated item totals
  // ✅ FIXED: Calculate consolidated item totals with proper vendor mapping
const getConsolidatedItems = () => {
  const itemTotals = {};
  const itemVendorMap = createItemVendorMap();
  
  orders.forEach(order => {
    if (order.boxes && Array.isArray(order.boxes)) {
      order.boxes.forEach(box => {
        if (box.items && Array.isArray(box.items)) {
          box.items.forEach(item => {
            const itemName = item.name;
            // ✅ FIXED: Get vendor from items collection mapping
            const vendorName = itemVendorMap[itemName] || 'Unknown Vendor';
            const totalQuantity = item.qty * (box.boxCount || 1);
            
            if (itemTotals[itemName]) {
              itemTotals[itemName].quantity += totalQuantity;
              itemTotals[itemName].orders.add(order.orderNumber);
            } else {
              itemTotals[itemName] = {
                quantity: totalQuantity,
                unit: item.unit || 'pcs',
                vendor: vendorName,
                orders: new Set([order.orderNumber])
              };
            }
          });
        }
      });
    }
  });
  
  // Filter by vendor if selected
  if (filters.vendor) {
    Object.keys(itemTotals).forEach(itemName => {
      if (itemTotals[itemName].vendor !== filters.vendor) {
        delete itemTotals[itemName];
      }
    });
  }
  
  // Convert Set to Array for orders
  Object.keys(itemTotals).forEach(itemName => {
    itemTotals[itemName].orders = Array.from(itemTotals[itemName].orders);
  });
  
  return itemTotals;
};

  // Calculate vendor-wise item totals
  // ✅ FIXED: Calculate vendor-wise item totals with proper vendor mapping
const getVendorWiseItems = () => {
  const vendorTotals = {};
  const itemVendorMap = createItemVendorMap();
  
  orders.forEach(order => {
    if (order.boxes && Array.isArray(order.boxes)) {
      order.boxes.forEach(box => {
        if (box.items && Array.isArray(box.items)) {
          box.items.forEach(item => {
            const itemName = item.name;
            // ✅ FIXED: Get vendor from items collection mapping
            const vendorName = itemVendorMap[itemName] || 'Unknown Vendor';
            const totalQuantity = item.qty * (box.boxCount || 1);
            
            if (!vendorTotals[vendorName]) {
              vendorTotals[vendorName] = {};
            }
            
            if (vendorTotals[vendorName][itemName]) {
              vendorTotals[vendorName][itemName].quantity += totalQuantity;
              vendorTotals[vendorName][itemName].orders.add(order.orderNumber);
            } else {
              vendorTotals[vendorName][itemName] = {
                quantity: totalQuantity,
                unit: item.unit || 'pcs',
                vendor: vendorName,
                orders: new Set([order.orderNumber])
              };
            }
          });
        }
      });
    }
  });
  
  // Filter by vendor if selected
  if (filters.vendor) {
    const filteredVendorTotals = {};
    if (vendorTotals[filters.vendor]) {
      filteredVendorTotals[filters.vendor] = vendorTotals[filters.vendor];
    }
    return filteredVendorTotals;
  }
  
  // Convert Set to Array for orders
  Object.keys(vendorTotals).forEach(vendorName => {
    Object.keys(vendorTotals[vendorName]).forEach(itemName => {
      vendorTotals[vendorName][itemName].orders = Array.from(vendorTotals[vendorName][itemName].orders);
    });
  });
  
  return vendorTotals;
};

  // Calculate order-wise breakdown
  // ✅ FIXED: Calculate order-wise breakdown with proper vendor mapping
const getOrderWiseBreakdown = () => {
  const orderBreakdown = {};
  const itemVendorMap = createItemVendorMap();
  
  orders.forEach(order => {
    const orderItems = {};
    
    if (order.boxes && Array.isArray(order.boxes)) {
      order.boxes.forEach(box => {
        if (box.items && Array.isArray(box.items)) {
          box.items.forEach(item => {
            const itemName = item.name;
            // ✅ FIXED: Get vendor from items collection mapping
            const vendorName = itemVendorMap[itemName] || 'Unknown Vendor';
            const totalQuantity = item.qty * (box.boxCount || 1);
            
            if (orderItems[itemName]) {
              orderItems[itemName].quantity += totalQuantity;
            } else {
              orderItems[itemName] = {
                quantity: totalQuantity,
                unit: item.unit || 'pcs',
                vendor: vendorName
              };
            }
          });
        }
      });
    }
    
    orderBreakdown[order.orderNumber] = {
      ...order,
      items: orderItems
    };
  });
  
  return orderBreakdown;
};

  const exportToCSV = () => {
    const currentBranch = isAdmin ? 
      (filters.branch ? branches[filters.branch] : 'All Branches') : 
      (user?.branchName || user?.branch || 'Unknown Branch');
    
    if (viewMode === 'consolidated') {
      const consolidatedItems = getConsolidatedItems();
      const csvContent = [
        [`Consolidated Item Summary - ${currentBranch}`],
        [`Generated on: ${new Date().toLocaleDateString()}`],
        [''],
        ['Item Name', 'Total Quantity', 'Unit', 'Orders Count'].join(','),
        ...Object.entries(consolidatedItems).map(([itemName, data]) => 
          [itemName, data.quantity, data.unit, data.orders.length].join(',')
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consolidated-summary-${currentBranch.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } else {
      const orderWise = getOrderWiseBreakdown();
      const csvContent = [
        [`Order-wise Summary - ${currentBranch}`],
        [`Generated on: ${new Date().toLocaleDateString()}`],
        [''],
        ['Order Number', 'Customer', 'Item Name', 'Quantity', 'Unit'].join(','),
        ...Object.entries(orderWise).flatMap(([orderNumber, order]) =>
          Object.entries(order.items).map(([itemName, itemData]) =>
            [orderNumber, order.customerName, itemName, itemData.quantity, itemData.unit].join(',')
          )
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orderwise-summary-${currentBranch.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  const consolidatedItems = getConsolidatedItems();
  const vendorWiseItems = getVendorWiseItems();
  const orderWiseBreakdown = getOrderWiseBreakdown();

  // Get current branch display name
  const getCurrentBranchDisplay = () => {
    if (isAdmin) {
      if (filters.branch) {
        return `${branches[filters.branch]} (${filters.branch})`;
      }
      return 'All Branches';
    } else {
      return `${user?.branchName || user?.branch || 'Unknown Branch'} (${user?.branchCode || 'XX'})`;
    }
  };

  // Early return if user is not loaded
  if (!user) {
    return (
      <div className="order-summary-container">
        <div className="loading-container">
          Loading user data...
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="order-summary-container">
        <div className="error-container" style={{
          padding: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          margin: '20px'
        }}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => {
            setError(null);
            fetchOrders();
          }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="order-summary-container">
      {/* Debug Info - Remove in production */}
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#f0f0f0', 
        margin: '10px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <strong>Debug Info:</strong><br/>
        User: {user?.username || 'Not loaded'}<br/>
        Role: {user?.role || 'Not set'}<br/>
        Branch: {user?.branchCode || 'Not set'}<br/>
        Orders Count: {orders.length}<br/>
        Loading: {isLoading ? 'Yes' : 'No'}<br/>
        Branches Count: {Object.keys(branches).length}<br/>
        Occasions Count: {occasions.length}<br/>
        Vendors Count: {vendors.length}<br/>
        API URL: {getApiUrl()}
      </div>

      {/* Filters Section */}
      <div className="order-summary-filters">
        <div className="order-summary-header">
          <h2>📊 Order Summary & Reports</h2>
          <div className="current-branch-display">
            <span className="branch-indicator">
              📍 {getCurrentBranchDisplay()}
            </span>
          </div>
        </div>
        
        <div className="filters-bar">
          {/* Date Range Filters */}
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="filter-input"
            />
          </div>

          {/* Occasion Filter */}
          <div className="filter-group">
            <label>Occasion</label>
            <select 
              className="filter-input" 
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
              className="filter-input" 
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">-- All Status --</option>
              <option value="saved">Saved</option>
              <option value="held">Held</option>
              <option value="auto-saved">Auto-Saved</option>
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="filter-group">
            <label>Vendor</label>
            <select 
              className="filter-input" 
              value={filters.vendor}
              onChange={(e) => handleFilterChange('vendor', e.target.value)}
            >
              <option value="">-- All Vendors --</option>
              {vendors.map(vendor => (
                <option key={vendor} value={vendor}>{vendor}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter - Only for Admin */}
          {isAdmin && (
            <div className="filter-group">
              <label>Branch</label>
              <select 
                className="filter-input" 
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
                onClick={fetchOrders} 
                className="search-btn"
                disabled={isLoading}
              >
                <FaSearch /> {isLoading ? 'Loading...' : 'Search'}
              </button>
              <button 
                onClick={clearFilters} 
                className="clear-btn"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button 
            className={viewMode === 'consolidated' ? 'active' : ''}
            onClick={() => setViewMode('consolidated')}
          >
            📋 Consolidated View
          </button>
          <button 
            className={viewMode === 'vendor' ? 'active' : ''}
            onClick={() => setViewMode('vendor')}
          >
            🏪 Vendor-wise View
          </button>
          <button 
            className={viewMode === 'orderwise' ? 'active' : ''}
            onClick={() => setViewMode('orderwise')}
          >
            📑 Order-wise View
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="order-summary-results">
        {isLoading ? (
          <div className="loading-container">
            Loading summary data...
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            No orders found for the selected criteria
            <p className="empty-subtitle">
              {isAdmin ? 
                'Try adjusting your filters or select a different branch' : 
                'No orders found for your branch with the current filters'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Summary Statistics */}
            <div className="summary-stats">
              <div className="stat-card">
                <h3>Total Orders</h3>
                <p className="stat-number">{orders.length}</p>
              </div>
              <div className="stat-card">
                <h3>Unique Items</h3>
                <p className="stat-number">{Object.keys(consolidatedItems).length}</p>
              </div>
              <div className="stat-card">
                <h3>Total Revenue</h3>
                <p className="stat-number">
                  ₹{orders.reduce((sum, order) => sum + (order.grandTotal || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="stat-card">
                <button onClick={exportToCSV} className="export-btn">
                  <FaDownload /> Export CSV
                </button>
              </div>
            </div>

            {/* Consolidated View */}
            {viewMode === 'consolidated' && (
              <div className="consolidated-view">
                <h3>📦 Item Summary</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Vendor</th>
                        <th>Total Quantity</th>
                        <th>Unit</th>
                        <th>Orders Count</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(consolidatedItems)
                        .sort(([,a], [,b]) => b.quantity - a.quantity)
                        .map(([itemName, data]) => (
                        <tr key={itemName}>
                          <td className="item-name">{itemName}</td>
                          <td>{data.vendor || 'Unknown Vendor'}</td>
                          <td className="quantity">{data.quantity.toLocaleString()}</td>
                          <td>{data.unit}</td>
                          <td>{data.orders.length}</td>
                          <td>
                            <button 
                              onClick={() => {
                                console.log('Orders with this item:', data.orders);
                                alert(`Orders containing "${itemName}":\n${data.orders.join(', ')}`);
                              }}
                              className="view-orders-btn"
                              title="View orders containing this item"
                            >
                              <FaEye /> View Orders
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Vendor-wise View */}
            {viewMode === 'vendor' && (
              <div className="vendor-view">
                <h3>🏪 Vendor-wise Item Summary</h3>
                {Object.entries(vendorWiseItems)
                  .sort(([,itemsA], [,itemsB]) => {
                    // Sort vendors by total quantity across all items
                    const totalA = Object.values(itemsA).reduce((sum, item) => sum + item.quantity, 0);
                    const totalB = Object.values(itemsB).reduce((sum, item) => sum + item.quantity, 0);
                    return totalB - totalA;
                  })
                  .map(([vendorName, items]) => {
                    const totalVendorQuantity = Object.values(items).reduce((sum, item) => sum + item.quantity, 0);
                    const totalVendorOrders = new Set(
                      Object.values(items).flatMap(item => item.orders)
                    ).size;
                    
                    return (
                      <div key={vendorName} className="vendor-section" style={{ marginBottom: '30px' }}>
                        <div className="vendor-header" style={{
                          backgroundColor: '#f8f9fa',
                          padding: '15px',
                          borderRadius: '8px',
                          marginBottom: '15px',
                          border: '1px solid #dee2e6'
                        }}>
                          <h4 style={{ margin: '0', color: '#495057', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>🏪 {vendorName}</span>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>
                              <span style={{ 
                                backgroundColor: '#007bff', 
                                color: 'white', 
                                padding: '4px 8px', 
                                borderRadius: '12px',
                                marginRight: '10px'
                              }}>
                                {Object.keys(items).length} items
                              </span>
                              <span style={{ 
                                backgroundColor: '#28a745', 
                                color: 'white', 
                                padding: '4px 8px', 
                                borderRadius: '12px',
                                marginRight: '10px'
                              }}>
                                {totalVendorQuantity.toLocaleString()} total qty
                              </span>
                              <span style={{ 
                                backgroundColor: '#17a2b8', 
                                color: 'white', 
                                padding: '4px 8px', 
                                borderRadius: '12px'
                              }}>
                                {totalVendorOrders} orders
                              </span>
                            </div>
                          </h4>
                        </div>
                        
                        <div className="table-container">
                          <table>
                            <thead>
                              <tr>
                                <th>Item Name</th>
                                <th>Total Quantity</th>
                                <th>Unit</th>
                                <th>Orders Count</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(items)
                                .sort(([,a], [,b]) => b.quantity - a.quantity)
                                .map(([itemName, data]) => (
                                <tr key={`${vendorName}-${itemName}`}>
                                  <td className="item-name">{itemName}</td>
                                  <td className="quantity">{data.quantity.toLocaleString()}</td>
                                  <td>{data.unit}</td>
                                  <td>{data.orders.length}</td>
                                  <td>
                                    <button 
                                      onClick={() => {
                                        console.log('Orders with this item:', data.orders);
                                        alert(`Orders containing "${itemName}" from ${vendorName}:\n${data.orders.join(', ')}`);
                                      }}
                                      className="view-orders-btn"
                                      title="View orders containing this item"
                                    >
                                      <FaEye /> View Orders
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}

            {/* Order-wise View */}
            {viewMode === 'orderwise' && (
              <div className="orderwise-view">
                <h3>📑 Order-wise Breakdown</h3>
                <div className="orders-breakdown">
                  {Object.entries(orderWiseBreakdown).map(([orderNumber, order]) => (
                    <div key={orderNumber} className="order-card">
                      <div 
                        className="order-header"
                        onClick={() => setExpandedOrders(prev => ({
                          ...prev,
                          [orderNumber]: !prev[orderNumber]
                        }))}
                      >
                        <div className="order-info">
                          <h4>{orderNumber}</h4>
                          <p>{order.customerName} | {order.deliveryDate}</p>
                          <span className="branch-tag">
                            {branches[order.branchCode] || order.branch || 'Unknown Branch'} ({order.branchCode})
                          </span>
                        </div>
                        <div className="expand-icon">
                          {expandedOrders[orderNumber] ? <FaChevronUp /> : <FaChevronDown />}
                        </div>
                      </div>
                      
                      {expandedOrders[orderNumber] && (
                        <div className="order-items">
                          <table>
                            <thead>
                              <tr>
                                <th>Item Name</th>
                                <th>Vendor</th>
                                <th>Quantity</th>
                                <th>Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(order.items).map(([itemName, itemData]) => (
                                <tr key={itemName}>
                                  <td>{itemName}</td>
                                  <td>{itemData.vendor || 'Unknown Vendor'}</td>
                                  <td>{itemData.quantity.toLocaleString()}</td>
                                  <td>{itemData.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrderSummary;