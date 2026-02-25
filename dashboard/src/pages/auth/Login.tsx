import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      // Login successful, checkAuth will be called automatically
      // Navigate based on user role (we'll get it from context)
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      padding: '24px'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <img
          src="./daedalus.png"
          alt="Daedalus Logo"
          style={{
            width: '200px',
            height: 'auto',
            marginBottom: '16px',
            filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.3))'
          }}
        />
        <h1 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#f1f5f9',
          margin: 0
        }}>
          Daedalus Login
        </h1>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
      }}>
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#cbd5e1',
            marginBottom: '8px'
          }}>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f1f5f9',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#334155'}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#cbd5e1',
            marginBottom: '8px'
          }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f1f5f9',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#334155'}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            fontWeight: '600',
            color: 'white',
            backgroundColor: loading ? '#64748b' : '#3b82f6',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#3b82f6';
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {/* Footer */}
      <p style={{
        marginTop: '24px',
        fontSize: '14px',
        color: '#64748b',
        fontStyle: 'italic'
      }}>
        Navigate the labyrinth with confidence
      </p>

      {/* Version label - bottom right */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '8px 16px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#3b82f6', fontWeight: '600' }}>v15-local</span>
          <span style={{ color: '#64748b' }}>•</span>
          <span style={{ color: '#94a3b8' }}>Login authentication restored</span>
        </div>
      </div>
    </div>
  );
}
