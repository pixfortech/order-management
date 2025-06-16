import React, { useEffect, useState } from 'react';
import './PrintOrderModal.css';

const PrintOrderModal = ({ order, onClose }) => {
  const [brandDetails, setBrandDetails] = useState({ 
    displayName: 'Order Management', 
    name: 'Brand' 
  });

  // Fetch brand details for the header
  useEffect(() => {
    const fetchBrandDetails = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://order-management-fbre.onrender.com'}/api/brand`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const brandData = await response.json();
          setBrandDetails({
            displayName: brandData.displayName || brandData.name || 'Order Management',
            name: brandData.name || 'Brand'
          });
        }
      } catch (error) {
        console.warn('Could not fetch brand details:', error);
      }
    };
    
    fetchBrandDetails();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const calculateBoxTotal = (box) => {
    const itemsSubtotal = box.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const boxSubtotal = itemsSubtotal * box.boxCount;
    const boxDiscount = box.discount > 0 ? box.discount * box.boxCount : 0;
    return boxSubtotal - boxDiscount;
  };

  const calculateGrandTotal = () => {
    const boxTotals = order.boxes.map(box => calculateBoxTotal(box));
    const subtotal = boxTotals.reduce((a, b) => a + b, 0);
    
    const extraDiscountAmount = order.extraDiscount?.value > 0
      ? (order.extraDiscount.type === 'percentage'
        ? (order.extraDiscount.value / 100) * subtotal
        : order.extraDiscount.value)
      : 0;
    
    return subtotal - extraDiscountAmount;
  };

  const grandTotal = calculateGrandTotal();
  const balance = grandTotal - (order.advancePaid || 0);

  // Determine which boxes to show based on boxViewMode
  const boxesToShow = order.boxViewMode === 'all' || order.boxViewMode === undefined
    ? order.boxes
    : [order.boxes[order.boxViewMode]];

  return (
    <div className="print-modal-backdrop" onClick={onClose}>
      <div className="print-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="print-modal-header no-print">
          <h2>Print Order</h2>
          <div className="print-modal-actions">
            <button onClick={handlePrint} className="print-btn">🖨️ Print</button>
            <button onClick={onClose} className="close-btn">✕ Close</button>
          </div>
        </div>

        <div className="print-content">
          {/* Header */}
          <div className="print-header">
            <h1>{brandDetails.displayName}</h1>
            <h2>Order Receipt</h2>
          </div>

          {/* Order Info */}
          <div className="order-info-section">
            <div className="order-info-row">
              <div className="order-info-col">
                <strong>Order Number:</strong> {order.orderNumber}
              </div>
              <div className="order-info-col">
                <strong>Order Date:</strong> {new Date(order.orderDate).toLocaleDateString()}
              </div>
            </div>
            <div className="order-info-row">
              <div className="order-info-col">
                <strong>Delivery Date:</strong> {new Date(order.deliveryDate).toLocaleDateString()}
              </div>
              <div className="order-info-col">
                <strong>Delivery Time:</strong> {order.deliveryTime}
              </div>
            </div>
            <div className="order-info-row">
              <div className="order-info-col">
                <strong>Occasion:</strong> {order.occasion}
              </div>
              <div className="order-info-col">
                <strong>Branch:</strong> {order.branch}
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="customer-info-section">
            <h3>Customer Information</h3>
            <div className="customer-details">
              <div><strong>Name:</strong> {order.customerName}</div>
              <div><strong>Phone:</strong> {order.phone}</div>
              {order.email && <div><strong>Email:</strong> {order.email}</div>}
              {order.address && <div><strong>Address:</strong> {order.address}</div>}
              {order.city && <div><strong>City:</strong> {order.city}</div>}
              {order.state && <div><strong>State:</strong> {order.state}</div>}
              {order.pincode && <div><strong>PIN Code:</strong> {order.pincode}</div>}
            </div>
          </div>

          {/* Order Items */}
          <div className="items-section">
            <h3>Order Items</h3>
            {boxesToShow.map((box, boxIndex) => (
              <div key={boxIndex} className="box-section">
                {order.boxes.length > 1 && (
                  <h4>Box #{boxIndex + 1} (Quantity: {box.boxCount})</h4>
                )}
                
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {box.items.map((item, itemIndex) => (
                      <tr key={itemIndex}>
                        <td>{item.name}</td>
                        <td>{item.qty}</td>
                        <td>{item.unit || 'pcs'}</td>
                        <td>₹{item.price.toFixed(2)}</td>
                        <td>₹{(item.qty * item.price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="box-totals">
                  <div className="total-row">
                    <span>Items Subtotal:</span>
                    <span>₹{box.items.reduce((sum, item) => sum + item.qty * item.price, 0).toFixed(2)}</span>
                  </div>
                  {box.boxCount > 1 && (
                    <div className="total-row">
                      <span>Box Count:</span>
                      <span>{box.boxCount}</span>
                    </div>
                  )}
                  <div className="total-row">
                    <span>Box Subtotal:</span>
                    <span>₹{(box.items.reduce((sum, item) => sum + item.qty * item.price, 0) * box.boxCount).toFixed(2)}</span>
                  </div>
                  {box.discount > 0 && (
                    <div className="total-row discount">
                      <span>Box Discount:</span>
                      <span>- ₹{(box.discount * box.boxCount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="total-row box-total">
                    <span><strong>Box Total:</strong></span>
                    <span><strong>₹{calculateBoxTotal(box).toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          {order.boxViewMode === 'all' || order.boxViewMode === undefined ? (
            <div className="summary-section">
              <h3>Order Summary</h3>
              <div className="summary-totals">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>₹{order.boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0).toFixed(2)}</span>
                </div>
                
                {order.extraDiscount?.value > 0 && (
                  <div className="total-row discount">
                    <span>Extra Discount ({order.extraDiscount.type === 'percentage' ? `${order.extraDiscount.value}%` : 'Fixed'}):</span>
                    <span>- ₹{order.extraDiscount.type === 'percentage' 
                      ? ((order.extraDiscount.value / 100) * order.boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0)).toFixed(2)
                      : order.extraDiscount.value.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="total-row grand-total">
                  <span><strong>Grand Total:</strong></span>
                  <span><strong>₹{grandTotal.toFixed(2)}</strong></span>
                </div>
                
                {order.advancePaid > 0 && (
                  <>
                    <div className="total-row">
                      <span>Advance Paid:</span>
                      <span>₹{order.advancePaid.toFixed(2)}</span>
                    </div>
                    <div className="total-row balance">
                      <span><strong>Balance Due:</strong></span>
                      <span><strong>₹{balance.toFixed(2)}</strong></span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="summary-section">
              <h3>Box Summary</h3>
              <div className="summary-totals">
                <div className="total-row grand-total">
                  <span><strong>Box Total:</strong></span>
                  <span><strong>₹{calculateBoxTotal(boxesToShow[0]).toFixed(2)}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="notes-section">
              <h3>Notes</h3>
              <p>{order.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="print-footer">
            <p>Thank you for your order!</p>
            <p>Generated on: {new Date().toLocaleString()}</p>
            {order.createdBy && <p>Created by: {order.createdBy}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintOrderModal;