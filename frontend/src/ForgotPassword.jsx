import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from './api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [emailPrefix, setEmailPrefix] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailPrefixChange = (e) => {
    setEmailPrefix(e.target.value.replace(/@/g, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!emailPrefix.trim()) {
      setError('Email prefix is required');
      return;
    }

    const fullEmail = `${emailPrefix.trim()}@gmail.com`;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fullEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Request failed');
        return;
      }

      setSuccess(data.message);
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(fullEmail)}`);
      }, 1500);
    } catch {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p className="subtitle">Enter your Gmail to receive a reset OTP</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="emailPrefix">Email</label>
            <div className="email-input-group">
              <input
                id="emailPrefix"
                name="emailPrefix"
                type="text"
                value={emailPrefix}
                onChange={handleEmailPrefixChange}
                onKeyDown={(e) => {
                  if (e.key === '@') e.preventDefault();
                }}
                required
                placeholder="Enter your email"
                autoComplete="username"
              />
              <span className="email-suffix">@gmail.com</span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !emailPrefix.trim()}
          >
            {loading ? 'Sending…' : 'Send Reset OTP'}
          </button>
        </form>

        <p className="auth-footer">
          Remember your password? <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
