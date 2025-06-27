import React, { useState, useEffect } from 'react';
import './ViewOrderModal.css';

const ViewOrderModal = ({ order, onClose }) => {
  const [selectedBoxIndex, setSelectedBoxIndex] = useState('all');
  const [printMode, setPrintMode] = useState('combined');
  const [brandDetails, setBrandDetails] = useState({
    displayName: 'Order Management',
    name: 'Brand',
    address: '',
    phone: '',
    email: ''
  });
  const [branchDetails, setBranchDetails] = useState({
    branchName: '',
    address: '',
    phone: '',
    email: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch brand and branch details
  useEffect(() => {
    const fetchBrandAndBranchDetails = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const getApiUrl = () => {
          if (window.location.hostname === 'localhost') {
            return 'http://localhost:5000';
          }
          return 'https://order-management-fbre.onrender.com';
        };
        
        const baseUrl = getApiUrl();
        
        // Fetch brand details
        const brandResponse = await fetch(`${baseUrl}/api/brand`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (brandResponse.ok) {
          const brandData = await brandResponse.json();
          setBrandDetails({
            displayName: brandData.displayName || brandData.name || 'Order Management',
            name: brandData.name || 'Brand',
            address: brandData.address || '',
            phone: brandData.phone || '',
            email: brandData.email || ''
          });
        }

        // Fetch branch details based on order's branch
        if (order.branchCode) {
          const branchResponse = await fetch(`${baseUrl}/api/branches/${order.branchCode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (branchResponse.ok) {
            const branchData = await branchResponse.json();
            setBranchDetails({
              branchName: branchData.branchName || order.branch || '',
              address: branchData.address || '',
              phone: branchData.phone || '',
              email: branchData.email || ''
            });
          }
        }
      } catch (error) {
        console.warn('Could not fetch brand/branch details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBrandAndBranchDetails();
  }, [order.branchCode, order.branch]);

  if (!order) return null;

  const totalBoxDiscount = order.boxes.reduce((acc, box) => acc + (box.discount || 0), 0);
  const extraDiscount = order.extraDiscount?.value || 0;
  const totalSavings = totalBoxDiscount + extraDiscount;

  const calculatedGrandTotal = order.boxes.reduce((sum, box) => {
    const itemSum = box.items.reduce((s, i) => s + ((i.qty || 0) * (i.price || 0)), 0);
    return sum + (box.total ?? (itemSum - (box.discount || 0)));
  }, 0) - extraDiscount;

  const advancePaid = Number(order.advancePaid) || 0;
  const balancePaid = Number(order.balancePaid) || 0;
  const grandTotal = order.grandTotal ?? calculatedGrandTotal;
  const remainingBalance = Math.max(0, grandTotal - advancePaid - balancePaid);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const formatPaymentTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const boxHtml = (box, idx, isLastBox, isSeparateMode) => {
      const multipleBoxes = order.boxes.length > 1;
      const boxLabel = multipleBoxes ? `-${String.fromCharCode(65 + idx)}` : '';
      const subtotal = box.items.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
      const boxDiscount = box.discount || 0;
      const boxTotal = box.total ?? (subtotal - boxDiscount);

      return `
        <div class="box-summary">
          <h4>Box ${idx + 1} ${multipleBoxes ? `(${order.orderNumber}${boxLabel})` : ''}</h4>
          <p><strong>Box Count:</strong> ${box.boxCount || 1}</p>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Total</th></tr></thead>
            <tbody>
              ${box.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.qty}</td>
                  <td>${item.unit || '-'}</td>
                  <td>₹${parseFloat(item.price ?? 0).toFixed(2)}</td>
                  <td>₹${(parseFloat(item.qty ?? 0) * parseFloat(item.price ?? 0)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${boxDiscount > 0 ? `<p class="totals">Box Discount: ₹${boxDiscount}</p>` : ''}
          <p class="totals">Box Total: ₹${boxTotal.toFixed(2)}</p>
          ${isSeparateMode && isLastBox
            ? `
              <hr/>
              ${advancePaid > 0 ? `
                <p class="totals">
                  Advance Paid: ₹${advancePaid.toFixed(2)}
                  ${order.advancePaidDate ? `<br><small>Paid on: ${formatPaymentTimestamp(order.advancePaidDate)}</small>` : ''}
                </p>
              ` : ''}
              ${balancePaid > 0 ? `
                <p class="totals">
                  Balance Paid: ₹${balancePaid.toFixed(2)}
                  ${order.balancePaidDate ? `<br><small>Paid on: ${formatPaymentTimestamp(order.balancePaidDate)}</small>` : ''}
                </p>
              ` : ''}
              ${extraDiscount > 0 ? `<p class="totals">Extra Discount: ₹${extraDiscount}</p>` : ''}
              <p class="totals">Grand Total: ₹${grandTotal.toFixed(2)}</p>
              ${remainingBalance > 0 ? `<p class="totals">Balance Due: ₹${remainingBalance.toFixed(2)}</p>` : ''}
              ${totalSavings > 0 ? `<p class="totals">Total Savings: ₹${totalSavings.toFixed(2)}</p>` : ''}
            `
            : ''}
        </div>
      `;
    };

    const bodyContent = `
      <html>
      <head>
        <title>Print Order</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins&display=swap" rel="stylesheet">
        <style>
          body { font-family: Poppins, sans-serif; padding: 20px; }
          .brand { display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; }
          .brand h1 { margin: 0; font-size: 24px; }
          .brand h2 { margin: 0; font-size: 18px; color: #666; }
          .branch-info { font-size: 14px; }
          .order-meta-row { display: flex; flex-wrap: wrap; justify-content: space-between; font-size: 14px; row-gap: 6px; margin: 6px 0; }
          .order-meta-row > div { flex: 1 1 240px; display: flex; gap: 6px; align-items: center; }
          .delivery-highlight { padding: 2px 8px; border: 1px solid #000; border-radius: 4px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; }
          .box-summary { margin-top: 20px; border: 1px solid #ccc; padding: 10px 15px; page-break-inside: avoid; }
          .totals { text-align: right; font-weight: 600; margin-top: 8px; }
          .payment-timestamp { font-size: 11px; color: #666; font-weight: normal; }
        </style>
      </head>
      <body>
        <div class="brand">
          <h1>${brandDetails.displayName}</h1>
          <div class="branch-info">
            <h2>${branchDetails.branchName}</h2>
            ${branchDetails.address ? `<div><strong>Address:</strong> ${branchDetails.address}</div>` : ''}
            ${branchDetails.phone ? `<div><strong>Phone:</strong> ${branchDetails.phone}</div>` : ''}
            ${branchDetails.email ? `<div><strong>Email:</strong> ${branchDetails.email}</div>` : ''}
          </div>
        </div>

        <h2>Order No: ${order.orderNumber}</h2>
        <div class="order-meta-row">
          <div><strong>Customer:</strong> ${order.customerName}</div>
          <div><strong>Phone:</strong> ${order.phone}</div>
          ${order.email ? `<div><strong>Email:</strong> ${order.email}</div>` : ''}
        </div>
        <div class="order-meta-row">
          <div><strong>Occasion:</strong> ${order.occasion}</div>
          <div><strong>Order Date:</strong> ${formatDate(order.orderDate)}</div>
          <div><strong>Delivery Date:</strong> <span class="delivery-highlight">${formatDate(order.deliveryDate)}</span></div>
          <div><strong>Delivery Time:</strong> <span class="delivery-highlight">${order.deliveryTime}</span></div>
        </div>

        ${
          printMode === 'combined'
            ? order.boxes.map((box, idx) => boxHtml(box, idx, false, false)).join('')
            : order.boxes.map((box, idx) => boxHtml(box, idx, idx === order.boxes.length - 1, true)).join('<div style="page-break-after: always;"></div>')
        }

        ${
          printMode === 'combined'
            ? `
              <hr/>
              ${advancePaid > 0 ? `
                <p class="totals">
                  Advance Paid: ₹${advancePaid.toFixed(2)}
                  ${order.advancePaidDate ? `<br><span class="payment-timestamp">Paid on: ${formatPaymentTimestamp(order.advancePaidDate)}</span>` : ''}
                </p>
              ` : ''}
              ${balancePaid > 0 ? `
                <p class="totals">
                  Balance Paid: ₹${balancePaid.toFixed(2)}
                  ${order.balancePaidDate ? `<br><span class="payment-timestamp">Paid on: ${formatPaymentTimestamp(order.balancePaidDate)}</span>` : ''}
                </p>
              ` : ''}
              ${extraDiscount > 0 ? `<p class="totals">Extra Discount: ₹${extraDiscount}</p>` : ''}
              <p class="totals">Grand Total: ₹${grandTotal.toFixed(2)}</p>
              ${remainingBalance > 0 ? `<p class="totals">Balance Due: ₹${remainingBalance.toFixed(2)}</p>` : ''}
              ${totalSavings > 0 ? `<p class="totals">Total Savings: ₹${totalSavings.toFixed(2)}</p>` : ''}
            `
            : ''
        }
      </body>
      </html>
    `;

    printWindow.document.write(bodyContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      onClose();
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading-message">Loading order details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>✖</button>
        <div className="modal-header">
          <h2>Order Summary</h2>
          <button onClick={handlePrint} className="print-btn">🖨️ Print</button>
        </div>

        <div className="brand">
          <h1>{brandDetails.displayName}</h1>
          <div className="branch-info">
            <h2>{branchDetails.branchName}</h2>
            {branchDetails.address && <div><strong>Address:</strong> {branchDetails.address}</div>}
            {branchDetails.phone && <div><strong>Phone:</strong> {branchDetails.phone}</div>}
            {branchDetails.email && <div><strong>Email:</strong> {branchDetails.email}</div>}
          </div>
        </div>

        <h3 style={{ fontWeight: 700 }}>Order No: {order.orderNumber}</h3>

        <div className="order-meta-row">
          <div><b>Customer:</b> {order.customerName}</div>
          <div><b>Phone:</b> {order.phone}</div>
          {order.email && <div><b>Email:</b> {order.email}</div>}
        </div>

        <div className="order-meta-row">
          <div><b>Occasion:</b> {order.occasion}</div>
          <div><b>Order Date:</b> {formatDate(order.orderDate)}</div>
          <div><b>Delivery Date:</b> <span className="delivery-highlight">{formatDate(order.deliveryDate)}</span></div>
          <div><b>Delivery Time:</b> <span className="delivery-highlight">{order.deliveryTime}</span></div>
        </div>

        <div className="box-selector">
          <label>📦 View: </label>
          <select value={selectedBoxIndex} onChange={(e) => setSelectedBoxIndex(e.target.value)}>
            <option value="all">View All Boxes</option>
            {order.boxes.map((_, idx) => (
              <option key={idx} value={idx}>Box {idx + 1}</option>
            ))}
          </select>

          <label style={{ marginLeft: '20px' }}>🖨️ Print Mode: </label>
          <select value={printMode} onChange={(e) => setPrintMode(e.target.value)}>
            <option value="combined">All Boxes in One Page</option>
            <option value="separate">Each Box on Separate Page</option>
          </select>
        </div>

        {(selectedBoxIndex === 'all' ? order.boxes : [order.boxes[selectedBoxIndex]]).map((box, idx) => {
          const actualIdx = selectedBoxIndex === 'all' ? idx : parseInt(selectedBoxIndex);
          const multiple = order.boxes.length > 1;
          const boxLabel = multiple ? ` (${order.orderNumber}-${String.fromCharCode(65 + actualIdx)})` : '';
          const subtotal = box.items.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
          const boxDiscount = box.discount || 0;
          const boxTotal = box.total ?? (subtotal - boxDiscount);

          return (
            <div key={actualIdx} className="box-summary">
              <h4>Box {actualIdx + 1}{multiple ? boxLabel : ''}</h4>
              <p><strong>Box Count:</strong> {box.boxCount || 1}</p>
              <table className="item-table">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {box.items.map((item, itemIdx) => (
                    <tr key={itemIdx}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>{item.unit || '-'}</td>
                      <td>₹{parseFloat(item.price ?? 0).toFixed(2)}</td>
                      <td>₹{(parseFloat(item.qty ?? 0) * parseFloat(item.price ?? 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {boxDiscount > 0 && <p className="totals">Box Discount: ₹{boxDiscount}</p>}
              <p className="totals">Box Total: ₹{boxTotal.toFixed(2)}</p>
            </div>
          );
        })}

        {selectedBoxIndex === 'all' && (
          <>
            <hr />
            
            {/* Payment Details with Timestamps */}
            {advancePaid > 0 && (
              <div className="payment-detail">
                <p className="totals">
                  Advance Paid: ₹{advancePaid.toFixed(2)}
                  {order.advancePaidDate && (
                    <small className="payment-timestamp">
                      <br />Paid on: {formatPaymentTimestamp(order.advancePaidDate)}
                    </small>
                  )}
                </p>
              </div>
            )}
            
            {balancePaid > 0 && (
              <div className="payment-detail">
                <p className="totals">
                  Balance Paid: ₹{balancePaid.toFixed(2)}
                  {order.balancePaidDate && (
                    <small className="payment-timestamp">
                      <br />Paid on: {formatPaymentTimestamp(order.balancePaidDate)}
                    </small>
                  )}
                </p>
              </div>
            )}
            
            {extraDiscount > 0 && <p className="totals">Extra Discount: ₹{extraDiscount}</p>}
            <p className="totals">Grand Total: ₹{grandTotal.toFixed(2)}</p>
            
            {remainingBalance > 0 && (
              <p className="totals balance-due">Balance Due: ₹{remainingBalance.toFixed(2)}</p>
            )}
            
            {remainingBalance <= 0 && (advancePaid > 0 || balancePaid > 0) && (
              <p className="totals fully-paid">✅ Fully Paid</p>
            )}
            
            {totalSavings > 0 && <p className="totals">Total Savings: ₹{totalSavings.toFixed(2)}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewOrderModal;