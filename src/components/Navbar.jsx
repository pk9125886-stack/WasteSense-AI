import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          WasteSense AI
        </Link>
        <div className="navbar-links">
          <Link to="/">Map</Link>
          <Link to="/report">Report</Link>
          <Link to="/admin">Admin</Link>
        </div>
      </div>
    </nav>
  );
}

