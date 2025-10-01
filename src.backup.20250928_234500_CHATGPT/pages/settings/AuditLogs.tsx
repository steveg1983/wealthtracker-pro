import React, { useState, useEffect, useMemo } from 'react';
import { securityService } from '../../services/securityService';
import { 
  FileTextIcon,
  FilterIcon,
  CalendarIcon,
  UserIcon,
  DatabaseIcon,
  SearchIcon
} from '../../components/icons';
import PageWrapper from '../../components/PageWrapper';
import { VirtualizedTable } from '../../components/VirtualizedTable';
import type { Column } from '../../components/VirtualizedTable';
import type { AuditLog } from '../../services/securityService';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    startDate: '',
    endDate: '',
    search: ''
  });

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  const loadLogs = () => {
    const auditLogs = securityService.getAuditLogs();
    setLogs(auditLogs);
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Filter by action
    if (filters.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }

    // Filter by resource type
    if (filters.resourceType) {
      filtered = filtered.filter(log => log.resourceType === filters.resourceType);
    }

    // Filter by date range
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filtered = filtered.filter(log => log.timestamp >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => log.timestamp <= endDate);
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(searchLower) ||
        log.resourceType.toLowerCase().includes(searchLower) ||
        (log.resourceId && log.resourceId.toLowerCase().includes(searchLower)) ||
        log.userId.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLogs(filtered);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      resourceType: '',
      startDate: '',
      endDate: '',
      search: ''
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return '✅';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      case 'login': return '🔐';
      case 'logout': return '🚪';
      case 'export': return '📤';
      case 'import': return '📥';
      default: return '📝';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-green-600 dark:text-green-400';
      case 'update': return 'text-gray-600 dark:text-gray-500';
      case 'delete': return 'text-red-600 dark:text-red-400';
      case 'login': return 'text-purple-600 dark:text-purple-400';
      case 'logout': return 'text-gray-600 dark:text-gray-400';
      case 'export': return 'text-orange-600 dark:text-orange-400';
      case 'import': return 'text-indigo-600 dark:text-indigo-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatChanges = (changes: Record<string, unknown> | undefined) => {
    if (!changes) return null;
    
    const changeKeys = Object.keys(changes);
    if (changeKeys.length === 0) return null;
    
    if (changeKeys.length === 1) {
      return `Changed ${changeKeys[0]}`;
    }
    
    return `Changed ${changeKeys.length} fields`;
  };

  // Define table columns
  const columns = useMemo<Column<unknown>[]>(() => [
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: '180px',
      accessor: (log) => {
        const auditLog = log as AuditLog;
        return (
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {auditLog.timestamp.toLocaleDateString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {auditLog.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        );
      },
      sortable: true
    },
    {
      key: 'action',
      header: 'Action',
      width: '120px',
      accessor: (log) => {
        const auditLog = log as AuditLog;
        return (
          <div className="flex items-center gap-2">
            <span className="text-lg">{getActionIcon(auditLog.action)}</span>
            <span className={`text-sm font-medium capitalize ${getActionColor(auditLog.action)}`}>
              {auditLog.action}
            </span>
          </div>
        );
      },
      sortable: true
    },
    {
      key: 'resource',
      header: 'Resource',
      width: '180px',
      accessor: (log) => {
        const auditLog = log as AuditLog;
        return (
          <div className="flex items-center gap-2">
            <DatabaseIcon size={16} className="text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                {auditLog.resourceType}
              </div>
              {auditLog.resourceId && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ID: {auditLog.resourceId}
                </div>
              )}
            </div>
          </div>
        );
      },
      sortable: true
    },
    {
      key: 'user',
      header: 'User',
      width: '150px',
      accessor: (log) => {
        const auditLog = log as AuditLog;
        return (
          <div className="flex items-center gap-2">
            <UserIcon size={16} className="text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">
              {auditLog.userId}
            </span>
          </div>
        );
      }
    },
    {
      key: 'changes',
      header: 'Changes',
      accessor: (log) => {
        const auditLog = log as AuditLog;
        return (
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {formatChanges(auditLog.changes) || '—'}
            </div>
            {auditLog.ipAddress && (
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                IP: {auditLog.ipAddress}
              </div>
            )}
          </div>
        );
      }
    }
  ], []);

  return (
    <PageWrapper
      title="Audit Logs"
      subtitle="Complete history of all system activities and changes"
      icon={<FileTextIcon size={32} className="text-white" />}
    >
      <div className="max-w-7xl mx-auto">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FilterIcon size={20} className="text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <SearchIcon size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search logs..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Action */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="export">Export</option>
                <option value="import">Import</option>
              </select>
            </div>

            {/* Resource Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resource Type
              </label>
              <select
                value={filters.resourceType}
                onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="transaction">Transaction</option>
                <option value="account">Account</option>
                <option value="budget">Budget</option>
                <option value="goal">Goal</option>
                <option value="investment">Investment</option>
                <option value="settings">Settings</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Clear Filters
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
          </div>
        </div>

        {/* Logs Table */}
        <div style={{ height: '600px' }}>
          <VirtualizedTable
            items={filteredLogs}
            columns={columns}
            getItemKey={(log) => (log as AuditLog).id}
            rowHeight={80}
            emptyMessage={
              logs.length === 0 
                ? 'No activities have been logged yet'
                : 'Try adjusting your filters to see more results'
            }
            threshold={50}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
