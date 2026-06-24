import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import StatusBar from '../components/StatusBar.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { isConnected } = useWebSocket();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="dashboard">
      <Sidebar isOpen={isSidebarOpen} isConnected={isConnected} />
      <div className="dashboard__main">
        <StatusBar onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <div className="dashboard__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
