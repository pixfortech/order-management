const express = require('express');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const router = express.Router();
const path = require('path');

// ✅ FIXED: Create email transporter with correct method name
const createEmailTransporter = () => {
  return nodemailer.createTransport({  // ✅ createTransport (not createTransporter)
    service: 'gmail',
    auth: {
      user: 'ganguramonline@gmail.com',
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });
};

// Generate PDF for order - Responsive layout matching ViewOrderModal
const generateOrderPDF = (orderData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks = [];

      // Collect PDF data
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Dynamic brand details from orderData
      const brandDetails = {
        displayName: orderData.brandDetails?.displayName || 'Store Name',
        address: orderData.brandDetails?.address || 'Store Address',
        phone: orderData.brandDetails?.phone || 'Store Phone',
        email: orderData.brandDetails?.email || 'Store Email'
      };

      // Helper functions
      const calculateBoxTotal = (box) => {
        const itemsSubtotal = box.items.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
        const boxDiscount = box.discount || 0;
        return (itemsSubtotal * (box.boxCount || 1)) - (boxDiscount * (box.boxCount || 1));
      };

      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB');
      };

      // Calculate totals
      const totalBoxDiscount = orderData.boxes.reduce((acc, box) => acc + ((box.discount || 0) * (box.boxCount || 1)), 0);
      const extraDiscount = orderData.extraDiscount?.value || 0;
      const totalSavings = totalBoxDiscount + extraDiscount;
      const subtotal = orderData.boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0);
      const calculatedGrandTotal = subtotal - extraDiscount;
      const finalTotal = orderData.grandTotal || calculatedGrandTotal;
      const balance = finalTotal - (orderData.advancePaid || 0);

      // Page dimensions
      const pageWidth = doc.page.width - 60; // Account for margins
      const pageHeight = doc.page.height - 60;
      let currentY = 30;

      // Header Section
      doc.fontSize(18).font('Helvetica-Bold').text(brandDetails.displayName, 30, currentY);
      currentY += 25;
      
      doc.fontSize(9).font('Helvetica');
      doc.text(`Address: ${brandDetails.address}`, 30, currentY);
      currentY += 12;
      doc.text(`Phone: ${brandDetails.phone}`, 30, currentY);
      if (brandDetails.email) {
        currentY += 12;
        doc.text(`Email: ${brandDetails.email}`, 30, currentY);
      }
      
      currentY += 20;
      
      // Order Header
      doc.fontSize(14).font('Helvetica-Bold').text(`Order No: ${orderData.orderNumber}`, 30, currentY);
      currentY += 25;

      // Customer and Order Information (2-column layout like ViewOrderModal)
      doc.fontSize(9).font('Helvetica');
      const leftCol = 30;
      const rightCol = 300;
      
      // Row 1
      doc.text(`Customer: ${orderData.customerName}`, leftCol, currentY);
      doc.text(`Phone: ${orderData.phone}`, rightCol, currentY);
      currentY += 12;
      
      // Row 2
      if (orderData.email) {
        doc.text(`Email: ${orderData.email}`, leftCol, currentY);
        currentY += 12;
      }
      
      // Row 3
      doc.text(`Occasion: ${orderData.occasion}`, leftCol, currentY);
      doc.text(`Order Date: ${formatDate(orderData.orderDate)}`, rightCol, currentY);
      currentY += 12;
      
      // Row 4
      doc.text(`Delivery Date: ${formatDate(orderData.deliveryDate)}`, leftCol, currentY);
      doc.text(`Delivery Time: ${orderData.deliveryTime}`, rightCol, currentY);
      currentY += 25;

      // Function to check if we need a new page
      const checkPageSpace = (neededSpace) => {
        if (currentY + neededSpace > pageHeight - 50) {
          doc.addPage();
          currentY = 30;
          return true;
        }
        return false;
      };

      // Box Details - Responsive layout
      orderData.boxes.forEach((box, boxIndex) => {
        const isLastBox = boxIndex === orderData.boxes.length - 1;
        const multipleBoxes = orderData.boxes.length > 1;
        const boxLabel = multipleBoxes ? `-${String.fromCharCode(65 + boxIndex)}` : '';
        const boxTotal = calculateBoxTotal(box);
        const boxDiscount = box.discount || 0;

        // Estimate space needed for this box
        const itemsHeight = box.items.length * 15 + 60; // Header + items + totals
        const shouldStartNewPage = checkPageSpace(itemsHeight);

        // Box Header
        doc.fontSize(11).font('Helvetica-Bold');
        const boxTitle = `Box ${boxIndex + 1}${multipleBoxes ? ` (${orderData.orderNumber}${boxLabel})` : ''}`;
        doc.text(boxTitle, 30, currentY);
        currentY += 18;
        
        doc.fontSize(9).font('Helvetica');
        doc.text(`Box Count: ${box.boxCount || 1}`, 30, currentY);
        currentY += 18;

        // Items Table
        const tableY = currentY;
        const colWidths = [200, 50, 50, 70, 70];
        const colX = [30, 230, 280, 330, 400];
        
        // Table headers
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('Item', colX[0], tableY);
        doc.text('Qty', colX[1], tableY);
        doc.text('Unit', colX[2], tableY);
        doc.text('Rate', colX[3], tableY);
        doc.text('Total', colX[4], tableY);
        
        currentY += 15;
        
        // Header line
        doc.moveTo(30, currentY).lineTo(pageWidth + 30, currentY).stroke();
        currentY += 5;

        // Items
        doc.font('Helvetica').fontSize(8);
        box.items.forEach((item) => {
          if (currentY > pageHeight - 80) {
            doc.addPage();
            currentY = 30;
          }

          const itemTotal = (parseFloat(item.qty || 0) * parseFloat(item.price || 0)).toFixed(2);
          
          doc.text(item.name, colX[0], currentY, { width: colWidths[0] - 10 });
          doc.text(item.qty.toString(), colX[1], currentY);
          doc.text(item.unit || '-', colX[2], currentY);
          doc.text(`₹${parseFloat(item.price || 0).toFixed(2)}`, colX[3], currentY);
          doc.text(`₹${itemTotal}`, colX[4], currentY);
          currentY += 12;
        });

        currentY += 8;

        // Box totals
        doc.fontSize(9).font('Helvetica-Bold');
        if (boxDiscount > 0) {
          doc.text(`Box Discount: ₹${(boxDiscount * (box.boxCount || 1)).toFixed(2)}`, 
                   pageWidth - 100, currentY, { align: 'right', width: 130 });
          currentY += 12;
        }
        
        doc.text(`Box Total: ₹${boxTotal.toFixed(2)}`, 
                 pageWidth - 100, currentY, { align: 'right', width: 130 });
        currentY += 15;

        // If this is the last box and we have space, add grand totals
        if (isLastBox) {
          // Check if we have space for grand totals
          const grandTotalSpace = 80; // Estimated space for grand totals
          if (currentY + grandTotalSpace > pageHeight - 50) {
            doc.addPage();
            currentY = 30;
          }

          // Grand totals separator
          currentY += 10;
          doc.moveTo(30, currentY).lineTo(pageWidth + 30, currentY).stroke();
          currentY += 15;

          // Grand totals
          doc.fontSize(9).font('Helvetica-Bold');
          doc.text(`Advance Paid: ₹${orderData.advancePaid || 0}`, 
                   pageWidth - 120, currentY, { align: 'right', width: 150 });
          currentY += 12;

          if (extraDiscount > 0) {
            const discountText = orderData.extraDiscount?.type === 'percentage' 
              ? `Extra Discount (${orderData.extraDiscount.value}%): ₹${extraDiscount.toFixed(2)}`
              : `Extra Discount: ₹${extraDiscount.toFixed(2)}`;
            doc.text(discountText, pageWidth - 120, currentY, { align: 'right', width: 150 });
            currentY += 12;
          }

          doc.fontSize(11);
          doc.text(`Grand Total: ₹${finalTotal.toFixed(2)}`, 
                   pageWidth - 120, currentY, { align: 'right', width: 150 });
          currentY += 12;

          if (balance !== finalTotal) {
            doc.fontSize(10);
            doc.text(`Balance Due: ₹${balance.toFixed(2)}`, 
                     pageWidth - 120, currentY, { align: 'right', width: 150 });
            currentY += 12;
          }

          if (totalSavings > 0) {
            doc.fontSize(9);
            doc.text(`Total Savings: ₹${totalSavings.toFixed(2)}`, 
                     pageWidth - 120, currentY, { align: 'right', width: 150 });
            currentY += 15;
          }
        } else {
          // Add separator between boxes
          currentY += 5;
          doc.moveTo(30, currentY).lineTo(pageWidth + 30, currentY).stroke();
          currentY += 15;
        }
      });

      // Notes section
      if (orderData.notes) {
        currentY += 15;
        if (currentY > pageHeight - 100) {
          doc.addPage();
          currentY = 30;
        }
        
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 30, currentY);
        currentY += 15;
        doc.fontSize(9).font('Helvetica').text(orderData.notes, 30, currentY, { width: pageWidth });
      }

      // Footer
      const footerY = doc.page.height - 60;
      doc.fontSize(7).font('Helvetica');
      doc.text(`Thank you for choosing ${brandDetails.displayName}!`, 30, footerY, 
               { align: 'center', width: pageWidth });
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 30, footerY + 12, 
               { align: 'center', width: pageWidth });
      if (orderData.createdBy) {
        doc.text(`Order created by: ${orderData.createdBy}`, 30, footerY + 24, 
                 { align: 'center', width: pageWidth });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Enhanced function to detect detailed changes
const detectDetailedOrderChanges = (original, current) => {
  const changes = {
    customer: [],
    order: [],
    financial: [],
    items: [],
    boxes: []
  };
  
  // Customer information changes
  if (original.customerName !== current.customerName) {
    changes.customer.push(`Customer name: "${original.customerName}" → "${current.customerName}"`);
  }
  
  if (original.phone !== current.phone) {
    changes.customer.push(`Phone number: ${original.phone} → ${current.phone}`);
  }
  
  if (original.email !== current.email) {
    changes.customer.push(`Email: ${original.email || 'None'} → ${current.email || 'None'}`);
  }
  
  if (original.address !== current.address) {
    changes.customer.push(`Address: "${original.address || 'None'}" → "${current.address || 'None'}"`);
  }
  
  // Order information changes
  if (original.occasion !== current.occasion) {
    changes.order.push(`Occasion: ${original.occasion} → ${current.occasion}`);
  }
  
  if (original.orderDate !== current.orderDate) {
    changes.order.push(`Order date: ${new Date(original.orderDate).toLocaleDateString()} → ${new Date(current.orderDate).toLocaleDateString()}`);
  }
  
  if (original.deliveryDate !== current.deliveryDate) {
    changes.order.push(`Delivery date: ${new Date(original.deliveryDate).toLocaleDateString()} → ${new Date(current.deliveryDate).toLocaleDateString()}`);
  }
  
  if (original.deliveryTime !== current.deliveryTime) {
    changes.order.push(`Delivery time: ${original.deliveryTime} → ${current.deliveryTime}`);
  }
  
  // Financial changes
  if (Math.abs(original.grandTotal - current.grandTotal) > 0.01) {
    changes.financial.push(`Total amount: ₹${original.grandTotal.toFixed(2)} → ₹${current.grandTotal.toFixed(2)}`);
  }
  
  if (Math.abs((original.advancePaid || 0) - (current.advancePaid || 0)) > 0.01) {
    changes.financial.push(`Advance paid: ₹${(original.advancePaid || 0).toFixed(2)} → ₹${(current.advancePaid || 0).toFixed(2)}`);
  }
  
  // Extra discount changes
  const origDiscount = original.extraDiscount?.value || 0;
  const currDiscount = current.extraDiscount?.value || 0;
  if (Math.abs(origDiscount - currDiscount) > 0.01) {
    changes.financial.push(`Extra discount: ₹${origDiscount.toFixed(2)} → ₹${currDiscount.toFixed(2)}`);
  }
  
  // Box changes
  if (original.boxes.length !== current.boxes.length) {
    if (original.boxes.length < current.boxes.length) {
      changes.boxes.push(`Added ${current.boxes.length - original.boxes.length} box(es)`);
    } else {
      changes.boxes.push(`Removed ${original.boxes.length - current.boxes.length} box(es)`);
    }
  }
  
  // Item changes - detailed comparison
  original.boxes.forEach((origBox, boxIndex) => {
    const currBox = current.boxes[boxIndex];
    if (!currBox) return;
    
    // Compare items in each box
    const origItems = origBox.items.map(item => `${item.name} (${item.qty})`);
    const currItems = currBox.items.map(item => `${item.name} (${item.qty})`);
    
    // Find added items
    currItems.forEach(item => {
      if (!origItems.includes(item)) {
        changes.items.push(`Added: ${item} in Box ${boxIndex + 1}`);
      }
    });
    
    // Find removed items
    origItems.forEach(item => {
      if (!currItems.includes(item)) {
        changes.items.push(`Removed: ${item} from Box ${boxIndex + 1}`);
      }
    });
    
    // Check for quantity changes
    origBox.items.forEach(origItem => {
      const currItem = currBox.items.find(item => item.name === origItem.name);
      if (currItem && origItem.qty !== currItem.qty) {
        changes.items.push(`${origItem.name}: quantity changed from ${origItem.qty} to ${currItem.qty} in Box ${boxIndex + 1}`);
      }
      if (currItem && Math.abs(origItem.price - currItem.price) > 0.01) {
        changes.items.push(`${origItem.name}: price changed from ₹${origItem.price} to ₹${currItem.price} in Box ${boxIndex + 1}`);
      }
    });
  });
  
  // Notes changes
  if ((original.notes || '') !== (current.notes || '')) {
    changes.order.push(`Notes: "${original.notes || 'None'}" → "${current.notes || 'None'}"`);
  }
  
  return changes;
};

// ✅ SINGLE generateEmailContent function - Enhanced version with dynamic brand details
const generateEmailContent = (orderData, isModification = false, changes = []) => {
  // Extract dynamic brand details from orderData
  const brandName = orderData.brandDetails?.displayName || 'Order Management';
  const brandColor = orderData.brandDetails?.primaryColor || '#007bff'; // Allow custom brand colors
  const brandAddress = orderData.brandDetails?.address || '';
  const brandPhone = orderData.brandDetails?.phone || '';
  const brandEmail = orderData.brandDetails?.email || '';
  
  const customerName = orderData.customerName;
  const orderNumber = orderData.orderNumber;
  const deliveryDate = new Date(orderData.deliveryDate).toLocaleDateString();
  const deliveryTime = orderData.deliveryTime;
  const finalTotal = orderData.calculatedTotals?.finalTotal || orderData.grandTotal;
  const balance = orderData.calculatedTotals?.balance || (finalTotal - (orderData.advancePaid || 0));

  if (isModification && changes && (changes.customer?.length || changes.order?.length || changes.financial?.length || changes.items?.length || changes.boxes?.length)) {
    // Order modification email with detailed changes
    return {
      subject: `Order Update - ${orderNumber} | ${brandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid ${brandColor}; padding-bottom: 20px;">
            <h1 style="color: ${brandColor}; margin: 0;">${brandName}</h1>
            <h2 style="color: #666; margin: 10px 0 0 0;">Order Update Notification</h2>
          </div>
          
          <p>Dear <strong>${customerName}</strong>,</p>
          
          <p>We wanted to inform you that your order <strong>${orderNumber}</strong> has been updated. Please review the changes below:</p>
          
          ${changes.customer?.length ? `
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${brandColor};">
              <h3 style="color: ${brandColor}; margin-top: 0;">👤 Customer Information Changes:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${changes.customer.map(change => `<li style="margin: 5px 0;">${change}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${changes.order?.length ? `
            <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800;">
              <h3 style="color: #ff9800; margin-top: 0;">📅 Order Details Changes:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${changes.order.map(change => `<li style="margin: 5px 0;">${change}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${changes.boxes?.length ? `
            <div style="background-color: #f3e5f5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #9c27b0;">
              <h3 style="color: #9c27b0; margin-top: 0;">📦 Box Changes:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${changes.boxes.map(change => `<li style="margin: 5px 0;">${change}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${changes.items?.length ? `
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
              <h3 style="color: #4caf50; margin-top: 0;">🛍️ Item Changes:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${changes.items.map(change => `<li style="margin: 5px 0;">${change}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${changes.financial?.length ? `
            <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336;">
              <h3 style="color: #f44336; margin-top: 0;">💰 Financial Changes:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${changes.financial.map(change => `<li style="margin: 5px 0;">${change}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border: 2px solid ${brandColor};">
            <h3 style="color: ${brandColor}; margin-top: 0;">📋 Updated Order Summary:</h3>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Delivery Date:</strong> ${deliveryDate} at ${deliveryTime}</p>
            <p><strong>Total Amount:</strong> ₹${finalTotal.toFixed(2)}</p>
            ${orderData.advancePaid > 0 ? `
              <p><strong>Advance Paid:</strong> ₹${orderData.advancePaid.toFixed(2)}</p>
              <p><strong>Balance Due:</strong> ₹${balance.toFixed(2)}</p>
            ` : ''}
          </div>
          
          <p>Please find the updated invoice attached to this email for your records.</p>
          
          <p>If you have any questions about these changes or need further assistance, please contact us immediately.</p>
          
          ${(brandAddress || brandPhone || brandEmail) ? `
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${brandColor};">
              <h4 style="color: ${brandColor}; margin-top: 0;">📞 Contact Information:</h4>
              ${brandAddress ? `<p><strong>Address:</strong> ${brandAddress}</p>` : ''}
              ${brandPhone ? `<p><strong>Phone:</strong> ${brandPhone}</p>` : ''}
              ${brandEmail ? `<p><strong>Email:</strong> ${brandEmail}</p>` : ''}
            </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
            <p>Thank you for choosing <strong style="color: ${brandColor};">${brandName}</strong>!</p>
            <p style="font-size: 14px;">This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      `,
      text: `Dear ${customerName}, Your order ${orderNumber} has been updated. Please check the attached invoice for full details. Thank you for choosing ${brandName}!`
    };
  } else {
    // New order confirmation email
    return {
      subject: `Order Confirmation - ${orderNumber} | ${brandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid ${brandColor}; padding-bottom: 20px;">
            <h1 style="color: ${brandColor}; margin: 0;">${brandName}</h1>
            <h2 style="color: #666; margin: 10px 0 0 0;">Order Confirmation</h2>
          </div>
          
          <p>Dear <strong>${customerName}</strong>,</p>
          
          <p>Thank you for your order! We're excited to confirm that we've received your order and it's being processed.</p>
          
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid ${brandColor};">
            <h3 style="color: ${brandColor}; margin-top: 0;">📋 Order Details:</h3>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Order Date:</strong> ${new Date(orderData.orderDate).toLocaleDateString()}</p>
            <p><strong>Delivery Date:</strong> ${deliveryDate}</p>
            <p><strong>Delivery Time:</strong> ${deliveryTime}</p>
            <p><strong>Occasion:</strong> ${orderData.occasion}</p>
          </div>
          
          <div style="background-color: #fff8e1; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <h3 style="color: #ff9800; margin-top: 0;">💰 Payment Summary:</h3>
            <p><strong>Total Amount:</strong> ₹${finalTotal.toFixed(2)}</p>
            ${orderData.advancePaid > 0 ? `
              <p><strong>Advance Paid:</strong> ₹${orderData.advancePaid.toFixed(2)}</p>
              <p style="font-size: 18px; color: ${brandColor};"><strong>Balance Due:</strong> ₹${balance.toFixed(2)}</p>
            ` : `
              <p style="font-size: 18px; color: ${brandColor};"><strong>Amount Due:</strong> ₹${finalTotal.toFixed(2)}</p>
            `}
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${brandColor};">
            <h4 style="color: ${brandColor}; margin-top: 0;">📋 What's Next?</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>We'll prepare your order with care</li>
              <li>You'll receive updates on your order status</li>
              <li>We'll deliver on ${deliveryDate} at ${deliveryTime}</li>
              <li>Please ensure someone is available to receive the delivery</li>
            </ul>
          </div>
          
          <p>Please find your detailed invoice attached to this email for your records.</p>
          
          <p>If you need to make any changes to your order or have questions, please contact us as soon as possible.</p>
          
          ${(brandAddress || brandPhone || brandEmail) ? `
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${brandColor};">
              <h4 style="color: ${brandColor}; margin-top: 0;">📞 Contact Information:</h4>
              ${brandAddress ? `<p><strong>Address:</strong> ${brandAddress}</p>` : ''}
              ${brandPhone ? `<p><strong>Phone:</strong> ${brandPhone}</p>` : ''}
              ${brandEmail ? `<p><strong>Email:</strong> ${brandEmail}</p>` : ''}
            </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
            <p><strong>Thank you for choosing <span style="color: ${brandColor};">${brandName}</span>!</strong></p>
            <p style="font-size: 14px;">This is an automated confirmation email. Please keep this for your records.</p>
          </div>
        </div>
      `,
      text: `Dear ${customerName}, Thank you for your order ${orderNumber}! Total: ₹${finalTotal.toFixed(2)}. Delivery: ${deliveryDate} at ${deliveryTime}. Thank you for choosing ${brandName}!`
    };
  }
};

// Debug routes
router.get('/debug', (req, res) => {
  res.json({
    message: 'Email service is accessible',
    timestamp: new Date().toISOString(),
    config: {
      hasEmailPassword: !!process.env.EMAIL_APP_PASSWORD,
      emailPasswordLength: process.env.EMAIL_APP_PASSWORD ? process.env.EMAIL_APP_PASSWORD.length : 0,
      nodeEnv: process.env.NODE_ENV,
      emailUser: 'ganguramonline@gmail.com'
    }
  });
});

router.post('/test-auth', async (req, res) => {
  try {
    console.log('🔍 Testing email authentication...');
    
    const transporter = createEmailTransporter();  // ✅ Using the fixed function
    const verified = await transporter.verify();
    
    res.json({
      success: true,
      message: 'Email authentication successful',
      verified: verified
    });
    
  } catch (error) {
    console.error('❌ Email auth test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email authentication failed',
      error: error.message,
      code: error.code
    });
  }
});

// ✅ FIXED: Complete send-order-email route with dynamic brand details
// Expected orderData.brandDetails structure:
// {
//   displayName: "Store Name",
//   address: "Complete store address",
//   phone: "Store phone number", 
//   email: "Store email address",
//   primaryColor: "#007bff" (optional, defaults to blue)
// }
router.post('/send-order-email', async (req, res) => {
  try {
    const { 
      to, 
      customerName, 
      orderNumber, 
      orderData, 
      isModification = false, 
      changes = null,  // This can now be the detailed changes object
      brandDetails,
      fromEmail = 'ganguramonline@gmail.com'
    } = req.body;

    console.log(`📧 Processing email for order ${orderNumber} to ${to}`);

    // Validate required fields
    if (!to || !customerName || !orderNumber || !orderData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Create and verify transporter
    const transporter = createEmailTransporter();
    
    try {
      await transporter.verify();
      console.log('✅ Email transporter verified successfully');
    } catch (verifyError) {
      console.error('❌ Email verification failed:', verifyError);
      return res.status(500).json({
        success: false,
        message: 'Email authentication failed',
        error: verifyError.message
      });
    }

    // Generate PDF
    console.log('📄 Generating PDF...');
    const pdfBuffer = await generateOrderPDF(orderData);
    console.log('✅ PDF generated successfully');

    // Generate email content with detailed changes
    const emailContent = generateEmailContent(orderData, isModification, changes);

    // Send email
    const mailOptions = {
      from: {
        name: brandDetails?.displayName || 'Order Management',
        address: fromEmail
      },
      to: to,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      attachments: [
        {
          filename: `${orderNumber}_Invoice.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    console.log('📤 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);

    res.status(200).json({
      success: true,
      message: isModification ? 'Order update email sent successfully' : 'Order confirmation email sent successfully',
      messageId: info.messageId,
      orderNumber,
      recipient: to
    });

  } catch (error) {
    console.error('❌ Email sending error:', error);
    
    let errorMessage = 'Failed to send email';
    let statusCode = 500;
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed';
      statusCode = 401;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Email routes are working!', 
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;