import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div>
      <nav className="main-nav">
        <Link to="/">This Week</Link>
        <Link to="/history">History</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}