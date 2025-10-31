import type { Budget, Goal, Transaction } from '../types';
import { householdService, type HouseholdMember } from './householdService';

export interface SharedBudget extends Budget {
  householdId: string;
  createdBy: string;
  createdByName: string;
  sharedWith: string[]; // Member IDs who can view
  editors: string[]; // Member IDs who can edit
  memberAllocations?: BudgetAllocation[];
  approvalRequired: boolean;
  approvalThreshold: number;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
}

export interface BudgetAllocation {
  memberId: string;
  memberName: string;
  amount: number;
  percentage: number;
  isResponsible: boolean;
}

export interface SharedGoal extends Goal {
  householdId: string;
  createdBy: string;
  createdByName: string;
  sharedWith: string[]; // Member IDs who can view
  contributors: GoalContributor[];
  isHouseholdGoal: boolean;
  approvalRequired: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
}

export interface GoalContributor {
  memberId: string;
  memberName: string;
  targetAmount: number;
  currentAmount: number;
  percentage: number;
  lastContribution?: Date;
}

export interface BudgetApproval {
  id: string;
  budgetId: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: Date;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  comments?: string;
}

export interface SharedFinanceActivity {
  id: string;
  type: 'budget_created' | 'budget_modified' | 'goal_created' | 'goal_progress' | 
        'budget_exceeded' | 'goal_achieved' | 'approval_requested' | 'approval_granted';
  entityId: string;
  entityType: 'budget' | 'goal';
  entityName: string;
  memberId: string;
  memberName: string;
  timestamp: Date;
  details: string;
  amount?: number;
}

class SharedFinanceService {
  private readonly BUDGETS_KEY = 'shared_budgets';
  private readonly GOALS_KEY = 'shared_goals';
  private readonly APPROVALS_KEY = 'budget_approvals';
  private readonly ACTIVITIES_KEY = 'shared_finance_activities';

  private sharedBudgets: SharedBudget[] = [];
  private sharedGoals: SharedGoal[] = [];
  private approvals: BudgetApproval[] = [];
  private activities: SharedFinanceActivity[] = [];

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      const budgetsData = localStorage.getItem(this.BUDGETS_KEY);
      if (budgetsData) {
        this.sharedBudgets = JSON.parse(budgetsData).map((b: any) => ({
          ...b,
          createdAt: new Date(b.createdAt),
          updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
          lastModifiedAt: b.lastModifiedAt ? new Date(b.lastModifiedAt) : undefined
        }));
      }

      const goalsData = localStorage.getItem(this.GOALS_KEY);
      if (goalsData) {
        this.sharedGoals = JSON.parse(goalsData).map((g: any) => ({
          ...g,
          createdAt: new Date(g.createdAt),
          targetDate: new Date(g.targetDate),
          lastModifiedAt: g.lastModifiedAt ? new Date(g.lastModifiedAt) : undefined,
          contributors: g.contributors.map((c: any) => ({
            ...c,
            lastContribution: c.lastContribution ? new Date(c.lastContribution) : undefined
          }))
        }));
      }

      const approvalsData = localStorage.getItem(this.APPROVALS_KEY);
      if (approvalsData) {
        this.approvals = JSON.parse(approvalsData).map((a: any) => ({
          ...a,
          requestedAt: new Date(a.requestedAt),
          reviewedAt: a.reviewedAt ? new Date(a.reviewedAt) : undefined
        }));
      }

