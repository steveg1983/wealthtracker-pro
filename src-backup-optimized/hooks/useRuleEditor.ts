/**
 * Custom Hook for Rule Editor
 * Manages rule form state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { ruleEditorService, type RuleFormData } from '../services/ruleEditorService';
import type { ImportRule, ImportRuleCondition, ImportRuleAction } from '../types/importRules';

export interface UseRuleEditorReturn {
  formData: RuleFormData;
  setFormData: (data: RuleFormData) => void;
  addCondition: () => void;
  updateCondition: (index: number, condition: Partial<ImportRuleCondition>) => void;
  removeCondition: (index: number) => void;
  addAction: () => void;
  updateAction: (index: number, action: Partial<ImportRuleAction>) => void;
  removeAction: (index: number) => void;
  handleSubmit: () => boolean;
  updateField: (field: keyof RuleFormData, value: any) => void;
}

export function useRuleEditor(
  rule: Partial<ImportRule> | null,
  onSave: (rule: Partial<ImportRule>) => void
): UseRuleEditorReturn {
  const [formData, setFormData] = useState<RuleFormData>(
    ruleEditorService.getDefaultFormData(rule)
  );

  // Sync form data when rule prop changes
  useEffect(() => {
    setFormData(ruleEditorService.getDefaultFormData(rule));
  }, [rule]);

  // Add a new condition
  const addCondition = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        ruleEditorService.createDefaultCondition()
      ]
    }));
  }, []);

  // Update a condition
  const updateCondition = useCallback((
    index: number,
    condition: Partial<ImportRuleCondition>
  ) => {
    setFormData(prev => ({
      ...prev,
      conditions: ruleEditorService.updateConditionAtIndex(
        prev.conditions,
        index,
        condition
      )
    }));
  }, []);

  // Remove a condition
  const removeCondition = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: ruleEditorService.removeAtIndex(prev.conditions, index)
    }));
  }, []);

  // Add a new action
  const addAction = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      actions: [
        ...prev.actions,
        ruleEditorService.createDefaultAction()
      ]
    }));
  }, []);

  // Update an action
  const updateAction = useCallback((
    index: number,
    action: Partial<ImportRuleAction>
  ) => {
    setFormData(prev => ({
      ...prev,
      actions: ruleEditorService.updateActionAtIndex(
        prev.actions,
        index,
        action
      )
    }));
  }, []);

  // Remove an action
  const removeAction = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: ruleEditorService.removeAtIndex(prev.actions, index)
    }));
  }, []);

  // Update a single field
  const updateField = useCallback((field: keyof RuleFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const validation = ruleEditorService.validateRule(formData);
    
    if (!validation.isValid) {
      alert(validation.errors.join('\n'));
      return false;
    }
    
    onSave(formData);
    return true;
  }, [formData, onSave]);

  return {
    formData,
    setFormData,
    addCondition,
    updateCondition,
    removeCondition,
    addAction,
    updateAction,
    removeAction,
    handleSubmit,
    updateField
  };
}