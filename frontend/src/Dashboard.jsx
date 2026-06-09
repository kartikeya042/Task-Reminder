import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import AddTaskModal from './AddTaskModal';

function formatDueDate(dueDate) {
  const raw = String(dueDate);
  const dateStr = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}-${month}-${year}`;
}

function TaskCard({ task }) {
  return (
    <div className="task-card">
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      {task.due_date && (
        <span className="due-date">
          Due: {formatDueDate(task.due_date)}
        </span>
      )}
      {task.has_reminder && task.reminder_time && (
        <span className="reminder-badge">
          Reminder: {String(task.reminder_time).slice(0, 5)}
          {task.reminder_type && ` (${task.reminder_type.replace(/_/g, ' ')})`}
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
  const [showModal, setShowModal] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiFetch('/api/tasks');
      setTasks(data);
      setError('');
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
  }, [navigate]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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
          <button type="button" className="btn btn-primary btn-inline" onClick={() => setShowModal(true)}>
            Add New Task
          </button>
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

      {showModal && (
        <AddTaskModal
          onClose={() => setShowModal(false)}
          onTaskCreated={fetchTasks}
        />
      )}
    </div>
  );
}
