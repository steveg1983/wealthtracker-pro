import type { ExportOptions } from '../exportService';
import { logger } from '../loggingService';

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  email: string;
  options: ExportOptions;
  nextRun: Date;
  isActive: boolean;
  createdAt: Date;
  lastRun?: Date;
}

/**
 * Enterprise-grade service for managing scheduled reports
 * Follows Single Responsibility Principle - only handles scheduled report management
 */
export class ScheduledReportService {
  private scheduledReports: ScheduledReport[] = [];
  private readonly STORAGE_KEY = 'scheduled_reports';

  constructor() {
    this.loadReports();
  }

  /**
   * Load scheduled reports from localStorage
   */
  private loadReports(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.scheduledReports = data.scheduledReports || [];
        // Convert date strings back to Date objects
        this.scheduledReports = this.scheduledReports.map(report => ({
          ...report,
          createdAt: new Date(report.createdAt),
          nextRun: new Date(report.nextRun),
          lastRun: report.lastRun ? new Date(report.lastRun) : undefined,
          options: {
            ...report.options,
            startDate: new Date(report.options.startDate),
            endDate: new Date(report.options.endDate)
          }
        }));
      }
    } catch (error) {
      logger.error('Failed to load scheduled reports:', error);
      this.scheduledReports = [];
    }
  }

  /**
   * Save scheduled reports to localStorage
   */
  private saveReports(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        scheduledReports: this.scheduledReports
      }));
    } catch (error) {
      logger.error('Failed to save scheduled reports:', error);
    }
  }

  /**
   * Get all scheduled reports
   */
  getScheduledReports(): ScheduledReport[] {
    return [...this.scheduledReports];
  }

  /**
   * Get scheduled report by ID
   */
  getScheduledReport(id: string): ScheduledReport | null {
    return this.scheduledReports.find(r => r.id === id) || null;
  }

  /**
   * Create a new scheduled report
   */
  createScheduledReport(report: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>): ScheduledReport {
    const newReport: ScheduledReport = {
      ...report,
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      nextRun: this.calculateNextRun(report.frequency)
    };
    
    this.scheduledReports.push(newReport);
    this.saveReports();
    logger.info('Created scheduled report:', newReport.name);
    
    return newReport;
  }

  /**
   * Update an existing scheduled report
   */
  updateScheduledReport(id: string, updates: Partial<ScheduledReport>): ScheduledReport | null {
    const index = this.scheduledReports.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    const updatedReport = { 
      ...this.scheduledReports[index], 
      ...updates, 
      id 
    };
    
    // Recalculate next run if frequency changed
    if (updates.frequency && updates.frequency !== this.scheduledReports[index].frequency) {
      updatedReport.nextRun = this.calculateNextRun(updates.frequency);
    }
    
    this.scheduledReports[index] = updatedReport;
    this.saveReports();
    logger.info('Updated scheduled report:', id);
    
    return this.scheduledReports[index];
  }

  /**
   * Delete a scheduled report
   */
  deleteScheduledReport(id: string): boolean {
    const initialLength = this.scheduledReports.length;
    this.scheduledReports = this.scheduledReports.filter(r => r.id !== id);
    
    if (this.scheduledReports.length < initialLength) {
      this.saveReports();
      logger.info('Deleted scheduled report:', id);
      return true;
    }
    
    return false;
  }

  /**
   * Calculate next run date based on frequency
   */
  private calculateNextRun(frequency: ScheduledReport['frequency']): Date {
    const now = new Date();
    const next = new Date(now);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(9, 0, 0, 0); // 9 AM
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        next.setHours(9, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(9, 0, 0, 0);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        next.setDate(1);
        next.setHours(9, 0, 0, 0);
        break;
    }
    
    return next;
  }

  /**
   * Get reports that are due to run
   */
  getDueReports(): ScheduledReport[] {
    const now = new Date();
    return this.scheduledReports.filter(report => 
      report.isActive && report.nextRun <= now
    );
  }

  /**
   * Mark report as run and calculate next run
   */
  markReportAsRun(id: string): void {
    const report = this.scheduledReports.find(r => r.id === id);
    if (report) {
      report.lastRun = new Date();
      report.nextRun = this.calculateNextRun(report.frequency);
      this.saveReports();
      logger.info('Marked report as run:', id);
    }
  }

  /**
   * Toggle report active status
   */
  toggleReportStatus(id: string): boolean {
    const report = this.scheduledReports.find(r => r.id === id);
    if (report) {
      report.isActive = !report.isActive;
      this.saveReports();
      logger.info(`Report ${id} is now ${report.isActive ? 'active' : 'inactive'}`);
      return true;
    }
    return false;
  }

  /**
   * Get active reports count
   */
  getActiveReportsCount(): number {
    return this.scheduledReports.filter(r => r.isActive).length;
  }
}

export const scheduledReportService = new ScheduledReportService();