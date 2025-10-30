import React, { useState, useEffect, useCallback } from 'react';
import { Decimal, toDecimal } from '@wealthtracker/utils';
import { securityService } from '../../services/securityService';
import {
  ShieldIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  ArrowRightIcon
} from '../icons';
import { useNavigate } from 'react-router-dom';
import type { SecuritySettings } from '../../services/securityService';
import type { BaseWidgetProps } from '../../types/widget-types';

export default function SecurityWidget({ size = 'medium' }: BaseWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const [securitySettings] = useState<SecuritySettings>(
    securityService.getSecuritySettings()
  );
  const [securityScore, setSecurityScore] = useState(0);
  const [recentLogs, setRecentLogs] = useState(0);

  const calculateSecurityScore = useCallback(() => {
    let score = toDecimal(0);
    const maxScore = 5;

    if (securitySettings.twoFactorEnabled) score = score.plus(1);
    if (securitySettings.biometricEnabled) score = score.plus(1);
    if (securitySettings.encryptionEnabled) score = score.plus(1);
    if (securitySettings.sessionTimeout <= 30) score = score.plus(1); // Shorter timeout = better
    if (securitySettings.failedAttempts === 0) score = score.plus(1); // No failed attempts

    const percentage = score
      .dividedBy(maxScore)
      .times(100)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();
    setSecurityScore(percentage);
  }, [securitySettings]);

  const loadRecentActivity = useCallback(() => {
    const logs = securityService.getAuditLogs({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    });
    setRecentLogs(logs.length);
  }, []);

  useEffect(() => {
    calculateSecurityScore();
    loadRecentActivity();
  }, [calculateSecurityScore, loadRecentActivity]);

  const getSecurityStatus = () => {
    if (securityScore >= 80) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (securityScore >= 60) return { label: 'Good', color: 'text-gray-600 dark:text-gray-500' };
    if (securityScore >= 40) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
    return { label: 'Poor', color: 'text-red-600 dark:text-red-400' };
  };

  const handleViewSecurity = () => {
    navigate('/settings/security');
  };

  if (size === 'small') {
    return (
      <div 
        className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3"
        onClick={handleViewSecurity}
      >
        <div className="flex items-center justify-between mb-2">
          <ShieldIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Security</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {securityScore}%
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Security Score
            </p>
          </div>
        </div>
      </div>
    );
  }

  const status = getSecurityStatus();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
          Security Status
        </h3>
        <span className={`text-sm font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {/* Security Score */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Security Score</span>
            <span className={`text-2xl font-bold ${status.color}`}>
              {securityScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                securityScore >= 80 ? 'bg-green-500' :
                securityScore >= 60 ? 'bg-gray-500' :
                securityScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${securityScore}%` }}
            />
          </div>
        </div>

        {/* Security Features */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {securitySettings.twoFactorEnabled ? (
              <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangleIcon size={16} className="text-red-600 dark:text-red-400" />
            )}
            <span className="text-gray-700 dark:text-gray-300">Two-Factor Auth</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            {securitySettings.encryptionEnabled ? (
              <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangleIcon size={16} className="text-red-600 dark:text-red-400" />
            )}
            <span className="text-gray-700 dark:text-gray-300">Data Encryption</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            {securitySettings.biometricEnabled ? (
              <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangleIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
            )}
            <span className="text-gray-700 dark:text-gray-300">Biometric Login</span>
          </div>
        </div>

        {/* Read-Only Mode Warning */}
        {securitySettings.readOnlyMode && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
            <div className="flex items-center gap-2">
              <EyeIcon size={16} className="text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-gray-900 dark:text-white">
                Read-only mode is active
              </p>
            </div>
          </div>
        )}

        {/* Account Lockout Warning */}
        {securitySettings.failedAttempts > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {securitySettings.failedAttempts} failed login attempt{securitySettings.failedAttempts > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Recent Activity</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {recentLogs} events (7 days)
            </span>
          </div>
        </div>

        {/* View Security Button */}
        <button
          onClick={handleViewSecurity}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          View Security Settings
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}
