import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__container">
        <div className="site-footer__section site-footer__disclaimer">
          <h2 className="footer-heading">Civic Logistics & Food Safety Commitment</h2>
          <p className="footer-text">
            AaharLink is a civic food recovery platform. Per municipal food hygiene standards, safe preparation and transport conditions are validated by participants. Donors declare handling at publishing, and receiving NGOs verify quality and temperature at physical handover.
          </p>
          <p className="footer-subtext">
            Engineered with strict WAL-mode SQLite atomic transitions, optimistic CAS concurrency protection, and an immutable audit trail.
          </p>
        </div>

        <div className="site-footer__section site-footer__links">
          <h2 className="footer-heading">Quick Navigation</h2>
          <ul className="footer-nav-list">
            <li><Link to="/">Home & Mission</Link></li>
            <li><Link to="/login">Sign In / Demo Accounts</Link></li>
            <li><Link to="/register">Register Organization</Link></li>
            <li><Link to="/account">Account & Capacity</Link></li>
            <li><Link to="/notifications">Alerts & Notifications</Link></li>
          </ul>
        </div>

        <div className="site-footer__section site-footer__standards">
          <h2 className="footer-heading">Standards & Assurance</h2>
          <p className="footer-text">
            Complies with WCAG 2.1 AA accessibility guidelines. Keyboard navigable, contrast checked, screen-reader announced.
          </p>
          <div className="system-status-indicator">
            <span className="status-dot status-dot--online" aria-hidden="true" />
            <span className="status-label">Operational — Local Native Persistence</span>
          </div>
          <p className="copyright-text">
            © {new Date().getFullYear()} AaharLink. Rescue Food. Connect Communities.
          </p>
        </div>
      </div>
    </footer>
  );
}
