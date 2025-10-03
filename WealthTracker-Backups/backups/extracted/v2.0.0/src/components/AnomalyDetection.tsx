import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { anomalyDetectionService, type Anomaly, type AnomalyDetectionConfig } from '../services/anomalyDetectionService';
import { 
  AlertTriangleIcon, 
  XIcon,
  CheckIcon,
  TrendingUpIcon,
  RepeatIcon,
  ShieldIcon,
  DollarSignIcon,
  ClockIcon,
  SettingsIcon,
  InfoIcon
} from './icons';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function AnomalyDetection() {
  const { transactions, categories } = useApp();
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AnomalyDetectionConfig>(anomalyDetectionService.getConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  useEffect(() => {
    detectAnomalies();
  }, [transactions, categories]);

  const detectAnomalies = async () => {
    setLoading(true);
    try {
      const detected = await anomalyDetectionService.detectAnomalies(transactions, categories);
      setAnomalies(detected);
      anomalyDetectionService.saveAnomalies(detected);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAnomaly = (anomalyId: string) => {
    anomalyDetectionService.dismissAnomaly(anomalyId);
    setAnomalies(anomalies.filter(a => a.id !== anomalyId));
  };

  const handleViewTransaction = (transactionId?: string) => {
    if (transactionId) {
      navigate(`/transactions?highlight=${transactionId}`);
    }
  };

  const handleToggleType = (type: Anomaly['type']) => {
    const newTypes = new Set(config.enabledTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    const newConfig = { ...config, enabledTypes: newTypes };
    setConfig(newConfig);
    anomalyDetectionService.saveConfig(newConfig);
  };

  const handleSensitivityChange = (level: 'low' | 'medium' | 'high') => {
    const newConfig = { ...config, sensitivityLevel: level };
    setConfig(newConfig);
    anomalyDetectionService.saveConfig(newConfig);
  };

  const getAnomalyIcon = (type: Anomaly['type']) => {
    switch (type) {
      case 'unusual_amount': return <DollarSignIcon size={16} />;
      case 'frequency_spike': return <TrendingUpIcon size={16} />;
      case 'new_merchant': return <ShieldIcon size={16} />;
      case 'category_overspend': return <AlertTriangleIcon size={16} />;
      case 'time_pattern': return <ClockIcon size={16} />;
      case 'duplicate_charge': return <RepeatIcon size={16} />;
      default: return <AlertTriangleIcon size={16} />;
    }
  };

  const getSeverityColor = (severity: Anomaly['severity']) => {
    switch (severity) {
      case 'low': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'medium': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    }
  };

  const stats = anomalyDetectionService.getAnomalyStats(anomalies);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Anomaly Detection</h2>
            <p className="text-red-100">
              AI-powered detection of unusual financial patterns and potential issues
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <SettingsIcon size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm text-red-100">Total Anomalies</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-3xl font-bold">{stats.bySeverity.high || 0}</p>
            <p className="text-sm text-red-100">High Severity</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-3xl font-bold">{stats.bySeverity.medium || 0}</p>
            <p className="text-sm text-red-100">Medium Severity</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-3xl font-bold">${stats.totalAmount.toFixed(0)}</p>
            <p className="text-sm text-red-100">Total Amount</p>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Detection Settings</h3>
          
          <div className="space-y-4">
            {/* Sensitivity Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sensitivity Level
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => handleSensitivityChange(level)}
                    className={`px-4 py-2 rounded-lg capitalize ${
                      config.sensitivityLevel === level
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Detection Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Detection Types
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {([
                  { type: 'unusual_amount', label: 'Unusual Amounts' },
                  { type: 'frequency_spike', label: 'Frequency Spikes' },
                  { type: 'new_merchant', label: 'New Merchants' },
                  { type: 'category_overspend', label: 'Category Overspending' },
                  { type: 'time_pattern', label: 'Time Patterns' },
                  { type: 'duplicate_charge', label: 'Duplicate Charges' }
                ] as const).map(({ type, label }) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabledTypes.has(type)}
                      onChange={() => handleToggleType(type)}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Other Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lookback Period
                </label>
                <select
                  value={config.lookbackMonths}
                  onChange={(e) => {
                    const newConfig = { ...config, lookbackMonths: Number(e.target.value) };
                    setConfig(newConfig);
                    anomalyDetectionService.saveConfig(newConfig);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value={1}>1 month</option>
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={12}>12 months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto Alert
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoAlert}
                    onChange={(e) => {
                      const newConfig = { ...config, autoAlert: e.target.checked };
                      setConfig(newConfig);
                      anomalyDetectionService.saveConfig(newConfig);
                    }}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-sm">Send notifications for new anomalies</span>
                </label>
              </div>
            </div>

            <button
              onClick={detectAnomalies}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Re-run Detection
            </button>
          </div>
        </div>
      )}

      {/* Anomalies List */}
      {anomalies.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
          <CheckIcon className="mx-auto text-green-500 mb-3" size={48} />
          <h3 className="text-lg font-semibold mb-2">No Anomalies Detected</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your financial activity looks normal. We'll keep monitoring for any unusual patterns.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalies.map(anomaly => (
            <div
              key={anomaly.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedAnomaly(anomaly)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                  {getAnomalyIcon(anomaly.type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {anomaly.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {anomaly.description}
                      </p>
                      {anomaly.suggestedAction && (
                        <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-2">
                          <InfoIcon size={14} className="inline mr-1" />
                          {anomaly.suggestedAction}
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissAnomaly(anomaly.id);
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Dismiss"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className={`px-2 py-1 rounded-full ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity}
                    </span>
                    {anomaly.amount && (
                      <span>${anomaly.amount.toFixed(2)}</span>
                    )}
                    {anomaly.merchant && (
                      <span>{anomaly.merchant}</span>
                    )}
                    {anomaly.category && (
                      <span>{categories.find(c => c.id === anomaly.category)?.name || anomaly.category}</span>
                    )}
                    <span>{format(anomaly.detectedAt, 'MMM d, h:mm a')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anomaly Detail Modal */}
      {selectedAnomaly && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getSeverityColor(selectedAnomaly.severity)}`}>
                  {getAnomalyIcon(selectedAnomaly.type)}
                </div>
                <h3 className="text-lg font-semibold">{selectedAnomaly.title}</h3>
              </div>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                {selectedAnomaly.description}
              </p>

              {selectedAnomaly.suggestedAction && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 mb-1">
                    Suggested Action
                  </p>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    {selectedAnomaly.suggestedAction}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                {selectedAnomaly.transactionId && (
                  <button
                    onClick={() => {
                      handleViewTransaction(selectedAnomaly.transactionId);
                      setSelectedAnomaly(null);
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    View Transaction
                  </button>
                )}
                {selectedAnomaly.transactions && selectedAnomaly.transactions.length > 0 && (
                  <button
                    onClick={() => {
                      navigate(`/transactions?ids=${selectedAnomaly.transactions?.join(',')}`);
                      setSelectedAnomaly(null);
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    View {selectedAnomaly.transactions.length} Transactions
                  </button>
                )}
                <button
                  onClick={() => {
                    handleDismissAnomaly(selectedAnomaly.id);
                    setSelectedAnomaly(null);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}