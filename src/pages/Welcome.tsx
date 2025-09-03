import { SignInButton, SignUpButton, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import { BarChart3Icon, ShieldIcon, TrendingUpIcon, UsersIcon, WifiIcon, PhoneIcon } from '../components/icons';

export default function Welcome() {
  const { isSignedIn } = useAuth();
  const { firstName } = usePreferences();
  const navigate = useNavigate();
  const displayName = firstName || 'there';

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  // Show authenticated welcome if signed in
  if (isSignedIn) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
        <div className="text-center space-y-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
            Welcome back, {displayName}!
          </h2>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white">
            Wealth Tracker Pro
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              The #1 Personal Finance App
              <span className="block text-gray-600 dark:text-gray-500 mt-2">
                That Just Works
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Apple-level quality meets financial excellence. Track, manage, and grow your wealth with the most intuitive finance app ever created.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignUpButton mode="modal">
                <button className="px-8 py-4 bg-gradient-to-r from-gray-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                  Start Free Trial
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-gray-200 dark:border-gray-700">
                  Sign In
                </button>
              </SignInButton>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <ShieldIcon size={20} />
                <span>Bank-level Security</span>
              </div>
              <div className="flex items-center gap-2">
                <WifiIcon size={20} />
                <span>Works Offline</span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneIcon size={20} />
                <span>Touch ID/Face ID</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-blue-100 dark:bg-gray-900 rounded-lg flex items-center justify-center mb-4">
              <BarChart3Icon size={24} className="text-gray-600 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
              Intelligent Analytics
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              AI-powered insights that actually help you save money and make better financial decisions.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <TrendingUpIcon size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
              Investment Tracking
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Real-time portfolio monitoring with automated rebalancing suggestions.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
              <UsersIcon size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
              Multi-User Support
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Securely manage household finances with role-based access control.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Teaser */}
      <div className="bg-blue-50 dark:bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Free to Start, Powerful to Scale
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Start with our free tier and unlock premium features as you grow
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Free</h3>
              <p className="text-gray-500 dark:text-gray-400">Essential features</p>
            </div>
            <div className="border-2 border-gray-500 rounded-xl p-6 transform scale-105 shadow-lg">
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Pro</h3>
              <p className="text-gray-500 dark:text-gray-400">Advanced analytics</p>
            </div>
            <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Business</h3>
              <p className="text-gray-500 dark:text-gray-400">Team collaboration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© 2024 WealthTracker. Built with excellence.</p>
      </footer>
    </div>
  );
}