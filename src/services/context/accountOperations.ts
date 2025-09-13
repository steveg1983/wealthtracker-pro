import { DataService } from '../api/dataService';
import * as SimpleAccountService from '../api/simpleAccountService';
import { logger } from '../loggingService';
import type { Account } from '../../types';

export class AccountOperations {
  static async addAccount(
    account: Omit<Account, 'id' | 'balance'>, 
    userId?: string
  ): Promise<Account> {
    try {
      // DataService doesn't have addAccount, use SimpleAccountService instead
      const newAccount = await SimpleAccountService.createAccount(userId || '', account as any);
      logger.debug('[AccountOps] Account added:', { id: newAccount.id });
      return newAccount;
    } catch (error) {
      logger.error('[AccountOps] Failed to add account:', error);
      throw error;
    }
  }

  static async updateAccount(
    id: string, 
    updates: Partial<Account>,
    userId?: string
  ): Promise<Account> {
    try {
      if (userId) {
        const updatedAccount = await SimpleAccountService.updateAccount(id, updates);
        logger.debug('[AccountOps] Account updated via SimpleAccountService:', { id });
        return updatedAccount;
      } else {
        const updatedAccount = await DataService.updateAccount(id, updates);
        logger.debug('[AccountOps] Account updated via DataService:', { id });
        return updatedAccount;
      }
    } catch (error) {
      logger.error('[AccountOps] Failed to update account:', error);
      throw error;
    }
  }

  static async deleteAccount(
    id: string,
    userId?: string
  ): Promise<void> {
    try {
      if (userId) {
        await SimpleAccountService.deleteAccount(id);
        logger.debug('[AccountOps] Account soft-deleted via SimpleAccountService:', { id });
      } else {
        await DataService.deleteAccount(id);
        logger.debug('[AccountOps] Account deleted via DataService:', { id });
      }
    } catch (error) {
      logger.error('[AccountOps] Failed to delete account:', error);
      throw error;
    }
  }

  static async getAccounts(userId: string): Promise<Account[]> {
    try {
      const accounts = await SimpleAccountService.getAccounts(userId);
      logger.debug('[AccountOps] Accounts loaded:', { count: accounts.length });
      return accounts;
    } catch (error) {
      logger.error('[AccountOps] Failed to get accounts:', error);
      throw error;
    }
  }

  static async subscribeToUpdates(
    userId: string,
    onUpdate: (payload: any) => void
  ): Promise<() => void> {
    try {
      const unsubscribe = await SimpleAccountService.subscribeToAccountChanges(userId, onUpdate);
      logger.debug('[AccountOps] Subscribed to account updates');
      return unsubscribe;
    } catch (error) {
      logger.error('[AccountOps] Failed to subscribe to updates:', error);
      throw error;
    }
  }
}