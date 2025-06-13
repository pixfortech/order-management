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

// Generate PDF for order
const generateOrderPDF = (orderData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      // Collect PDF data
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper function to calculate box total
      const calculateBoxTotal = (box) => {
        const itemsSubtotal = box.items.reduce((sum, item) => sum + item.qty * item.price, 0);
        const boxSubtotal = itemsSubtotal * box.boxCount;
        const boxDiscount = box.discount > 0 ? box.discount * box.boxCount : 0;
        return boxSubtotal - boxDiscount;
      };

      // PDF Header
      doc.fontSize(20).text(orderData.brandDetails?.displayName || 'Order Management', { align: 'center' });
      doc.fontSize(16).text('ORDER INVOICE', { align: 'center' });
      doc.moveDown();

      // Order Information
      doc.fontSize(14).text(`Order Number: ${orderData.orderNumber}`, { continued: true });
      doc.text(`Order Date: ${new Date(orderData.orderDate).toLocaleDateString()}`, { align: 'right' });
      doc.text(`Delivery Date: ${new Date(orderData.deliveryDate).toLocaleDateString()}`, { continued: true });
      doc.text(`Delivery Time: ${orderData.deliveryTime}`, { align: 'right' });
      doc.text(`Occasion: ${orderData.occasion}`, { continued: true });
      doc.text(`Branch: ${orderData.branch}`, { align: 'right' });
      doc.moveDown();

      // Customer Information
      doc.fontSize(14).text('CUSTOMER INFORMATION', { underline: true });
      doc.fontSize(12);
      doc.text(`Name: ${orderData.customerName}`);
      doc.text(`Phone: ${orderData.phone}`);
      if (orderData.email) doc.text(`Email: ${orderData.email}`);
      if (orderData.address) doc.text(`Address: ${orderData.address}`);
      if (orderData.city) doc.text(`City: ${orderData.city}, ${orderData.state} ${orderData.pincode}`);
      doc.moveDown();

      // Order Items
      doc.fontSize(14).text('ORDER ITEMS', { underline: true });
      doc.fontSize(10);

      let yPosition = doc.y;
      
      orderData.boxes.forEach((box, boxIndex) => {
        if (orderData.boxes.length > 1) {
          doc.fontSize(12).text(`Box #${boxIndex + 1} (Quantity: ${box.boxCount})`, { underline: true });
          yPosition = doc.y + 5;
        }

        // Table headers
        doc.fontSize(10);
        const tableTop = yPosition;
        const itemX = 50;
        const qtyX = 250;
        const priceX = 300;
        const amountX = 400;

        doc.text('Item', itemX, tableTop);
        doc.text('Qty', qtyX, tableTop);
        doc.text('Price', priceX, tableTop);
        doc.text('Amount', amountX, tableTop);

        // Draw line under headers
        doc.moveTo(itemX, tableTop + 15).lineTo(500, tableTop + 15).stroke();

        let itemY = tableTop + 25;

        box.items.forEach((item) => {
          if (itemY > 700) {
            doc.addPage();
            itemY = 50;
          }

          doc.text(item.name, itemX, itemY, { width: 180 });
          doc.text(`${item.qty} ${item.unit || 'pcs'}`, qtyX, itemY);
          doc.text(`₹${item.price.toFixed(2)}`, priceX, itemY);
          doc.text(`₹${(item.qty * item.price).toFixed(2)}`, amountX, itemY);
          itemY += 20;
        });

        // Box totals
        const boxTotal = calculateBoxTotal(box);
        const itemsSubtotal = box.items.reduce((sum, item) => sum + item.qty * item.price, 0);
        
        itemY += 10;
        doc.text(`Items Subtotal: ₹${itemsSubtotal.toFixed(2)}`, 300, itemY);
        itemY += 15;
        
        if (box.boxCount > 1) {
          doc.text(`Box Count: ${box.boxCount}`, 300, itemY);
          itemY += 15;
          doc.text(`Box Subtotal: ₹${(itemsSubtotal * box.boxCount).toFixed(2)}`, 300, itemY);
          itemY += 15;
        }
        
        if (box.discount > 0) {
          doc.text(`Box Discount: -₹${(box.discount * box.boxCount).toFixed(2)}`, 300, itemY);
          itemY += 15;
        }
        
        doc.fontSize(12).text(`Box Total: ₹${boxTotal.toFixed(2)}`, 300, itemY, { underline: true });
        doc.fontSize(10);
        itemY += 25;
        yPosition = itemY;
      });

      // Order Summary
      doc.fontSize(14).text('ORDER SUMMARY', { underline: true });
      doc.fontSize(12);
      
      const subtotal = orderData.calculatedTotals?.subtotal || orderData.boxes.reduce((sum, box) => sum + calculateBoxTotal(box), 0);
      const extraDiscountAmount = orderData.calculatedTotals?.extraDiscountAmount || 0;
      const finalTotal = orderData.calculatedTotals?.finalTotal || orderData.grandTotal;
      const balance = orderData.calculatedTotals?.balance || (finalTotal - (orderData.advancePaid || 0));

      doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, 300, doc.y);
      
      if (extraDiscountAmount > 0) {
        const discountText = orderData.extraDiscount?.type === 'percentage' 
          ? `Extra Discount (${orderData.extraDiscount.value}%): -₹${extraDiscountAmount.toFixed(2)}`
          : `Extra Discount: -₹${extraDiscountAmount.toFixed(2)}`;
        doc.text(discountText, 300, doc.y);
      }
      
      doc.fontSize(14).text(`Grand Total: ₹${finalTotal.toFixed(2)}`, 300, doc.y, { underline: true });
      
      if (orderData.advancePaid > 0) {
        doc.fontSize(12);
        doc.text(`Advance Paid: ₹${orderData.advancePaid.toFixed(2)}`, 300, doc.y);
        doc.fontSize(14).text(`Balance Due: ₹${balance.toFixed(2)}`, 300, doc.y, { underline: true });
      }

      // Notes
      if (orderData.notes) {
        doc.moveDown();
        doc.fontSize(14).text('NOTES', { underline: true });
        doc.fontSize(12).text(orderData.notes);
      }

      // Footer
      doc.moveDown();
      doc.fontSize(10).text('Thank you for your order!', { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      if (orderData.createdBy) {
        doc.text(`Order created by: ${orderData.createdBy}`, { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate professional email content
const generateEmailContent = (orderData, isModification = false, changes = []) => {
  const brandName = orderData.brandDetails?.displayName || 'Order Management';
  const customerName = orderData.customerName;
  const orderNumber = orderData.orderNumber;
  const deliveryDate = new Date(orderData.deliveryDate).toLocaleDateString();
  const deliveryTime = orderData.deliveryTime;
  const finalTotal = orderData.calculatedTotals?.finalTotal || orderData.grandTotal;
  const balance = orderData.calculatedTotals?.balance || (finalTotal - (orderData.advancePaid || 0));

  if (isModification && changes.length > 0) {
    return {
      subject: `Order Update - ${orderNumber} | ${brandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007bff; padding-bottom: 20px;">
            <h1 style="color: #007bff; margin: 0;">${brandName}</h1>
            <h2 style="color: #666; margin: 10px 0 0 0;">Order Update Notification</h2>
          </div>
          
          <p>Dear <strong>${customerName}</strong>,</p>
          
          <p>We wanted to inform you that your order <strong>${orderNumber}</strong> has been updated. Please review the changes below:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #007bff; margin-top: 0;">Changes Made:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${changes.map(change => `<li style="margin: 5px 0;">${change}</li>`).join('')}
            </ul>
          </div>
          
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #28a745; margin-top: 0;">Updated Order Summary:</h3>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Delivery Date:</strong> ${deliveryDate} at ${deliveryTime}</p>
            <p><strong>Total Amount:</strong> ₹${finalTotal.toFixed(2)}</p>
            ${orderData.advancePaid > 0 ? `
              <p><strong>Advance Paid:</strong> ₹${orderData.advancePaid.toFixed(2)}</p>
              <p><strong>Balance Due:</strong> ₹${balance.toFixed(2)}</p>
            ` : ''}
          </div>
          
          <p>Please find the updated invoice attached to this email for your records.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
            <p>Thank you for choosing ${brandName}!</p>
            <p style="font-size: 14px;">This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      `,
      text: `Dear ${customerName}, Your order ${orderNumber} has been updated. Changes: ${changes.join(', ')}. Thank you!`
    };
  } else {
    return {
      subject: `Order Confirmation - ${orderNumber} | ${brandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007bff; padding-bottom: 20px;">
            <h1 style="color: #007bff; margin: 0;">${brandName}</h1>
            <h2 style="color: #666; margin: 10px 0 0 0;">Order Confirmation</h2>
          </div>
          
          <p>Dear <strong>${customerName}</strong>,</p>
          <p>Thank you for your order! We've received your order and it's being processed.</p>
          
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #28a745; margin-top: 0;">Order Details:</h3>
            <p><strong>Order Number:</strong> ${orderNumber}</p>
            <p><strong>Total Amount:</strong> ₹${finalTotal.toFixed(2)}</p>
            <p><strong>Delivery Date:</strong> ${deliveryDate} at ${deliveryTime}</p>
          </div>
          
          <p>Please find your detailed invoice attached.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
            <p><strong>Thank you for choosing ${brandName}!</strong></p>
          </div>
        </div>
      `,
      text: `Dear ${customerName}, Thank you for your order ${orderNumber}! Total: ₹${finalTotal.toFixed(2)}. Delivery: ${deliveryDate} at ${deliveryTime}.`
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

// ✅ FIXED: Complete send-order-email route
router.post('/send-order-email', async (req, res) => {
  try {
    const { 
      to, 
      customerName, 
      orderNumber, 
      orderData, 
      isModification = false, 
      changes = [],
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
    const transporter = createEmailTransporter();  // ✅ Using the fixed function
    
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

    // Generate email content
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