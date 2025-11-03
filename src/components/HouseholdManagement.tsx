import React, { useState, useEffect } from 'react';
import { householdService, type Household, type HouseholdMember, type MemberActivity, type HouseholdInvite, type MemberContribution } from '../services/householdService';
import SharedBudgetsGoals from './SharedBudgetsGoals';
import {
  UsersIcon,
  PlusIcon,
  MailIcon,
  UserIcon,
  ShieldIcon,
  ActivityIcon,
  SettingsIcon,
  XIcon,
  TargetIcon
} from './icons';
import { format } from 'date-fns';
import { useCurrency } from '../hooks/useCurrency';
import { useApp } from '../contexts/AppContextSupabase';
import { formatDecimal } from '../utils/decimal-format';

type MemberVisibility = Household['settings']['memberVisibility'];

const allowedRoles: HouseholdMember['role'][] = ['owner', 'admin', 'member', 'viewer'];
const allowedVisibilities: MemberVisibility[] = ['all', 'summary', 'none'];

const parseMemberRole = (value: string): HouseholdMember['role'] => {
  return allowedRoles.includes(value as HouseholdMember['role']) ? (value as HouseholdMember['role']) : 'member';
};

const parseMemberVisibility = (value: string): MemberVisibility => {
  return allowedVisibilities.includes(value as MemberVisibility) ? (value as MemberVisibility) : 'all';
};

const notifyError = (error: unknown, fallbackMessage: string) => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  console.error(fallbackMessage, error);
  alert(message);
};

