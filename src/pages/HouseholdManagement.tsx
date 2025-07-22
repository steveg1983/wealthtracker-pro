import React, { useState, useEffect } from 'react';
import { collaborationService } from '../services/collaborationService';
import { 
  UsersIcon,
  PlusIcon,
  SettingsIcon,
  MailIcon,
  ShieldIcon,
  CalendarIcon,
  DollarSignIcon,
  ChevronRightIcon,
  UserIcon,
  TrashIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Household, HouseholdMember, ExpenseSplit, Settlement } from '../services/collaborationService';

export default function HouseholdManagement() {
  const { formatCurrency } = useCurrencyDecimal();
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<HouseholdMember['role']>('member');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCurrentHousehold(collaborationService.getCurrentHousehold());
    setHouseholds(collaborationService.getHouseholds());
    setExpenseSplits(collaborationService.getExpenseSplits());
    setSettlements(collaborationService.calculateSettlements());
  };

  const handleCreateHousehold = () => {
    if (newHouseholdName.trim()) {
      collaborationService.createHousehold(newHouseholdName.trim());
      setNewHouseholdName('');
      setShowCreateHousehold(false);
      loadData();
    }
  };

  const handleInviteMember = () => {
    if (newMemberEmail.trim()) {
      try {
        collaborationService.inviteMember(newMemberEmail.trim(), newMemberRole);
        setNewMemberEmail('');
        setNewMemberRole('member');
        setShowInviteMember(false);
        loadData();
      } catch (error) {
        alert('Failed to invite member: ' + (error as Error).message);
      }
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      collaborationService.removeMember(memberId);
      loadData();
    }
  };

  const handleSwitchHousehold = (householdId: string) => {
    collaborationService.switchHousehold(householdId);
    loadData();
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Household Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Households</h3>
        
        {households.length === 0 ? (
          <div className="text-center py-8">
            <UsersIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No households yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first household to start collaborating
            </p>
            <button
              onClick={() => setShowCreateHousehold(true)}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              Create Household
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {households.map(household => (
              <div
                key={household.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  currentHousehold?.id === household.id
                    ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => handleSwitchHousehold(household.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {household.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {household.members.length} member{household.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRightIcon size={20} className="text-gray-400" />
                </div>
              </div>
            ))}
            
            <button
              onClick={() => setShowCreateHousehold(true)}
              className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              <PlusIcon size={20} className="mx-auto mb-2" />
              Create New Household
            </button>
          </div>
        )}
      </div>

      {/* Current Household Stats */}
      {currentHousehold && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <UsersIcon size={20} className="text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Members</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentHousehold.members.filter(m => m.isActive).length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active members</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSignIcon size={20} className="text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Splits</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {expenseSplits.filter(s => s.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending settlements</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <SettingsIcon size={20} className="text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Settings</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Split Method: {currentHousehold.settings.defaultSplitMethod}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Currency: {currentHousehold.settings.currency}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderMembers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Household Members
        </h3>
        <button
          onClick={() => setShowInviteMember(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Invite Member
        </button>
      </div>

      {currentHousehold && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {currentHousehold.members.map(member => (
              <div key={member.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <UserIcon size={20} className="text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {member.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.role === 'owner' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                          : member.role === 'admin'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {member.role}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Joined {member.joinedAt.toLocaleDateString()}
                      </p>
                    </div>
                    
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Permissions
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {member.permissions.map((permission, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {permission.resource}: {permission.actions.join(', ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderExpenses = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Expense Splits & Settlements
      </h3>

      {/* Pending Settlements */}
      {settlements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Suggested Settlements
          </h4>
          <div className="space-y-3">
            {settlements.map(settlement => {
              const fromMember = currentHousehold?.members.find(m => m.id === settlement.fromMemberId);
              const toMember = currentHousehold?.members.find(m => m.id === settlement.toMemberId);
              
              return (
                <div key={settlement.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {fromMember?.name || 'Unknown'} owes {toMember?.name || 'Unknown'}
                    </p>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                      {formatCurrency(settlement.amount)}
                    </p>
                  </div>
                  <button className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">
                    Mark as Paid
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Expense Splits */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white">Recent Splits</h4>
        </div>
        
        {expenseSplits.length === 0 ? (
          <div className="p-6 text-center">
            <DollarSignIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">No expense splits yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {expenseSplits.slice(0, 5).map(split => (
              <div key={split.id} className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      {split.description}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {split.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(split.totalAmount)}
                    </p>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      split.status === 'settled'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {split.status}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {split.splits.map((memberSplit, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {memberSplit.memberName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(memberSplit.amount)}
                        </span>
                        {memberSplit.isPaid ? (
                          <span className="text-green-600 dark:text-green-400">✓</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">○</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: UsersIcon },
    { id: 'members', label: 'Members', icon: UserIcon },
    { id: 'expenses', label: 'Expenses', icon: DollarSignIcon }
  ];

  return (
    <PageWrapper>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-800 dark:to-purple-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Household Management</h1>
              <p className="text-blue-100">
                {currentHousehold ? `Managing: ${currentHousehold.name}` : 'Collaborate with family and roommates'}
              </p>
            </div>
            <UsersIcon size={48} className="text-white/80" />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="flex overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-gray-700">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'members' && renderMembers()}
        {activeTab === 'expenses' && renderExpenses()}

        {/* Create Household Modal */}
        {showCreateHousehold && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Create New Household
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Household Name
                  </label>
                  <input
                    type="text"
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                    placeholder="e.g., The Smith Family"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateHousehold(false);
                    setNewHouseholdName('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateHousehold}
                  disabled={!newHouseholdName.trim()}
                  className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Member Modal */}
        {showInviteMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Invite Member
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as HouseholdMember['role'])}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowInviteMember(false);
                    setNewMemberEmail('');
                    setNewMemberRole('member');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteMember}
                  disabled={!newMemberEmail.trim()}
                  className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Invite
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}