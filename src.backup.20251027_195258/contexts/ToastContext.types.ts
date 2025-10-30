import type { ToastMessage } from '../components/common/Toast';

export type ToastInput = Omit<ToastMessage, 'id'> & { id?: string };

export interface ToastContextType {
  showToast: (message: ToastInput) => string;
  showSuccess: (message: string, title?: string) => string;
  showError: (error: unknown) => string;
  showWarning: (message: string, title?: string) => string;
  showInfo: (message: string, title?: string) => string;
  dismissToast: (id: string) => void;
}
