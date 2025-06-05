const API_BASE = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

export const saveOrder = async (orderData, editingOrderId = null) => {
  const branchCode = orderData.branchCode.toLowerCase();

  const endpoint = editingOrderId 
    ? `${API_BASE}/orders/${branchCode}/${editingOrderId}`
    : `${API_BASE}/orders/${branchCode}`;

  const method = editingOrderId ? 'PUT' : 'POST';

  const token = localStorage.getItem('authToken');

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    throw new Error(`Failed to save order: ${response.statusText}`);
  }

  return response.json();
};

export const getLastOrderNumber = async (prefix) => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${API_BASE}/orders/last-number/${prefix}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return response.json();
};
