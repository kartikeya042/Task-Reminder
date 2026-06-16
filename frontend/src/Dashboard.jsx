import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import AddTaskModal from './AddTaskModal';
import EditTaskModal from './EditTaskModal';

function formatDueDate(dueDate) {
  const raw = String(dueDate);
  const dateStr = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}-${month}-${year}`;
}

function parseDueDateForSort(dueDate) {
  if (dueDate === null || dueDate === undefined || dueDate === '') return null;
  const raw = String(dueDate);
  const dateStr = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : null;
}

function parseReminderTimeForSort(reminderTime) {
  if (!reminderTime) return null;
  return String(reminderTime).slice(0, 8);
}

function parseCreatedAt(createdAt) {
  if (!createdAt) return 0;
  return new Date(createdAt).getTime();
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aDue = parseDueDateForSort(a.due_date);
    const bDue = parseDueDateForSort(b.due_date);

    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    if (!aDue && !bDue) {
      return parseCreatedAt(a.created_at) - parseCreatedAt(b.created_at);
    }

    const byDue = aDue.localeCompare(bDue);
    if (byDue !== 0) return byDue;

    const aTime = parseReminderTimeForSort(a.reminder_time);
    const bTime = parseReminderTimeForSort(b.reminder_time);

    if (aTime && bTime) {
      const byTime = aTime.localeCompare(bTime);
      if (byTime !== 0) return byTime;
    } else if (aTime && !bTime) {
      return -1;
    } else if (!aTime && bTime) {
      return 1;
    }

    return parseCreatedAt(a.created_at) - parseCreatedAt(b.created_at);
  });
}

function sortTaskGroups(data) {
  return {
    upcoming: sortTasks(data.upcoming || []),
    completed: sortTasks(data.completed || []),
  };
}

function PencilIcon() {
  return (
    <svg
      className="task-action-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="task-action-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function TaskCard({ task, showEdit, onEdit, onDelete }) {
  return (
    <div className="task-card">
      <div className="task-card-header">
        <h3>{task.title}</h3>
        <div className="task-card-actions">
          {showEdit && (
            <button
              type="button"
              className="btn-icon btn-icon-edit"
              onClick={() => onEdit(task)}
              title="Edit task"
              aria-label="Edit task"
            >
              <PencilIcon />
            </button>
          )}
          <button
            type="button"
            className="btn-icon btn-icon-danger"
            onClick={() => onDelete(task.id)}
            title="Delete task"
            aria-label="Delete task"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
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

function TaskColumn({ title, tasks, columnClass, showEdit, onEdit, onDelete }) {
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
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showEdit={showEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function removeTaskFromState(tasks, taskId) {
  return {
    upcoming: tasks.upcoming.filter((t) => t.id !== taskId),
    completed: tasks.completed.filter((t) => t.id !== taskId),
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState({ upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiFetch('/api/tasks');
      setTasks(sortTaskGroups(data));
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

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks((prev) => removeTaskFromState(prev, taskId));
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Yadhwala</h1>
        <div className="user-info">
          {user.name && <span className="user-name">Hello, {user.name}</span>}
          {(user.role === 'admin' || user.role === 'superadmin' || user.is_admin) && (
            <Link to="/admin" className="btn btn-secondary btn-inline">
              Go to Admin Panel
            </Link>
          )}
          <button type="button" className="btn btn-primary btn-inline" onClick={() => setShowAddModal(true)}>
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
              title="Upcoming Tasks"
              tasks={tasks.upcoming}
              columnClass="column-upcoming"
              showEdit
              onEdit={setEditingTask}
              onDelete={handleDelete}
            />
            <TaskColumn
              title="Completed Tasks"
              tasks={tasks.completed}
              columnClass="column-completed"
              showEdit={false}
              onEdit={setEditingTask}
              onDelete={handleDelete}
            />
          </div>
        )}
      </main>

      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onTaskCreated={fetchTasks}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={fetchTasks}
        />
      )}
    </div>
  );
}