export default function HouseholdManagement() {
  const { transactions } = useApp();
  const { formatCurrency } = useCurrency();
  const [household, setHousehold] = useState<Household | null>(null);
  const [currentMember, setCurrentMember] = useState<HouseholdMember | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activities, setActivities] = useState<MemberActivity[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [contributions, setContributions] = useState<MemberContribution[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'finances'>('overview');

  // Form states
  const [householdName, setHouseholdName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<HouseholdMember['role']>('member');

  useEffect(() => {
    loadHousehold();
  }, []);

  useEffect(() => {
    if (household && transactions) {
      const memberContributions = householdService.calculateMemberContributions(transactions);
      setContributions(memberContributions);
    }
  }, [household, transactions]);

  const loadHousehold = () => {
    const data = householdService.getHousehold();
    if (data) {
      setHousehold(data);
      setCurrentMember(data.members[0]); // Assume first member is current user
      setActivities(householdService.getRecentActivities());
      setInvites(householdService.getPendingInvites());
    }
  };

  const handleCreateHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdName || !memberName || !memberEmail) return;

    const newHousehold = householdService.createHousehold(
      householdName,
      memberEmail,
      memberName
    );
    setHousehold(newHousehold);
    setCurrentMember(newHousehold.members[0]);
    setShowCreateForm(false);
    setHouseholdName('');
    setMemberName('');
    setMemberEmail('');
    loadHousehold();
  };

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !currentMember) return;

    try {
      const invite = householdService.inviteMember(
        inviteEmail,
        inviteRole,
        currentMember.id,
        currentMember.name
      );
      setInvites([...invites, invite]);
      setShowInviteForm(false);
      setInviteEmail('');
      setInviteRole('member');
      loadHousehold();
    } catch (error: unknown) {
      notifyError(error, 'Unable to send household invite. Please try again.');
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (!currentMember || !confirm('Are you sure you want to remove this member?')) return;

    try {
      householdService.removeMember(memberId, currentMember.id, currentMember.name);
      loadHousehold();
    } catch (error: unknown) {
      notifyError(error, 'Failed to remove household member.');
    }
  };

  const handleCancelInvite = (inviteId: string) => {
    householdService.cancelInvite(inviteId);
    setInvites(invites.filter(i => i.id !== inviteId));
  };

  const handleUpdateRole = (memberId: string, newRole: HouseholdMember['role']) => {
    if (!currentMember) return;

    try {
      householdService.updateMemberRole(memberId, newRole, currentMember.id);
      loadHousehold();
    } catch (error: unknown) {
      notifyError(error, 'Unable to update member role.');
    }
  };

  const getRoleIcon = (role: HouseholdMember['role']) => {
    switch (role) {
      case 'owner': return <ShieldIcon size={16} className="text-purple-600" />;
      case 'admin': return <UserIcon size={16} className="text-blue-600" />;
      case 'member': return <UserIcon size={16} className="text-green-600" />;
      case 'viewer': return <UserIcon size={16} className="text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role: HouseholdMember['role']) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'member': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  if (!household) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <UsersIcon className="mx-auto text-gray-400 mb-4" size={64} />
          <h2 className="text-2xl font-bold mb-2">Create a Household</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Share your finances with family members and collaborate on budgets and goals
          </p>
          
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Create Household
            </button>
          ) : (
            <form onSubmit={handleCreateHousehold} className="max-w-md mx-auto space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Household Name
                </label>
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="e.g., Smith Family"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your Email
                </label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">{household.name}</h2>
            <p className="text-indigo-100">
              {household.members.length} member{household.members.length !== 1 ? 's' : ''} • 
              Created {format(household.createdAt, 'MMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <SettingsIcon size={20} />
          </button>
        </div>

        {/* Member Contributions Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contributions.slice(0, 3).map(contribution => (
            <div key={contribution.memberId} className="bg-white/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: household.members.find(m => m.id === contribution.memberId)?.color }}
                >
                  {contribution.memberName.charAt(0)}
                </div>
                <span className="font-medium">{contribution.memberName}</span>
              </div>
              <p className="text-sm text-indigo-100">
                {formatCurrency(contribution.totalExpenses)} spent
              </p>
              <p className="text-xs text-indigo-200">
                {formatDecimal(contribution.percentageOfHousehold, 0)}% of household
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-1 flex">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <UsersIcon size={20} />
          <span className="font-medium">Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
            activeTab === 'members'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <UserIcon size={20} />
          <span className="font-medium">Members</span>
        </button>
        <button
          onClick={() => setActiveTab('finances')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
            activeTab === 'finances'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <TargetIcon size={20} />
          <span className="font-medium">Shared Finances</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Settings Panel */}
          {showSettings && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Household Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Member Visibility
              </label>
              <select
                value={household.settings.memberVisibility}
                onChange={(e) => householdService.updateHouseholdSettings({
                  memberVisibility: parseMemberVisibility(e.target.value)
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="all">All transactions visible</option>
                <option value="summary">Summary only</option>
                <option value="none">Private transactions</option>
              </select>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={household.settings.requireApprovalForLargeTransactions}
                onChange={(e) => householdService.updateHouseholdSettings({ 
                  requireApprovalForLargeTransactions: e.target.checked 
                })}
                className="rounded text-indigo-600"
              />
              <span className="text-sm">Require approval for large transactions</span>
            </label>
            
            {household.settings.requireApprovalForLargeTransactions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Large Transaction Threshold
                </label>
                <input
                  type="number"
                  value={household.settings.largeTransactionThreshold}
                  onChange={(e) => householdService.updateHouseholdSettings({ 
                    largeTransactionThreshold: Number(e.target.value) 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Members</h3>
          {currentMember?.permissions.canInviteMembers && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
            >
              <PlusIcon size={16} />
              Invite Member
            </button>
          )}
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <form onSubmit={handleInviteMember} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(parseMemberRole(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Send Invite
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Members List */}
        <div className="space-y-3">
          {household.members.map(member => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: member.color }}
                >
                  {member.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(member.role)}`}>
                      {getRoleIcon(member.role)}
                      {member.role}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{member.email}</p>
                </div>
              </div>
              
              {currentMember?.role === 'owner' && member.id !== currentMember.id && (
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.id, parseMemberRole(e.target.value))}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pending Invites</h4>
            <div className="space-y-2">
              {invites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <div className="flex items-center gap-2">
                    <MailIcon size={16} className="text-yellow-600" />
                    <span className="text-sm">{invite.email}</span>
                    <span className="text-xs text-gray-500">• {invite.role}</span>
                  </div>
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        
        {activities.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map(activity => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-1">
                  <ActivityIcon size={16} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.memberName}</span>
                    {' '}
                    <span className="text-gray-600 dark:text-gray-400">{activity.details}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(activity.timestamp, 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contribution Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Monthly Contributions</h3>
        
        <div className="space-y-4">
          {contributions.map(contribution => (
            <div key={contribution.memberId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: household.members.find(m => m.id === contribution.memberId)?.color }}
                  >
                    {contribution.memberName.charAt(0)}
                  </div>
                  <span className="font-medium">{contribution.memberName}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {contribution.netContribution >= 0 ? (
                      <span className="text-green-600 dark:text-green-400">
                        +{formatCurrency(contribution.netContribution)}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        {formatCurrency(contribution.netContribution)}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {contribution.transactionCount} transactions
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Income:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(contribution.totalIncome)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Expenses:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(contribution.totalExpenses)}
                  </span>
                </div>
              </div>
              
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full transition-all duration-300"
                  style={{ 
                    width: `${contribution.percentageOfHousehold}%`,
                    backgroundColor: household.members.find(m => m.id === contribution.memberId)?.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <>
          {/* Members Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Members</h3>
              {currentMember?.permissions.canInviteMembers && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                >
                  <PlusIcon size={16} />
                  Invite Member
                </button>
              )}
            </div>

            {/* Invite Form */}
            {showInviteForm && (
              <form onSubmit={handleInviteMember} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email address"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    required
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(parseMemberRole(e.target.value))}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Send Invite
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInviteForm(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Members List */}
            <div className="space-y-3">
              {household.members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(member.role)}`}>
                          {getRoleIcon(member.role)}
                          {member.role}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{member.email}</p>
                    </div>
                  </div>
                  
                  {currentMember?.role === 'owner' && member.id !== currentMember.id && (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, parseMemberRole(e.target.value))}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pending Invites */}
            {invites.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pending Invites</h4>
                <div className="space-y-2">
                  {invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <div className="flex items-center gap-2">
                        <MailIcon size={16} className="text-yellow-600" />
                        <span className="text-sm">{invite.email}</span>
                        <span className="text-xs text-gray-500">• {invite.role}</span>
                      </div>
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            
            {activities.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {activities.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="mt-1">
                      <ActivityIcon size={16} className="text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.memberName}</span>
                        {' '}
                        <span className="text-gray-600 dark:text-gray-400">{activity.details}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(activity.timestamp, 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Finances Tab */}
      {activeTab === 'finances' && (
        <SharedBudgetsGoals />
      )}
    </div>
  );
}
