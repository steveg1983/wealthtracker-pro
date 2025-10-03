import React, { useEffect, memo } from 'react';
import { AlertTriangleIcon, SettingsIcon, RefreshCwIcon } from '../icons';
import { useAnomalyDetection } from './useAnomalyDetection';
import { AnomalyCard } from './AnomalyCard';
import { AnomalySettings } from './AnomalySettings';
import { AnomalyDetails } from './AnomalyDetails';
import { useLogger } from '../services/ServiceProvider';

const AnomalyDetection = memo(function AnomalyDetection(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AnomalyDetection component initialized', {
      componentName: 'AnomalyDetection'
    });
  }, []);

  const {
    anomalies,
    loading,
    config,
    showSettings,
    setShowSettings,
    selectedAnomaly,
    setSelectedAnomaly,
    handleDismissAnomaly,
    handleViewTransaction,
    handleToggleType,
    handleSensitivityChange,
    detectAnomalies,
    highPriorityCount,
    mediumPriorityCount,
    lowPriorityCount
  } = useAnomalyDetection();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Anomaly Detection
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Automatically detect unusual patterns in your transactions
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={detectAnomalies}
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                High Priority
              </span>
              <span className="text-2xl font-bold text-red-600">
                {highPriorityCount}
              </span>
            </div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                Medium Priority
              </span>
              <span className="text-2xl font-bold text-yellow-600">
                {mediumPriorityCount}
              </span>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Low Priority
              </span>
              <span className="text-2xl font-bold text-blue-600">
                {lowPriorityCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detected Anomalies
        </h3>
        
        {loading ? (
          <div className="text-center py-8">
            <RefreshCwIcon size={32} className="animate-spin mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Analyzing transactions...
            </p>
          </div>
        ) : anomalies.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangleIcon size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No anomalies detected
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Your transactions look normal based on current settings
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {anomalies.map(anomaly => (
              <AnomalyCard
                key={anomaly.id}
                anomaly={anomaly}
                onDismiss={handleDismissAnomaly}
                onViewTransaction={handleViewTransaction}
                onClick={() => setSelectedAnomaly(anomaly)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnomalySettings
        isOpen={showSettings}
        config={config}
        onClose={() => setShowSettings(false)}
        onToggleType={handleToggleType}
        onSensitivityChange={handleSensitivityChange}
        onRefresh={detectAnomalies}
      />

      {/* Details Modal */}
      <AnomalyDetails
        anomaly={selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
      />
    </div>
  );
});

export default AnomalyDetection;