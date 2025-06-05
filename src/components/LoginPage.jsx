import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    const success = await login(username, password);
    if (success) {
      navigate('/');
    } else {
      setError('Invalid credentials');
    }
    setLoading(false);
  };
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '30px', background: '#fff', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#49488D' }}>Admin Login</h2>
      <input
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '15px' }}
        disabled={loading}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '15px' }}
        disabled={loading}
      />
      {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
      <button 
        onClick={handleLogin} 
        disabled={loading}
        style={{ 
          width: '100%', 
          padding: '10px', 
          backgroundColor: loading ? '#ccc' : '#49488D', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </div>
  );
};

export default LoginPage;