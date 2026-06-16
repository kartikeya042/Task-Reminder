import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-brand">
          <Link to="/" className="public-footer-logo">
            Yadhwala
          </Link>
          <p className="public-footer-tagline">
            Smart task reminders that keep you on track.
          </p>
        </div>

        <div className="public-footer-links">
          <Link to="/about">About Us</Link>
          <Link to="/testimonials">Testimonials</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </div>

        <div className="public-footer-meta">
          <p>Visakhapatnam, Andhra Pradesh</p>
          <p className="public-footer-copy">
            &copy; {new Date().getFullYear()} Yadhwala. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
