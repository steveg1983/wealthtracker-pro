import type { Middleware, Dispatch, AnyAction } from '@reduxjs/toolkit';
import { syncService } from '../../services/syncService';
import type { SyncEventPayload, EntityType, SyncData, SyncOperation } from '../../types/sync-types';
import { logger } from '../../services/loggingService';

// Action types to sync
const SYNC_ACTIONS = {
  // Transactions
  'transactions/add': { entity: 'transaction', type: 'CREATE' },
  'transactions/update': { entity: 'transaction', type: 'UPDATE' },
  'transactions/delete': { entity: 'transaction', type: 'DELETE' },
  'transactions/addTransaction': { entity: 'transaction', type: 'CREATE' },
  'transactions/updateTransaction': { entity: 'transaction', type: 'UPDATE' },
  'transactions/deleteTransaction': { entity: 'transaction', type: 'DELETE' },
  
  // Accounts
  'accounts/add': { entity: 'account', type: 'CREATE' },
  'accounts/update': { entity: 'account', type: 'UPDATE' },
  'accounts/delete': { entity: 'account', type: 'DELETE' },
  'accounts/addAccount': { entity: 'account', type: 'CREATE' },
  'accounts/updateAccount': { entity: 'account', type: 'UPDATE' },
  'accounts/deleteAccount': { entity: 'account', type: 'DELETE' },
  
  // Budgets
  'budgets/add': { entity: 'budget', type: 'CREATE' },
  'budgets/update': { entity: 'budget', type: 'UPDATE' },
  'budgets/delete': { entity: 'budget', type: 'DELETE' },
  'budgets/setBudget': { entity: 'budget', type: 'UPDATE' },
  
  // Goals
  'goals/add': { entity: 'goal', type: 'CREATE' },
  'goals/update': { entity: 'goal', type: 'UPDATE' },
  'goals/delete': { entity: 'goal', type: 'DELETE' },
  'goals/addGoal': { entity: 'goal', type: 'CREATE' },
  'goals/updateGoal': { entity: 'goal', type: 'UPDATE' },
  'goals/deleteGoal': { entity: 'goal', type: 'DELETE' },
  
  // Categories
  'categories/add': { entity: 'category', type: 'CREATE' },
  'categories/update': { entity: 'category', type: 'UPDATE' },
  'categories/delete': { entity: 'category', type: 'DELETE' },
} as const;

// Actions to ignore (fetched from server, not local changes)
const IGNORE_ACTIONS = [
  'transactions/setTransactions',
  'accounts/setAccounts',
  'budgets/setBudgets',
  'goals/setGoals',
  'categories/setCategories',
  // Add any bulk set operations that come from server
];

export const syncMiddleware: Middleware = (store) => (next) => (action: unknown) => {
  const typedAction = action as AnyAction;
  // Execute the action first
  const result = next(action);

  // Check if this action should be synced
  const actionType = typedAction.type;
  
  // Ignore bulk set operations (usually from server)
  if (IGNORE_ACTIONS.includes(actionType)) {
    return result;
  }
  
  // Check if this is a syncable action
  const syncConfig = SYNC_ACTIONS[actionType as keyof typeof SYNC_ACTIONS];
  
  if (syncConfig) {
    try {
      // Extract entity ID and data from the action
      let entityId: string | undefined;
      let data: SyncData<EntityType> = {} as SyncData<EntityType>;
      
      // Handle different action payload structures
      if (typedAction.payload) {
        if (typeof typedAction.payload === 'object') {
          // Most actions have an id field
          entityId = typedAction.payload.id || typedAction.payload.entityId;
          
          // For delete actions, we might only have the ID
          if (syncConfig.type === 'DELETE') {
            entityId = typeof typedAction.payload === 'string' ? typedAction.payload : typedAction.payload.id;
            data = {} as SyncData<EntityType>; // Use empty object instead of null
          } else {
            // For create/update, send the full payload
            data = typedAction.payload;
          }
        } else if (typeof typedAction.payload === 'string') {
          // Some delete actions just pass the ID as a string
          entityId = typedAction.payload;
          data = {} as SyncData<EntityType>; // Use empty object instead of null
        }
      }
      
      // Queue the sync operation if we have an entity ID
      if (entityId) {
        syncService.queueOperation(
          syncConfig.type as 'CREATE' | 'UPDATE' | 'DELETE',
          syncConfig.entity as any,
          entityId,
          data
        );
      }
    } catch (error) {
      logger.error('Failed to queue sync operation:', error);
    }
  }
  
  return result;
};

