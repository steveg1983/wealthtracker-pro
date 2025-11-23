/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatErrorNotification } from '../utils/errorMessages';

interface ToastContextType {
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (error: unknown) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = {
      id,
      ...message,
    };
    
    setToasts(prev => [...prev, newToast]);
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    showToast({
      type: 'success',
      title: title || 'Success',
      message,
      duration: 3000,
    });
  }, [showToast]);

  const showError = useCallback((error: unknown) => {
    const notification = formatErrorNotification(error);
    showToast({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      duration: 6000,
      action: notification.action ? {
        label: notification.action,
        onClick: () => {
          // Handle specific actions
          if (notification.action === 'Sign in again') {
            window.location.href = '/login';
          } else if (notification.action === 'Retry') {
            window.location.reload();
          }
        }
      } : undefined,
    });
  }, [showToast]);

  const showWarning = useCallback((message: string, title?: string) => {
    showToast({
      type: 'warning',
      title: title || 'Warning',
      message,
      duration: 5000,
    });
  }, [showToast]);

  const showInfo = useCallback((message: string, title?: string) => {
    showToast({
      type: 'info',
      title: title || 'Info',
      message,
      duration: 4000,
    });
  }, [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      dismissToast,
    }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
