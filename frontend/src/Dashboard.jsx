import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from './api';

function TaskCard({ task }) {
  return (
    <div className="task-card">
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      {task.due_date && (
        <span className="due-date">
          Due: {new Date(task.due_date).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

function TaskColumn({ title, tasks, columnClass }) {
  return (
    <div className={`task-column ${columnClass}`}>
      <div className="task-column-header">
        <h2>{title}</h2>
        <span className="task-count">{tasks.length}</span>
      </div>
      <div className="task-list">
        {tasks.length === 0 ? (
          <p className="task-empty">No tasks here</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState({ new: [], upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await apiFetch('/api/tasks');
        setTasks(data);
      } catch (err) {
        if (err.message === 'Unauthorized' || err.message === 'Invalid or expired token') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
          return;
        }
        setError(err.message || 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Task Reminder</h1>
        <div className="user-info">
          {user.name && <span className="user-name">Hello, {user.name}</span>}
          <button type="button" className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {loading && <p className="loading">Loading tasks…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="task-columns">
            <TaskColumn
              title="New Tasks"
              tasks={tasks.new}
              columnClass="column-new"
            />
            <TaskColumn
              title="Upcoming Tasks"
              tasks={tasks.upcoming}
              columnClass="column-upcoming"
            />
            <TaskColumn
              title="Completed Tasks"
              tasks={tasks.completed}
              columnClass="column-completed"
            />
          </div>
        )}
      </main>
    </div>
  );
}
