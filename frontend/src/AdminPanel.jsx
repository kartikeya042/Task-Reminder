import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiUrl } from './api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function RoleBadge({ role }) {
  const label = role || 'user';
  return <span className={`admin-role-badge admin-role-${label}`}>{label}</span>;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = currentUser.role === 'superadmin';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);

  const columnCount = isSuperAdmin ? 7 : 5;

  const fetchAdminData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/admin/stats'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load admin data');
      }

      setUsers(data);
    } catch (err) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleRoleChange = async (userId, role) => {
    setError('');
    setActionUserId(userId);

    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/role`), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ role }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update user role');
      }

      await fetchAdminData();
    } catch (err) {
      setError(err.message || 'Failed to update user role');
    } finally {
      setActionUserId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="admin-panel">
        <header className="dashboard-header">
          <h1>Admin Panel</h1>
        </header>
        <main className="admin-content">
          <p className="loading">Loading admin data…</p>
        </main>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="admin-panel">
        <header className="dashboard-header">
          <h1>Admin Panel</h1>
          <div className="user-info">
            <Link to="/dashboard" className="btn btn-secondary btn-inline">
              Back to Dashboard
            </Link>
          </div>
        </header>
        <main className="admin-content">
          <div className="admin-access-denied">
            <h2>Access Denied</h2>
            <p>You do not have permission to view this page.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="dashboard-header">
        <h1>Admin Panel</h1>
        <div className="user-info">
          {isSuperAdmin && (
            <span className="admin-header-badge">Superadmin</span>
          )}
          <Link to="/dashboard" className="btn btn-secondary btn-inline">
            Back to Dashboard
          </Link>
          <button type="button" className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="admin-content">
        {error && <p className="error">{error}</p>}

        {!error && (
          <>
            <div className="admin-summary-card">
              <span className="admin-summary-label">Total Registered Users</span>
              <span className="admin-summary-value">{users.length}</span>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Pending Tasks</th>
                    <th>Completed Tasks</th>
                    {isSuperAdmin && <th>Role</th>}
                    {isSuperAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={columnCount} className="admin-table-empty">
                        No registered users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const isSelf = user.id === currentUser.id;
                      const canManage =
                        isSuperAdmin &&
                        !isSelf &&
                        user.role !== 'superadmin';

                      return (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>{Number(user.pending_tasks)}</td>
                          <td>{Number(user.completed_tasks)}</td>
                          {isSuperAdmin && (
                            <td>
                              <RoleBadge role={user.role} />
                            </td>
                          )}
                          {isSuperAdmin && (
                            <td>
                              {canManage ? (
                                <div className="admin-actions">
                                  {user.role === 'user' && (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-inline admin-action-btn"
                                      disabled={actionUserId === user.id}
                                      onClick={() => handleRoleChange(user.id, 'admin')}
                                    >
                                      {actionUserId === user.id ? 'Saving…' : 'Promote to Admin'}
                                    </button>
                                  )}
                                  {user.role === 'admin' && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-inline admin-action-btn"
                                      disabled={actionUserId === user.id}
                                      onClick={() => handleRoleChange(user.id, 'user')}
                                    >
                                      {actionUserId === user.id ? 'Saving…' : 'Revoke Admin'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="admin-actions-muted">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
