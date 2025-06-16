export const getApiUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  const hostname = window.location.hostname;
  
  console.log('🌐 API URL Detection:', {
    envUrl,
    hostname,
    origin: window.location.origin
  });
  
  // 1. If environment variable is set, use it
  if (envUrl && envUrl.trim() && envUrl !== 'auto') {
    return envUrl.trim();
  }
  
  // 2. Dynamic detection based on current hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  } else if (hostname.startsWith('192.168.') || hostname.includes('local')) {
    // Use the same IP as the frontend for API
    return `http://${hostname}:5000`;
  }
  
  // 3. Production fallback
  return 'https://order-management-fbre.onrender.com';
};