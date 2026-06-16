import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <>
      <section className="public-hero">
        <div className="public-container public-hero-grid">
          <div className="public-hero-content">
            <span className="public-eyebrow">Task management, simplified</span>
            <h1>Stay ahead of every deadline with Yadhwala</h1>
            <p>
              Organize upcoming work, automate reminders, and never miss what matters.
              Built for students, professionals, and teams who value clarity.
            </p>
            <div className="public-hero-actions">
              <Link to="/signup" className="btn btn-primary">
                Get Started Free
              </Link>
              <Link to="/about" className="btn btn-secondary">
                Learn More
              </Link>
            </div>
          </div>
          <div className="public-hero-card">
            <div className="public-stat">
              <strong>Simplified Design</strong>
              <span>Upcoming &amp; completed tasks</span>
            </div>
            <div className="public-stat">
              <strong>Smart alerts</strong>
              <span>Email &amp; WhatsApp reminders</span>
            </div>
            <div className="public-stat">
              <strong>Secure access</strong>
              <span>Verified accounts &amp; JWT sessions</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <h2 className="public-section-title">Why choose Yadhwala?</h2>
          <div className="public-feature-grid">
            <article className="public-feature-card">
              <h3>Focused dashboard</h3>
              <p>See what is due next and what you have already finished — no clutter.</p>
            </article>
            <article className="public-feature-card">
              <h3>Flexible reminders</h3>
              <p>Set exact times, hourly nudges, or advance warnings before due dates.</p>
            </article>
            <article className="public-feature-card">
              <h3>Built for trust</h3>
              <p>Email verification, captcha protection, and encrypted sessions by default.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-cta">
        <div className="public-container public-cta-inner">
          <h2>Ready to take control of your schedule?</h2>
          <p>Join Yadhwala today and turn reminders into results.</p>
          <Link to="/signup" className="btn btn-primary">
            Create your account
          </Link>
        </div>
      </section>
    </>
  );
}
