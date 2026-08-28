/**
 * THE RULES ENGINE, WITH NOTHING AROUND IT.
 *
 * Lifted out of `importRulesService` on 28 August 2026, unchanged, because a
 * rule now has to be applied in two very different places: in the browser
 * during a CSV import, and on the SERVER while a bank feed is being synced.
 *
 * The service that used to own this logic also owned the storage it read
 * rules from, which is precisely why the server could never run it. Here the
 * rules arrive as an argument. That is the whole difference, and it is what
 * makes "the same rule behaves the same way whichever door a transaction came
 * in through" a property of the code rather than a hope.
 *
 * Nothing in this file may reach for storage, a network, or a clock.
 */
import type { ImportRule, ImportRuleCondition, ImportRuleAction, RuleTarget } from '../../types/importRules.js';

export interface TransactionWithSkip extends RuleTarget {
  __skip?: boolean;
}

export function checkCondition(condition: ImportRuleCondition, transaction: RuleTarget): boolean {
  let fieldValue: string | number | Date | null;
  
  switch (condition.field) {
    case 'description':
      fieldValue = transaction.description || '';
      break;
    case 'amount':
      fieldValue = Math.abs(transaction.amount || 0);
      break;
    case 'accountId':
      fieldValue = transaction.accountId || '';
      break;
    case 'date':
      fieldValue = transaction.date ? new Date(transaction.date) : null;
      break;
  }

  if (fieldValue === null || fieldValue === undefined) return false;

  switch (condition.operator) {
    case 'contains':
      if (typeof fieldValue !== 'string') return false;
      return condition.caseSensitive 
        ? fieldValue.includes(condition.value as string)
        : fieldValue.toLowerCase().includes((condition.value as string).toLowerCase());
    
    case 'equals':
      if (condition.field === 'amount' && typeof fieldValue === 'number') {
        return Math.abs(fieldValue - (condition.value as number)) < 0.01;
      }
      return condition.caseSensitive
        ? fieldValue === condition.value
        : fieldValue.toString().toLowerCase() === condition.value.toString().toLowerCase();
    
    case 'startsWith':
      if (typeof fieldValue !== 'string') return false;
      return condition.caseSensitive
        ? fieldValue.startsWith(condition.value as string)
        : fieldValue.toLowerCase().startsWith((condition.value as string).toLowerCase());
    
    case 'endsWith':
      if (typeof fieldValue !== 'string') return false;
      return condition.caseSensitive
        ? fieldValue.endsWith(condition.value as string)
        : fieldValue.toLowerCase().endsWith((condition.value as string).toLowerCase());
    
    case 'greaterThan':
      if (typeof fieldValue !== 'number') return false;
      return fieldValue > (condition.value as number);
    
    case 'lessThan':
      if (typeof fieldValue !== 'number') return false;
      return fieldValue < (condition.value as number);
    
    case 'between':
      if (typeof fieldValue !== 'number') return false;
      return fieldValue >= (condition.value as number) && 
             fieldValue <= (condition.value2 as number);
    
    case 'regex':
      if (typeof fieldValue !== 'string') return false;
      try {
        const regex = new RegExp(condition.value as string, condition.caseSensitive ? '' : 'i');
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    
    default:
      return false;
  }
}

export function applyAction(action: ImportRuleAction, transaction: RuleTarget): TransactionWithSkip {
  const result: TransactionWithSkip = { ...transaction };

  switch (action.type) {
    case 'setCategory':
      if (action.value) {
        result.category = action.value;
        // A rule is a standing instruction the user wrote themselves —
        // "anything matching TESCO is Groceries" — so the category it sets is
        // their decision, not the app guessing. It must also OVERRIDE a
        // suggestion the categoriser had already pencilled in, because rules
        // run last and win: leaving the row marked as a guess would ask the
        // user to re-confirm the rule they authored.
        result.categoryConfirmed = true;
      }
      break;
    
    case 'addTag':
      if (action.value) {
        result.tags = result.tags || [];
        if (!result.tags.includes(action.value)) {
          result.tags.push(action.value);
        }
      }
      break;
    
    case 'modifyDescription':
      if (result.description && action.modification) {
        switch (action.modification) {
          case 'replace':
            result.description = action.value || '';
            break;
          case 'prepend':
            result.description = (action.value || '') + result.description;
            break;
          case 'append':
            result.description = result.description + (action.value || '');
            break;
          case 'regex':
            if (action.pattern) {
              try {
                const regex = new RegExp(action.pattern, 'g');
                result.description = result.description.replace(regex, action.replacement || '');
              } catch {
                // Invalid regex, skip
              }
            }
            break;
        }
      }
      break;
    
    case 'setAccount':
      if (action.value) {
        result.accountId = action.value;
      }
      break;
    
    case 'skip':
      // Mark transaction to be skipped
      result.__skip = true;
      break;
  }

  return result;
}

export function applyRules<T extends RuleTarget>(
  transaction: T,
  rules: readonly ImportRule[]
): T | null {
  let result: TransactionWithSkip = { ...transaction };
  const enabledRules = rules
    .filter(rule => rule.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabledRules) {
    // Check if all conditions match
    const allConditionsMatch = rule.conditions.every(condition => 
      checkCondition(condition, result)
    );

    if (allConditionsMatch) {
      // Apply all actions
      for (const action of rule.actions) {
        result = applyAction(action, result);
        
        // If transaction should be skipped, return null
        if (result.__skip) {
          return null;
        }
      }
    }
  }

  // Remove temporary skip flag if it exists
  delete result.__skip;
  // Generic in, generic out: a caller keeps whatever shape it passed, which is
  // how one engine serves a CSV row (the app's Transaction) and a feed row
  // (database columns) without either learning about the other.
  return result as T;
}
