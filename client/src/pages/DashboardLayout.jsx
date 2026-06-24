import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import StatusBar from '../components/StatusBar.jsx';
import './DashboardLayout.css';

export default function DashboardLayout() {
  return (
    <div className="dashboard">
      <Sidebar />
      <div className="dashboard__main">
        <StatusBar />
        <div className="dashboard__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
