const Changelog = require('../models/Changelog');

/**
 * Create a changelog entry for order changes
 */
const createChangelogEntry = async (orderId, orderNumber, action, changes, user, req) => {
  try {
    const changelogEntry = new Changelog({
      orderId,
      orderNumber,
      action,
      changes,
      user: {
        id: user.id || user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role
      },
      systemInfo: {
        userAgent: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
        timestamp: new Date()
      }
    });
    
    await changelogEntry.save();
    console.log('📝 Changelog entry created:', {
      orderId,
      orderNumber,
      action,
      user: user.username,
      changesCount: changes.length
    });
  } catch (error) {
    console.error('❌ Failed to create changelog entry:', error);
  }
};

/**
 * Compare old and new order data to generate change list
 */
const generateChanges = (oldOrder, newOrder) => {
  const changes = [];
  const fieldsToTrack = {
    'customerName': 'Customer Name',
    'phone': 'Phone',
    'email': 'Email',
    'address': 'Address',
    'deliveryDate': 'Delivery Date',
    'deliveryTime': 'Delivery Time',
    'occasion': 'Occasion',
    'status': 'Status',
    'orderProgress': 'Order Progress',
    'advancePaid': 'Advance Paid',
    'balancePaid': 'Balance Paid',
    'grandTotal': 'Grand Total',
    'notes': 'Notes'
  };
  
  Object.keys(fieldsToTrack).forEach(field => {
    const oldValue = oldOrder[field];
    const newValue = newOrder[field];
    
    // Handle different data types and formats
    let formattedOldValue = oldValue;
    let formattedNewValue = newValue;
    
    if (field.includes('Date') && oldValue && newValue) {
      formattedOldValue = new Date(oldValue).toLocaleDateString();
      formattedNewValue = new Date(newValue).toLocaleDateString();
    }
    
    if (field.includes('Paid') || field === 'grandTotal') {
      formattedOldValue = oldValue ? `₹${Number(oldValue).toFixed(2)}` : '₹0.00';
      formattedNewValue = newValue ? `₹${Number(newValue).toFixed(2)}` : '₹0.00';
    }
    
    if (formattedOldValue !== formattedNewValue) {
      changes.push({
        field,
        oldValue: formattedOldValue || '',
        newValue: formattedNewValue || '',
        displayName: fieldsToTrack[field]
      });
    }
  });
  
  return changes;
};

// Export the functions
module.exports = {
  createChangelogEntry,
  generateChanges
};