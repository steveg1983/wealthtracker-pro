/**
 * Custom Hook for Accessibility Dashboard
 * Manages accessibility dashboard state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccessibilityAudit } from './useAccessibilityAudit';
import { accessibilityDashboardService } from '../services/accessibilityDashboardService';
import { commonCombinations } from '../utils/color-contrast-checker';
import type { ColorContrastResult, WCAGGuideline } from '../services/accessibilityDashboardService';
import { useLogger } from '../services/ServiceProvider';

export type TabType = 'overview' | 'issues' | 'colors' | 'guidelines';

export interface UseAccessibilityDashboardReturn {
  // Tab state
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  tabs: Array<{
    id: string;
    label: string;
    icon: string;
    count?: number;
  }>;
  
  // Audit data
  issues: any[];
  stats: any;
  isAuditing: boolean;
  lastAuditTime: Date | null;
  runAudit: () => void;
  
  // Dashboard data
  score: number;
  status: {
    label: string;
    color: 'green' | 'yellow' | 'red';
    message: string;
  };
  colorContrastResults: ColorContrastResult[];
  guidelines: WCAGGuideline[];
  testingTools: string[];
  
  // Actions
  generateReport: () => void;
  exportReport: () => void;
}

export function useAccessibilityDashboard(): UseAccessibilityDashboardReturn {
  const logger = useLogger();
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Use existing audit hook
  const { 
    issues, 
    stats, 
    runAudit, 
    isAuditing,
    lastAuditTime 
  } = useAccessibilityAudit({ autoAudit: true });
  
  // Dashboard specific state
  const [colorContrastResults, setColorContrastResults] = useState<ColorContrastResult[]>([]);
  const [guidelines] = useState<WCAGGuideline[]>(
    accessibilityDashboardService.getWCAGGuidelines()
  );
  const [testingTools] = useState<string[]>(
    accessibilityDashboardService.getTestingTools()
  );
  
  // Calculate score and status
  const score = accessibilityDashboardService.calculateScore(stats);
  const status = accessibilityDashboardService.getStatus(score);
  
  // Run color contrast analysis on mount
  useEffect(() => {
    const results = accessibilityDashboardService.analyzeColorContrast(commonCombinations);
    setColorContrastResults(results);
  }, []);
  
  // Generate tabs with counts
  const tabs = accessibilityDashboardService.getTabConfig().map(tab => ({
    ...tab,
    label: tab.showCount ? `${tab.label} (${stats.total})` : tab.label,
    count: tab.showCount ? stats.total : undefined
  }));
  
  // Generate report
  const generateReport = useCallback(() => {
    const report = accessibilityDashboardService.generateReport(
      stats,
      issues,
      colorContrastResults
    );
    
    // For now, just log it - could open in modal or new window
    logger.info('Accessibility Report:', report);
    
    // Trigger print dialog as a simple report generation
    window.print();
  }, [stats, issues, colorContrastResults]);
  
  // Export report to file
  const exportReport = useCallback(() => {
    const report = accessibilityDashboardService.generateReport(
      stats,
      issues,
      colorContrastResults
    );
    
    accessibilityDashboardService.exportReport(report);
  }, [stats, issues, colorContrastResults]);
  
  return {
    // Tab state
    activeTab,
    setActiveTab,
    tabs,
    
    // Audit data
    issues,
    stats,
    isAuditing,
    lastAuditTime,
    runAudit,
    
    // Dashboard data
    score,
    status,
    colorContrastResults,
    guidelines,
    testingTools,
    
    // Actions
    generateReport,
    exportReport
  };
}