import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface User {
  id: number;
  username: string;
  role: string;
  enabled: boolean;
  created_at: string;
  last_login?: string;
}

interface UserSummary {
  username: string;
  role: string;
  enabled: boolean;
  created_at: string;
  last_login?: string;
  database_exists: boolean;
  database_size: number;
  total_calculations: number;
  last_calculation?: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingSummary, setViewingSummary] = useState<{ user: User; summary: UserSummary } | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user',
    notes: ''
  });
  const [editFormData, setEditFormData] = useState({
    password: '',
    role: 'user'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setFormData({ username: '', password: '', role: 'user', notes: '' });
        setShowCreateForm(false);
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create user');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleToggleUser = async (userId: number, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled })
      });

      if (res.ok) {
        loadUsers();
      }
    } catch (err) {
      console.error('Failed to toggle user:', err);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Network error');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      password: '',
      role: user.role
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updateData: any = {
        role: editFormData.role
      };

      // Only include password if it's been changed
      if (editFormData.password) {
        updateData.password = editFormData.password;
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (res.ok) {
        setEditingUser(null);
        setEditFormData({ password: '', role: 'user' });
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user');
      }
    } catch (err) {
      console.error('Failed to update user:', err);
      alert('Network error');
    }
  };

  const handleViewSummary = async (user: User) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/summary`);
      if (res.ok) {
        const summary = await res.json();
        setViewingSummary({ user, summary });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to load summary');
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
      alert('Network error');
    }
  };

  if (currentUser?.role !== 'admin') {
    return <div>Access denied</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9' }}>
          User Management
        </h1>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateUser} style={{
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '16px' }}>
            Create New User
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
                Username *
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f1f5f9'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
                Password *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f1f5f9'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f1f5f9'
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
                <option value="explorer">Explorer</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Create User
          </button>
        </form>
      )}

      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <form onSubmit={handleUpdateUser} style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '600px'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '16px' }}>
              Edit User: {editingUser.username}
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
                  Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f1f5f9'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
                  Role *
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f1f5f9'
                  }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                  <option value="explorer">Explorer</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setEditFormData({ password: '', role: 'user' });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#475569',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>Loading users...</div>
      ) : (
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#cbd5e1', fontSize: '14px', fontWeight: '600' }}>Username</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#cbd5e1', fontSize: '14px', fontWeight: '600' }}>Role</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#cbd5e1', fontSize: '14px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#cbd5e1', fontSize: '14px', fontWeight: '600' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#cbd5e1', fontSize: '14px', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.id} style={{ borderTop: index > 0 ? '1px solid rgba(71, 85, 105, 0.4)' : 'none' }}>
                  <td style={{ padding: '12px', color: '#f1f5f9', fontSize: '14px' }}>{user.username}</td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: user.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : user.role === 'viewer' ? 'rgba(168, 85, 247, 0.2)' : user.role === 'explorer' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: user.role === 'admin' ? '#fca5a5' : user.role === 'viewer' ? '#d8b4fe' : user.role === 'explorer' ? '#fde047' : '#93c5fd'
                    }}>
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: user.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                      color: user.enabled ? '#6ee7b7' : '#9ca3af'
                    }}>
                      {user.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '14px' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {user.id !== currentUser?.id && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleViewSummary(user)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Summary
                        </button>
                        <button
                          onClick={() => handleToggleUser(user.id, user.enabled)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: user.enabled ? '#ef4444' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          {user.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#7c2d12',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#991b1b'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7c2d12'}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Button - Below the table */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          {showCreateForm ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {/* Summary Modal */}
      {viewingSummary && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '600px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#f1f5f9', marginBottom: '20px' }}>
              User Activity Summary: {viewingSummary.user.username}
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(71, 85, 105, 0.4)', paddingBottom: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Role:</span>
                <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{viewingSummary.summary.role.toUpperCase()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(71, 85, 105, 0.4)', paddingBottom: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Status:</span>
                <span style={{
                  color: viewingSummary.summary.enabled ? '#6ee7b7' : '#9ca3af',
                  fontWeight: '600'
                }}>
                  {viewingSummary.summary.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(71, 85, 105, 0.4)', paddingBottom: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Account Created:</span>
                <span style={{ color: '#f1f5f9' }}>{new Date(viewingSummary.summary.created_at).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(71, 85, 105, 0.4)', paddingBottom: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Last Login:</span>
                <span style={{ color: '#f1f5f9' }}>
                  {viewingSummary.summary.last_login ? new Date(viewingSummary.summary.last_login).toLocaleString() : 'Never'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(71, 85, 105, 0.4)', paddingBottom: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Database:</span>
                <span style={{ color: '#f1f5f9' }}>
                  {viewingSummary.summary.database_exists ? `${(viewingSummary.summary.database_size / 1024 / 1024).toFixed(2)} MB` : 'No database'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(71, 85, 105, 0.4)', paddingBottom: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Total Calculations:</span>
                <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{viewingSummary.summary.total_calculations}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ color: '#cbd5e1' }}>Last Calculation:</span>
                <span style={{ color: '#f1f5f9' }}>
                  {viewingSummary.summary.last_calculation ? new Date(viewingSummary.summary.last_calculation).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setViewingSummary(null)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
