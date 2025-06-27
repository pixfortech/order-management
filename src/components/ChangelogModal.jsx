import React, { useState, useEffect } from 'react';
import { FaTimes, FaClock, FaUser, FaDesktop } from 'react-icons/fa';

const ChangelogModal = ({ orderId, orderNumber, onClose }) => {
  const [changelog, setChangelog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('📋 ChangelogModal rendered with:', { orderId, orderNumber });

  // Replace the fetchChangelog function in ChangelogModal.jsx with this enhanced version:

useEffect(() => {
  const fetchChangelog = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      
      const getApiUrl = () => {
        if (window.location.hostname === 'localhost') {
          return 'http://localhost:5000';
        }
        return 'https://order-management-fbre.onrender.com';
      };
      
      const apiUrl = getApiUrl();
      const endpoint = `${apiUrl}/api/changelog/order/${orderId}`;
      
      console.log('📋 ChangelogModal Debug Info:', {
        orderId: orderId,
        orderNumber: orderNumber,
        apiUrl: apiUrl,
        endpoint: endpoint,
        token: token ? 'Present' : 'Missing',
        tokenLength: token ? token.length : 0
      });
      
      console.log('📋 Making API call to:', endpoint);
      
      const response = await fetch(endpoint, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📋 Response details:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Changelog API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(`Failed to fetch changelog: ${response.status} - ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log('📋 Raw response text:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('📋 Parsed response data:', {
          dataType: typeof data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 'N/A',
          keys: typeof data === 'object' ? Object.keys(data) : 'N/A',
          fullData: data
        });
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        throw new Error('Invalid JSON response from server');
      }
      
      setChangelog(Array.isArray(data) ? data : []);
      
      // Additional debug info
      if (Array.isArray(data) && data.length === 0) {
        console.log('⚠️ Changelog is empty. Possible reasons:');
        console.log('1. No changelog entries exist for this order ID:', orderId);
        console.log('2. Order ID format mismatch');
        console.log('3. Database/collection mismatch');
        console.log('4. Authorization issue');
        
        // Try to verify the order ID format
        console.log('🔍 Order ID verification:', {
          orderId: orderId,
          orderIdType: typeof orderId,
          orderIdLength: orderId ? orderId.length : 0,
          isValidObjectId: /^[a-fA-F0-9]{24}$/.test(orderId)
        });
      }
      
    } catch (err) {
      console.error('❌ Complete error details:', {
        error: err,
        message: err.message,
        stack: err.stack,
        orderId: orderId,
        orderNumber: orderNumber
      });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (orderId) {
    fetchChangelog();
  } else {
    console.error('❌ No orderId provided to ChangelogModal');
    setError('No order ID provided');
    setIsLoading(false);
  }
}, [orderId]);

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'created': return '🆕';
      case 'updated': return '✏️';
      case 'deleted': return '🗑️';
      case 'status_changed': return '🔄';
      case 'payment_added': return '💰';
      case 'progress_updated': return '📦';
      default: return '📝';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'created': return '#4caf50';
      case 'updated': return '#2196f3';
      case 'deleted': return '#f44336';
      case 'status_changed': return '#ff9800';
      case 'payment_added': return '#9c27b0';
      case 'progress_updated': return '#00bcd4';
      default: return '#666';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'created': return 'Order Created';
      case 'updated': return 'Order Updated';
      case 'deleted': return 'Order Deleted';
      case 'status_changed': return 'Status Changed';
      case 'payment_added': return 'Payment Updated';
      case 'progress_updated': return 'Progress Updated';
      default: return 'Action Performed';
    }
  };

  // Fixed modal styles
  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px'
  };

  const modalStyle = {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: '12px 12px 0 0'
  };

  const closeBtnStyle = {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    color: 'white',
    width: '35px',
    height: '35px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem'
  };

  const contentStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '20px'
  };

  if (isLoading) {
    return (
      <div style={modalOverlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div style={headerStyle}>
            <h2>Loading Order History...</h2>
            <button onClick={onClose} style={closeBtnStyle}>
              <FaTimes />
            </button>
          </div>
          <div style={{ ...contentStyle, textAlign: 'center' }}>
            <div>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={modalOverlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div style={headerStyle}>
            <h2>Error Loading History</h2>
            <button onClick={onClose} style={closeBtnStyle}>
              <FaTimes />
            </button>
          </div>
          <div style={{ ...contentStyle, textAlign: 'center', color: '#d32f2f' }}>
            <p>Failed to load order history: {error}</p>
            <button 
              onClick={onClose} 
              style={{
                background: '#667eea',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2>📋 Order History: {orderNumber}</h2>
          <button onClick={onClose} style={closeBtnStyle}>
            <FaTimes />
          </button>
        </div>

        <div style={contentStyle}>
          {changelog.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', padding: '40px' }}>
              <p>No history available for this order.</p>
            </div>
          ) : (
            <div>
              {changelog.map((entry, index) => (
                <div key={entry._id || index} style={{ 
                  display: 'flex', 
                  marginBottom: '30px',
                  borderLeft: '4px solid #e0e0e0',
                  paddingLeft: '20px'
                }}>
                  <div style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    color: 'white',
                    marginRight: '20px',
                    flexShrink: 0,
                    backgroundColor: getActionColor(entry.action),
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                  }}>
                    {getActionIcon(entry.action)}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div>
                      <h4 style={{ 
                        margin: '0 0 10px 0', 
                        fontSize: '1.1rem', 
                        fontWeight: 600,
                        color: getActionColor(entry.action)
                      }}>
                        {getActionLabel(entry.action)}
                      </h4>
                      
                      <div style={{ 
                        display: 'flex', 
                        gap: '20px', 
                        marginBottom: '15px', 
                        flexWrap: 'wrap',
                        fontSize: '0.9rem',
                        color: '#666'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <FaClock /> {formatTimestamp(entry.createdAt)}
                        </span>
                        {entry.user && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FaUser /> {entry.user.displayName || entry.user.username} ({entry.user.role})
                          </span>
                        )}
                      </div>
                    </div>

                    {entry.changes && entry.changes.length > 0 && (
                      <div style={{ marginTop: '15px' }}>
                        <h5 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#333', fontWeight: 600 }}>
                          Changes Made:
                        </h5>
                        <div style={{
                          background: 'white',
                          borderRadius: '8px',
                          padding: '15px',
                          border: '1px solid #e0e0e0'
                        }}>
                          {entry.changes.map((change, changeIndex) => (
                            <div key={changeIndex} style={{
                              marginBottom: '12px',
                              paddingBottom: '12px',
                              borderBottom: changeIndex < entry.changes.length - 1 ? '1px solid #f0f0f0' : 'none'
                            }}>
                              <div style={{
                                fontWeight: 600,
                                color: '#333',
                                marginBottom: '5px',
                                fontSize: '0.9rem'
                              }}>
                                {change.displayName}:
                              </div>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                flexWrap: 'wrap'
                              }}>
                                {change.oldValue && (
                                  <span style={{
                                    background: '#ffebee',
                                    color: '#d32f2f',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    border: '1px solid #ffcdd2',
                                    textDecoration: 'line-through'
                                  }}>
                                    "{change.oldValue}"
                                  </span>
                                )}
                                {change.oldValue && change.newValue && (
                                  <span style={{ color: '#666', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    →
                                  </span>
                                )}
                                {change.newValue && (
                                  <span style={{
                                    background: '#e8f5e9',
                                    color: '#2e7d32',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    border: '1px solid #c8e6c9',
                                    fontWeight: 500
                                  }}>
                                    "{change.newValue}"
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {entry.systemInfo && (
                      <div style={{
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid #e0e0e0'
                      }}>
                        <small style={{
                          color: '#999',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <FaDesktop /> {entry.systemInfo.ipAddress}
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: '20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#f8f9fa'
        }}>
          <button 
            onClick={onClose}
            style={{
              background: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;