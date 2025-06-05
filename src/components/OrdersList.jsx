import React, { useEffect, useState } from 'react';

const displayName = localStorage.getItem('displayName') || '{displayName}';
const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        setOrders(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'all') return true;
    return order.status === statusFilter;
  });

  return (
    <div className="orders-page">
      <h2>📋 All Orders</h2>

      <div style={{ marginBottom: '1rem' }}>
        <label>Filter by status: </label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="saved">Saved</option>
          <option value="held">Held</option>
        </select>
      </div>

      {loading ? (
        <p>Loading orders...</p>
      ) : filteredOrders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        filteredOrders.map((order, index) => (
          <div key={index} className="order-card">
            <h3>{order.orderNumber} - {order.occasion}</h3>
            <p><strong>Name:</strong> {order.customerName}</p>
            <p><strong>Phone:</strong> {order.phone}</p>
            <p><strong>Status:</strong> {order.status}</p>
            <p><strong>Total:</strong> ₹{order.grandTotal}</p>
            <p><strong>Balance:</strong> ₹{order.balance}</p>
            <p><strong>Date:</strong> {order.orderDate}</p>
          </div>
        ))
      )}
    </div>
  );
};

export default Orders;