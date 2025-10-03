/**
 * SecureField Component
 * Input field that automatically encrypts data before storage
 */

import React, { useState, useEffect, useCallback } from 'react';
import { enhancedEncryption } from '../../security/encryption-enhanced';
import { sanitizeText } from '../../security/xss-protection';
import { EyeIcon, EyeOffIcon, LockIcon } from 'lucide-react';
import { logger } from '../../services/loggingService';

interface SecureFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onEncryptedChange?: (encrypted: string) => void;
  isEncrypted?: boolean;
  showToggle?: boolean;
  autoDecrypt?: boolean;
  label?: string;
  helperText?: string;
}

export const SecureField: React.FC<SecureFieldProps> = ({
  value,
  onChange,
  onEncryptedChange,
  isEncrypted = false,
  showToggle = true,
  autoDecrypt = true,
  label,
  helperText,
  type = 'text',
  className = '',
  ...inputProps
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [decryptedValue, setDecryptedValue] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize encryption service
  useEffect(() => {
    const init = async () => {
      try {
        await enhancedEncryption.initialize();
      } catch (err) {
        setError('Failed to initialize encryption');
        logger.error('Encryption initialization failed:', err);
      }
    };
    init();
  }, []);

  // Decrypt value when it changes (if encrypted and autoDecrypt is enabled)
  useEffect(() => {
    if (isEncrypted && autoDecrypt && value) {
      decryptValue(value);
    } else if (!isEncrypted) {
      setDecryptedValue(value);
    }
  }, [value, isEncrypted, autoDecrypt]);

  const decryptValue = async (encryptedValue: string) => {
    if (!encryptedValue) {
      setDecryptedValue('');
      return;
    }

    setIsDecrypting(true);
    setError(null);

    try {
      const encrypted = JSON.parse(encryptedValue);
      const decrypted = await enhancedEncryption.decrypt<string>(encrypted);
      setDecryptedValue(decrypted);
    } catch (err) {
      setError('Failed to decrypt value');
      logger.error('Decryption failed:', err);
      setDecryptedValue('');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = sanitizeText(e.target.value);
    setDecryptedValue(newValue);
    
    if (!isEncrypted) {
      onChange(newValue);
    } else {
      // Encrypt the value
      try {
        const encrypted = enhancedEncryption.encrypt(newValue);
        const encryptedString = JSON.stringify(encrypted);
        onChange(encryptedString);
        onEncryptedChange?.(encryptedString);
      } catch (err) {
        setError('Failed to encrypt value');
        logger.error('Encryption failed:', err);
      }
    }
  }, [isEncrypted, onChange, onEncryptedChange]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const getInputType = () => {
    if (type === 'password' && !isVisible) return 'password';
    return 'text';
  };

  const getDisplayValue = () => {
    if (isDecrypting) return 'Decrypting...';
    if (error && isEncrypted) return '';
    if (!isVisible && isEncrypted && !autoDecrypt) return '••••••••';
    return decryptedValue;
  };

  return (
    <div className="secure-field-wrapper">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {isEncrypted && (
            <LockIcon className="inline-block w-4 h-4 ml-1 text-green-600 dark:text-green-400" />
          )}
        </label>
      )}
      
      <div className="relative">
        <input
          {...inputProps}
          type={getInputType()}
          value={getDisplayValue()}
          onChange={handleChange}
          disabled={isDecrypting || inputProps.disabled}
          className={`
            ${className}
            ${isEncrypted ? 'pr-20' : 'pr-10'}
            ${error ? 'border-red-500' : ''}
            ${isDecrypting ? 'opacity-50' : ''}
          `}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
          {isEncrypted && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
              Encrypted
            </span>
          )}
          
          {showToggle && (type === 'password' || (isEncrypted && !autoDecrypt)) && (
            <button
              type="button"
              onClick={toggleVisibility}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={isVisible ? 'Hide value' : 'Show value'}
            >
              {isVisible ? (
                <EyeOffIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>
      
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
      
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};