import type { Bill } from './types';

export const billUtils = {
  getDaysUntilDue(dueDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  },

  getStatusColor(bill: Bill): string {
    const daysUntil = this.getDaysUntilDue(bill.nextDueDate);
    
    if (daysUntil < 0) return 'text-red-600 dark:text-red-400';
    if (daysUntil <= bill.reminderDays) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  },

  getStatusText(bill: Bill): string {
    const daysUntil = this.getDaysUntilDue(bill.nextDueDate);
    
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    if (daysUntil === 0) return 'Due today';
    if (daysUntil === 1) return 'Due tomorrow';
    return `Due in ${daysUntil} days`;
  }
};