import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiUrl } from './api';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');

      try {
        const res = await fetch(apiUrl('/api/admin/stats'), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
          throw new Error(data.message || 'Failed to load admin stats');
        }

        setUsers(data);
      } catch (err) {
        setError(err.message || 'Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [navigate]);

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
          <p className="loading">Loading user statistics…</p>
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
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-table-empty">
                        No registered users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{Number(user.pending_tasks)}</td>
                        <td>{Number(user.completed_tasks)}</td>
                      </tr>
                    ))
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
