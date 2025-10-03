import type { Account, Transaction, Budget, Goal } from '../types';
import { lazyLogger as logger } from './serviceFactory';

export interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatar?: string;
  color: string;
  joinedAt: Date;
  lastActive?: Date;
  permissions: MemberPermissions;
}

export interface MemberPermissions {
  canViewAccounts: boolean;
  canEditAccounts: boolean;
  canViewTransactions: boolean;
  canEditTransactions: boolean;
  canViewBudgets: boolean;
  canEditBudgets: boolean;
  canViewGoals: boolean;
  canEditGoals: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
}

export interface Household {
  id: string;
  name: string;
  createdAt: Date;
  createdBy: string;
  members: HouseholdMember[];
  settings: HouseholdSettings;
}

export interface HouseholdSettings {
  currency: string;
  timezone: string;
  fiscalYearStart: number; // 1-12
  allowMemberExpenses: boolean;
  requireApprovalForLargeTransactions: boolean;
  largeTransactionThreshold: number;
  sharedCategories: boolean;
  memberVisibility: 'all' | 'summary' | 'none';
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  email: string;
  role: HouseholdMember['role'];
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
}

export interface MemberActivity {
  id: string;
  memberId: string;
  memberName: string;
  action: 'added_transaction' | 'edited_transaction' | 'deleted_transaction' | 
          'added_account' | 'edited_budget' | 'achieved_goal' | 'joined_household';
  details: string;
  timestamp: Date;
  entityId?: string;
  entityType?: 'transaction' | 'account' | 'budget' | 'goal';
}

export interface MemberContribution {
  memberId: string;
  memberName: string;
  totalIncome: number;
  totalExpenses: number;
  netContribution: number;
  transactionCount: number;
  percentageOfHousehold: number;
}

class HouseholdService {
  private readonly STORAGE_KEY = 'household_data';
  private readonly INVITES_KEY = 'household_invites';
  private readonly ACTIVITIES_KEY = 'household_activities';
  
  private household: Household | null = null;
  private invites: HouseholdInvite[] = [];
  private activities: MemberActivity[] = [];

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      const householdData = localStorage.getItem(this.STORAGE_KEY);
      if (householdData) {
        const parsed = JSON.parse(householdData);
        this.household = {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          members: parsed.members.map((m: any) => ({
            ...m,
            joinedAt: new Date(m.joinedAt),
            lastActive: m.lastActive ? new Date(m.lastActive) : undefined
          }))
        };
      }

