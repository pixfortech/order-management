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
        
        // ✅ FIXED: Use correct endpoint based on user role
        let endpoint;
        if (user?.role === 'admin') {
          endpoint = '/api/orders/all'; // Admin sees all orders
        } else {
          endpoint = `/api/orders/${user?.branchCode?.toLowerCase()}`; // Staff sees only their branch
        }
        
        console.log('📡 Fetching orders from:', endpoint);
        
        const res = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('📊 Orders data received:', data);
        
        // Handle both direct array and object with orders property
        const ordersArray = Array.isArray(data) ? data : (data.orders || []);
        setOrders(ordersArray);
        setLoading(false);
      } catch (err) {
        console.error('❌ Error fetching orders:', err);
        setOrders([]);
        setLoading(false);
      }
    };

    // Only fetch if user data is available
    if (user && user.branchCode) {
      fetchOrders();
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