import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext'; // Add this import

const Orders = () => {
  const { user } = useAuth(); // Get user data
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      // Enhanced debugging
      console.log('🔍 Starting order fetch...');
      console.log('👤 Current user data:', user);
      console.log('🔑 Auth token exists:', !!token);
      
      // Construct proper API URL
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
      
      // Build endpoint
      let endpoint;
      if (user?.role === 'admin') {
        endpoint = `${baseUrl}/api/orders/all`;
        console.log('👑 Admin fetching all orders');
      } else {
        // For staff, use branch code if available
        const branchCode = user?.branchCode || user?.branch;
        endpoint = `${baseUrl}/api/orders/${branchCode}`;
        console.log('👤 Staff fetching orders for branch:', branchCode);
      }
      
      console.log('📡 Fetching from endpoint:', endpoint);
      
      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      console.log('📊 Raw orders data received:', data);
      console.log('📋 Orders count:', Array.isArray(data) ? data.length : (data.orders ? data.orders.length : 'Unknown'));
      
      // Handle both direct array and object with orders property
      const ordersArray = Array.isArray(data) ? data : (data.orders || []);
      
      // Debug each order
      ordersArray.forEach((order, index) => {
        console.log(`📝 Order ${index + 1}:`, {
          id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          branch: order.branch,
          branchCode: order.branchCode,
          status: order.status,
          createdAt: order.createdAt
        });
      });
      
      setOrders(ordersArray);
      setLoading(false);
    } catch (err) {
      console.error('❌ Error fetching orders:', err);
      setOrders([]);
      setLoading(false);
    }
  };

  // Only fetch if user data is available
  if (user && (user.branchCode || user.branch)) {
    console.log('✅ User data available, fetching orders...');
    fetchOrders();
  } else {
    console.log('⏳ Waiting for user data...', user);
  }
}, [user]);

  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  if (loading) {
    return <div className="orders-page"><p>Loading orders...</p></div>;
  }

  return (
    <div className="orders-page">
      <h2>📋 All Orders</h2>
      
      {user?.role === 'admin' && (
        <p className="admin-notice">👑 Admin View - Showing orders from all branches</p>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label>Filter by status: </label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="saved">Saved</option>
          <option value="held">Held</option>
          <option value="auto-saved">Auto-Saved</option>
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map((order) => (
            <div key={order._id} className="order-card">
              <h3>{order.orderNumber} - {order.occasion}</h3>
              <p><strong>Name:</strong> {order.customerName}</p>
              <p><strong>Phone:</strong> {order.phone}</p>
              <p><strong>Status:</strong> {order.status}</p>
              <p><strong>Total:</strong> ₹{order.grandTotal?.toLocaleString()}</p>
              <p><strong>Balance:</strong> ₹{order.balance?.toLocaleString()}</p>
              <p><strong>Date:</strong> {order.orderDate}</p>
              {/* Show branch info for admin */}
              {user?.role === 'admin' && (
                <p><strong>Branch:</strong> {order.branchName || order.branch} ({order.branchCode})</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;