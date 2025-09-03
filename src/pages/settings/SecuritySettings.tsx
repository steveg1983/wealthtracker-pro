import React, { useState, useEffect } from 'react';
import { securityService } from '../../services/securityService';
import { 
  LockIcon,
  ShieldIcon,
  KeyIcon,
  EyeIcon,
  FileTextIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  PhoneIcon,
  FingerprintIcon
} from '../../components/icons';
import PageWrapper from '../../components/PageWrapper';
import type { SecuritySettings as SecuritySettingsType } from '../../services/securityService';

export default function SecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettingsType>(
    securityService.getSecuritySettings()
  );
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [setupMessage, setSetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    const available = await securityService.isBiometricAvailable();
    setBiometricAvailable(available);
  };

  const handleToggleTwoFactor = () => {
    if (!settings.twoFactorEnabled) {
      const setup = securityService.generateTwoFactorSecret();
      setTwoFactorSecret(setup);
      setShowTwoFactorSetup(true);
    } else {
      // Disable 2FA
      securityService.updateSecuritySettings({ twoFactorEnabled: false });
      setSettings({ ...settings, twoFactorEnabled: false });
      setSetupMessage({ type: 'success', text: 'Two-factor authentication disabled' });
    }
  };

  const handleVerifyTwoFactor = () => {
    if (twoFactorSecret && verificationCode) {
      const isValid = securityService.verifyTwoFactorCode(verificationCode, twoFactorSecret.secret);
      
      if (isValid) {
        securityService.updateSecuritySettings({ twoFactorEnabled: true });
        setSettings({ ...settings, twoFactorEnabled: true });
        setShowTwoFactorSetup(false);
        setTwoFactorSecret(null);
        setVerificationCode('');
        setSetupMessage({ type: 'success', text: 'Two-factor authentication enabled successfully' });
      } else {
        setSetupMessage({ type: 'error', text: 'Invalid verification code' });
      }
    }
  };

  const handleToggleBiometric = async () => {
    if (!settings.biometricEnabled) {
      try {
        const credential = await securityService.setupBiometric();
        if (credential) {
          securityService.updateSecuritySettings({ biometricEnabled: true });
          setSettings({ ...settings, biometricEnabled: true });
          setSetupMessage({ type: 'success', text: 'Biometric authentication enabled' });
        } else {
          setSetupMessage({ type: 'error', text: 'Failed to setup biometric authentication' });
        }
      } catch (error) {
        setSetupMessage({ type: 'error', text: 'Biometric authentication not available' });
      }
    } else {
      securityService.updateSecuritySettings({ biometricEnabled: false });
      setSettings({ ...settings, biometricEnabled: false });
      setSetupMessage({ type: 'success', text: 'Biometric authentication disabled' });
    }
  };

  const handleToggleReadOnly = () => {
    const newValue = !settings.readOnlyMode;
    securityService.toggleReadOnlyMode(newValue);
    setSettings({ ...settings, readOnlyMode: newValue });
    setSetupMessage({ 
      type: 'success', 
      text: newValue ? 'Read-only mode enabled' : 'Read-only mode disabled' 
    });
  };

  const handleToggleEncryption = () => {
    const newValue = !settings.encryptionEnabled;
    securityService.updateSecuritySettings({ encryptionEnabled: newValue });
    setSettings({ ...settings, encryptionEnabled: newValue });
    setSetupMessage({ 
      type: 'success', 
      text: newValue ? 'Data encryption enabled' : 'Data encryption disabled' 
    });
  };

  const handleSessionTimeoutChange = (timeout: number) => {
    securityService.updateSecuritySettings({ sessionTimeout: timeout });
    setSettings({ ...settings, sessionTimeout: timeout });
  };

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-800 dark:to-purple-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Security Settings</h1>
              <p className="text-indigo-100">
                Protect your financial data with advanced security features
              </p>
            </div>
            <ShieldIcon size={48} className="text-white/80" />
          </div>
        </div>

        {/* Setup Messages */}
        {setupMessage && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            setupMessage.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {setupMessage.type === 'success' ? (
              <CheckCircleIcon size={20} />
            ) : (
              <AlertCircleIcon size={20} />
            )}
            <p>{setupMessage.text}</p>
          </div>
        )}

        {/* Security Features */}
        <div className="space-y-6">
          {/* Two-Factor Authentication */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <PhoneIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
                  Two-Factor Authentication
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Add an extra layer of security with time-based one-time passwords
                </p>
              </div>
              <button
                onClick={handleToggleTwoFactor}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.twoFactorEnabled
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                }`}
              >
                {settings.twoFactorEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            
            {settings.twoFactorEnabled && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                  <CheckCircleIcon size={16} />
                  Two-factor authentication is active
                </p>
              </div>
            )}
          </div>

          {/* Biometric Authentication */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FingerprintIcon size={20} className="text-purple-600 dark:text-purple-400" />
                  Biometric Authentication
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Use Face ID, Touch ID, or Windows Hello for quick access
                </p>
              </div>
              <button
                onClick={handleToggleBiometric}
                disabled={!biometricAvailable}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  !biometricAvailable
                    ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 cursor-not-allowed'
                    : settings.biometricEnabled
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                }`}
              >
                {!biometricAvailable ? 'Not Available' : settings.biometricEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            
            {!biometricAvailable && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Biometric authentication is not available on this device
                </p>
              </div>
            )}
          </div>

          {/* Data Encryption */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <LockIcon size={20} className="text-green-600 dark:text-green-400" />
                  End-to-End Encryption
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Encrypt all sensitive data stored locally
                </p>
              </div>
              <button
                onClick={handleToggleEncryption}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.encryptionEnabled
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                }`}
              >
                {settings.encryptionEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            
            {settings.encryptionEnabled && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                  <CheckCircleIcon size={16} />
                  All data is encrypted using AES-256-GCM
                </p>
              </div>
            )}
          </div>

          {/* Read-Only Mode */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <EyeIcon size={20} className="text-gray-600 dark:text-gray-500" />
                  Read-Only Mode
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  View your data without the ability to make changes
                </p>
              </div>
              <button
                onClick={handleToggleReadOnly}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  settings.readOnlyMode
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                }`}
              >
                {settings.readOnlyMode ? 'Disable' : 'Enable'}
              </button>
            </div>
            
            {settings.readOnlyMode && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <EyeIcon size={16} />
                  Read-only mode is active - no changes can be made
                </p>
              </div>
            )}
          </div>

          {/* Session Timeout */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <RefreshCwIcon size={20} className="text-orange-600 dark:text-orange-400" />
              Session Timeout
            </h3>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically log out after a period of inactivity
              </p>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Timeout after:
                </label>
                <select
                  value={settings.sessionTimeout}
                  onChange={(e) => handleSessionTimeoutChange(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <FileTextIcon size={20} className="text-gray-600 dark:text-gray-400" />
              Security Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                <span className="text-sm text-gray-700 dark:text-gray-300">Failed login attempts</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {settings.failedAttempts}
                </span>
              </div>
              {settings.lastLogin && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Last login</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(settings.lastLogin).toLocaleString()}
                  </span>
                </div>
              )}
              <button
                onClick={() => window.location.href = '/settings/security/audit-logs'}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                View Audit Logs
              </button>
            </div>
          </div>
        </div>

        {/* Two-Factor Setup Modal */}
        {showTwoFactorSetup && twoFactorSecret && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Set Up Two-Factor Authentication
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    1. Scan this QR code with your authenticator app:
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                    <div className="inline-block p-4 bg-white dark:bg-gray-800 rounded">
                      <KeyIcon size={48} className="text-gray-400" />
                      <p className="text-xs text-gray-500 mt-2">QR Code Placeholder</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    2. Or enter this secret manually:
                  </p>
                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm break-all">
                    {twoFactorSecret.secret}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    3. Enter the 6-digit code from your app:
                  </p>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono text-lg"
                  />
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    4. Save these backup codes in a safe place:
                  </p>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded">
                    {twoFactorSecret.backupCodes.slice(0, 6).map((code: string, index: number) => (
                      <span key={index} className="font-mono text-sm">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowTwoFactorSetup(false);
                    setTwoFactorSecret(null);
                    setVerificationCode('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyTwoFactor}
                  disabled={verificationCode.length !== 6}
                  className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Verify & Enable
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}