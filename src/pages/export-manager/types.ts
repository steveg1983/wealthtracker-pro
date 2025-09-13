import type { ExportOptions } from '../../services/export';

export type ActiveTab = 'export' | 'templates' | 'scheduled' | 'history';

export interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  options: ExportOptions;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledReport {
  id: string;
  name: string;
  email: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  options: ExportOptions;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportHistory {
  id: string;
  fileName: string;
  format: string;
  size: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  exportedAt: Date;
  exportedBy?: string;
}