      const activitiesData = localStorage.getItem(this.ACTIVITIES_KEY);
      if (activitiesData) {
        this.activities = JSON.parse(activitiesData).map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load shared finance data:', error);
    }
  }

  private saveData() {
    try {
      localStorage.setItem(this.BUDGETS_KEY, JSON.stringify(this.sharedBudgets));
      localStorage.setItem(this.GOALS_KEY, JSON.stringify(this.sharedGoals));
      localStorage.setItem(this.APPROVALS_KEY, JSON.stringify(this.approvals));
      localStorage.setItem(this.ACTIVITIES_KEY, JSON.stringify(this.activities));
    } catch (error) {
      console.error('Failed to save shared finance data:', error);
    }
  }

  // Create shared budget
  createSharedBudget(
    budget: Omit<Budget, 'id' | 'createdAt'>,
    householdId: string,
    createdBy: string,
    createdByName: string,
    sharedWith?: string[],
    editors?: string[],
    approvalRequired = false,
    approvalThreshold = 0
  ): SharedBudget {
    const household = householdService.getHousehold();
    if (!household || household.id !== householdId) {
      throw new Error('Invalid household');
    }

    const sharedBudget: SharedBudget = {
      ...budget,
      id: this.generateId(),
      createdAt: new Date(),
      householdId,
      createdBy,
      createdByName,
      sharedWith: sharedWith || household.members.map(m => m.id),
      editors: editors || [createdBy],
      approvalRequired,
      approvalThreshold,
      isActive: true
    };

    this.sharedBudgets.push(sharedBudget);
    this.saveData();
    this.logActivity(
      'budget_created',
      sharedBudget.id,
      'budget',
      budget.name || `${budget.categoryId} Budget`,
      createdBy,
      createdByName,
      `Created shared budget for ${budget.categoryId}`,
      budget.amount
    );

    return sharedBudget;
  }

  // Update shared budget
  updateSharedBudget(
    budgetId: string,
    updates: Partial<SharedBudget>,
    updatedBy: string,
    updatedByName: string
  ): SharedBudget {
    const budget = this.sharedBudgets.find(b => b.id === budgetId);
    if (!budget) throw new Error('Budget not found');

    // Check permissions
    if (!budget.editors.includes(updatedBy)) {
      throw new Error('Insufficient permissions to edit budget');
    }

    // Check if approval needed for amount changes
    if (updates.amount && budget.approvalRequired && 
        Math.abs(updates.amount - budget.amount) > budget.approvalThreshold) {
      this.requestBudgetApproval(
        budgetId,
        updates.amount,
        updatedBy,
        updatedByName,
        'Budget amount change requires approval'
      );
      throw new Error('Budget change requires approval');
    }

    Object.assign(budget, {
      ...updates,
      lastModifiedBy: updatedBy,
      lastModifiedAt: new Date(),
      updatedAt: new Date()
    });

    this.saveData();
    this.logActivity(
      'budget_modified',
      budgetId,
      'budget',
      budget.name || `${budget.categoryId} Budget`,
      updatedBy,
      updatedByName,
      'Updated shared budget',
      budget.amount
    );

    return budget;
  }

  // Create shared goal
  createSharedGoal(
    goal: Omit<Goal, 'id' | 'createdAt'>,
    householdId: string,
    createdBy: string,
    createdByName: string,
    isHouseholdGoal = true,
    contributors?: GoalContributor[]
  ): SharedGoal {
    const household = householdService.getHousehold();
    if (!household || household.id !== householdId) {
      throw new Error('Invalid household');
    }

    // If no contributors specified, create equal distribution
    if (!contributors || contributors.length === 0) {
      const memberCount = household.members.length;
      const amountPerMember = goal.targetAmount / memberCount;
      
      contributors = household.members.map(member => ({
        memberId: member.id,
        memberName: member.name,
        targetAmount: amountPerMember,
        currentAmount: 0,
        percentage: 100 / memberCount,
        lastContribution: undefined
      }));
    }

    const sharedGoal: SharedGoal = {
      ...goal,
      id: this.generateId(),
      createdAt: new Date(),
      householdId,
      createdBy,
      createdByName,
      sharedWith: household.members.map(m => m.id),
      contributors,
      isHouseholdGoal,
      approvalRequired: false,
      completedAt: false
    };

    this.sharedGoals.push(sharedGoal);
    this.saveData();
    this.logActivity(
      'goal_created',
      sharedGoal.id,
      'goal',
      goal.name,
      createdBy,
      createdByName,
      `Created shared goal: ${goal.name}`,
      goal.targetAmount
    );

    return sharedGoal;
  }

  // Update goal progress
  updateGoalProgress(
    goalId: string,
    memberId: string,
    memberName: string,
    contributionAmount: number
  ): SharedGoal {
    const goal = this.sharedGoals.find(g => g.id === goalId);
    if (!goal) throw new Error('Goal not found');

    const contributor = goal.contributors.find(c => c.memberId === memberId);
    if (!contributor) throw new Error('Member is not a contributor to this goal');

    contributor.currentAmount += contributionAmount;
    contributor.lastContribution = new Date();

    // Update overall goal progress
    const totalCurrent = goal.contributors.reduce((sum, c) => sum + c.currentAmount, 0);
    goal.currentAmount = totalCurrent;
    goal.progress = (totalCurrent / goal.targetAmount) * 100;

    // Check if goal is achieved
    if (totalCurrent >= goal.targetAmount && !goal.completedAt) {
      goal.completedAt = true;
      goal.completedAt = new Date();
      this.logActivity(
        'goal_achieved',
        goalId,
        'goal',
        goal.name,
        memberId,
        memberName,
        `Goal achieved: ${goal.name}!`,
        goal.targetAmount
      );
    } else {
      this.logActivity(
        'goal_progress',
        goalId,
        'goal',
        goal.name,
        memberId,
        memberName,
        `Contributed ${contributionAmount} to goal`,
        contributionAmount
      );
    }

    goal.lastModifiedBy = memberId;
    goal.lastModifiedAt = new Date();
    
    this.saveData();
    return goal;
  }

  // Get shared budgets for household
  getHouseholdBudgets(householdId: string, memberId?: string): SharedBudget[] {
    return this.sharedBudgets.filter(budget => {
      if (budget.householdId !== householdId) return false;
      if (memberId && !budget.sharedWith.includes(memberId)) return false;
      return budget.isActive;
    });
  }

  // Get shared goals for household
  getHouseholdGoals(householdId: string, memberId?: string): SharedGoal[] {
    return this.sharedGoals.filter(goal => {
      if (goal.householdId !== householdId) return false;
      if (memberId && !goal.sharedWith.includes(memberId)) return false;
      return !goal.isDeleted;
    });
  }

  // Calculate budget spending by member
  calculateBudgetSpending(
    budgetId: string,
    transactions: Transaction[],
    period: Date
  ): Map<string, number> {
    const budget = this.sharedBudgets.find(b => b.id === budgetId);
    if (!budget) return new Map();

    const spending = new Map<string, number>();
    const startOfPeriod = new Date(period.getFullYear(), period.getMonth(), 1);
    const endOfPeriod = new Date(period.getFullYear(), period.getMonth() + 1, 0);

    transactions
      .filter(t => 
        t.category === budget.categoryId &&
        t.type === 'expense' &&
        new Date(t.date) >= startOfPeriod &&
        new Date(t.date) <= endOfPeriod
      )
      .forEach(t => {
        const memberId = t.addedBy || 'unknown';
        const current = spending.get(memberId) || 0;
        spending.set(memberId, current + Math.abs(t.amount));
      });

    return spending;
  }

  // Request budget approval
  requestBudgetApproval(
    budgetId: string,
    amount: number,
    requestedBy: string,
    requestedByName: string,
    reason: string
  ): BudgetApproval {
    const approval: BudgetApproval = {
      id: this.generateId(),
      budgetId,
      requestedBy,
      requestedByName,
      requestedAt: new Date(),
      amount,
      reason,
      status: 'pending'
    };

    this.approvals.push(approval);
    this.saveData();
    this.logActivity(
      'approval_requested',
      budgetId,
      'budget',
      'Budget',
      requestedBy,
      requestedByName,
      `Requested approval for budget change`,
      amount
    );

    return approval;
  }

  // Review budget approval
  reviewApproval(
    approvalId: string,
    reviewedBy: string,
    approved: boolean,
    comments?: string
  ): void {
    const approval = this.approvals.find(a => a.id === approvalId);
    if (!approval) throw new Error('Approval not found');
    if (approval.status !== 'pending') throw new Error('Approval already reviewed');

    approval.status = approved ? 'approved' : 'rejected';
    approval.reviewedBy = reviewedBy;
    approval.reviewedAt = new Date();
    approval.comments = comments;

    // If approved, apply the budget change
    if (approved) {
      const budget = this.sharedBudgets.find(b => b.id === approval.budgetId);
      if (budget) {
        budget.amount = approval.amount;
        budget.lastModifiedBy = approval.requestedBy;
        budget.lastModifiedAt = new Date();
        this.logActivity(
          'approval_granted',
          approval.budgetId,
          'budget',
          budget.name || 'Budget',
          reviewedBy,
          'Reviewer',
          `Approved budget change to ${approval.amount}`,
          approval.amount
        );
      }
    }

    this.saveData();
  }

  // Get pending approvals
  getPendingApprovals(householdId: string): BudgetApproval[] {
    const budgetIds = this.sharedBudgets
      .filter(b => b.householdId === householdId)
      .map(b => b.id);
    
    return this.approvals.filter(a => 
      a.status === 'pending' && budgetIds.includes(a.budgetId)
    );
  }

  // Get activities
  getRecentActivities(householdId: string, limit = 20): SharedFinanceActivity[] {
    const budgetIds = this.sharedBudgets
      .filter(b => b.householdId === householdId)
      .map(b => b.id);
    const goalIds = this.sharedGoals
      .filter(g => g.householdId === householdId)
      .map(g => g.id);
    
    return this.activities
      .filter(a => 
        (a.entityType === 'budget' && budgetIds.includes(a.entityId)) ||
        (a.entityType === 'goal' && goalIds.includes(a.entityId))
      )
      .slice(0, limit);
  }

  // Check budget exceeded
  checkBudgetExceeded(
    budgetId: string,
    currentSpending: number,
    memberId: string,
    memberName: string
  ): boolean {
    const budget = this.sharedBudgets.find(b => b.id === budgetId);
    if (!budget) return false;

    if (currentSpending > budget.amount && !budget.isExceeded) {
      budget.isExceeded = true;
      this.logActivity(
        'budget_exceeded',
        budgetId,
        'budget',
        budget.name || `${budget.categoryId} Budget`,
        memberId,
        memberName,
        `Budget exceeded! Spent ${currentSpending} of ${budget.amount}`,
        currentSpending
      );
      this.saveData();
      return true;
    }

    return false;
  }

  // Delete shared budget
  deleteSharedBudget(budgetId: string, deletedBy: string): void {
    const budget = this.sharedBudgets.find(b => b.id === budgetId);
    if (!budget) return;

    if (!budget.editors.includes(deletedBy) && budget.createdBy !== deletedBy) {
      throw new Error('Insufficient permissions to delete budget');
    }

    budget.isActive = false;
    this.saveData();
  }

  // Delete shared goal
  deleteSharedGoal(goalId: string, deletedBy: string): void {
    const goal = this.sharedGoals.find(g => g.id === goalId);
    if (!goal) return;

    if (goal.createdBy !== deletedBy) {
      const member = householdService.getMemberById(deletedBy);
      if (!member || member.role !== 'owner') {
        throw new Error('Insufficient permissions to delete goal');
      }
    }

    goal.isDeleted = true;
    this.saveData();
  }

  // Private methods
  private logActivity(
    type: SharedFinanceActivity['type'],
    entityId: string,
    entityType: 'budget' | 'goal',
    entityName: string,
    memberId: string,
    memberName: string,
    details: string,
    amount?: number
  ): void {
    const activity: SharedFinanceActivity = {
      id: this.generateId(),
      type,
      entityId,
      entityType,
      entityName,
      memberId,
      memberName,
      timestamp: new Date(),
      details,
      amount
    };

    this.activities.unshift(activity);
    
    // Keep only last 200 activities
    if (this.activities.length > 200) {
      this.activities = this.activities.slice(0, 200);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const sharedFinanceService = new SharedFinanceService();