import { Link, useLocation, Outlet } from 'react-router-dom';
import { Home, Wallet, Settings } from 'lucide-react';

export default function DebugLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Simple Sidebar */}
      <aside className="w-64 bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold mb-8">Debug Layout</h1>
        <nav className="space-y-2">
          <Link 
            to="/" 
            className={`block p-3 rounded ${location.pathname === '/' ? 'bg-blue-700' : 'hover:bg-blue-500'}`}
          >
            <Home className="inline mr-2" size={20} />
            Dashboard
          </Link>
          <Link 
            to="/accounts" 
            className={`block p-3 rounded ${location.pathname === '/accounts' ? 'bg-blue-700' : 'hover:bg-blue-500'}`}
          >
            <Wallet className="inline mr-2" size={20} />
            Accounts
          </Link>
          <Link 
            to="/settings" 
            className={`block p-3 rounded ${location.pathname === '/settings' ? 'bg-blue-700' : 'hover:bg-blue-500'}`}
          >
            <Settings className="inline mr-2" size={20} />
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-4">Current path: {location.pathname}</h2>
        <div className="bg-white p-6 rounded shadow">
          <Outlet />
        </div>
      </main>
    </div>
  );
}