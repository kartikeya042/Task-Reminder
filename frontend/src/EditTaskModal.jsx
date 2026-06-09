import { useState } from 'react';
import { apiFetch } from './api';

const NATIVE_PICKER_STYLE = { colorScheme: 'dark' };

const REMINDER_TYPES = [
  { value: 'exact_time', label: 'Exact Time' },
  { value: 'every_hour', label: 'Every hour in a day' },
  { value: '30_min_prior', label: '30 min prior' },
  { value: '1_hour_prior', label: '1 hour prior' },
];

const TASK_STATUSES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
];

function normalizeTaskStatus(status) {
  return status === 'completed' ? 'completed' : 'upcoming';
}

function parseDueDate(dueDate) {
  const raw = String(dueDate || '');
  return raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
}

function parseReminderTime(reminderTime) {
  if (!reminderTime) return '';
  return String(reminderTime).slice(0, 5);
}

export default function EditTaskModal({ task, onClose, onTaskUpdated }) {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    due_date: parseDueDate(task.due_date),
    status: normalizeTaskStatus(task.status),
    has_reminder: Boolean(task.has_reminder),
    reminder_time: parseReminderTime(task.reminder_time),
    reminder_type: task.reminder_type || 'exact_time',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const dueDate = form.due_date.slice(0, 10);

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        due_date: dueDate,
        status: form.status,
        has_reminder: form.has_reminder,
        reminder_time: form.has_reminder ? form.reminder_time : null,
        reminder_type: form.has_reminder ? form.reminder_type : null,
      };

      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      onTaskUpdated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
      >
        <div className="modal-header">
          <h2 id="edit-task-title">Edit Task</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-title">Name of the task</label>
            <input
              id="edit-title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              required
              placeholder="Enter task name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-description">Purpose of the task</label>
            <textarea
              id="edit-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="What is this task for?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-due_date">Date of reminder</label>
            <input
              id="edit-due_date"
              name="due_date"
              type="date"
              className="date-time-input"
              style={NATIVE_PICKER_STYLE}
              value={form.due_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-status">Status</label>
            <select
              id="edit-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              required
            >
              {TASK_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="has_reminder"
                checked={form.has_reminder}
                onChange={handleChange}
              />
              Time reminder
            </label>
          </div>

          {form.has_reminder && (
            <>
              <div className="form-group">
                <label htmlFor="edit-reminder_time">Time</label>
                <input
                  id="edit-reminder_time"
                  name="reminder_time"
                  type="time"
                  className="date-time-input"
                  style={NATIVE_PICKER_STYLE}
                  value={form.reminder_time}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-reminder_type">Reminder type</label>
                <select
                  id="edit-reminder_type"
                  name="reminder_type"
                  value={form.reminder_type}
                  onChange={handleChange}
                  required
                >
                  {REMINDER_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-inline" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
