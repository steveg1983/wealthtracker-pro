/**
 * Rule Editor Service
 * Business logic for import rule management
 */

import type { ImportRule, ImportRuleCondition, ImportRuleAction } from '../types/importRules';

export interface RuleFormData extends Partial<ImportRule> {
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: ImportRuleCondition[];
  actions: ImportRuleAction[];
}

class RuleEditorService {
  /**
   * Get default form data
   */
  getDefaultFormData(rule?: Partial<ImportRule> | null): RuleFormData {
    return {
      name: '',
      description: '',
      enabled: true,
      priority: 1,
      conditions: [],
      actions: [],
      ...rule
    };
  }

  /**
   * Create a new condition with defaults
   */
  createDefaultCondition(): ImportRuleCondition {
    return {
      field: 'description',
      operator: 'contains',
      value: '',
      caseSensitive: false
    };
  }

  /**
   * Create a new action with defaults
   */
  createDefaultAction(): ImportRuleAction {
    return {
      type: 'setCategory',
      value: ''
    };
  }

  /**
   * Get available condition fields
   */
  getConditionFields() {
    return [
      { value: 'description', label: 'Description' },
      { value: 'amount', label: 'Amount' },
      { value: 'merchant', label: 'Merchant' }
    ];
  }

  /**
   * Get operators for a field type
   */
  getOperatorsForField(field: string) {
    if (field === 'amount') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'Greater than' },
        { value: 'less_than', label: 'Less than' },
        { value: 'between', label: 'Between' }
      ];
    }
    
    return [
      { value: 'contains', label: 'Contains' },
      { value: 'starts_with', label: 'Starts with' },
      { value: 'ends_with', label: 'Ends with' },
      { value: 'equals', label: 'Equals' },
      { value: 'matches_regex', label: 'Matches pattern' }
    ];
  }

  /**
   * Get available action types
   */
  getActionTypes() {
    return [
      { value: 'setCategory', label: 'Set Category' },
      { value: 'setAccount', label: 'Set Account' },
      { value: 'addTag', label: 'Add Tag' },
      { value: 'setMerchant', label: 'Set Merchant' },
      { value: 'skip', label: 'Skip Transaction' }
    ];
  }

  /**
   * Validate rule form data
   */
  validateRule(formData: RuleFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!formData.name?.trim()) {
      errors.push('Rule name is required');
    }

    if (!formData.conditions?.length) {
      errors.push('At least one condition is required');
    }

    if (!formData.actions?.length) {
      errors.push('At least one action is required');
    }

    // Validate conditions
    formData.conditions?.forEach((condition, index) => {
      const valueStr = String(condition.value || '');
      if (!valueStr.trim() && condition.operator !== 'between') {
        errors.push(`Condition ${index + 1}: Value is required`);
      }
      
      const value2Str = String(condition.value2 || '');
      if (condition.operator === 'between' && !value2Str.trim()) {
        errors.push(`Condition ${index + 1}: Max value is required for 'between' operator`);
      }
    });

    // Validate actions
    formData.actions?.forEach((action, index) => {
      if (action.type !== 'skip' && !action.value?.trim()) {
        errors.push(`Action ${index + 1}: Value is required`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update condition at index
   */
  updateConditionAtIndex(
    conditions: ImportRuleCondition[],
    index: number,
    update: Partial<ImportRuleCondition>
  ): ImportRuleCondition[] {
    return conditions.map((c, i) => 
      i === index ? { ...c, ...update } : c
    );
  }

  /**
   * Update action at index
   */
  updateActionAtIndex(
    actions: ImportRuleAction[],
    index: number,
    update: Partial<ImportRuleAction>
  ): ImportRuleAction[] {
    return actions.map((a, i) => 
      i === index ? { ...a, ...update } : a
    );
  }

  /**
   * Remove item at index from array
   */
  removeAtIndex<T>(items: T[], index: number): T[] {
    return items.filter((_, i) => i !== index);
  }

  /**
   * Get input type for condition field
   */
  getInputTypeForField(field: string): string {
    return field === 'amount' ? 'number' : 'text';
  }

  /**
   * Check if operator requires second value
   */
  requiresSecondValue(operator: string): boolean {
    return operator === 'between';
  }

  /**
   * Get placeholder for action value
   */
  getActionPlaceholder(actionType: string): string {
    switch (actionType) {
      case 'add_tag':
        return 'Tag name';
      case 'set_merchant':
        return 'Merchant name';
      default:
        return 'Value';
    }
  }
}

export const ruleEditorService = new RuleEditorService();
