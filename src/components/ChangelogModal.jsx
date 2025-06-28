import React, { useState, useEffect } from 'react';
import { FaTimes, FaClock, FaUser, FaDesktop } from 'react-icons/fa';

const ChangelogModal = ({ orderId, orderNumber, onClose }) => {
  const [changelog, setChangelog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('📋 ChangelogModal rendered with:', { orderId, orderNumber });

  // Use the same API URL logic as OrderForm
  const getApiUrl = () => {
    const envUrl = process.env.REACT_APP_API_URL;
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalNetwork = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
    
    if (isLocalNetwork) {
      return `http://${hostname.replace(':3000', '')}:5000`;
    }
    
    if (!isLocalhost && !isLocalNetwork) {
      return 'https://order-management-fbre.onrender.com';
    }
    
    if (envUrl) return envUrl;
    
    if (isLocalhost) return 'http://localhost:5000';
    
    return 'https://order-management-fbre.onrender.com';
  };

  // Add authentication helper
  const getAuthToken = () => localStorage.getItem('authToken');

  useEffect(() => {
    const fetchChangelog = async () => {
      // Don't make API calls if essential data is missing
      if (!orderId) {
        console.error('❌ No orderId provided to ChangelogModal');
        setError('No order ID provided');
        setIsLoading(false);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        console.error('❌ No auth token available');
        setError('Authentication required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const baseUrl = `${getApiUrl()}/api`;
        const endpoint = `${baseUrl}/changelog/order/${orderId}`;
        
        console.log('📋 ChangelogModal Debug Info:', {
          orderId: orderId,
          orderNumber: orderNumber,
          baseUrl: baseUrl,
          endpoint: endpoint,
          token: token ? 'Present' : 'Missing'
        });
        
        const response = await fetch(endpoint, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📋 Response details:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });
        
        if (!response.ok) {
          let errorMessage = `Failed to fetch changelog: ${response.status}`;
          
          if (response.status === 404) {
            errorMessage = 'Changelog endpoint not found. Make sure the backend changelog routes are properly configured.';
          } else if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (response.status === 403) {
            errorMessage = 'Access denied. Admin privileges required.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          }
          
          throw new Error(errorMessage);
        }
        
        const responseText = await response.text();
        console.log('📋 Raw response text:', responseText);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response:', parseError);
          throw new Error('Invalid response from server');
        }
        
        setChangelog(Array.isArray(data) ? data : []);
        
        if (Array.isArray(data) && data.length === 0) {
          console.log('⚠️ No changelog entries found for order:', orderId);
        }
        
      } catch (err) {
        console.error('❌ Changelog fetch error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Add a small delay to prevent immediate API calls on app load
    const timeoutId = setTimeout(() => {
      fetchChangelog();
    }, 100);
    
    return () => clearTimeout(timeoutId);
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

  // Modal styles
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
    fontSize: '1.2rem',
    transition: 'background 0.2s'
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
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '200px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
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
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
            <p style={{ marginBottom: '20px' }}>Failed to load order history:</p>
            <p style={{ 
              background: '#ffebee',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #ffcdd2'
            }}>
              {error}
            </p>
            <button 
              onClick={onClose} 
              style={{
                background: '#667eea',
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
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
              <p>No history available for this order.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
                This could mean the order was created before changelog tracking was enabled.
              </p>
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
              fontWeight: 500,
              transition: 'background 0.2s'
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