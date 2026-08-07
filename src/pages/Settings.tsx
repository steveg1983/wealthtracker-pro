import { DatabaseIcon, TagIcon, PaletteIcon } from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import SubscriptionStatus from '../components/SubscriptionStatus';

export default function Settings() {
  // The Quick Settings panel that used to sit here is gone with its last two
  // cards. Notifications pointed at a push-notification page whose every
  // control depended on a service worker this app does not ship, and
  // Accessibility pointed at a panel of switches wired to nothing. The alert
  // settings that DO work — budget alerts and large-transaction warnings —
  // live on App Settings, and the accessibility features themselves are
  // always on rather than optional.
  return (
    <PageWrapper title="Settings">

      {/* Subscription and Sync Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SubscriptionStatus />
        <SyncStatusIndicator variant="detailed" showLastSync={true} />
      </div>

      {/* Main About Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center">
            <span className="text-2xl font-bold text-white">WT</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-blue-900 dark:text-white">WealthTracker</h2>
            <p className="text-gray-600 dark:text-gray-400">Version 1.0</p>
          </div>
        </div>
        
        <div className="space-y-4 text-gray-600 dark:text-gray-400">
          <p className="text-lg">
            A comprehensive personal finance management application designed to help you track, 
            manage, and grow your wealth with ease.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Features</h3>
              <ul className="space-y-2 text-sm">
                <li>• Account management and tracking</li>
                <li>• Transaction recording and categorization</li>
                <li>• Budget planning and monitoring</li>
                <li>• Investment portfolio tracking</li>
                <li>• Financial goal setting</li>
                <li>• Analytics and insights</li>
                <li>• Account reconciliation</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Technology</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <PaletteIcon size={16} />
                  <span>Built with React & TypeScript</span>
                </div>
                <div className="flex items-center gap-2">
                  <DatabaseIcon size={16} />
                  <span>Tailwind CSS for styling</span>
                </div>
                <div className="flex items-center gap-2">
                  <TagIcon size={16} />
                  <span>Recharts for data visualization</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    {/* id bumped again: the copy still promised categories and tags here, and
        those now live under Manage — a tip that names the wrong door is worse
        than no tip. */}
    <PageTip
      id="settings-intro-3"
      title="App settings"
      description="Your name, currency, theme and which pages appear in the sidebar, reached from the Settings menu above. Data Management covers archiving, backups and cleaning up — bringing data in and getting it out lives under Manage, alongside categories and tags."
    />
    </PageWrapper>
  );
}
