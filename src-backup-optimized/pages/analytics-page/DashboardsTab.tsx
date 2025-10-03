import { memo, useState } from 'react';
import { PlusIcon, EditIcon, TrashIcon, GridIcon } from '../../components/icons';
import DashboardBuilder, { Dashboard as BuilderDashboard } from '../../components/analytics/DashboardBuilder';
import type { Dashboard, Widget, LayoutItem } from './types';

interface DashboardsTabProps {
  dashboards: Dashboard[];
  activeDashboard: Dashboard | null;
  onSelectDashboard: (dashboard: Dashboard) => void;
  onSaveDashboard: (dashboard: Dashboard) => void;
  onDeleteDashboard: (id: string) => void;
}

/**
 * Tab for managing and viewing analytics dashboards
 * Allows creation, editing, and deletion of custom dashboards
 */
export const DashboardsTab = memo(function DashboardsTab({
  dashboards,
  activeDashboard,
  onSelectDashboard,
  onSaveDashboard,
  onDeleteDashboard
}: DashboardsTabProps) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);

  const handleCreateDashboard = () => {
    const newDashboard: Dashboard = {
      id: crypto.randomUUID(),
      name: 'New Dashboard',
      description: '',
      widgets: [],
      layout: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setEditingDashboard(newDashboard);
    setShowBuilder(true);
  };

  const handleEditDashboard = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setShowBuilder(true);
  };

  const handleSaveDashboard = (dashboard: Dashboard) => {
    if (editingDashboard) {
      const updatedDashboard: Dashboard = {
        ...editingDashboard,
        ...dashboard,
        updatedAt: new Date()
      };
      onSaveDashboard(updatedDashboard);
    } else {
      onSaveDashboard(dashboard);
    }
    setShowBuilder(false);
    setEditingDashboard(null);
  };

  if (showBuilder && editingDashboard) {
    // Map to DashboardBuilder format
    const builderDashboard: BuilderDashboard = {
      id: editingDashboard.id,
      name: editingDashboard.name,
      description: editingDashboard.description,
      createdAt: editingDashboard.createdAt,
      updatedAt: editingDashboard.updatedAt,
      settings: editingDashboard.settings || {
        columns: 12,
        rowHeight: 60,
        theme: 'auto' as const,
        autoRefresh: false,
        refreshInterval: 300000
      },
      widgets: editingDashboard.widgets.map((widget, index) => ({
        id: widget.id,
        type: widget.type as string,
        title: widget.title,
        config: widget.config || {},
        layout: editingDashboard.layout?.[index] ? {
          x: editingDashboard.layout[index].x,
          y: editingDashboard.layout[index].y,
          w: editingDashboard.layout[index].w,
          h: editingDashboard.layout[index].h
        } : {
          x: 0,
          y: 0,
          w: 4,
          h: 3
        }
      }))
    };
    
    return (
      <DashboardBuilder
        dashboard={builderDashboard}
        onSave={(updatedDashboard) => {
          // Map back to analytics-page format
          const mappedDashboard: Dashboard = {
            id: updatedDashboard.id,
            name: updatedDashboard.name,
            description: updatedDashboard.description || '',
            createdAt: updatedDashboard.createdAt,
            updatedAt: updatedDashboard.updatedAt,
            settings: updatedDashboard.settings,
            widgets: updatedDashboard.widgets.map(w => ({
              id: w.id,
              type: w.type as 'chart' | 'metric' | 'table' | 'custom',
              title: w.title,
              config: w.config
            })),
            layout: updatedDashboard.widgets.map(w => ({
              i: w.id,
              x: w.layout.x,
              y: w.layout.y,
              w: w.layout.w,
              h: w.layout.h
            }))
          };
          handleSaveDashboard(mappedDashboard);
        }}
        onClose={() => {
          setShowBuilder(false);
          setEditingDashboard(null);
        }}
      />
    );
  }

  if (dashboards.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
        <GridIcon size={48} className="text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Dashboards Yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Create a custom dashboard to visualize your financial data
        </p>
        <button
          onClick={handleCreateDashboard}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <PlusIcon size={20} className="mr-2" />
          Create Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Your Dashboards
        </h3>
        <button
          onClick={handleCreateDashboard}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <PlusIcon size={20} className="mr-2" />
          New Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboards.map((dashboard) => (
          <div
            key={dashboard.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 p-6 cursor-pointer transition-all hover:shadow-md ${
              activeDashboard?.id === dashboard.id
                ? 'border-blue-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => onSelectDashboard(dashboard)}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {dashboard.name}
                </h4>
                {dashboard.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {dashboard.description}
                  </p>
                )}
              </div>
              <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleEditDashboard(dashboard)}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Edit Dashboard"
                >
                  <EditIcon size={20} />
                </button>
                <button
                  onClick={() => onDeleteDashboard(dashboard.id)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  title="Delete Dashboard"
                >
                  <TrashIcon size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Widgets:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {dashboard.widgets.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {new Date(dashboard.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeDashboard && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {activeDashboard.name}
          </h3>
          <DashboardBuilder
            dashboard={{
              ...activeDashboard,
              settings: {},
              widgets: (activeDashboard.widgets || []).map(w => ({
                id: w.id,
                type: w.type,
                title: w.title,
                config: w.config || {},
                layout: w.position ? {
                  x: w.position.x,
                  y: w.position.y,
                  w: w.position.w,
                  h: w.position.h
                } : { x: 0, y: 0, w: 2, h: 2 }
              }))
            }}
            onSave={(builderDashboard) => {
              const dashboard: Dashboard = {
                ...activeDashboard,
                name: builderDashboard.name,
                description: builderDashboard.description || '',
                widgets: builderDashboard.widgets.map(w => ({
                  id: w.id,
                  type: w.type,
                  title: w.title,
                  data: undefined,
                  config: w.config,
                  position: {
                    x: w.layout.x,
                    y: w.layout.y,
                    w: w.layout.w,
                    h: w.layout.h
                  }
                })),
                updatedAt: new Date()
              };
              handleSaveDashboard(dashboard);
            }}
            readOnly
          />
        </div>
      )}
    </div>
  );
});