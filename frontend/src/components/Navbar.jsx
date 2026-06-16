import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navClass = ({ isActive }) =>
    isActive ? 'public-nav-link public-nav-link-active' : 'public-nav-link';

  return (
    <header className="public-navbar">
      <div className="public-navbar-inner">
        <Link to="/" className="public-brand" onClick={() => setMenuOpen(false)}>
          Yadhwala
        </Link>

        <button
          type="button"
          className="public-nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`public-nav ${menuOpen ? 'public-nav-open' : ''}`}>
          <NavLink to="/" end className={navClass} onClick={() => setMenuOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/about" className={navClass} onClick={() => setMenuOpen(false)}>
            About Us
          </NavLink>
          <NavLink to="/testimonials" className={navClass} onClick={() => setMenuOpen(false)}>
            Testimonials
          </NavLink>
          <NavLink to="/contact" className={navClass} onClick={() => setMenuOpen(false)}>
            Contact Us
          </NavLink>
          <div className="public-nav-auth">
            <Link to="/login" className="btn btn-secondary btn-inline" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
            <Link to="/signup" className="btn btn-primary btn-inline" onClick={() => setMenuOpen(false)}>
              Sign Up
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
