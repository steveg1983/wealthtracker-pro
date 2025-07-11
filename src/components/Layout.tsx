import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Home, CreditCard, PieChart, Target, Wallet, TrendingUp, Settings, Menu, X, ArrowRightLeft, BarChart3, Goal } from 'lucide-react';

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
}

function SidebarLink({ to, icon: Icon, label, isCollapsed }: SidebarLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary text-white'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={isCollapsed ? label : undefined}
    >
      <Icon size={20} />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}

export default function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        } bg-white dark:bg-gray-800 shadow-md transition-all duration-300 hidden md:block`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">Money Tracker</h1>
            )}
            <button
              onClick={toggleSidebar}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <nav className="space-y-2">
            <SidebarLink to="/" icon={Home} label="Dashboard" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/accounts" icon={Wallet} label="Accounts" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/transactions" icon={CreditCard} label="Transactions" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/investments" icon={TrendingUp} label="Investments" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/budgets" icon={Target} label="Budget" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/goals" icon={Goal} label="Goals" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/analytics" icon={BarChart3} label="Analytics" isCollapsed={isSidebarCollapsed} />
            <SidebarLink to="/settings" icon={Settings} label="Settings" isCollapsed={isSidebarCollapsed} />
          </nav>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={toggleMobileMenu}>
          <aside className="w-64 h-full bg-white dark:bg-gray-800 shadow-md" onClick={e => e.stopPropagation()}>
            <div className="p-4">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-8">Money Tracker</h1>
              <nav className="space-y-2">
                <SidebarLink to="/" icon={Home} label="Dashboard" isCollapsed={false} />
                <SidebarLink to="/accounts" icon={Wallet} label="Accounts" isCollapsed={false} />
                <SidebarLink to="/transactions" icon={CreditCard} label="Transactions" isCollapsed={false} />
                <SidebarLink to="/investments" icon={TrendingUp} label="Investments" isCollapsed={false} />
                <SidebarLink to="/budgets" icon={Target} label="Budget" isCollapsed={false} />
                <SidebarLink to="/goals" icon={Goal} label="Goals" isCollapsed={false} />
                <SidebarLink to="/analytics" icon={BarChart3} label="Analytics" isCollapsed={false} />
                <SidebarLink to="/settings" icon={Settings} label="Settings" isCollapsed={false} />
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 pt-16 md:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
