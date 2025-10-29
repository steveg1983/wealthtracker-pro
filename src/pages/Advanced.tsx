import { Link } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import { MagicWandIcon, LightbulbIcon, FileTextIcon, CalculatorIcon, UsersIcon, BriefcaseIcon, DatabaseIcon, PieChartIcon } from '../components/icons';
import { usePreferences } from '../contexts/PreferencesContext';

export default function Advanced() {
  const { 
    showAIAnalytics,
    showTaxPlanning,
    showHousehold,
    showBusinessFeatures,
    showFinancialPlanning,
    showDataIntelligence,
    showSummaries
  } = usePreferences();

  const advancedFeatures = [
    {
      title: 'AI Analytics',
      description: 'Smart insights powered by artificial intelligence',
      icon: MagicWandIcon,
      link: '/ai-analytics',
      enabled: showAIAnalytics
    },
    {
      title: 'AI Features',
      description: 'Automated features and smart suggestions',
      icon: LightbulbIcon,
      link: '/ai-features',
      enabled: true
    },
    {
      title: 'Custom Reports',
      description: 'Build and customize your own financial reports',
      icon: FileTextIcon,
      link: '/custom-reports',
      enabled: true
    },
    {
      title: 'Tax Planning',
      description: 'Track tax obligations and optimize deductions',
      icon: CalculatorIcon,
      link: '/tax-planning',
      enabled: showTaxPlanning
    },
    {
      title: 'Household',
      description: 'Manage shared finances with family members',
      icon: UsersIcon,
      link: '/household',
      enabled: showHousehold
    },
    {
      title: 'Business Features',
      description: 'Tools for business expense tracking and invoicing',
      icon: BriefcaseIcon,
      link: '/business-features',
      enabled: showBusinessFeatures
    },
    {
      title: 'Financial Planning',
      description: 'Long-term financial planning and projections',
      icon: CalculatorIcon,
      link: '/financial-planning',
      enabled: showFinancialPlanning
    },
    {
      title: 'Data Intelligence',
      description: 'Advanced data analysis and insights',
      icon: DatabaseIcon,
      link: '/data-intelligence',
      enabled: showDataIntelligence
    },
    {
      title: 'Summaries',
      description: 'Comprehensive financial summaries and overviews',
      icon: PieChartIcon,
      link: '/summaries',
      enabled: showSummaries
    }
  ];

  const enabledFeatures = advancedFeatures.filter(f => f.enabled);

  return (
    <PageWrapper title="Advanced Features">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {enabledFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.link}
              to={feature.link}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 block"
            >
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-lg">
                  <Icon size={24} className="text-primary dark:text-primary-light" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {enabledFeatures.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <p className="text-yellow-800 dark:text-yellow-200">
            No advanced features are currently enabled. You can enable them in Settings → App Settings.
          </p>
        </div>
      )}
    </PageWrapper>
  );
}