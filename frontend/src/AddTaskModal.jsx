import { useState } from 'react';
import { apiFetch } from './api';

const REMINDER_TYPES = [
  { value: 'exact_time', label: 'Exact Time' },
  { value: 'every_hour', label: 'Every hour in a day' },
  { value: '30_min_prior', label: '30 min prior' },
  { value: '1_hour_prior', label: '1 hour prior' },
];

export default function AddTaskModal({ onClose, onTaskCreated }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    has_reminder: false,
    reminder_time: '',
    reminder_type: 'exact_time',
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
        has_reminder: form.has_reminder,
        reminder_time: form.has_reminder ? form.reminder_time : null,
        reminder_type: form.has_reminder ? form.reminder_type : null,
      };

      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onTaskCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task');
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
        aria-labelledby="add-task-title"
      >
        <div className="modal-header">
          <h2 id="add-task-title">Add New Task</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Name of the task</label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              required
              placeholder="Enter task name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Purpose of the task</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="What is this task for?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="due_date">Date of reminder</label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              value={form.due_date}
              onChange={handleChange}
              required
            />
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
                <label htmlFor="reminder_time">Time</label>
                <input
                  id="reminder_time"
                  name="reminder_time"
                  type="time"
                  value={form.reminder_time}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reminder_type">Reminder type</label>
                <select
                  id="reminder_type"
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
              {loading ? 'Saving…' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
