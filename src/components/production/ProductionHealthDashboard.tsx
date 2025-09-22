/**
 * Production Health Dashboard - Phase 8.3
 * Comprehensive production health monitoring and status display
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  ActivityIcon,
  ShieldIcon,
  ZapIcon,
  DatabaseIcon,
  ClockIcon
} from '../icons';
import { productionMonitoring, createMonitoringWidget } from '../../services/ProductionMonitoringService';
import { webVitalsMonitor } from '../../utils/performance/coreWebVitals';
import { errorTaxonomyService } from '../../services/ErrorTaxonomyService';
import { useLogger } from '../services/ServiceProvider';
interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  database: boolean;
  authentication: boolean;
  storage: boolean;
  externalApis: boolean;
  responseTime: number;
  uptime: string;
}

interface WebVitalsReport {
  vitals: Array<{
    name: string;
    rating: 'good' | 'needs-improvement' | 'poor';
    value: number;
  }>;
  overallScore: number;
}

interface ErrorStats {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

export default function ProductionHealthDashboard(): React.JSX.Element {
  const logger = useLogger();
  const [isVisible, setIsVisible] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [webVitals, setWebVitals] = useState<WebVitalsReport | null>(null);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if we're in production or development mode
  const isProduction = import.meta.env.MODE === 'production';

  useEffect(() => {
    // Only show in development or if explicitly enabled
    const showDashboard = !isProduction || localStorage.getItem('showProductionDashboard') === 'true';
    setIsVisible(showDashboard);

    if (showDashboard) {
      loadHealthData();
    }
  }, [isProduction, refreshKey]);

  const loadHealthData = async () => {
    try {
      // Get health check data
      const healthCheck = await productionMonitoring.performHealthCheck();
      setHealthStatus({
        overall: healthCheck.status === 'healthy' ? 'healthy' :
                healthCheck.status === 'degraded' ? 'warning' : 'critical',
        database: healthCheck.checks.database,
        authentication: healthCheck.checks.authentication,
        storage: healthCheck.checks.storage,
        externalApis: healthCheck.checks.externalApis,
        responseTime: healthCheck.responseTime,
        uptime: Math.round((Date.now() - Date.parse(healthCheck.timestamp.toString())) / 1000 / 60) + 'm'
      });

      // Get Web Vitals data
      const vitalsReport = webVitalsMonitor.getReport();
      setWebVitals(vitalsReport ?? null);

      // Get error statistics
      const stats = errorTaxonomyService.getErrorStats();
      setErrorStats(stats ?? null);

    } catch (error) {
      logger.error('Failed to load health data:', error);
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical' | boolean) => {
    if (typeof status === 'boolean') {
      return status ? (
        <CheckCircleIcon size={16} className="text-green-500" />
      ) : (
        <AlertCircleIcon size={16} className="text-red-500" />
      );
    }

    switch (status) {
      case 'healthy':
        return <CheckCircleIcon size={20} className="text-green-500" />;
      case 'warning':
        return <AlertTriangleIcon size={20} className="text-yellow-500" />;
      case 'critical':
        return <AlertCircleIcon size={20} className="text-red-500" />;
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors"
          title="Production Health"
        >
          <ActivityIcon size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ActivityIcon size={18} className="text-blue-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Production Health
            </h3>
            {healthStatus && (
              <div className="flex items-center gap-1">
                {getStatusIcon(healthStatus.overall)}
                <span className={`text-xs font-medium ${
                  healthStatus.overall === 'healthy' ? 'text-green-600 dark:text-green-400' :
                  healthStatus.overall === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {healthStatus.overall.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Refresh"
            >
              <ClockIcon size={14} className="text-gray-500" />
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Hide"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Health Status */}
      {healthStatus && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <DatabaseIcon size={12} />
                Database
              </span>
              {getStatusIcon(healthStatus.database)}
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldIcon size={12} />
                Auth
              </span>
              {getStatusIcon(healthStatus.authentication)}
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <DatabaseIcon size={12} />
                Storage
              </span>
              {getStatusIcon(healthStatus.storage)}
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ZapIcon size={12} />
                APIs
              </span>
              {getStatusIcon(healthStatus.externalApis)}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Response: {Math.round(healthStatus.responseTime)}ms | Uptime: {healthStatus.uptime}
          </div>
        </div>
      )}

      {/* Web Vitals */}
      {webVitals && webVitals.vitals.length > 0 && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Core Web Vitals
          </h4>
          <div className="space-y-2">
            {webVitals.vitals.slice(0, 4).map((vital) => (
              <div key={vital.name} className="flex items-center justify-between text-xs">
                <span className="font-mono">{vital.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`${
                    vital.rating === 'good' ? 'text-green-500' :
                    vital.rating === 'needs-improvement' ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {vital.name === 'CLS' ? vital.value.toFixed(3) : Math.round(vital.value)}
                    {vital.name !== 'CLS' ? 'ms' : ''}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${
                    vital.rating === 'good' ? 'bg-green-500' :
                    vital.rating === 'needs-improvement' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Overall Score: {webVitals.overallScore}/100
          </div>
        </div>
      )}

      {/* Error Statistics */}
      {errorStats && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Error Statistics
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Total Errors:</span>
              <span className="font-mono">{errorStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Critical:</span>
              <span className="font-mono text-red-500">{errorStats.bySeverity.critical || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Financial:</span>
              <span className="font-mono">{errorStats.byCategory.financial || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="font-mono">{errorStats.byCategory.network || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              const report = productionMonitoring.getProductionReadinessReport();
              logger.info('Production readiness report:', report);
              const widget = createMonitoringWidget();
              alert(`Status: ${widget.status}\nAlerts: ${widget.alerts}\nUptime: ${widget.uptime}`);
            }}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
          >
            Full Report
          </button>
          <button
            onClick={() => {
              errorTaxonomyService.clearHistory();
              setRefreshKey(prev => prev + 1);
            }}
            className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
          >
            Clear Errors
          </button>
        </div>
        {!isProduction && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Development Mode - Limited Monitoring
          </div>
        )}
      </div>
    </div>
  );
}
