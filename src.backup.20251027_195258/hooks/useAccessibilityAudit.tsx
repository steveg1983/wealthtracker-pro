/**
 * React Hook for Accessibility Auditing
 * Provides easy access to accessibility testing in components
 */

import { useState, useEffect, useCallback } from 'react';
import { AccessibilityTester } from '../utils/accessibility-testing';
import { logger } from '../services/loggingService';

interface UseAccessibilityAuditOptions {
  autoAudit?: boolean; // Run audit automatically on mount
  auditDelay?: number; // Delay before running audit (ms)
  rootElement?: HTMLElement | null;
}

export function useAccessibilityAudit(options: UseAccessibilityAuditOptions = {}) {
  const { autoAudit = false, auditDelay = 1000, rootElement } = options;
  const [issues, setIssues] = useState<ReturnType<typeof AccessibilityTester.audit>>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [lastAuditTime, setLastAuditTime] = useState<Date | null>(null);

  const runAudit = useCallback(() => {
    setIsAuditing(true);
    
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      const root = rootElement || document.body;
      const auditResults = AccessibilityTester.audit(root);
      setIssues(auditResults);
      setLastAuditTime(new Date());
      setIsAuditing(false);

      // Log results in development
      if (process.env.NODE_ENV === 'development') {
        console.group('🔍 Accessibility Audit Results');
        logger.info('Accessibility audit results', { issues: auditResults.length });
        
        const errors = auditResults.filter(i => i.type === 'error');
        const warnings = auditResults.filter(i => i.type === 'warning');
        
        if (errors.length > 0) {
          logger.error(`❌ ${errors.length} errors`);
          errors.forEach(error => {
            logger.error(`- ${error.message}`, error.element);
          });
        }
        
        if (warnings.length > 0) {
          logger.warn(`⚠️ ${warnings.length} warnings`);
          warnings.forEach(warning => {
            logger.warn(`- ${warning.message}`, warning.element);
          });
        }
        
        console.groupEnd();
      }
    }, auditDelay);
  }, [rootElement, auditDelay]);

  const clearIssues = useCallback(() => {
    setIssues([]);
  }, []);

  const getIssuesByCategory = useCallback((category: string) => {
    return issues.filter(issue => issue.category === category);
  }, [issues]);

  const getIssuesByType = useCallback((type: 'error' | 'warning') => {
    return issues.filter(issue => issue.type === type);
  }, [issues]);

  const generateReport = useCallback(() => {
    return AccessibilityTester.generateReport(issues);
  }, [issues]);

  // Auto audit on mount if enabled
  useEffect(() => {
    if (autoAudit) {
      runAudit();
    }
  }, [autoAudit, runAudit]);

  // Development mode: Add keyboard shortcut for manual audit
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Ctrl/Cmd + Shift + A for Accessibility audit
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
          e.preventDefault();
          logger.info('Running accessibility audit...');
          runAudit();
        }
      };

      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [runAudit]);

  return {
    issues,
    isAuditing,
    lastAuditTime,
    runAudit,
    clearIssues,
    getIssuesByCategory,
    getIssuesByType,
    generateReport,
    stats: {
      total: issues.length,
      errors: issues.filter(i => i.type === 'error').length,
      warnings: issues.filter(i => i.type === 'warning').length,
      byCategory: issues.reduce((acc, issue) => {
        acc[issue.category] = (acc[issue.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    }
  };
}
