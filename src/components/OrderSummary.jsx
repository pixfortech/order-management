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
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    occasion: '',
    status: '',
    branch: '' // Only for admin
  });
  
  const [viewMode, setViewMode] = useState('consolidated'); // 'consolidated' or 'orderwise'
  const [expandedOrders, setExpandedOrders] = useState({});

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
      
      // Build the correct endpoint - SAME LOGIC AS OrderTabs
      let endpoint;
      if (isAdmin) {
        if (filters.branch) {
          // Admin filtering by specific branch
          endpoint = `/api/orders/${filters.branch.toLowerCase()}`;
        } else {
          // Admin viewing all orders
          endpoint = `/api/orders/all`;
        }
      } else {
        // Staff user - only their branch orders
        endpoint = `/api/orders/${user?.branchCode?.toLowerCase()}`;
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
      
      console.log('Fetching summary from endpoint:', endpoint, 'with params:', queryParams);
      console.log('User role:', user?.role, 'Branch:', user?.branchCode);
      
      const response = await axios.get(endpoint, {
        params: queryParams,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const ordersData = response.data;
      if (Array.isArray(ordersData)) {
        const realOrders = ordersData.filter(order => 
          order._id && 
          order.customerName && 
          order.customerName.trim() !== ''
        );
        setOrders(realOrders);
      } else if (ordersData && Array.isArray(ordersData.orders)) {
        const realOrders = ordersData.orders.filter(order => 
          order._id && 
          order.customerName && 
          order.customerName.trim() !== ''
        );
        setOrders(realOrders);
      } else {
        setOrders([]);
      }
      
    } catch (err) {
      console.error('Error fetching orders for summary:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, isAdmin, user?.branchCode]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      occasion: '',
      status: '',
      branch: ''
    });
  };

  // Calculate consolidated item totals
  const getConsolidatedItems = () => {
    const itemTotals = {};
    
    orders.forEach(order => {
      order.boxes.forEach(box => {
        box.items.forEach(item => {
          const itemName = item.name;
          const totalQuantity = item.qty * box.boxCount;
          
          if (itemTotals[itemName]) {
            itemTotals[itemName].quantity += totalQuantity;
            itemTotals[itemName].orders.add(order.orderNumber);
          } else {
            itemTotals[itemName] = {
              quantity: totalQuantity,
              unit: item.unit || 'pcs',
              orders: new Set([order.orderNumber])
            };
          }
        });
      });
    });
    
    // Convert Set to Array for orders
    Object.keys(itemTotals).forEach(itemName => {
      itemTotals[itemName].orders = Array.from(itemTotals[itemName].orders);
    });
    
    return itemTotals;
  };

  // Calculate order-wise breakdown
  const getOrderWiseBreakdown = () => {
    const orderBreakdown = {};
    
    orders.forEach(order => {
      const orderItems = {};
      
      order.boxes.forEach(box => {
        box.items.forEach(item => {
          const itemName = item.name;
          const totalQuantity = item.qty * box.boxCount;
          
          if (orderItems[itemName]) {
            orderItems[itemName].quantity += totalQuantity;
          } else {
            orderItems[itemName] = {
              quantity: totalQuantity,
              unit: item.unit || 'pcs'
            };
          }
        });
      });
      
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

  return (
    <div className="order-summary-container">
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
                          {/* Always show branch info for context */}
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
                                <th>Quantity</th>
                                <th>Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(order.items).map(([itemName, itemData]) => (
                                <tr key={itemName}>
                                  <td>{itemName}</td>
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