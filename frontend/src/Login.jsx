import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from './api';
import PasswordInput from './PasswordInput';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    emailPrefix: '',
    password: '',
    captchaAnswer: '',
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [mathQuestion, setMathQuestion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchMathCaptcha = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/captcha/math`);
      const data = await res.json();
      setCaptchaToken(data.token);
      setMathQuestion(data.question);
    } catch {
      setError('Failed to load math captcha. Please refresh.');
    }
  };

  useEffect(() => {
    fetchMathCaptcha();
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

    if (!form.emailPrefix.trim()) {
      setError('Email prefix is required');
      return;
    }

    const fullEmail = `${form.emailPrefix.trim()}@gmail.com`;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fullEmail,
          password: form.password,
          captchaToken,
          captchaAnswer: form.captchaAnswer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Login failed');
        fetchMathCaptcha();
        setForm((prev) => ({ ...prev, captchaAnswer: '' }));
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch {
      setError('Network error. Is the backend running?');
      fetchMathCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p className="subtitle">Log in to your Task Reminder account</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
                placeholder="Enter your email"
                autoComplete="username"
              />
              <span className="email-suffix">@gmail.com</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="captchaAnswer">Math Captcha</label>
            <div className="captcha-row">
              <div className="captcha-question">{mathQuestion}</div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchMathCaptcha}
                title="New question"
              >
                ↻
              </button>
              <input
                id="captchaAnswer"
                name="captchaAnswer"
                type="number"
                value={form.captchaAnswer}
                onChange={handleChange}
                required
                placeholder="Answer"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <p className="forgot-password-link">
            <Link to="/forgot-password">Forgot Password?</Link>
          </p>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !form.emailPrefix.trim()}
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
