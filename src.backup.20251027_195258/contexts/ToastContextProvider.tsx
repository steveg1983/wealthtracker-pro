import React, { useState, useCallback } from 'react';
import { ToastContainer } from '../components/common/Toast';
import type { ToastMessage } from '../components/common/Toast';
import { formatErrorNotification } from '../utils/errorMessages';
import { ToastContext } from './ToastContext.context';
import type { ToastContextType, ToastInput } from './ToastContext.types';

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: ToastInput) => {
    const id = message.id ?? `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = {
      ...message,
      id,
    };

    setToasts(prev => {
      const filtered = prev.filter(existing => existing.id !== id);
      return [...filtered, newToast];
    });

    return id;
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    return showToast({
      type: 'success',
      title: title || 'Success',
      message,
      duration: 3000,
    });
  }, [showToast]);

  const showError = useCallback((error: unknown) => {
    const notification = formatErrorNotification(error);
    const baseToast = {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      duration: 6000
    };

    const toastWithAction = notification.action
      ? {
          ...baseToast,
          action: {
            label: notification.action,
            onClick: () => {
              // Handle specific actions
              if (notification.action === 'Sign in again') {
                window.location.href = '/login';
              } else if (notification.action === 'Retry') {
                window.location.reload();
              }
            }
          }
        }
      : baseToast;

    return showToast(toastWithAction);
  }, [showToast]);

  const showWarning = useCallback((message: string, title?: string) => {
    return showToast({
      type: 'warning',
      title: title || 'Warning',
      message,
      duration: 5000,
    });
  }, [showToast]);

  const showInfo = useCallback((message: string, title?: string) => {
    return showToast({
      type: 'info',
      title: title || 'Info',
      message,
      duration: 4000,
    });
  }, [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const value: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
