import { Transaction, Account, Budget, Goal } from '../types';
import { toDecimal, Decimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';

export interface HouseholdMember {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: Permission[];
  joinedAt: Date;
  lastActive?: Date;
  isActive: boolean;
  avatar?: string;
}

export interface Household {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  ownerId: string;
  members: HouseholdMember[];
  sharedAccounts: string[];
  sharedBudgets: string[];
  settings: HouseholdSettings;
}

export interface Permission {
  resource: 'accounts' | 'transactions' | 'budgets' | 'goals' | 'reports' | 'settings';
  actions: ('view' | 'create' | 'edit' | 'delete')[];
}

export interface HouseholdSettings {
  allowExpenseSplitting: boolean;
  defaultSplitMethod: 'equal' | 'custom' | 'percentage';
  requireApprovalForExpenses: boolean;
  expenseApprovalThreshold: number;
  currency: string;
  timezone: string;
}

export interface ExpenseSplit {
  id: string;
  transactionId: string;
  totalAmount: DecimalInstance;
  currency: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  splits: ExpenseSplitMember[];
  status: 'pending' | 'approved' | 'settled';
  settledAt?: Date;
}

export interface ExpenseSplitMember {
  memberId: string;
  memberName: string;
  amount: DecimalInstance;
  percentage?: number;
  isPaid: boolean;
  paidAt?: Date;
  notes?: string;
}

export interface Settlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: DecimalInstance;
  currency: string;
  description: string;
  relatedSplits: string[];
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface JointBudget extends Budget {
  householdId: string;
  assignedMembers: string[];
  approvedBy: string[];
  needsApproval: boolean;
}

export interface CollaborationActivity {
  id: string;
  householdId: string;
  memberId: string;
  memberName: string;
  action: 'joined' | 'left' | 'added_expense' | 'split_expense' | 'settled_expense' | 'created_budget' | 'modified_budget';
  resourceType?: 'transaction' | 'budget' | 'split' | 'settlement';
  resourceId?: string;
  description: string;
  timestamp: Date;
}

const HOUSEHOLDS_KEY = 'households';
const CURRENT_HOUSEHOLD_KEY = 'current_household';
const EXPENSE_SPLITS_KEY = 'expense_splits';
const SETTLEMENTS_KEY = 'settlements';
const COLLABORATION_ACTIVITY_KEY = 'collaboration_activity';

const DEFAULT_PERMISSIONS: Permission[] = [
  { resource: 'accounts', actions: ['view'] },
  { resource: 'transactions', actions: ['view', 'create'] },
  { resource: 'budgets', actions: ['view'] },
  { resource: 'goals', actions: ['view'] },
  { resource: 'reports', actions: ['view'] }
];

class CollaborationService {
  private households: Household[] = [];
  private currentHouseholdId: string | null = null;
  private expenseSplits: ExpenseSplit[] = [];
  private settlements: Settlement[] = [];
  private activities: CollaborationActivity[] = [];

  constructor() {
    this.loadData();
  }

  private loadData() {
    // Load households
    const householdsData = localStorage.getItem(HOUSEHOLDS_KEY);
    if (householdsData) {
      this.households = JSON.parse(householdsData);
    }

    // Load current household
    this.currentHouseholdId = localStorage.getItem(CURRENT_HOUSEHOLD_KEY);

    // Load expense splits
    const splitsData = localStorage.getItem(EXPENSE_SPLITS_KEY);
    if (splitsData) {
      this.expenseSplits = JSON.parse(splitsData);
    }

    // Load settlements
    const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
    if (settlementsData) {
      this.settlements = JSON.parse(settlementsData);
    }

    // Load activities
    const activitiesData = localStorage.getItem(COLLABORATION_ACTIVITY_KEY);
    if (activitiesData) {
      this.activities = JSON.parse(activitiesData);
    }
  }

  private saveData() {
    localStorage.setItem(HOUSEHOLDS_KEY, JSON.stringify(this.households));
    localStorage.setItem(EXPENSE_SPLITS_KEY, JSON.stringify(this.expenseSplits));
    localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(this.settlements));
    localStorage.setItem(COLLABORATION_ACTIVITY_KEY, JSON.stringify(this.activities));
    
    if (this.currentHouseholdId) {
      localStorage.setItem(CURRENT_HOUSEHOLD_KEY, this.currentHouseholdId);
    }
  }

  // Household Management
  createHousehold(name: string, description?: string): Household {
    const household: Household = {
      id: this.generateId(),
      name,
      description,
      createdAt: new Date(),
      ownerId: 'current-user',
      members: [{
        id: 'current-user',
        email: 'user@example.com',
        name: 'Current User',
        role: 'owner',
        permissions: this.getAllPermissions(),
        joinedAt: new Date(),
        isActive: true
      }],
      sharedAccounts: [],
      sharedBudgets: [],
      settings: {
        allowExpenseSplitting: true,
        defaultSplitMethod: 'equal',
        requireApprovalForExpenses: false,
        expenseApprovalThreshold: 100,
        currency: 'USD',
        timezone: 'America/New_York'
      }
    };

    this.households.push(household);
    this.currentHouseholdId = household.id;
    this.saveData();

    this.logActivity('joined', 'Current User', 'Created household');
    return household;
  }

  getHouseholds(): Household[] {
    return [...this.households];
  }

  getCurrentHousehold(): Household | null {
    if (!this.currentHouseholdId) return null;
    return this.households.find(h => h.id === this.currentHouseholdId) || null;
  }

  switchHousehold(householdId: string): boolean {
    const household = this.households.find(h => h.id === householdId);
    if (household) {
      this.currentHouseholdId = householdId;
      localStorage.setItem(CURRENT_HOUSEHOLD_KEY, householdId);
      return true;
    }
    return false;
  }

  // Member Management
  inviteMember(email: string, role: HouseholdMember['role'] = 'member'): HouseholdMember | null {
    const household = this.getCurrentHousehold();
    if (!household) return null;

    // Check if member already exists
    if (household.members.some(m => m.email === email)) {
      throw new Error('Member already exists in household');
    }

    const member: HouseholdMember = {
      id: this.generateId(),
      email,
      name: email.split('@')[0], // Use email prefix as default name
      role,
      permissions: role === 'owner' ? this.getAllPermissions() : DEFAULT_PERMISSIONS,
      joinedAt: new Date(),
      isActive: true
    };

    household.members.push(member);
    this.saveData();

    this.logActivity('joined', member.name, `Invited to household as ${role}`);
    return member;
  }

  updateMemberRole(memberId: string, role: HouseholdMember['role']): boolean {
    const household = this.getCurrentHousehold();
    if (!household) return false;

    const member = household.members.find(m => m.id === memberId);
    if (!member || member.role === 'owner') return false;

    member.role = role;
    member.permissions = role === 'admin' ? this.getAllPermissions() : DEFAULT_PERMISSIONS;
    this.saveData();

    this.logActivity('modified_budget', member.name, `Role changed to ${role}`);
    return true;
  }

  removeMember(memberId: string): boolean {
    const household = this.getCurrentHousehold();
    if (!household) return false;

    const memberIndex = household.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1 || household.members[memberIndex].role === 'owner') return false;

    const member = household.members[memberIndex];
    household.members.splice(memberIndex, 1);
    this.saveData();

    this.logActivity('left', member.name, 'Removed from household');
    return true;
  }

  // Expense Splitting
  createExpenseSplit(
    transactionId: string,
    totalAmount: DecimalInstance,
    description: string,
    splitMethod: 'equal' | 'custom' | 'percentage',
    customSplits?: { memberId: string; amount?: DecimalInstance; percentage?: number }[]
  ): ExpenseSplit | null {
    const household = this.getCurrentHousehold();
    if (!household) return null;

    const activeMembers = household.members.filter(m => m.isActive);
    let splits: ExpenseSplitMember[];

    if (splitMethod === 'equal') {
      const equalAmount = totalAmount.dividedBy(activeMembers.length);
      splits = activeMembers.map(member => ({
        memberId: member.id,
        memberName: member.name,
        amount: equalAmount,
        isPaid: member.id === 'current-user', // Assume current user paid
        paidAt: member.id === 'current-user' ? new Date() : undefined
      }));
    } else if (splitMethod === 'custom' && customSplits) {
      splits = customSplits.map(split => {
        const member = household.members.find(m => m.id === split.memberId);
        return {
          memberId: split.memberId,
          memberName: member?.name || 'Unknown',
          amount: split.amount || toDecimal(0),
          isPaid: split.memberId === 'current-user',
          paidAt: split.memberId === 'current-user' ? new Date() : undefined
        };
      });
    } else if (splitMethod === 'percentage' && customSplits) {
      splits = customSplits.map(split => {
        const member = household.members.find(m => m.id === split.memberId);
        const amount = totalAmount.times(split.percentage || 0).dividedBy(100);
        return {
          memberId: split.memberId,
          memberName: member?.name || 'Unknown',
          amount,
          percentage: split.percentage,
          isPaid: split.memberId === 'current-user',
          paidAt: split.memberId === 'current-user' ? new Date() : undefined
        };
      });
    } else {
      return null;
    }

    const expenseSplit: ExpenseSplit = {
      id: this.generateId(),
      transactionId,
      totalAmount,
      currency: household.settings.currency,
      description,
      createdBy: 'current-user',
      createdAt: new Date(),
      splits,
      status: 'pending'
    };

    this.expenseSplits.push(expenseSplit);
    this.saveData();

    this.logActivity('split_expense', 'Current User', `Split expense: ${description}`);
    return expenseSplit;
  }

  getExpenseSplits(householdId?: string): ExpenseSplit[] {
    // For now, return all splits (in a real app, filter by household)
    return [...this.expenseSplits];
  }

  markSplitAsPaid(splitId: string, memberId: string): boolean {
    const split = this.expenseSplits.find(s => s.id === splitId);
    if (!split) return false;

    const member = split.splits.find(s => s.memberId === memberId);
    if (!member) return false;

    member.isPaid = true;
    member.paidAt = new Date();

    // Check if all splits are paid
    if (split.splits.every(s => s.isPaid)) {
      split.status = 'settled';
      split.settledAt = new Date();
    }

    this.saveData();
    this.logActivity('settled_expense', member.memberName, `Paid ${member.amount} for ${split.description}`);
    return true;
  }

  // Settlement Management
  calculateSettlements(): Settlement[] {
    const household = this.getCurrentHousehold();
    if (!household) return [];

    const memberBalances = new Map<string, DecimalInstance>();
    
    // Initialize balances
    household.members.forEach(member => {
      memberBalances.set(member.id, toDecimal(0));
    });

    // Calculate balances from unpaid splits
    this.expenseSplits.forEach(split => {
      split.splits.forEach(s => {
        if (!s.isPaid) {
          const currentBalance = memberBalances.get(s.memberId) || toDecimal(0);
          memberBalances.set(s.memberId, currentBalance.minus(s.amount));
        }
      });
    });

    // Create settlements
    const settlements: Settlement[] = [];
    const debtors = Array.from(memberBalances.entries())
      .filter(([_, balance]) => balance.lessThan(0))
      .map(([id, balance]) => ({ id, balance: balance.abs() }));
    
    const creditors = Array.from(memberBalances.entries())
      .filter(([_, balance]) => balance.greaterThan(0))
      .map(([id, balance]) => ({ id, balance }));

    // Simple settlement algorithm
    debtors.forEach(debtor => {
      creditors.forEach(creditor => {
        if (debtor.balance.greaterThan(0) && creditor.balance.greaterThan(0)) {
          const settlementAmount = Decimal.min(debtor.balance, creditor.balance);
          
          const settlement: Settlement = {
            id: this.generateId(),
            fromMemberId: debtor.id,
            toMemberId: creditor.id,
            amount: settlementAmount,
            currency: household.settings.currency,
            description: 'Settlement payment',
            relatedSplits: [],
            status: 'pending',
            createdAt: new Date()
          };

          settlements.push(settlement);
          debtor.balance = debtor.balance.minus(settlementAmount);
          creditor.balance = creditor.balance.minus(settlementAmount);
        }
      });
    });

    return settlements;
  }

  createSettlement(fromMemberId: string, toMemberId: string, amount: DecimalInstance): Settlement | null {
    const household = this.getCurrentHousehold();
    if (!household) return null;

    const settlement: Settlement = {
      id: this.generateId(),
      fromMemberId,
      toMemberId,
      amount,
      currency: household.settings.currency,
      description: 'Manual settlement',
      relatedSplits: [],
      status: 'pending',
      createdAt: new Date()
    };

    this.settlements.push(settlement);
    this.saveData();

    const fromMember = household.members.find(m => m.id === fromMemberId);
    const toMember = household.members.find(m => m.id === toMemberId);
    this.logActivity(
      'settled_expense', 
      fromMember?.name || 'Unknown', 
      `Created settlement of ${amount} to ${toMember?.name || 'Unknown'}`
    );

    return settlement;
  }

  // Joint Budget Management
  createJointBudget(
    category: string,
    amount: number,
    period: 'monthly' | 'weekly' | 'yearly',
    assignedMembers: string[]
  ): JointBudget | null {
    const household = this.getCurrentHousehold();
    if (!household) return null;

    const budget: JointBudget = {
      id: this.generateId(),
      category,
      amount,
      period,
      isActive: true,
      createdAt: new Date(),
      householdId: household.id,
      assignedMembers,
      approvedBy: ['current-user'],
      needsApproval: household.settings.requireApprovalForExpenses && amount > household.settings.expenseApprovalThreshold
    };

    // In a real app, save to budgets collection
    this.logActivity('created_budget', 'Current User', `Created joint budget for ${category}`);
    return budget;
  }

  // Activity Logging
  private logActivity(
    action: CollaborationActivity['action'],
    memberName: string,
    description: string,
    resourceType?: CollaborationActivity['resourceType'],
    resourceId?: string
  ) {
    const household = this.getCurrentHousehold();
    if (!household) return;

    const activity: CollaborationActivity = {
      id: this.generateId(),
      householdId: household.id,
      memberId: 'current-user',
      memberName,
      action,
      resourceType,
      resourceId,
      description,
      timestamp: new Date()
    };

    this.activities.push(activity);
    this.saveData();
  }

  getActivities(householdId?: string, limit: number = 50): CollaborationActivity[] {
    let filtered = this.activities;
    
    if (householdId) {
      filtered = filtered.filter(a => a.householdId === householdId);
    }

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Utility Methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getAllPermissions(): Permission[] {
    return [
      { resource: 'accounts', actions: ['view', 'create', 'edit', 'delete'] },
      { resource: 'transactions', actions: ['view', 'create', 'edit', 'delete'] },
      { resource: 'budgets', actions: ['view', 'create', 'edit', 'delete'] },
      { resource: 'goals', actions: ['view', 'create', 'edit', 'delete'] },
      { resource: 'reports', actions: ['view'] },
      { resource: 'settings', actions: ['view', 'edit'] }
    ];
  }

  // Permission Checking
  hasPermission(resource: Permission['resource'], action: Permission['actions'][0]): boolean {
    const household = this.getCurrentHousehold();
    if (!household) return false;

    const currentMember = household.members.find(m => m.id === 'current-user');
    if (!currentMember) return false;

    if (currentMember.role === 'owner') return true;

    const permission = currentMember.permissions.find(p => p.resource === resource);
    return permission ? permission.actions.includes(action) : false;
  }
}

export const collaborationService = new CollaborationService();