      const invitesData = localStorage.getItem(this.INVITES_KEY);
      if (invitesData) {
        this.invites = JSON.parse(invitesData).map((i: any) => ({
          ...i,
          invitedAt: new Date(i.invitedAt),
          expiresAt: new Date(i.expiresAt)
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
      logger.error('Failed to load household data:', error);
    }
  }

  private saveData() {
    try {
      if (this.household) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.household));
      }
      localStorage.setItem(this.INVITES_KEY, JSON.stringify(this.invites));
      localStorage.setItem(this.ACTIVITIES_KEY, JSON.stringify(this.activities));
    } catch (error) {
      logger.error('Failed to save household data:', error);
    }
  }

  // Create a new household
  createHousehold(name: string, creatorEmail: string, creatorName: string): Household {
    const creator: HouseholdMember = {
      id: this.generateId(),
      name: creatorName,
      email: creatorEmail,
      role: 'owner',
      color: this.generateMemberColor(0),
      joinedAt: new Date(),
      permissions: this.getDefaultPermissions('owner')
    };

    this.household = {
      id: this.generateId(),
      name,
      createdAt: new Date(),
      createdBy: creator.id,
      members: [creator],
      settings: {
        currency: 'USD',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        fiscalYearStart: 1,
        allowMemberExpenses: true,
        requireApprovalForLargeTransactions: false,
        largeTransactionThreshold: 1000,
        sharedCategories: true,
        memberVisibility: 'all'
      }
    };

    this.saveData();
    this.logActivity(creator.id, creator.name, 'joined_household', 'Created the household');
    
    return this.household;
  }

  // Get current household
  getHousehold(): Household | null {
    return this.household;
  }

  // Update household settings
  updateHouseholdSettings(settings: Partial<HouseholdSettings>): void {
    if (!this.household) return;
    
    this.household.settings = {
      ...this.household.settings,
      ...settings
    };
    
    this.saveData();
  }

  // Invite a member
  inviteMember(
    email: string, 
    role: HouseholdMember['role'], 
    invitedBy: string,
    inviterName: string
  ): HouseholdInvite {
    if (!this.household) throw new Error('No household exists');
    
    const household = this.household; // Store in local variable for type narrowing
    
    // Check if already a member
    if (household.members.some(m => m.email === email)) {
      throw new Error('User is already a member');
    }
    
    // Check for existing pending invite
    const existingInvite = this.invites.find(
      i => i.email === email && i.status === 'pending' && i.householdId === household.id
    );
    if (existingInvite) {
      throw new Error('An invitation is already pending for this email');
    }

    const invite: HouseholdInvite = {
      id: this.generateId(),
      householdId: household.id,
      email,
      role,
      invitedBy,
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending',
      token: this.generateToken()
    };

    this.invites.push(invite);
    this.saveData();
    this.logActivity(invitedBy, inviterName, 'joined_household', `Invited ${email} to join as ${role}`);
    
    return invite;
  }

  // Accept an invite
  acceptInvite(token: string, name: string): HouseholdMember {
    const invite = this.invites.find(i => i.token === token && i.status === 'pending');
    if (!invite) throw new Error('Invalid or expired invitation');
    
    if (new Date() > invite.expiresAt) {
      invite.status = 'expired';
      this.saveData();
      throw new Error('Invitation has expired');
    }

    if (!this.household || this.household.id !== invite.householdId) {
      throw new Error('Household not found');
    }

    const newMember: HouseholdMember = {
      id: this.generateId(),
      name,
      email: invite.email,
      role: invite.role,
      color: this.generateMemberColor(this.household.members.length),
      joinedAt: new Date(),
      permissions: this.getDefaultPermissions(invite.role)
    };

    this.household.members.push(newMember);
    invite.status = 'accepted';
    this.saveData();
    this.logActivity(newMember.id, newMember.name, 'joined_household', 'Joined the household');
    
    return newMember;
  }

  // Remove a member
  removeMember(memberId: string, removedBy: string, removerName: string): void {
    if (!this.household) return;
    
    const member = this.household.members.find(m => m.id === memberId);
    if (!member) throw new Error('Member not found');
    
    // Can't remove the owner
    if (member.role === 'owner') {
      throw new Error('Cannot remove the household owner');
    }
    
    // Check permissions
    const remover = this.household.members.find(m => m.id === removedBy);
    if (!remover || !remover.permissions.canRemoveMembers) {
      throw new Error('Insufficient permissions to remove members');
    }

    this.household.members = this.household.members.filter(m => m.id !== memberId);
    this.saveData();
    this.logActivity(removedBy, removerName, 'joined_household', `Removed ${member.name} from household`);
  }

  // Update member role
  updateMemberRole(memberId: string, newRole: HouseholdMember['role'], updatedBy: string): void {
    if (!this.household) return;
    
    const member = this.household.members.find(m => m.id === memberId);
    if (!member) throw new Error('Member not found');
    
    // Check permissions
    const updater = this.household.members.find(m => m.id === updatedBy);
    if (!updater || updater.role !== 'owner') {
      throw new Error('Only the owner can change member roles');
    }
    
    // Can't change owner role
    if (member.role === 'owner' && newRole !== 'owner') {
      throw new Error('Cannot change owner role. Transfer ownership first.');
    }

    member.role = newRole;
    member.permissions = this.getDefaultPermissions(newRole);
    this.saveData();
  }

  // Get member by ID
  getMemberById(memberId: string): HouseholdMember | undefined {
    return this.household?.members.find(m => m.id === memberId);
  }

  // Log activity
  logActivity(
    memberId: string, 
    memberName: string,
    action: MemberActivity['action'], 
    details: string,
    entityId?: string,
    entityType?: MemberActivity['entityType']
  ): void {
    const activity: MemberActivity = {
      id: this.generateId(),
      memberId,
      memberName,
      action,
      details,
      timestamp: new Date(),
      entityId,
      entityType
    };

    this.activities.unshift(activity);
    
    // Keep only last 100 activities
    if (this.activities.length > 100) {
      this.activities = this.activities.slice(0, 100);
    }
    
    this.saveData();
  }

  // Get recent activities
  getRecentActivities(limit: number = 20): MemberActivity[] {
    return this.activities.slice(0, limit);
  }

  // Calculate member contributions
  calculateMemberContributions(transactions: Transaction[]): MemberContribution[] {
    if (!this.household) return [];
    
    const contributions = new Map<string, MemberContribution>();
    let totalHouseholdExpenses = 0;
    let totalHouseholdIncome = 0;

    // Initialize contributions for all members
    this.household.members.forEach(member => {
      contributions.set(member.id, {
        memberId: member.id,
        memberName: member.name,
        totalIncome: 0,
        totalExpenses: 0,
        netContribution: 0,
        transactionCount: 0,
        percentageOfHousehold: 0
      });
    });

    // Calculate contributions
    transactions.forEach(transaction => {
      const memberId = transaction.addedBy || this.household!.createdBy;
      const contribution = contributions.get(memberId);
      
      if (contribution) {
        contribution.transactionCount++;
        
        if (transaction.type === 'income') {
          contribution.totalIncome += Math.abs(transaction.amount);
          totalHouseholdIncome += Math.abs(transaction.amount);
        } else if (transaction.type === 'expense') {
          contribution.totalExpenses += Math.abs(transaction.amount);
          totalHouseholdExpenses += Math.abs(transaction.amount);
        }
      }
    });

    // Calculate net contributions and percentages
    const totalHouseholdNet = totalHouseholdIncome - totalHouseholdExpenses;
    
    contributions.forEach(contribution => {
      contribution.netContribution = contribution.totalIncome - contribution.totalExpenses;
      if (totalHouseholdExpenses > 0) {
        contribution.percentageOfHousehold = (contribution.totalExpenses / totalHouseholdExpenses) * 100;
      }
    });

    return Array.from(contributions.values());
  }

  // Check if user can perform action
  canMemberPerformAction(
    memberId: string, 
    action: keyof MemberPermissions
  ): boolean {
    const member = this.household?.members.find(m => m.id === memberId);
    return member ? member.permissions[action] : false;
  }

  // Get default permissions for role
  private getDefaultPermissions(role: HouseholdMember['role']): MemberPermissions {
    switch (role) {
      case 'owner':
        return {
          canViewAccounts: true,
          canEditAccounts: true,
          canViewTransactions: true,
          canEditTransactions: true,
          canViewBudgets: true,
          canEditBudgets: true,
          canViewGoals: true,
          canEditGoals: true,
          canInviteMembers: true,
          canRemoveMembers: true
        };
      case 'admin':
        return {
          canViewAccounts: true,
          canEditAccounts: true,
          canViewTransactions: true,
          canEditTransactions: true,
          canViewBudgets: true,
          canEditBudgets: true,
          canViewGoals: true,
          canEditGoals: true,
          canInviteMembers: true,
          canRemoveMembers: false
        };
      case 'member':
        return {
          canViewAccounts: true,
          canEditAccounts: false,
          canViewTransactions: true,
          canEditTransactions: true,
          canViewBudgets: true,
          canEditBudgets: false,
          canViewGoals: true,
          canEditGoals: false,
          canInviteMembers: false,
          canRemoveMembers: false
        };
      case 'viewer':
        return {
          canViewAccounts: true,
          canEditAccounts: false,
          canViewTransactions: true,
          canEditTransactions: false,
          canViewBudgets: true,
          canEditBudgets: false,
          canViewGoals: true,
          canEditGoals: false,
          canInviteMembers: false,
          canRemoveMembers: false
        };
    }
  }

  // Generate member color
  private generateMemberColor(index: number): string {
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#06B6D4', // cyan
      '#F97316', // orange
      '#EC4899', // pink
    ];
    return colors[index % colors.length];
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate invite token
  private generateToken(): string {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
  }

  // Transfer ownership
  transferOwnership(currentOwnerId: string, newOwnerId: string): void {
    if (!this.household) return;
    
    const currentOwner = this.household.members.find(m => m.id === currentOwnerId);
    const newOwner = this.household.members.find(m => m.id === newOwnerId);
    
    if (!currentOwner || currentOwner.role !== 'owner') {
      throw new Error('Only the current owner can transfer ownership');
    }
    
    if (!newOwner) {
      throw new Error('New owner not found');
    }

    // Update roles
    currentOwner.role = 'admin';
    currentOwner.permissions = this.getDefaultPermissions('admin');
    newOwner.role = 'owner';
    newOwner.permissions = this.getDefaultPermissions('owner');
    
    this.household.createdBy = newOwnerId;
    this.saveData();
  }

  // Leave household
  leaveHousehold(memberId: string): void {
    if (!this.household) return;
    
    const member = this.household.members.find(m => m.id === memberId);
    if (!member) return;
    
    if (member.role === 'owner' && this.household.members.length > 1) {
      throw new Error('Owner must transfer ownership before leaving');
    }
    
    if (this.household.members.length === 1) {
      // Last member leaving, delete household
      this.household = null;
      this.invites = [];
      this.activities = [];
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.INVITES_KEY);
      localStorage.removeItem(this.ACTIVITIES_KEY);
    } else {
      this.household.members = this.household.members.filter(m => m.id !== memberId);
      this.saveData();
    }
  }

  // Get pending invites
  getPendingInvites(): HouseholdInvite[] {
    if (!this.household) return [];
    
    return this.invites.filter(
      i => i.householdId === this.household!.id && 
           i.status === 'pending' &&
           new Date() <= i.expiresAt
    );
  }

  // Cancel invite
  cancelInvite(inviteId: string): void {
    const invite = this.invites.find(i => i.id === inviteId);
    if (invite && invite.status === 'pending') {
      invite.status = 'declined';
      this.saveData();
    }
  }
}

export const householdService = new HouseholdService();