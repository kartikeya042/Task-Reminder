export default function About() {
  return (
    <div className="public-page">
      <div className="public-container public-page-narrow">
        <span className="public-eyebrow">About Us</span>
        <h1>We help you remember what matters</h1>
        <p className="public-lead">
          Yadhwala is a modern task reminder platform designed to reduce missed deadlines
          and mental overload. We combine a clean task board with reliable notifications
          so you can focus on doing the work — not tracking it.
        </p>

        <div className="public-about-grid">
          <article className="public-about-card">
            <h2>Our mission</h2>
            <p>
              To make personal productivity accessible, dependable, and stress-free for
              everyone — from college students managing assignments to professionals
              juggling multiple projects.
            </p>
          </article>
          <article className="public-about-card">
            <h2>What we offer</h2>
            <ul className="public-list">
              <li>Intuitive upcoming and completed task views</li>
              <li>Customizable email and WhatsApp reminder schedules</li>
              <li>Secure sign-up with OTP email verification</li>
              <li>Admin insights for platform operators</li>
            </ul>
          </article>
        </div>

        <div className="public-values">
          <h2>Our values</h2>
          <div className="public-feature-grid">
            <div className="public-feature-card">
              <h3>Reliability</h3>
              <p>Reminders you can count on, delivered on time.</p>
            </div>
            <div className="public-feature-card">
              <h3>Simplicity</h3>
              <p>No steep learning curve — start organizing in minutes.</p>
            </div>
            <div className="public-feature-card">
              <h3>Privacy</h3>
              <p>Your data stays yours. We build with security in mind.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
