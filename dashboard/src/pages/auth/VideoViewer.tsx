export default function VideoViewer() {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      backgroundColor: '#0f172a'
    }}>
      <div style={{
        maxWidth: '1200px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#f1f5f9',
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          Daedalus Platform Overview
        </h1>

        <video
          controls
          style={{
            width: '100%',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            backgroundColor: '#000'
          }}
        >
          <source src="./Daedalus.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '32px'
        }}>
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 24px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
