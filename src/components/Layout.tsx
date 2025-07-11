import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Wallet, 
  ArrowUpDown, 
  TrendingUp, 
  Target, 
  PieChart,
  Settings,
  Menu,
  X,
  BarChart3
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Accounts', href: '/accounts', icon: Wallet },
    { name: 'Transactions', href: '/transactions', icon: ArrowUpDown },
    { name: 'Investments', href: '/investments', icon: TrendingUp },
    { name: 'Budget', href: '/budget', icon: PieChart },
    { name: 'Goals', href: '/goals', icon: Target },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md"
        >
          {mobileMenuOpen ? <X size={24} className="dark:text-white" /> : <Menu size={24} className="dark:text-white" />}
        </button>
      <MobileDebug />
      </div>

      {/* Sidebar for desktop, overlay for mobile */}
      <div className={`${
        mobileMenuOpen ? 'block' : 'hidden'
      } lg:block fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 shadow-lg`}>
        <div className="flex h-full flex-col">
          {/* Logo - Updated with proper emoji */}
          <div className="flex h-16 items-center justify-center lg:justify-center border-b dark:border-gray-700 pl-16 pr-4 lg:px-4">
            <h1 className="text-lg lg:text-xl font-bold text-primary dark:text-blue-400 text-center">
              Danielle's Money <span className="inline-block">👋</span>
            </h1>
      <MobileDebug />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-white dark:bg-blue-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
      <MobileDebug />
        </div>
      <MobileDebug />
      </div>

      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content - Added padding-top for mobile */}
      <div className="lg:pl-64">
        <main className="p-4 lg:p-8 pt-20 lg:pt-8">
          <Outlet />
        </main>
      <MobileDebug />
      </div>
      <MobileDebug />
    </div>
  );
}
