import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from './api';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    emailPrefix: '',
    password: '',
    captchaAnswer: '',
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCaptcha = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/captcha/image`);
      const data = await res.json();
      setCaptchaToken(data.token);
      setCaptchaSvg(data.svg);
    } catch {
      setError('Failed to load captcha. Please refresh.');
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEmailPrefixChange = (e) => {
    const value = e.target.value.replace(/@/g, '');
    setForm((prev) => ({ ...prev, emailPrefix: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.emailPrefix.trim()) {
      setError('Email prefix is required');
      return;
    }

    const fullEmail = `${form.emailPrefix.trim()}@gmail.com`;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          mobile: form.mobile,
          email: fullEmail,
          password: form.password,
          captchaToken,
          captchaAnswer: form.captchaAnswer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Signup failed');
        fetchCaptcha();
        return;
      }

      setSuccess(data.message);
      setTimeout(() => {
        navigate(`/verify?email=${encodeURIComponent(fullEmail)}`);
      }, 2000);
    } catch {
      setError('Network error. Is the backend running?');
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p className="subtitle">Sign up for Task Reminder</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="mobile">Mobile Number</label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              value={form.mobile}
              onChange={handleChange}
              required
              placeholder="10-digit mobile number"
            />
          </div>

          <div className="form-group">
            <label htmlFor="emailPrefix">Email</label>
            <div className="email-input-group">
              <input
                id="emailPrefix"
                name="emailPrefix"
                type="text"
                value={form.emailPrefix}
                onChange={handleEmailPrefixChange}
                onKeyDown={(e) => {
                  if (e.key === '@') e.preventDefault();
                }}
                required
                placeholder="username"
                autoComplete="username"
              />
              <span className="email-suffix">@gmail.com</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </div>

          <div className="form-group">
            <label htmlFor="captchaAnswer">Image Captcha</label>
            <div className="captcha-row">
              <div
                className="captcha-image"
                dangerouslySetInnerHTML={{ __html: captchaSvg }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchCaptcha}
                title="Refresh captcha"
              >
                ↻
              </button>
              <input
                id="captchaAnswer"
                name="captchaAnswer"
                type="text"
                value={form.captchaAnswer}
                onChange={handleChange}
                required
                placeholder="Enter captcha"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !form.emailPrefix.trim()}
          >
            {loading ? 'Signing up…' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
