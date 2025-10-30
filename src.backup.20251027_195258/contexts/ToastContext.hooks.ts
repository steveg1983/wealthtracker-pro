import { useContext } from 'react';
import { ToastContext } from './ToastContext.context';
import type { ToastContextType } from './ToastContext.types';

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