// Helper to handle incoming sync updates
export const handleRemoteSyncUpdate = <T extends EntityType>(
  dispatch: Dispatch<AnyAction>,
  event: SyncEventPayload<T> & { type: string }
) => {
  const { entity, entityId, data, type } = event;
  
  // Dispatch appropriate action based on entity and type
  switch (entity) {
    case 'transaction':
      switch (type) {
        case 'CREATE':
          dispatch({ type: 'transactions/addTransaction', payload: data });
          break;
        case 'UPDATE':
          dispatch({ type: 'transactions/updateTransaction', payload: { ...data, id: entityId } });
          break;
        case 'DELETE':
          dispatch({ type: 'transactions/deleteTransaction', payload: entityId });
          break;
      }
      break;
      
    case 'account':
      switch (type) {
        case 'CREATE':
          dispatch({ type: 'accounts/addAccount', payload: data });
          break;
        case 'UPDATE':
          dispatch({ type: 'accounts/updateAccount', payload: { ...data, id: entityId } });
          break;
        case 'DELETE':
          dispatch({ type: 'accounts/deleteAccount', payload: entityId });
          break;
      }
      break;
      
    case 'budget':
      switch (type) {
        case 'CREATE':
        case 'UPDATE':
          dispatch({ type: 'budgets/setBudget', payload: data });
          break;
        case 'DELETE':
          dispatch({ type: 'budgets/deleteBudget', payload: entityId });
          break;
      }
      break;
      
    case 'goal':
      switch (type) {
        case 'CREATE':
          dispatch({ type: 'goals/addGoal', payload: data });
          break;
        case 'UPDATE':
          dispatch({ type: 'goals/updateGoal', payload: { ...data, id: entityId } });
          break;
        case 'DELETE':
          dispatch({ type: 'goals/deleteGoal', payload: entityId });
          break;
      }
      break;
      
    case 'category':
      switch (type) {
        case 'CREATE':
          dispatch({ type: 'categories/addCategory', payload: data });
          break;
        case 'UPDATE':
          dispatch({ type: 'categories/updateCategory', payload: { ...data, id: entityId } });
          break;
        case 'DELETE':
          dispatch({ type: 'categories/deleteCategory', payload: entityId });
          break;
      }
      break;
  }
};

// Initialize sync listeners when store is created
export const initializeSyncListeners = (dispatch: Dispatch<AnyAction>) => {
  // Listen for remote updates
  syncService.on('remote-create', (event: SyncEventPayload) => {
    handleRemoteSyncUpdate(dispatch, { ...event, type: 'CREATE' });
  });
  
  syncService.on('remote-update', (event: SyncEventPayload) => {
    handleRemoteSyncUpdate(dispatch, { ...event, type: 'UPDATE' });
  });
  
  syncService.on('remote-delete', (event: SyncEventPayload) => {
    handleRemoteSyncUpdate(dispatch, { ...event, type: 'DELETE' });
  });
  
  syncService.on('remote-merge', (event: SyncEventPayload) => {
    handleRemoteSyncUpdate(dispatch, { ...event, type: 'UPDATE' });
  });
  
  // Handle sync failures
  syncService.on('sync-failed', (operation: SyncOperation) => {
    logger.error('Sync operation failed:', operation);
    // Could dispatch an action to show error to user
    dispatch({ 
      type: 'ui/showNotification', 
      payload: {
        type: 'error',
        message: `Failed to sync ${operation.entity}. Changes saved locally.`
      }
    });
  });
};